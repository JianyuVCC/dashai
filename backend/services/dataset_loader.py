import pandas as pd

from services.data_parser import dataframe_summary, parse_bytes
from services.storage import load_file


def load_dataframe(dataset_row: dict) -> pd.DataFrame:
    content = load_file(dataset_row["storage_path"])
    return parse_bytes(content, dataset_row["filename"])


def full_summary(dataset_row: dict) -> dict:
    """Recomputes numeric/categorical/datetime column lists from the live data
    (the DB row's `summary` column already has these, but this stays correct
    even if the stored summary predates a schema tweak)."""
    df = load_dataframe(dataset_row)
    return dataframe_summary(df)
