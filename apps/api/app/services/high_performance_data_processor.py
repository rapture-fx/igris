"""
High-Performance Data Processor for Schlep Engine
Polars-first implementation with Pandas fallback for maximum performance
"""

import polars as pl
import pandas as pd
import numpy as np
import time
import logging
import io
from typing import Dict, List, Any, Optional, Union, Tuple
from pathlib import Path
import psutil
from datetime import datetime
import hashlib
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class HighPerformanceDataProcessor:
    """
    High-performance data processor using Polars with Pandas fallback.
    Designed for 5-10x performance improvement on large datasets.
    """

    def __init__(self, prefer_polars: bool = True, max_workers: int = 4):
        self.prefer_polars = prefer_polars
        self.max_workers = max_workers
        self.performance_metrics = {}

        # Test Polars availability
        try:
            import polars as pl
            self.polars_available = True
            logger.info("Polars available - enabling high-performance mode")
        except ImportError:
            self.polars_available = False
            logger.warning("Polars not available - falling back to Pandas")

    def _track_performance(self, operation: str, start_time: float,
                          rows: int, memory_before: float) -> Dict[str, Any]:
        """Track performance metrics for operations"""
        end_time = time.time()
        process = psutil.Process()
        memory_after = process.memory_info().rss / 1024 / 1024  # MB

        metrics = {
            "operation": operation,
            "duration_seconds": end_time - start_time,
            "rows_processed": rows,
            "rows_per_second": rows / (end_time - start_time) if end_time > start_time else 0,
            "memory_before_mb": memory_before,
            "memory_after_mb": memory_after,
            "memory_delta_mb": memory_after - memory_before,
            "timestamp": datetime.now().isoformat()
        }

        self.performance_metrics[f"{operation}_{int(time.time())}"] = metrics
        return metrics

    def read_csv_optimized(self, file_path: Union[str, Path, io.IOBase],
                          **kwargs) -> Union[pl.DataFrame, pd.DataFrame]:
        """
        Optimized CSV reading with Polars first, Pandas fallback
        Returns the appropriate DataFrame type based on what worked
        """
        start_time = time.time()
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024

        if self.polars_available and self.prefer_polars:
            try:
                # Use Polars for high performance
                if isinstance(file_path, (str, Path)):
                    df = pl.read_csv(file_path, **kwargs)
                else:
                    # Handle file-like objects
                    content = file_path.read()
                    if isinstance(content, bytes):
                        content = content.decode('utf-8')
                    df = pl.read_csv(io.StringIO(content), **kwargs)

                metrics = self._track_performance("polars_read_csv", start_time,
                                                df.height, memory_before)
                logger.info(f"Polars CSV read: {metrics['rows_per_second']:.2f} rows/sec")
                return df

            except Exception as e:
                logger.warning(f"Polars CSV read failed: {e}, falling back to Pandas")

        # Pandas fallback
        try:
            if isinstance(file_path, (str, Path)):
                df = pd.read_csv(file_path, **kwargs)
            else:
                df = pd.read_csv(file_path, **kwargs)

            metrics = self._track_performance("pandas_read_csv", start_time,
                                            len(df), memory_before)
            logger.info(f"Pandas CSV read: {metrics['rows_per_second']:.2f} rows/sec")
            return df

        except Exception as e:
            logger.error(f"Both Polars and Pandas CSV read failed: {e}")
            raise

    def process_dataframe_transformations(self, df: Union[pl.DataFrame, pd.DataFrame],
                                        operations: List[Dict[str, Any]]) -> Union[pl.DataFrame, pd.DataFrame]:
        """
        Apply a series of transformations optimally based on DataFrame type

        Operations format:
        [
            {"type": "filter", "column": "age", "operator": ">", "value": 18},
            {"type": "groupby", "columns": ["category"], "agg": {"value": "mean"}},
            {"type": "sort", "column": "timestamp", "descending": True}
        ]
        """
        start_time = time.time()
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024

        if isinstance(df, pl.DataFrame):
            # Polars optimized path
            result_df = self._apply_polars_transformations(df, operations)
            engine = "polars"
        else:
            # Pandas path
            result_df = self._apply_pandas_transformations(df, operations)
            engine = "pandas"

        rows = result_df.height if isinstance(result_df, pl.DataFrame) else len(result_df)
        metrics = self._track_performance(f"{engine}_transformations", start_time,
                                        rows, memory_before)
        logger.info(f"{engine.title()} transformations: {metrics['rows_per_second']:.2f} rows/sec")

        return result_df

    def _apply_polars_transformations(self, df: pl.DataFrame, operations: List[Dict[str, Any]]) -> pl.DataFrame:
        """Apply transformations using Polars syntax"""
        result = df

        for op in operations:
            op_type = op.get("type")

            if op_type == "filter":
                column = op["column"]
                operator = op["operator"]
                value = op["value"]

                if operator == ">":
                    result = result.filter(pl.col(column) > value)
                elif operator == "<":
                    result = result.filter(pl.col(column) < value)
                elif operator == "==":
                    result = result.filter(pl.col(column) == value)
                elif operator == "!=":
                    result = result.filter(pl.col(column) != value)

            elif op_type == "groupby":
                columns = op["columns"]
                agg_dict = op["agg"]

                # Convert aggregation dict to Polars expressions
                agg_exprs = []
                for col, agg_func in agg_dict.items():
                    if agg_func == "mean":
                        agg_exprs.append(pl.col(col).mean().alias(f"{col}_mean"))
                    elif agg_func == "sum":
                        agg_exprs.append(pl.col(col).sum().alias(f"{col}_sum"))
                    elif agg_func == "count":
                        agg_exprs.append(pl.col(col).count().alias(f"{col}_count"))
                    elif agg_func == "std":
                        agg_exprs.append(pl.col(col).std().alias(f"{col}_std"))

                result = result.group_by(columns).agg(agg_exprs)

            elif op_type == "sort":
                column = op["column"]
                descending = op.get("descending", False)
                result = result.sort(column, descending=descending)

            elif op_type == "select":
                columns = op["columns"]
                result = result.select(columns)

            elif op_type == "with_column":
                column_name = op["column_name"]
                expression = op["expression"]
                # Simple expressions supported
                if expression["type"] == "multiply":
                    result = result.with_columns(
                        (pl.col(expression["column"]) * expression["value"]).alias(column_name)
                    )
                elif expression["type"] == "add":
                    result = result.with_columns(
                        (pl.col(expression["column"]) + expression["value"]).alias(column_name)
                    )

        return result

    def _apply_pandas_transformations(self, df: pd.DataFrame, operations: List[Dict[str, Any]]) -> pd.DataFrame:
        """Apply transformations using Pandas syntax"""
        result = df.copy()

        for op in operations:
            op_type = op.get("type")

            if op_type == "filter":
                column = op["column"]
                operator = op["operator"]
                value = op["value"]

                if operator == ">":
                    result = result[result[column] > value]
                elif operator == "<":
                    result = result[result[column] < value]
                elif operator == "==":
                    result = result[result[column] == value]
                elif operator == "!=":
                    result = result[result[column] != value]

            elif op_type == "groupby":
                columns = op["columns"]
                agg_dict = op["agg"]
                result = result.groupby(columns).agg(agg_dict).reset_index()

            elif op_type == "sort":
                column = op["column"]
                ascending = not op.get("descending", False)
                result = result.sort_values(column, ascending=ascending).reset_index(drop=True)

            elif op_type == "select":
                columns = op["columns"]
                result = result[columns]

            elif op_type == "with_column":
                column_name = op["column_name"]
                expression = op["expression"]
                if expression["type"] == "multiply":
                    result[column_name] = result[expression["column"]] * expression["value"]
                elif expression["type"] == "add":
                    result[column_name] = result[expression["column"]] + expression["value"]

        return result

    def convert_to_pandas(self, df: Union[pl.DataFrame, pd.DataFrame]) -> pd.DataFrame:
        """Convert Polars DataFrame to Pandas if needed"""
        if isinstance(df, pl.DataFrame):
            return df.to_pandas()
        return df

    def convert_to_polars(self, df: Union[pl.DataFrame, pd.DataFrame]) -> pl.DataFrame:
        """Convert Pandas DataFrame to Polars if available"""
        if isinstance(df, pd.DataFrame) and self.polars_available:
            return pl.from_pandas(df)
        return df

    def aggregate_large_dataset(self, file_path: str, chunk_size: int = 10000,
                              operations: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Process large datasets in chunks to manage memory usage
        Returns aggregated results and performance metrics
        """
        start_time = time.time()
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024

        results = []
        total_rows = 0
        chunk_count = 0

        try:
            if self.polars_available and self.prefer_polars:
                # Polars lazy evaluation for large files
                lazy_df = pl.scan_csv(file_path)

                if operations:
                    # Apply operations lazily
                    for op in operations:
                        if op["type"] == "filter":
                            lazy_df = lazy_df.filter(pl.col(op["column"]) > op["value"])
                        elif op["type"] == "groupby":
                            agg_exprs = [pl.col(col).mean() for col in op["agg"].keys()]
                            lazy_df = lazy_df.group_by(op["columns"]).agg(agg_exprs)

                # Execute and collect
                result_df = lazy_df.collect()
                total_rows = result_df.height
                results.append(result_df.to_pandas())

            else:
                # Pandas chunked processing
                for chunk_df in pd.read_csv(file_path, chunksize=chunk_size):
                    if operations:
                        processed_chunk = self._apply_pandas_transformations(chunk_df, operations)
                    else:
                        processed_chunk = chunk_df

                    results.append(processed_chunk)
                    total_rows += len(chunk_df)
                    chunk_count += 1

            # Combine results
            if len(results) > 1:
                final_result = pd.concat(results, ignore_index=True)
            else:
                final_result = results[0]

            metrics = self._track_performance("large_dataset_aggregation", start_time,
                                            total_rows, memory_before)

            return {
                "result": final_result,
                "performance": metrics,
                "chunks_processed": chunk_count,
                "total_rows": total_rows
            }

        except Exception as e:
            logger.error(f"Large dataset processing failed: {e}")
            raise

    def get_performance_summary(self) -> Dict[str, Any]:
        """Get summary of all performance metrics collected"""
        if not self.performance_metrics:
            return {"message": "No performance data collected yet"}

        total_operations = len(self.performance_metrics)
        total_rows = sum(m["rows_processed"] for m in self.performance_metrics.values())
        avg_speed = np.mean([m["rows_per_second"] for m in self.performance_metrics.values()])
        total_time = sum(m["duration_seconds"] for m in self.performance_metrics.values())

        operations_by_type = {}
        for metrics in self.performance_metrics.values():
            op_type = metrics["operation"]
            if op_type not in operations_by_type:
                operations_by_type[op_type] = {"count": 0, "total_time": 0, "total_rows": 0}

            operations_by_type[op_type]["count"] += 1
            operations_by_type[op_type]["total_time"] += metrics["duration_seconds"]
            operations_by_type[op_type]["total_rows"] += metrics["rows_processed"]

        return {
            "summary": {
                "total_operations": total_operations,
                "total_rows_processed": total_rows,
                "total_time_seconds": total_time,
                "average_speed_rows_per_second": avg_speed,
                "polars_available": self.polars_available,
                "prefer_polars": self.prefer_polars
            },
            "operations_by_type": operations_by_type,
            "detailed_metrics": self.performance_metrics
        }

# Usage example and testing functions
def performance_comparison_test(file_path: str, operations: List[Dict[str, Any]] = None):
    """
    Compare performance between Polars and Pandas on the same operations
    """
    print("=" * 60)
    print("HIGH-PERFORMANCE DATA PROCESSOR - COMPARISON TEST")
    print("=" * 60)

    # Test with Polars preferred
    polars_processor = HighPerformanceDataProcessor(prefer_polars=True)

    print("\n🚀 Testing with Polars (high-performance mode)...")
    start_time = time.time()

    try:
        df_polars = polars_processor.read_csv_optimized(file_path)
        if operations:
            df_polars_processed = polars_processor.process_dataframe_transformations(df_polars, operations)
        else:
            df_polars_processed = df_polars

        polars_time = time.time() - start_time
        polars_rows = df_polars_processed.height if hasattr(df_polars_processed, 'height') else len(df_polars_processed)
        print(f"✅ Polars: {polars_rows:,} rows processed in {polars_time:.2f}s ({polars_rows/polars_time:.2f} rows/sec)")

    except Exception as e:
        print(f"❌ Polars failed: {e}")
        polars_time = float('inf')
        polars_rows = 0

    # Test with Pandas only
    pandas_processor = HighPerformanceDataProcessor(prefer_polars=False)

    print("\n🐼 Testing with Pandas (fallback mode)...")
    start_time = time.time()

    try:
        df_pandas = pandas_processor.read_csv_optimized(file_path)
        if operations:
            df_pandas_processed = pandas_processor.process_dataframe_transformations(df_pandas, operations)
        else:
            df_pandas_processed = df_pandas

        pandas_time = time.time() - start_time
        pandas_rows = len(df_pandas_processed)
        print(f"✅ Pandas: {pandas_rows:,} rows processed in {pandas_time:.2f}s ({pandas_rows/pandas_time:.2f} rows/sec)")

    except Exception as e:
        print(f"❌ Pandas failed: {e}")
        pandas_time = float('inf')
        pandas_rows = 0

    # Performance comparison
    if polars_time < float('inf') and pandas_time < float('inf'):
        speedup = pandas_time / polars_time if polars_time > 0 else 0
        print(f"\n📊 Performance Summary:")
        print(f"   Polars: {polars_time:.2f}s ({polars_rows/polars_time:.2f} rows/sec)")
        print(f"   Pandas: {pandas_time:.2f}s ({pandas_rows/pandas_time:.2f} rows/sec)")
        print(f"   Speedup: {speedup:.2f}x faster with Polars" if speedup > 1 else f"   Pandas was {1/speedup:.2f}x faster")

    return {
        "polars_time": polars_time,
        "pandas_time": pandas_time,
        "polars_rows": polars_rows,
        "pandas_rows": pandas_rows,
        "speedup": pandas_time / polars_time if polars_time > 0 and polars_time < float('inf') else 0
    }

if __name__ == "__main__":
    # Example usage
    processor = HighPerformanceDataProcessor()

    # Sample operations for testing
    sample_operations = [
        {"type": "filter", "column": "value", "operator": ">", "value": 100},
        {"type": "groupby", "columns": ["category"], "agg": {"value": "mean"}},
        {"type": "sort", "column": "value_mean", "descending": True}
    ]

    print("High-Performance Data Processor initialized")
    print(f"Polars available: {processor.polars_available}")
    print(f"Performance metrics: {len(processor.performance_metrics)} operations tracked")