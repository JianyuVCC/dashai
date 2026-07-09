from __future__ import annotations
import io
import sqlite3
import tempfile
from pathlib import Path
from typing import Any

import pandas as pd

SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".parquet", ".tsv", ".db", ".sqlite", ".sqlite3"}


def _coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.columns:
        if df[col].dtype == object:
            try:
                df[col] = pd.to_numeric(df[col])
                continue
            except (ValueError, TypeError):
                pass
        if df[col].dtype == object and "date" in col.lower():
            try:
                df[col] = pd.to_datetime(df[col])
            except Exception:
                pass
    return df


def _parse_sqlite_bytes(content: bytes) -> pd.DataFrame:
    with tempfile.NamedTemporaryFile(suffix=".sqlite") as tmp:
        tmp.write(content)
        tmp.flush()
        conn = sqlite3.connect(tmp.name)
        try:
            tables = pd.read_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", conn
            )["name"].tolist()
            if not tables:
                raise ValueError("No tables found in SQLite file.")
            best_table, best_count = tables[0], -1
            for t in tables:
                count = conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
                if count > best_count:
                    best_table, best_count = t, count
            return pd.read_sql(f'SELECT * FROM "{best_table}"', conn)
        finally:
            conn.close()


def parse_bytes(content: bytes, filename: str) -> pd.DataFrame:
    ext = Path(filename).suffix.lower()
    buf = io.BytesIO(content)

    if ext == ".csv":
        df = pd.read_csv(buf)
    elif ext == ".tsv":
        df = pd.read_csv(buf, sep="\t")
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(buf)
    elif ext == ".json":
        df = pd.read_json(buf)
    elif ext == ".parquet":
        df = pd.read_parquet(buf)
    elif ext in (".db", ".sqlite", ".sqlite3"):
        df = _parse_sqlite_bytes(content)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return _coerce_types(df)


def dataframe_to_parquet_bytes(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    df.to_parquet(buf, index=False)
    return buf.getvalue()


def dataframe_summary(df: pd.DataFrame, preview_rows: int = 5) -> dict[str, Any]:
    return {
        "rows": len(df),
        "columns": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "preview": df.head(preview_rows).fillna("").to_dict(orient="records"),
        "numeric_columns": df.select_dtypes(include="number").columns.tolist(),
        "categorical_columns": df.select_dtypes(include=["object", "category"]).columns.tolist(),
        "datetime_columns": df.select_dtypes(include="datetime").columns.tolist(),
    }


def aggregate_data(
    df: pd.DataFrame,
    x_column: str | None,
    y_column: str | None,
    y_columns: list[str] | None,
    aggregation: str | None,
    filters: dict | None,
    limit: int = 500,
) -> list[dict]:
    if filters:
        for col, val in filters.items():
            if col in df.columns:
                df = df[df[col] == val]

    targets = y_columns if y_columns else ([y_column] if y_column else [])

    if x_column and targets and aggregation:
        agg_map = {
            "sum": "sum", "mean": "mean", "count": "count",
            "max": "max", "min": "min", "median": "median",
        }
        func = agg_map.get(aggregation, "sum")
        result = df.groupby(x_column)[targets].agg(func).reset_index()
        return result.head(limit).fillna(0).to_dict(orient="records")

    cols = ([x_column] if x_column else []) + [c for c in targets if c]
    cols = [c for c in cols if c in df.columns] or df.columns.tolist()
    return df[cols].head(limit).fillna("").to_dict(orient="records")
