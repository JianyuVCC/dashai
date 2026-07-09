import uuid

from services.supabase_client import get_service_client

BUCKET = "datasets"


def save_file(user_id: str, content: bytes, filename: str) -> str:
    """Uploads to Storage under a per-user folder; returns the storage path."""
    path = f"{user_id}/{uuid.uuid4()}_{filename}"
    get_service_client().storage.from_(BUCKET).upload(
        path, content, {"content-type": "application/octet-stream"}
    )
    return path


def load_file(path: str) -> bytes:
    return get_service_client().storage.from_(BUCKET).download(path)


def delete_file(path: str) -> None:
    get_service_client().storage.from_(BUCKET).remove([path])
