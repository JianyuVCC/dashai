from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DatasetMeta(BaseModel):
    id: str
    filename: str
    source_type: str
    rows: int
    columns: list[str]
    dtypes: dict[str, str]
    preview: list[dict[str, Any]]
    created_at: datetime


class ChartConfig(BaseModel):
    id: str
    type: str  # bar, line, pie, scatter, area, table
    title: str
    x_column: str | None = None
    y_column: str | None = None
    y_columns: list[str] | None = None
    color_column: str | None = None
    aggregation: str | None = None  # sum, count, mean, max, min
    filters: dict[str, Any] | None = None
    options: dict[str, Any] | None = None


class Dashboard(BaseModel):
    id: str
    title: str
    dataset_id: str
    charts: list[ChartConfig]
    layout: list[dict[str, Any]]
    is_public: bool = False
    public_slug: str | None = None
    created_at: datetime
    updated_at: datetime
    description: str = ""


class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    message: str
    dashboard: Dashboard | None = None


class CreateDashboardRequest(BaseModel):
    dataset_id: str
    user_prompt: str = ""


class ConnectDatabaseRequest(BaseModel):
    dialect: str  # postgresql | mysql
    connection_uri: str
    query: str
    name: str | None = None
    save_connection: bool = False


class SavedConnection(BaseModel):
    id: str
    name: str
    dialect: str
    created_at: datetime


class PublishResponse(BaseModel):
    is_public: bool
    public_slug: str | None
