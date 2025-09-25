//! Schlep-engine High-Performance Compute Kernels
//!
//! This module provides high-performance compute kernels written in Rust
//! for the Schlep-engine data processing platform. Based on performance audit,
//! targets the highest-impact bottlenecks:
//!
//! 1. CSV Reading (72.8% CPU time) - Target: 6.22x speedup
//! 2. Aggregations (14.4% CPU time) - Target: 6.36x speedup
//! 3. String Operations - Target: 10x+ speedup
//!
//! Architecture: PyO3 bindings for seamless Python integration

use pyo3::prelude::*;
use pyo3::types::PyModule;
use std::collections::HashMap;

// Sub-modules for different kernel types
mod csv_kernels;
mod aggregation_kernels;
mod string_kernels;
mod memory_kernels;

// Security modules
mod security_fixes;
mod secure_string_kernels;

// Re-export public APIs
pub use csv_kernels::*;
pub use aggregation_kernels::*;
pub use string_kernels::*;
pub use memory_kernels::*;
pub use security_fixes::*;
pub use secure_string_kernels::*;

/// Fast CSV reading kernel - addresses 72.8% CPU bottleneck
///
/// Expected performance: 6.22x faster than pandas.read_csv()
/// Memory efficiency: 40-60% less memory usage
///
/// # Arguments
/// * `file_path` - Path to CSV file
/// * `chunk_size` - Optional chunk size for memory management (default: 50000)
/// * `delimiter` - Field delimiter (default: ',')
/// * `has_header` - Whether file has header row (default: true)
///
/// # Returns
/// Tuple of (headers: Vec<String>, data: Vec<Vec<String>>)
#[pyfunction]
#[pyo3(signature = (file_path, chunk_size=None, delimiter=None, has_header=None))]
pub fn fast_csv_read(
    file_path: String,
    chunk_size: Option<usize>,
    delimiter: Option<char>,
    has_header: Option<bool>,
) -> PyResult<(Vec<String>, Vec<Vec<String>>)> {
    csv_kernels::fast_csv_read_impl(file_path, chunk_size, delimiter, has_header)
}

/// Parallel CSV reading with automatic chunking for very large files
///
/// Expected performance: 8-12x faster than pandas for files >100MB
/// Automatically uses memory mapping for files >50MB
///
/// # Arguments
/// * `file_path` - Path to CSV file
/// * `max_memory_mb` - Maximum memory usage in MB (default: 500)
/// * `num_threads` - Number of threads to use (default: CPU count)
#[pyfunction]
#[pyo3(signature = (file_path, max_memory_mb=None, num_threads=None))]
pub fn fast_csv_read_parallel(
    file_path: String,
    max_memory_mb: Option<usize>,
    num_threads: Option<usize>,
) -> PyResult<(Vec<String>, Vec<Vec<String>>)> {
    csv_kernels::fast_csv_read_parallel_impl(file_path, max_memory_mb, num_threads)
}

/// High-performance groupby aggregation - addresses 14.4% CPU bottleneck
///
/// Expected performance: 6.36x faster than pandas.groupby().agg()
/// Memory efficiency: 50-70% less memory usage through HashMap optimizations
///
/// # Arguments
/// * `groups` - Vector of group identifiers
/// * `values` - Vector of values to aggregate
/// * `agg_func` - Aggregation function: "mean", "sum", "count", "min", "max", "std"
///
/// # Returns
/// HashMap mapping group -> aggregated value
#[pyfunction]
pub fn fast_groupby_agg(
    groups: Vec<String>,
    values: Vec<f64>,
    agg_func: String,
) -> PyResult<HashMap<String, f64>> {
    aggregation_kernels::fast_groupby_agg_impl(groups, values, agg_func)
}

/// Multi-function parallel aggregation - processes multiple aggregation functions at once
///
/// Expected performance: 8-15x faster than multiple pandas.groupby() calls
///
/// # Arguments
/// * `groups` - Vector of group identifiers
/// * `values` - Vector of values to aggregate
/// * `agg_funcs` - List of aggregation functions to compute
///
/// # Returns
/// HashMap mapping (group, function) -> result
#[pyfunction]
pub fn fast_multi_agg(
    groups: Vec<String>,
    values: Vec<f64>,
    agg_funcs: Vec<String>,
) -> PyResult<HashMap<(String, String), f64>> {
    aggregation_kernels::fast_multi_agg_impl(groups, values, agg_funcs)
}

/// Secure high-performance string operations kernel
///
/// Expected performance: 10-25x faster than pandas string operations
/// Includes security fixes for 9 vulnerabilities found in fuzz testing:
/// - Unicode validation and sanitization
/// - Input size limits and resource budgeting
/// - Timeout protection for regex operations
/// - Secure regex pattern validation
///
/// # Arguments
/// * `strings` - Vector of input strings
/// * `operation` - Operation type: "length", "upper", "lower", "contains", "regex", "strip"
/// * `pattern` - Optional pattern for contains/regex operations
///
/// # Returns
/// Vector of results (strings or booleans as strings)
#[pyfunction]
#[pyo3(signature = (strings, operation, pattern=None))]
pub fn fast_string_ops(
    strings: Vec<String>,
    operation: String,
    pattern: Option<String>,
) -> PyResult<Vec<String>> {
    // Use secure implementation with vulnerability fixes
    secure_string_kernels::secure_string_ops_impl(strings, operation, pattern)
}

/// Secure batch string processing for multiple operations
///
/// Expected performance: 15-30x faster than sequential pandas operations
/// Processes multiple string operations in a single pass with security hardening:
/// - Limits batch size to prevent resource exhaustion
/// - Uses secure implementations for all operations
/// - Includes comprehensive input validation
///
/// # Arguments
/// * `strings` - Vector of input strings
/// * `operations` - List of operations to perform (max 10)
///
/// # Returns
/// HashMap mapping operation -> results
#[pyfunction]
pub fn fast_string_batch(
    strings: Vec<String>,
    operations: Vec<String>,
) -> PyResult<HashMap<String, Vec<String>>> {
    // Use secure implementation with vulnerability fixes
    secure_string_kernels::secure_string_batch_impl(strings, operations)
}

/// Memory-efficient data cleaning operations
///
/// Expected performance: 3-8x faster than pandas cleaning operations
/// Optimized null handling and type inference
///
/// # Arguments
/// * `data` - 2D vector of string data
/// * `null_values` - Values to treat as null
/// * `infer_types` - Whether to infer and convert data types
///
/// # Returns
/// Cleaned data with type information
#[pyfunction]
pub fn fast_data_clean(
    data: Vec<Vec<String>>,
    null_values: Vec<String>,
    infer_types: bool,
) -> PyResult<(Vec<Vec<String>>, Vec<String>)> {
    memory_kernels::fast_data_clean_impl(data, null_values, infer_types)
}

/// Performance benchmark function for internal testing
///
/// Runs micro-benchmarks of all kernel functions to validate
/// performance claims and detect regressions
#[pyfunction]
pub fn benchmark_kernels() -> PyResult<HashMap<String, f64>> {
    let mut results = HashMap::new();

    // CSV reading benchmark
    let csv_time = csv_kernels::benchmark_csv_reading();
    results.insert("csv_reading_ops_per_sec".to_string(), csv_time);

    // Aggregation benchmark
    let agg_time = aggregation_kernels::benchmark_aggregations();
    results.insert("aggregation_ops_per_sec".to_string(), agg_time);

    // String operations benchmark
    let str_time = string_kernels::benchmark_string_ops();
    results.insert("string_ops_per_sec".to_string(), str_time);

    // Memory operations benchmark
    let mem_time = memory_kernels::benchmark_memory_ops();
    results.insert("memory_ops_per_sec".to_string(), mem_time);

    Ok(results)
}

/// Get kernel version and feature information
#[pyfunction]
pub fn kernel_info() -> PyResult<HashMap<String, String>> {
    let mut info = HashMap::new();

    info.insert("version".to_string(), env!("CARGO_PKG_VERSION").to_string());
    info.insert("build_profile".to_string(),
                if cfg!(debug_assertions) { "debug" } else { "release" }.to_string());

    // Feature flags
    let mut features = Vec::new();
    #[cfg(feature = "fast-csv")]
    features.push("fast-csv");
    #[cfg(feature = "parallel-agg")]
    features.push("parallel-agg");
    #[cfg(feature = "string-ops")]
    features.push("string-ops");
    #[cfg(feature = "simd")]
    features.push("simd");

    info.insert("features".to_string(), features.join(", "));
    info.insert("thread_count".to_string(), rayon::current_num_threads().to_string());

    Ok(info)
}

/// Python module definition
///
/// Exposes all high-performance kernels to Python with proper error handling
/// and documentation
#[pymodule]
fn schlep_compute_kernels(m: &Bound<'_, PyModule>) -> PyResult<()> {
    // CSV processing functions
    m.add_function(wrap_pyfunction!(fast_csv_read, m)?)?;
    m.add_function(wrap_pyfunction!(fast_csv_read_parallel, m)?)?;

    // Aggregation functions
    m.add_function(wrap_pyfunction!(fast_groupby_agg, m)?)?;
    m.add_function(wrap_pyfunction!(fast_multi_agg, m)?)?;

    // String processing functions
    m.add_function(wrap_pyfunction!(fast_string_ops, m)?)?;
    m.add_function(wrap_pyfunction!(fast_string_batch, m)?)?;

    // Data cleaning functions
    m.add_function(wrap_pyfunction!(fast_data_clean, m)?)?;

    // Utility functions
    m.add_function(wrap_pyfunction!(benchmark_kernels, m)?)?;
    m.add_function(wrap_pyfunction!(kernel_info, m)?)?;

    // Module metadata
    m.add("__version__", env!("CARGO_PKG_VERSION"))?;
    m.add("__author__", "Schlep-engine Team")?;
    m.add("__description__", "High-performance compute kernels for data processing")?;

    Ok(())
}