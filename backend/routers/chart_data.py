from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query

from auth import CurrentUser, get_current_user
from services import db
from services.data_parser import aggregate_data
from services.dataset_loader import load_dataframe

router = APIRouter(prefix="/chart-data", tags=["chart-data"])


@router.get("/{dataset_id}")
async def get_chart_data(
    dataset_id: str,
    x_column: str | None = Query(None),
    y_column: str | None = Query(None),
    y_columns: str | None = Query(None),
    aggregation: str | None = Query(None),
    limit: int = Query(500, le=2000),
    user: CurrentUser = Depends(get_current_user),
):
    dataset_row = db.get_dataset(dataset_id, user.id)
    if not dataset_row:
        raise HTTPException(404, "Dataset not found")

    df = load_dataframe(dataset_row)
    y_cols = y_columns.split(",") if y_columns else None
    data = aggregate_data(df, x_column, y_column, y_cols, aggregation, None, limit)
    return {"data": data}
