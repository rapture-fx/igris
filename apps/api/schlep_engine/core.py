"""
Core Schlep Engine API - Pythonic wrappers over Rust kernels

Provides high-level, user-friendly interfaces for data processing operations.
"""

import os
import sys
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple
from enum import Enum
import pandas as pd
import polars as pl

# Import Rust kernels (with fallback to pandas/polars)
try:
    sys.path.append(os.path.join(os.path.dirname(__file__), "..", "rust_compute_kernels"))
    import schlep_compute_kernels as _rust_kernels
    _RUST_AVAILABLE = True
except ImportError:
    warnings.warn("Rust kernels not available. Falling back to pandas/polars.")
    _RUST_AVAILABLE = False


class PerformanceMode(Enum):
    """Performance optimization modes"""
    AUTO = "auto"                    # Automatically choose best approach
    PYTHON_ONLY = "python_only"      # Use only pandas/polars
    RUST_PREFERRED = "rust_preferred" # Prefer Rust kernels when available
    RUST_ONLY = "rust_only"          # Use only Rust kernels (fail if not available)


class SchlepConfig:
    """Global configuration for Schlep Engine"""

    def __init__(self,
                 performance_mode: PerformanceMode = PerformanceMode.AUTO,
                 max_memory_mb: int = 1000,
                 num_threads: Optional[int] = None,
                 enable_monitoring: bool = True,
                 fallback_to_pandas: bool = True):
        self.performance_mode = performance_mode
        self.max_memory_mb = max_memory_mb
        self.num_threads = num_threads or os.cpu_count()
        self.enable_monitoring = enable_monitoring
        self.fallback_to_pandas = fallback_to_pandas

    def should_use_rust(self, operation_type: str, data_size_mb: float = 0) -> bool:
        """Decide whether to use Rust kernels for an operation"""

        if not _RUST_AVAILABLE:
            return False

        if self.performance_mode == PerformanceMode.PYTHON_ONLY:
            return False

        if self.performance_mode == PerformanceMode.RUST_ONLY:
            return True

        if self.performance_mode == PerformanceMode.RUST_PREFERRED:
            return True

        # AUTO mode - use decision rules
        if operation_type == "csv_read":
            return data_size_mb > 50  # Use Rust for files > 50MB

        if operation_type == "aggregation":
            return data_size_mb > 10  # Use Rust for data > 10MB

        if operation_type == "string_processing":
            return data_size_mb > 5   # Use Rust for text > 5MB

        return data_size_mb > 100  # Default threshold


# Global configuration instance
_config = SchlepConfig()


def configure(**kwargs) -> None:
    """
    Configure Schlep Engine globally

    Args:
        performance_mode: PerformanceMode enum value
        max_memory_mb: Maximum memory usage in MB
        num_threads: Number of threads for parallel processing
        enable_monitoring: Whether to enable performance monitoring
        fallback_to_pandas: Whether to fallback to pandas on Rust failures
    """
    global _config

    for key, value in kwargs.items():
        if hasattr(_config, key):
            setattr(_config, key, value)
        else:
            raise ValueError(f"Unknown configuration parameter: {key}")


def read_csv_fast(file_path: Union[str, Path],
                  chunk_size: Optional[int] = None,
                  delimiter: str = ",",
                  has_header: bool = True,
                  return_format: str = "pandas",
                  **kwargs) -> Union[pd.DataFrame, pl.DataFrame, Tuple[List[str], List[List[str]]]]:
    """
    Fast CSV reading with automatic optimization

    Args:
        file_path: Path to CSV file
        chunk_size: Optional chunk size for memory management
        delimiter: Field delimiter (default: comma)
        has_header: Whether file has header row
        return_format: "pandas", "polars", or "raw" for format preference
        **kwargs: Additional arguments passed to underlying readers

    Returns:
        DataFrame or raw data depending on return_format

    Examples:
        >>> df = read_csv_fast("data.csv")
        >>> df = read_csv_fast("large_data.csv", return_format="polars")
        >>> headers, data = read_csv_fast("data.csv", return_format="raw")
    """
    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"CSV file not found: {file_path}")

    # Estimate file size
    file_size_mb = file_path.stat().st_size / 1024 / 1024

    # Decide on processing approach
    use_rust = _config.should_use_rust("csv_read", file_size_mb)

    try:
        if use_rust and _RUST_AVAILABLE:
            # Use Rust kernel for high performance
            if file_size_mb > 500:
                headers, data = _rust_kernels.fast_csv_read_parallel(
                    str(file_path),
                    _config.max_memory_mb,
                    _config.num_threads
                )
            else:
                headers, data = _rust_kernels.fast_csv_read(
                    str(file_path),
                    chunk_size,
                    delimiter,
                    has_header
                )

            # Convert to requested format
            if return_format == "raw":
                return headers, data

            elif return_format == "polars":
                # Convert to Polars DataFrame
                if headers and data:
                    df_dict = {headers[i]: [row[i] if i < len(row) else None for row in data]
                              for i in range(len(headers))}
                    return pl.DataFrame(df_dict)
                else:
                    return pl.DataFrame()

            else:  # pandas (default)
                # Convert to Pandas DataFrame
                if headers and data:
                    return pd.DataFrame(data, columns=headers)
                else:
                    return pd.DataFrame()

        else:
            # Fallback to pandas/polars
            if return_format == "polars":
                return pl.read_csv(
                    file_path,
                    separator=delimiter,
                    has_header=has_header,
                    **kwargs
                )
            else:
                return pd.read_csv(
                    file_path,
                    sep=delimiter,
                    header=0 if has_header else None,
                    **kwargs
                )

    except Exception as e:
        if _config.fallback_to_pandas and use_rust:
            warnings.warn(f"Rust CSV processing failed, falling back to pandas: {e}")
            return pd.read_csv(
                file_path,
                sep=delimiter,
                header=0 if has_header else None,
                **kwargs
            )
        else:
            raise


def aggregate_data(data: Union[pd.DataFrame, Dict[str, List]],
                   group_columns: Union[str, List[str]],
                   value_column: str,
                   functions: Union[str, List[str]] = "mean",
                   return_format: str = "pandas") -> Union[pd.DataFrame, pl.DataFrame, Dict]:
    """
    High-performance data aggregation

    Args:
        data: Input data as DataFrame or dict
        group_columns: Column(s) to group by
        value_column: Column containing values to aggregate
        functions: Aggregation function(s): "mean", "sum", "count", "min", "max", "std"
        return_format: "pandas", "polars", or "dict" for output format

    Returns:
        Aggregated data in requested format

    Examples:
        >>> result = aggregate_data(df, "category", "sales", "mean")
        >>> result = aggregate_data(df, ["region", "category"], "sales", ["mean", "sum"])
    """

    # Convert inputs to standard format
    if isinstance(data, pd.DataFrame):
        # Extract from pandas DataFrame
        if isinstance(group_columns, str):
            groups = data[group_columns].astype(str).tolist()
        else:
            groups = data[group_columns].astype(str).apply(
                lambda x: "|".join(x), axis=1
            ).tolist()
        values = data[value_column].astype(float).tolist()

    elif isinstance(data, dict):
        # Extract from dictionary
        if isinstance(group_columns, str):
            groups = [str(x) for x in data[group_columns]]
        else:
            groups = ["|".join(str(data[col][i]) for col in group_columns)
                     for i in range(len(data[group_columns[0]]))]
        values = [float(x) for x in data[value_column]]

    else:
        raise ValueError("Data must be pandas DataFrame or dictionary")

    # Estimate data size
    data_size_mb = (len(groups) * 50) / 1024 / 1024  # Rough estimate

    # Decide on processing approach
    use_rust = _config.should_use_rust("aggregation", data_size_mb)

    try:
        if use_rust and _RUST_AVAILABLE:
            # Use Rust kernel
            if isinstance(functions, str):
                # Single function
                result = _rust_kernels.fast_groupby_agg(groups, values, functions)
            else:
                # Multiple functions
                result = _rust_kernels.fast_multi_agg(groups, values, functions)

            # Convert to requested format
            if return_format == "dict":
                return result

            elif return_format == "polars":
                if isinstance(functions, str):
                    df_data = {"group": list(result.keys()), functions: list(result.values())}
                else:
                    # Multi-function results
                    df_data = {"group": [], "function": [], "value": []}
                    for (group, func), value in result.items():
                        df_data["group"].append(group)
                        df_data["function"].append(func)
                        df_data["value"].append(value)
                return pl.DataFrame(df_data)

            else:  # pandas (default)
                if isinstance(functions, str):
                    return pd.DataFrame({"group": list(result.keys()),
                                       functions: list(result.values())})
                else:
                    # Multi-function results
                    rows = []
                    for (group, func), value in result.items():
                        rows.append({"group": group, "function": func, "value": value})
                    return pd.DataFrame(rows)

        else:
            # Fallback to pandas
            df = pd.DataFrame({"group": groups, "value": values})
            if isinstance(functions, str):
                result = df.groupby("group")["value"].agg(functions).reset_index()
            else:
                result = df.groupby("group")["value"].agg(functions).reset_index()

            if return_format == "polars":
                return pl.from_pandas(result)
            elif return_format == "dict":
                return result.to_dict("records")
            else:
                return result

    except Exception as e:
        if _config.fallback_to_pandas and use_rust:
            warnings.warn(f"Rust aggregation failed, falling back to pandas: {e}")
            df = pd.DataFrame({"group": groups, "value": values})
            return df.groupby("group")["value"].agg(functions).reset_index()
        else:
            raise


def process_strings(strings: List[str],
                    operations: Union[str, List[str]],
                    pattern: Optional[str] = None,
                    return_format: str = "list") -> Union[List[str], Dict[str, List[str]]]:
    """
    High-performance string processing operations

    Args:
        strings: List of input strings
        operations: String operation(s) - "length", "upper", "lower", "contains", etc.
        pattern: Pattern for operations like "contains" or "regex"
        return_format: "list" for single operation, "dict" for multiple operations

    Returns:
        Processed strings as list or dict of results

    Examples:
        >>> lengths = process_strings(text_data, "length")
        >>> results = process_strings(text_data, ["upper", "length"])
        >>> matches = process_strings(text_data, "contains", pattern="error")
    """

    # Estimate data size
    data_size_mb = sum(len(s.encode('utf-8')) for s in strings) / 1024 / 1024

    # Decide on processing approach
    use_rust = _config.should_use_rust("string_processing", data_size_mb)

    try:
        if use_rust and _RUST_AVAILABLE:
            if isinstance(operations, str):
                # Single operation
                result = _rust_kernels.fast_string_ops(strings, operations, pattern)
                return result
            else:
                # Multiple operations
                results = {}
                for op in operations:
                    if ":" in op:
                        # Operation with pattern (e.g., "contains:error")
                        op_name, op_pattern = op.split(":", 1)
                        results[op] = _rust_kernels.fast_string_ops(strings, op_name, op_pattern)
                    else:
                        results[op] = _rust_kernels.fast_string_ops(strings, op, pattern)
                return results

        else:
            # Fallback to pandas string operations
            series = pd.Series(strings)

            if isinstance(operations, str):
                if operations == "length":
                    return series.str.len().astype(str).tolist()
                elif operations == "upper":
                    return series.str.upper().tolist()
                elif operations == "lower":
                    return series.str.lower().tolist()
                elif operations == "contains" and pattern:
                    return series.str.contains(pattern, na=False).astype(str).tolist()
                else:
                    raise ValueError(f"Unsupported operation: {operations}")
            else:
                results = {}
                for op in operations:
                    if op == "length":
                        results[op] = series.str.len().astype(str).tolist()
                    elif op == "upper":
                        results[op] = series.str.upper().tolist()
                    elif op == "lower":
                        results[op] = series.str.lower().tolist()
                    else:
                        results[op] = [str(x) for x in strings]  # Fallback
                return results

    except Exception as e:
        if _config.fallback_to_pandas and use_rust:
            warnings.warn(f"Rust string processing failed, falling back to pandas: {e}")
            # Simplified pandas fallback
            series = pd.Series(strings)
            if isinstance(operations, str) and operations == "length":
                return series.str.len().astype(str).tolist()
            else:
                return [str(x) for x in strings]
        else:
            raise


def clean_data(data: Union[pd.DataFrame, List[List[str]]],
               null_values: Optional[List[str]] = None,
               infer_types: bool = True,
               return_format: str = "pandas") -> Union[pd.DataFrame, Tuple[List[List[str]], List[str]]]:
    """
    Clean and normalize data with type inference

    Args:
        data: Input data as DataFrame or list of rows
        null_values: Values to treat as null (default: ["", "null", "NA", "None"])
        infer_types: Whether to infer and convert data types
        return_format: "pandas" or "raw" for output format

    Returns:
        Cleaned data with inferred types

    Examples:
        >>> clean_df = clean_data(df)
        >>> cleaned_data, types = clean_data(raw_data, return_format="raw")
    """

    if null_values is None:
        null_values = ["", "null", "NA", "None", "NULL", "nan"]

    # Convert DataFrame to list format if needed
    if isinstance(data, pd.DataFrame):
        data_list = data.astype(str).values.tolist()
    else:
        data_list = data

    # Estimate data size
    if data_list:
        data_size_mb = len(data_list) * len(data_list[0]) * 20 / 1024 / 1024  # Rough estimate
    else:
        data_size_mb = 0

    # Decide on processing approach
    use_rust = _config.should_use_rust("data_cleaning", data_size_mb)

    try:
        if use_rust and _RUST_AVAILABLE:
            cleaned_data, column_types = _rust_kernels.fast_data_clean(
                data_list, null_values, infer_types
            )

            if return_format == "raw":
                return cleaned_data, column_types

            else:  # pandas
                if cleaned_data and column_types:
                    # Convert back to DataFrame with proper types
                    df = pd.DataFrame(cleaned_data)

                    # Apply type conversions
                    for i, col_type in enumerate(column_types):
                        if i < len(df.columns):
                            col_name = df.columns[i]
                            try:
                                if col_type == "int64":
                                    df[col_name] = pd.to_numeric(df[col_name], errors="coerce").fillna(0).astype("int64")
                                elif col_type == "float64":
                                    df[col_name] = pd.to_numeric(df[col_name], errors="coerce")
                                elif col_type == "bool":
                                    df[col_name] = df[col_name].map({"true": True, "false": False, "1": True, "0": False})
                            except (ValueError, TypeError):
                                pass  # Keep as string if conversion fails

                    return df
                else:
                    return pd.DataFrame()

        else:
            # Fallback to pandas
            if isinstance(data, pd.DataFrame):
                df = data.copy()
            else:
                df = pd.DataFrame(data_list)

            # Replace null values
            df = df.replace(null_values, None)

            # Basic type inference
            if infer_types:
                df = df.infer_objects()

            if return_format == "raw":
                return df.values.tolist(), [str(dtype) for dtype in df.dtypes]
            else:
                return df

    except Exception as e:
        if _config.fallback_to_pandas and use_rust:
            warnings.warn(f"Rust data cleaning failed, falling back to pandas: {e}")
            if isinstance(data, pd.DataFrame):
                return data.replace(null_values, None)
            else:
                df = pd.DataFrame(data_list)
                return df.replace(null_values, None)
        else:
            raise


def get_kernel_info() -> Dict[str, Any]:
    """
    Get information about available kernels and configuration

    Returns:
        Dictionary with kernel and configuration information
    """
    info = {
        "rust_kernels_available": _RUST_AVAILABLE,
        "configuration": {
            "performance_mode": _config.performance_mode.value,
            "max_memory_mb": _config.max_memory_mb,
            "num_threads": _config.num_threads,
            "enable_monitoring": _config.enable_monitoring,
            "fallback_to_pandas": _config.fallback_to_pandas
        }
    }

    if _RUST_AVAILABLE:
        try:
            rust_info = _rust_kernels.kernel_info()
            info["rust_kernel_info"] = rust_info
        except Exception:
            info["rust_kernel_info"] = "Error retrieving Rust kernel info"

    return info