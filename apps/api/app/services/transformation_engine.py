"""Transformation Engine
=======================
Executes declarative transformation pipelines described in YAML/JSON.
Each step has `action` field plus parameters.  Supported actions (MVP):
  - drop_columns: {columns: ["col1", "col2"]}
  - rename_columns: {mapping: {old: new}}
  - fillna: {columns: ["col"], value: 0}
  - convert_dtype: {column: "col", dtype: "datetime"|"int"|"float"|"str"}
  - filter_rows: {expr: "column > 0"} (uses `df.query`)
  - map_values: {column: "col", mapping: {old: new}}
Extensible by adding functions to ACTION_REGISTRY.
"""

from __future__ import annotations

import logging
from typing import Dict, Any, Callable, List

import pandas as pd
import yaml

logger = logging.getLogger(__name__)

class TransformationError(Exception):
    pass


class TransformationEngine:
    ACTION_REGISTRY: Dict[str, Callable[[pd.DataFrame, Dict[str, Any]], pd.DataFrame]] = {}

    def __init__(self):
        if not self.ACTION_REGISTRY:
            self._register_default_actions()

    # -------------------- PUBLIC API --------------------
    def apply_from_yaml(self, df: pd.DataFrame, spec_yaml: str) -> pd.DataFrame:
        try:
            spec = yaml.safe_load(spec_yaml)
            return self.apply(df, spec)
        except yaml.YAMLError as e:
            raise TransformationError(f"Invalid YAML spec: {e}") from e

    def apply(self, df: pd.DataFrame, spec: List[Dict[str, Any]]) -> pd.DataFrame:
        current = df.copy()
        for idx, step in enumerate(spec):
            action = step.get("action")
            if not action or action not in self.ACTION_REGISTRY:
                raise TransformationError(f"Unknown or missing action at step {idx}: {action}")
            logger.debug("Applying transformation step %s: %s", idx, action)
            current = self.ACTION_REGISTRY[action](current, step)
        return current

    # -------------------- Default actions --------------------
    def _register_default_actions(self):
        self.ACTION_REGISTRY = {
            "drop_columns": self._drop_columns,
            "rename_columns": self._rename_columns,
            "fillna": self._fillna,
            "convert_dtype": self._convert_dtype,
            "filter_rows": self._filter_rows,
            "map_values": self._map_values,
        }

    @staticmethod
    def _drop_columns(df: pd.DataFrame, params: Dict[str, Any]):
        cols = params.get("columns", [])
        return df.drop(columns=cols, errors="ignore")

    @staticmethod
    def _rename_columns(df: pd.DataFrame, params: Dict[str, Any]):
        mapping = params.get("mapping", {})
        return df.rename(columns=mapping)

    @staticmethod
    def _fillna(df: pd.DataFrame, params: Dict[str, Any]):
        columns = params.get("columns")
        value = params.get("value")
        if columns:
            return df.fillna({col: value for col in columns})
        return df.fillna(value)

    @staticmethod
    def _convert_dtype(df: pd.DataFrame, params: Dict[str, Any]):
        column = params.get("column")
        dtype = params.get("dtype")
        if not column or not dtype:
            return df
        try:
            if dtype == "datetime":
                df[column] = pd.to_datetime(df[column], errors="coerce")
            else:
                df[column] = df[column].astype(dtype, errors="ignore")
        except Exception as e:
            logger.warning("dtype conversion failed for %s: %s", column, e)
        return df

    @staticmethod
    def _filter_rows(df: pd.DataFrame, params: Dict[str, Any]):
        expr = params.get("expr")
        if not expr:
            return df
        return df.query(expr)

    @staticmethod
    def _map_values(df: pd.DataFrame, params: Dict[str, Any]):
        column = params.get("column")
        mapping = params.get("mapping", {})
        if column and mapping:
            df[column] = df[column].map(mapping).fillna(df[column])
        return df 