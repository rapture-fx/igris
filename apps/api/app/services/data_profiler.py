"""
DataProfiler Service
--------------------
Provides quick, lightweight dataset profiling to support *Schlep Wrangler*.
If the optional dependency `ydata-profiling` (formerly pandas-profiling) is
installed it will be used; otherwise falls back to custom statistics.
"""
from __future__ import annotations

import logging
from typing import Dict, Any, List

import pandas as pd

try:
    from ydata_profiling import ProfileReport  # type: ignore
    _HAS_PROFILER = True
except ImportError:  # pragma: no cover
    _HAS_PROFILER = False

logger = logging.getLogger(__name__)


class DataProfiler:
    """Utility class for dataframe profiling & anomaly detection."""

    def __init__(self, sample_size: int | None = 50_000):
        self.sample_size = sample_size

    def profile(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Return a JSON-serialisable summary of the dataframe."""
        logger.info("Starting dataset profiling (rows=%s, cols=%s)", len(df), df.shape[1])

        if _HAS_PROFILER:
            logger.debug("Using ydata-profiling backend")
            profile = ProfileReport(df.sample(n=min(len(df), self.sample_size)))
            return profile.to_json()

        # --- Custom lightweight fallback (no heavy HTML/JSON dump) ---
        summary: Dict[str, Any] = {
            "shape": df.shape,
            "columns": {},
            "missing": df.isna().sum().sum(),
        }
        for col in df.columns:
            series = df[col]
            col_summary: Dict[str, Any] = {
                "dtype": str(series.dtype),
                "missing_count": int(series.isna().sum()),
            }
            if pd.api.types.is_numeric_dtype(series):
                col_summary.update({
                    "mean": float(series.mean()),
                    "std": float(series.std()),
                    "min": float(series.min()),
                    "max": float(series.max()),
                })
                # Simple anomaly detection: z-score >3 or <-3
                z_scores = ((series - series.mean()) / (series.std() or 1)).abs()
                col_summary["outliers"] = int((z_scores > 3).sum())
            elif pd.api.types.is_datetime64_any_dtype(series):
                col_summary.update({
                    "min": str(series.min()),
                    "max": str(series.max()),
                })
            else:
                col_summary["unique"] = int(series.nunique())

            summary["columns"][col] = col_summary

        return summary 