from __future__ import annotations
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth import CurrentUser, get_current_user
from config import get_settings
from models.schemas import ConnectDatabaseRequest, DatasetMeta, SavedConnection
from services import db
from services.crypto import decrypt, encrypt
from services.data_parser import (
    SUPPORTED_EXTENSIONS,
    dataframe_summary,
    dataframe_to_parquet_bytes,
    parse_bytes,
)
from services.db_connector import run_query
from services.storage import delete_file, save_file

router = APIRouter(prefix="/datasets", tags=["datasets"])
settings = get_settings()
MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024


def _meta(row: dict) -> DatasetMeta:
    return DatasetMeta(
        id=row["id"],
        filename=row["filename"],
        source_type=row["source_type"],
        rows=row["rows"],
        columns=row["columns"],
        dtypes=row["dtypes"],
        preview=row["preview"],
        created_at=row["created_at"],
    )


@router.post("", response_model=DatasetMeta)
async def upload_dataset(
    file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type. Supported: {sorted(SUPPORTED_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, f"File too large (max {settings.max_upload_size_mb} MB)")

    try:
        df = parse_bytes(content, file.filename)
    except Exception as e:
        raise HTTPException(422, f"Failed to parse file: {e}")

    storage_path = save_file(user.id, content, file.filename)
    summary = dataframe_summary(df)

    row = db.create_dataset({
        "user_id": user.id,
        "filename": file.filename,
        "source_type": "file",
        "storage_path": storage_path,
        "rows": summary["rows"],
        "columns": summary["columns"],
        "dtypes": summary["dtypes"],
        "preview": summary["preview"],
        "summary": {k: v for k, v in summary.items() if k not in ("preview",)},
    })
    return _meta(row)


@router.post("/connect", response_model=DatasetMeta)
async def connect_database(
    req: ConnectDatabaseRequest, user: CurrentUser = Depends(get_current_user)
):
    try:
        df = run_query(req.dialect, req.connection_uri, req.query)
    except Exception as e:
        raise HTTPException(422, f"Query failed: {e}")

    filename = (req.name or "database_query") + ".parquet"
    content = dataframe_to_parquet_bytes(df)
    storage_path = save_file(user.id, content, filename)
    summary = dataframe_summary(df)

    connection_id = None
    if req.save_connection:
        saved = db.create_db_connection({
            "user_id": user.id,
            "name": req.name or "Saved connection",
            "dialect": req.dialect,
            "encrypted_uri": encrypt(req.connection_uri),
        })
        connection_id = saved["id"]

    row = db.create_dataset({
        "user_id": user.id,
        "filename": filename,
        "source_type": "database",
        "storage_path": storage_path,
        "connection_id": connection_id,
        "source_query": req.query,
        "rows": summary["rows"],
        "columns": summary["columns"],
        "dtypes": summary["dtypes"],
        "preview": summary["preview"],
        "summary": {k: v for k, v in summary.items() if k not in ("preview",)},
    })
    return _meta(row)


@router.get("", response_model=list[DatasetMeta])
async def list_datasets(user: CurrentUser = Depends(get_current_user)):
    return [_meta(r) for r in db.list_datasets(user.id)]


@router.get("/{dataset_id}", response_model=DatasetMeta)
async def get_dataset(dataset_id: str, user: CurrentUser = Depends(get_current_user)):
    row = db.get_dataset(dataset_id, user.id)
    if not row:
        raise HTTPException(404, "Dataset not found")
    return _meta(row)


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, user: CurrentUser = Depends(get_current_user)):
    row = db.get_dataset(dataset_id, user.id)
    if not row:
        raise HTTPException(404, "Dataset not found")
    if row.get("storage_path"):
        try:
            delete_file(row["storage_path"])
        except Exception:
            pass
    db.delete_dataset(dataset_id, user.id)
    return {"deleted": True}


@router.get("/connections/saved", response_model=list[SavedConnection])
async def list_saved_connections(user: CurrentUser = Depends(get_current_user)):
    return db.list_db_connections(user.id)


@router.delete("/connections/saved/{connection_id}")
async def delete_saved_connection(connection_id: str, user: CurrentUser = Depends(get_current_user)):
    if not db.delete_db_connection(connection_id, user.id):
        raise HTTPException(404, "Connection not found")
    return {"deleted": True}


@router.post("/{dataset_id}/refresh", response_model=DatasetMeta)
async def refresh_dataset(dataset_id: str, user: CurrentUser = Depends(get_current_user)):
    row = db.get_dataset(dataset_id, user.id)
    if not row:
        raise HTTPException(404, "Dataset not found")
    if row["source_type"] != "database" or not row.get("connection_id"):
        raise HTTPException(400, "This dataset has no saved connection to refresh from")

    conn = db.get_db_connection(row["connection_id"], user.id)
    if not conn:
        raise HTTPException(404, "Saved connection not found")

    try:
        df = run_query(conn["dialect"], decrypt(conn["encrypted_uri"]), row["source_query"])
    except Exception as e:
        raise HTTPException(422, f"Query failed: {e}")

    content = dataframe_to_parquet_bytes(df)
    new_storage_path = save_file(user.id, content, row["filename"])
    summary = dataframe_summary(df)

    from services.supabase_client import get_service_client

    get_service_client().table("datasets").update({
        "storage_path": new_storage_path,
        "rows": summary["rows"],
        "columns": summary["columns"],
        "dtypes": summary["dtypes"],
        "preview": summary["preview"],
        "summary": {k: v for k, v in summary.items() if k not in ("preview",)},
    }).eq("id", dataset_id).eq("user_id", user.id).execute()

    old_path = row.get("storage_path")
    if old_path:
        try:
            delete_file(old_path)
        except Exception:
            pass

    refreshed = db.get_dataset(dataset_id, user.id)
    return _meta(refreshed)
