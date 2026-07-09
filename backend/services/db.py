from __future__ import annotations
import secrets
from typing import Any

from services.supabase_client import get_service_client


def _sb():
    return get_service_client()


# --------------------------------------------------------------------------
# datasets
# --------------------------------------------------------------------------

def create_dataset(row: dict[str, Any]) -> dict[str, Any]:
    res = _sb().table("datasets").insert(row).execute()
    return res.data[0]


def get_dataset(dataset_id: str, user_id: str) -> dict[str, Any] | None:
    res = _sb().table("datasets").select("*").eq("id", dataset_id).eq("user_id", user_id).limit(1).execute()
    return res.data[0] if res.data else None


def list_datasets(user_id: str) -> list[dict[str, Any]]:
    res = (
        _sb().table("datasets").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    )
    return res.data


def delete_dataset(dataset_id: str, user_id: str) -> bool:
    res = _sb().table("datasets").delete().eq("id", dataset_id).eq("user_id", user_id).execute()
    return len(res.data) > 0


def get_dataset_unowned(dataset_id: str) -> dict[str, Any] | None:
    """No ownership check - callers must independently verify the caller is
    allowed to see this dataset (e.g. it belongs to a dashboard with is_public=True)."""
    res = _sb().table("datasets").select("*").eq("id", dataset_id).limit(1).execute()
    return res.data[0] if res.data else None


# --------------------------------------------------------------------------
# dashboards
# --------------------------------------------------------------------------

def create_dashboard(row: dict[str, Any]) -> dict[str, Any]:
    res = _sb().table("dashboards").insert(row).execute()
    return res.data[0]


def get_dashboard(dashboard_id: str, user_id: str) -> dict[str, Any] | None:
    res = (
        _sb().table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user_id).limit(1).execute()
    )
    return res.data[0] if res.data else None


def get_public_dashboard(slug: str) -> dict[str, Any] | None:
    res = (
        _sb().table("dashboards").select("*").eq("public_slug", slug).eq("is_public", True).limit(1).execute()
    )
    return res.data[0] if res.data else None


def list_dashboards(user_id: str) -> list[dict[str, Any]]:
    res = (
        _sb().table("dashboards").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    )
    return res.data


def update_dashboard(dashboard_id: str, user_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    res = (
        _sb().table("dashboards").update(patch).eq("id", dashboard_id).eq("user_id", user_id).execute()
    )
    return res.data[0] if res.data else None


def delete_dashboard(dashboard_id: str, user_id: str) -> bool:
    res = _sb().table("dashboards").delete().eq("id", dashboard_id).eq("user_id", user_id).execute()
    return len(res.data) > 0


def set_dashboard_public(dashboard_id: str, user_id: str, public: bool) -> dict[str, Any] | None:
    patch: dict[str, Any] = {"is_public": public}
    if public:
        current = get_dashboard(dashboard_id, user_id)
        if current and not current.get("public_slug"):
            patch["public_slug"] = secrets.token_urlsafe(8)
    return update_dashboard(dashboard_id, user_id, patch)


# --------------------------------------------------------------------------
# db_connections (saved live-database connections)
# --------------------------------------------------------------------------

def create_db_connection(row: dict[str, Any]) -> dict[str, Any]:
    res = _sb().table("db_connections").insert(row).execute()
    return res.data[0]


def get_db_connection(connection_id: str, user_id: str) -> dict[str, Any] | None:
    res = (
        _sb()
        .table("db_connections")
        .select("*")
        .eq("id", connection_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def list_db_connections(user_id: str) -> list[dict[str, Any]]:
    res = (
        _sb()
        .table("db_connections")
        .select("id,name,dialect,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


def delete_db_connection(connection_id: str, user_id: str) -> bool:
    res = (
        _sb().table("db_connections").delete().eq("id", connection_id).eq("user_id", user_id).execute()
    )
    return len(res.data) > 0
