from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query

from models.schemas import ChatRequest, Dashboard
from services import db
from services.ai_service import modify_dashboard
from services.data_parser import aggregate_data
from services.dataset_loader import full_summary, load_dataframe
from services.rate_limit import rate_limit_public_chat

router = APIRouter(prefix="/public/dashboards", tags=["public"])


def _get_public_dashboard(slug: str) -> Dashboard:
    row = db.get_public_dashboard(slug)
    if not row:
        raise HTTPException(404, "Dashboard not found")
    return Dashboard(**row)


@router.get("/{slug}", response_model=Dashboard)
async def get_public_dashboard(slug: str):
    return _get_public_dashboard(slug)


@router.get("/{slug}/chart-data")
async def get_public_chart_data(
    slug: str,
    x_column: str | None = Query(None),
    y_column: str | None = Query(None),
    y_columns: str | None = Query(None),
    aggregation: str | None = Query(None),
    limit: int = Query(500, le=2000),
):
    dashboard = _get_public_dashboard(slug)
    dataset_row = db.get_dataset_unowned(dashboard.dataset_id)
    if not dataset_row:
        raise HTTPException(404, "Dataset not found")

    df = load_dataframe(dataset_row)
    y_cols = y_columns.split(",") if y_columns else None
    data = aggregate_data(df, x_column, y_column, y_cols, aggregation, None, limit)
    return {"data": data}


@router.post("/{slug}/chat", dependencies=[Depends(rate_limit_public_chat)])
async def public_chat(slug: str, req: ChatRequest):
    dashboard = _get_public_dashboard(slug)
    dataset_row = db.get_dataset_unowned(dashboard.dataset_id)
    if not dataset_row:
        raise HTTPException(404, "Dataset not found")

    summary = full_summary(dataset_row)
    reply, _ = await modify_dashboard(
        dashboard, summary, req.message, req.history, allow_modify=False
    )
    return {"message": reply}
