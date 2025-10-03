"""
Rust-Python bridge for high-performance data preprocessing
Connects Rust Polars kernels with Python ML frameworks via Arrow IPC
"""

import pyarrow as pa
import pyarrow.parquet as pq
from typing import Dict, Any, Optional, List
import tempfile
import os
from pathlib import Path
import time

from app.core.logging_config import get_logger
from app.core.metrics import metrics_collector

logger = get_logger(__name__)


class RustPreprocessingBridge:
    """
    Bridge between Rust preprocessing kernels and Python ML frameworks
    Uses Arrow IPC for zero-copy data transfer
    """

    def __init__(self):
        self.rust_kernels = None
        self._load_rust_kernels()

    def _load_rust_kernels(self):
        """Load Rust compute kernels with Polars support"""
        try:
            import schlep_compute_kernels
            self.rust_kernels = schlep_compute_kernels
            logger.info("Rust compute kernels loaded successfully")
        except ImportError as e:
            logger.warning(f"Failed to load Rust kernels: {e}. Using Python fallback.")
            self.rust_kernels = None

    async def load_dataset(
        self,
        file_path: str,
        format: str = "csv"
    ) -> pa.Table:
        """
        Load dataset using Rust Polars and return PyArrow Table

        Args:
            file_path: Path to dataset file
            format: File format (csv, parquet, json)

        Returns:
            PyArrow Table with zero-copy transfer from Rust
        """
        start_time = time.time()

        if not self.rust_kernels:
            # Fallback to PyArrow native loading
            return self._fallback_load(file_path, format)

        try:
            # Load via Rust Polars kernel (returns Arrow IPC bytes)
            arrow_bytes = self.rust_kernels.load_dataset_to_arrow(
                file_path=file_path,
                format=format
            )

            # Convert Arrow IPC bytes to PyArrow Table (zero-copy)
            reader = pa.ipc.open_stream(arrow_bytes)
            table = reader.read_all()

            load_time = (time.time() - start_time) * 1000
            logger.info(
                f"Loaded dataset via Rust: {table.num_rows} rows, "
                f"{table.num_columns} cols in {load_time:.2f}ms"
            )

            # Record metrics
            metrics_collector.record_business_event(
                "rust_dataset_load",
                metadata={
                    "rows": table.num_rows,
                    "columns": table.num_columns,
                    "load_time_ms": load_time,
                    "format": format
                }
            )

            return table

        except Exception as e:
            logger.error(f"Rust load failed: {e}. Using Python fallback.")
            return self._fallback_load(file_path, format)

    def _fallback_load(self, file_path: str, format: str) -> pa.Table:
        """Fallback dataset loading using PyArrow"""
        if format == "csv":
            return pa.csv.read_csv(file_path)
        elif format == "parquet":
            return pq.read_table(file_path)
        elif format == "json":
            import json
            import pandas as pd
            df = pd.read_json(file_path, lines=True)
            return pa.Table.from_pandas(df)
        else:
            raise ValueError(f"Unsupported format: {format}")

    async def deduplicate(
        self,
        file_path: str,
        columns: List[str] = None,
        format: str = "csv"
    ) -> pa.Table:
        """
        Deduplicate dataset using Rust hash-based parallel processing

        Args:
            file_path: Path to dataset
            columns: Columns to use for deduplication (None = all columns)
            format: File format

        Returns:
            Deduplicated PyArrow Table
        """
        if not self.rust_kernels:
            table = await self.load_dataset(file_path, format)
            # Fallback: Use PyArrow native deduplication
            return table.drop_duplicates()

        try:
            start_time = time.time()

            # Deduplicate via Rust Polars
            arrow_bytes = self.rust_kernels.deduplicate_dataset(
                file_path=file_path,
                columns=columns or [],
                format=format
            )

            # Convert to PyArrow Table
            reader = pa.ipc.open_stream(arrow_bytes)
            table = reader.read_all()

            dedup_time = (time.time() - start_time) * 1000
            logger.info(f"Deduplicated dataset in {dedup_time:.2f}ms: {table.num_rows} rows")

            metrics_collector.record_business_event(
                "rust_deduplication",
                metadata={
                    "rows": table.num_rows,
                    "dedup_time_ms": dedup_time
                }
            )

            return table

        except Exception as e:
            logger.error(f"Rust deduplication failed: {e}")
            raise

    async def join_datasets(
        self,
        left_path: str,
        right_path: str,
        left_on: List[str],
        right_on: List[str],
        how: str = "inner",
        format: str = "csv"
    ) -> pa.Table:
        """
        Join datasets using Rust high-performance hash join

        Args:
            left_path: Path to left dataset
            right_path: Path to right dataset
            left_on: Left join keys
            right_on: Right join keys
            how: Join type (inner, left, outer)
            format: File format

        Returns:
            Joined PyArrow Table
        """
        if not self.rust_kernels:
            raise NotImplementedError("Join operation requires Rust kernels")

        try:
            start_time = time.time()

            # Join via Rust Polars
            arrow_bytes = self.rust_kernels.join_datasets(
                left_path=left_path,
                right_path=right_path,
                left_on=left_on,
                right_on=right_on,
                how=how,
                format=format
            )

            # Convert to PyArrow Table
            reader = pa.ipc.open_stream(arrow_bytes)
            table = reader.read_all()

            join_time = (time.time() - start_time) * 1000
            logger.info(f"Joined datasets in {join_time:.2f}ms: {table.num_rows} rows")

            metrics_collector.record_business_event(
                "rust_join",
                metadata={
                    "rows": table.num_rows,
                    "join_type": how,
                    "join_time_ms": join_time
                }
            )

            return table

        except Exception as e:
            logger.error(f"Rust join failed: {e}")
            raise

    async def tokenize_text(
        self,
        file_path: str,
        column: str,
        lowercase: bool = True,
        remove_punctuation: bool = True
    ) -> pa.Table:
        """
        Tokenize text column using Rust parallel processing

        Args:
            file_path: Path to dataset
            column: Text column to tokenize
            lowercase: Convert to lowercase
            remove_punctuation: Remove punctuation

        Returns:
            PyArrow Table with tokenized text
        """
        if not self.rust_kernels:
            raise NotImplementedError("Tokenization requires Rust kernels")

        try:
            start_time = time.time()

            # Tokenize via Rust
            arrow_bytes = self.rust_kernels.tokenize_column(
                file_path=file_path,
                column=column,
                lowercase=lowercase,
                remove_punctuation=remove_punctuation
            )

            # Convert to PyArrow Table
            reader = pa.ipc.open_stream(arrow_bytes)
            table = reader.read_all()

            tokenize_time = (time.time() - start_time) * 1000
            logger.info(f"Tokenized column '{column}' in {tokenize_time:.2f}ms")

            return table

        except Exception as e:
            logger.error(f"Rust tokenization failed: {e}")
            raise

    async def get_dataset_stats(
        self,
        file_path: str,
        format: str = "csv"
    ) -> Dict[str, Any]:
        """
        Get dataset statistics using Rust Polars

        Args:
            file_path: Path to dataset
            format: File format

        Returns:
            Dictionary with dataset statistics
        """
        if not self.rust_kernels:
            table = await self.load_dataset(file_path, format)
            return {
                "rows": table.num_rows,
                "columns": table.num_columns,
                "schema": {col: str(table.schema.field(col).type) for col in table.column_names},
                "memory_usage_mb": table.nbytes / (1024 * 1024)
            }

        try:
            stats = self.rust_kernels.get_dataset_stats(
                file_path=file_path,
                format=format
            )
            return stats

        except Exception as e:
            logger.error(f"Failed to get dataset stats: {e}")
            raise


# Global bridge instance
rust_bridge = RustPreprocessingBridge()


async def process_dataset_with_rust(
    file_path: str,
    format: str,
    dataset_name: str,
    apply_preprocessing: bool = True,
    deduplication: bool = False,
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main entry point for Rust-accelerated dataset processing

    Args:
        file_path: Path to dataset file
        format: File format
        dataset_name: Name for the dataset
        apply_preprocessing: Apply Rust preprocessing kernels
        deduplication: Enable deduplication
        job_id: Optional job ID for tracking

    Returns:
        Processing result with metadata
    """
    try:
        start_time = time.time()

        # Load dataset via Rust
        table = await rust_bridge.load_dataset(file_path, format)

        # Apply preprocessing if requested
        if apply_preprocessing:
            # Get dataset statistics
            stats = await rust_bridge.get_dataset_stats(file_path, format)

            # Apply deduplication if requested
            if deduplication:
                table = await rust_bridge.deduplicate(file_path, format=format)

        # Save processed dataset (optional)
        output_path = f"/tmp/{dataset_name}_processed.parquet"
        pq.write_table(table, output_path)

        processing_time = (time.time() - start_time) * 1000

        result = {
            "job_id": job_id or "sync",
            "dataset_name": dataset_name,
            "rows_ingested": table.num_rows,
            "columns": table.num_columns,
            "memory_usage_mb": table.nbytes / (1024 * 1024),
            "processing_time_ms": processing_time,
            "arrow_schema": {
                col: str(table.schema.field(col).type)
                for col in table.column_names
            },
            "output_path": output_path
        }

        logger.info(f"Dataset processing completed: {result}")
        return result

    except Exception as e:
        logger.error(f"Dataset processing failed: {e}")
        raise
