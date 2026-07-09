from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException

from auth import CurrentUser, get_current_user
from models.schemas import (
    ChatRequest,
    ChatResponse,
    CreateDashboardRequest,
    Dashboard,
    PublishResponse,
)
from services import db
from services.ai_service import generate_dashboard, modify_dashboard
from services.dataset_loader import full_summary

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.post("", response_model=Dashboard)
async def create_dashboard(req: CreateDashboardRequest, user: CurrentUser = Depends(get_current_user)):
    dataset_row = db.get_dataset(req.dataset_id, user.id)
    if not dataset_row:
        raise HTTPException(404, "Dataset not found")

    summary = full_summary(dataset_row)
    dashboard = await generate_dashboard(req.dataset_id, summary, req.user_prompt)

    row = db.create_dashboard({
        "id": dashboard.id,
        "user_id": user.id,
        "dataset_id": dashboard.dataset_id,
        "title": dashboard.title,
        "description": dashboard.description,
        "charts": [c.model_dump() for c in dashboard.charts],
        "layout": dashboard.layout,
        "created_at": dashboard.created_at.isoformat(),
        "updated_at": dashboard.updated_at.isoformat(),
    })
    return Dashboard(**row)


@router.get("", response_model=list[Dashboard])
async def list_dashboards(user: CurrentUser = Depends(get_current_user)):
    return [Dashboard(**r) for r in db.list_dashboards(user.id)]


@router.get("/{dashboard_id}", response_model=Dashboard)
async def get_dashboard(dashboard_id: str, user: CurrentUser = Depends(get_current_user)):
    row = db.get_dashboard(dashboard_id, user.id)
    if not row:
        raise HTTPException(404, "Dashboard not found")
    return Dashboard(**row)


@router.delete("/{dashboard_id}")
async def delete_dashboard(dashboard_id: str, user: CurrentUser = Depends(get_current_user)):
    if not db.delete_dashboard(dashboard_id, user.id):
        raise HTTPException(404, "Dashboard not found")
    return {"deleted": True}


@router.post("/{dashboard_id}/publish", response_model=PublishResponse)
async def publish_dashboard(dashboard_id: str, user: CurrentUser = Depends(get_current_user)):
    row = db.set_dashboard_public(dashboard_id, user.id, True)
    if not row:
        raise HTTPException(404, "Dashboard not found")
    return PublishResponse(is_public=row["is_public"], public_slug=row["public_slug"])


@router.post("/{dashboard_id}/unpublish", response_model=PublishResponse)
async def unpublish_dashboard(dashboard_id: str, user: CurrentUser = Depends(get_current_user)):
    row = db.set_dashboard_public(dashboard_id, user.id, False)
    if not row:
        raise HTTPException(404, "Dashboard not found")
    return PublishResponse(is_public=row["is_public"], public_slug=row["public_slug"])


@router.post("/{dashboard_id}/chat", response_model=ChatResponse)
async def chat(dashboard_id: str, req: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    row = db.get_dashboard(dashboard_id, user.id)
    if not row:
        raise HTTPException(404, "Dashboard not found")

    dashboard = Dashboard(**row)
    dataset_row = db.get_dataset(dashboard.dataset_id, user.id)
    if not dataset_row:
        raise HTTPException(404, "Dataset not found")
    summary = full_summary(dataset_row)

    reply, updated = await modify_dashboard(dashboard, summary, req.message, req.history, allow_modify=True)

    if updated:
        db.update_dashboard(dashboard_id, user.id, {
            "title": updated.title,
            "description": updated.description,
            "charts": [c.model_dump() for c in updated.charts],
            "layout": updated.layout,
            "updated_at": updated.updated_at.isoformat(),
        })

    return ChatResponse(message=reply, dashboard=updated)
