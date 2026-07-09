from __future__ import annotations
import re

import pandas as pd
from sqlalchemy import create_engine, text

from config import get_settings

settings = get_settings()

_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|call|merge|copy|vacuum|reindex)\b",
    re.IGNORECASE,
)

DIALECT_DRIVERS = {
    "postgresql": "postgresql+psycopg2",
    "mysql": "mysql+pymysql",
}


def _validate_query(query: str) -> str:
    stripped = query.strip().rstrip(";")
    if ";" in stripped:
        raise ValueError("Only a single statement is allowed.")
    if not re.match(r"^(select|with)\b", stripped, re.IGNORECASE):
        raise ValueError("Only SELECT (or WITH ... SELECT) queries are allowed.")
    if _FORBIDDEN.search(stripped):
        raise ValueError("Query contains a disallowed keyword. Only read queries are allowed.")
    return stripped


def _build_url(dialect: str, uri: str) -> str:
    driver = DIALECT_DRIVERS.get(dialect)
    if not driver:
        raise ValueError(f"Unsupported dialect: {dialect}")
    # Allow either a bare "postgresql://..." / "mysql://..." URI or one that
    # already specifies the driver.
    if "+" not in uri.split("://", 1)[0]:
        scheme, rest = uri.split("://", 1)
        uri = f"{driver}://{rest}"
    return uri


def run_query(dialect: str, uri: str, query: str, row_limit: int | None = None) -> pd.DataFrame:
    stripped = _validate_query(query)
    limit = row_limit or settings.live_query_row_limit
    url = _build_url(dialect, uri)

    connect_args = {"connect_timeout": settings.live_query_timeout_seconds} if dialect == "mysql" else {
        "connect_timeout": settings.live_query_timeout_seconds
    }

    engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)
    try:
        wrapped = text(f"SELECT * FROM ({stripped}) AS _sub LIMIT {int(limit)}")
        with engine.connect() as conn:
            if dialect == "postgresql":
                conn = conn.execution_options(postgresql_readonly=True)
            conn = conn.execution_options(stream_results=True)
            df = pd.read_sql(wrapped, conn)
    finally:
        engine.dispose()

    return df
