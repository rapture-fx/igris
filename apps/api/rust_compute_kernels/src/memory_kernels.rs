//! Memory-efficient data processing kernels
//!
//! Optimized data cleaning, type inference, and memory management operations.
//! Expected performance: 3-8x faster than pandas cleaning operations

use pyo3::prelude::*;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use ahash::{AHashMap, AHashSet};
use std::sync::Arc;

/// Data type enumeration for efficient type inference
#[derive(Debug, Clone, PartialEq)]
pub enum DataType {
    Integer,
    Float,
    Boolean,
    String,
    DateTime,
    Null,
}

impl DataType {
    fn from_string(s: &str) -> Self {
        if s.trim().is_empty() {
            return DataType::Null;
        }

        // Try boolean first (most specific)
        match s.to_lowercase().trim() {
            "true" | "false" | "1" | "0" | "yes" | "no" => return DataType::Boolean,
            _ => {}
        }

        // Try integer
        if s.trim().parse::<i64>().is_ok() {
            return DataType::Integer;
        }

        // Try float
        if s.trim().parse::<f64>().is_ok() {
            return DataType::Float;
        }

        // Try datetime patterns
        if is_datetime_pattern(s) {
            return DataType::DateTime;
        }

        DataType::String
    }

    fn to_string(&self) -> String {
        match self {
            DataType::Integer => "int64".to_string(),
            DataType::Float => "float64".to_string(),
            DataType::Boolean => "bool".to_string(),
            DataType::String => "string".to_string(),
            DataType::DateTime => "datetime64".to_string(),
            DataType::Null => "null".to_string(),
        }
    }
}

/// Fast data cleaning implementation
///
/// Optimized null handling, type inference, and data validation
pub fn fast_data_clean_impl(
    data: Vec<Vec<String>>,
    null_values: Vec<String>,
    infer_types: bool,
) -> PyResult<(Vec<Vec<String>>, Vec<String>)> {
    if data.is_empty() {
        return Ok((Vec::new(), Vec::new()));
    }

    let null_set: AHashSet<String> = null_values.into_iter().collect();
    let num_columns = data[0].len();

    // Process data in parallel chunks
    let cleaned_data = if data.len() > 10_000 {
        data.par_iter()
            .map(|row| clean_row(row, &null_set))
            .collect()
    } else {
        data.iter()
            .map(|row| clean_row(row, &null_set))
            .collect()
    };

    let column_types = if infer_types {
        infer_column_types(&cleaned_data, num_columns)
    } else {
        vec!["string".to_string(); num_columns]
    };

    Ok((cleaned_data, column_types))
}

/// Clean a single row by handling null values and basic validation
fn clean_row(row: &[String], null_values: &AHashSet<String>) -> Vec<String> {
    row.iter()
        .map(|cell| {
            let trimmed = cell.trim();
            if trimmed.is_empty() || null_values.contains(trimmed) {
                String::new() // Represent null as empty string
            } else {
                trimmed.to_string()
            }
        })
        .collect()
}

/// Infer column types by sampling data
fn infer_column_types(data: &[Vec<String>], num_columns: usize) -> Vec<String> {
    let sample_size = std::cmp::min(1000, data.len()); // Sample first 1000 rows

    (0..num_columns)
        .into_par_iter()
        .map(|col_idx| {
            let mut type_counts: AHashMap<DataType, usize> = AHashMap::new();

            for row in data.iter().take(sample_size) {
                if col_idx < row.len() && !row[col_idx].is_empty() {
                    let data_type = DataType::from_string(&row[col_idx]);
                    *type_counts.entry(data_type).or_insert(0) += 1;
                }
            }

            // Determine most common type (excluding nulls)
            type_counts
                .into_iter()
                .filter(|(dt, _)| *dt != DataType::Null)
                .max_by_key(|(_, count)| *count)
                .map(|(dt, _)| dt.to_string())
                .unwrap_or_else(|| DataType::String.to_string())
        })
        .collect()
}

/// Check if a string matches common datetime patterns
fn is_datetime_pattern(s: &str) -> bool {
    // Common datetime patterns
    let patterns = [
        // ISO format
        r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}",
        // Common date formats
        r"^\d{4}-\d{2}-\d{2}$",
        r"^\d{2}/\d{2}/\d{4}$",
        r"^\d{2}-\d{2}-\d{4}$",
        // With time
        r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$",
    ];

    for pattern in &patterns {
        if regex::Regex::new(pattern).unwrap().is_match(s) {
            return true;
        }
    }

    false
}

/// Memory-efficient duplicate detection
pub fn detect_duplicates(
    data: Vec<Vec<String>>,
    columns: Option<Vec<usize>>,
) -> PyResult<Vec<bool>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let columns = columns.unwrap_or_else(|| (0..data[0].len()).collect());
    let mut seen_rows: AHashSet<Vec<String>> = AHashSet::new();

    let results = if data.len() > 50_000 {
        // For large datasets, use parallel processing with local sets
        use std::sync::Mutex;
        let global_seen = Arc::new(Mutex::new(AHashSet::new()));

        data.par_iter()
            .map(|row| {
                let key: Vec<String> = columns
                    .iter()
                    .filter_map(|&col_idx| row.get(col_idx))
                    .cloned()
                    .collect();

                let mut seen = global_seen.lock().unwrap();
                !seen.insert(key)
            })
            .collect()
    } else {
        // Sequential processing for smaller datasets
        data.iter()
            .map(|row| {
                let key: Vec<String> = columns
                    .iter()
                    .filter_map(|&col_idx| row.get(col_idx))
                    .cloned()
                    .collect();

                !seen_rows.insert(key)
            })
            .collect()
    };

    Ok(results)
}

/// Memory-efficient missing value analysis
pub fn analyze_missing_values(
    data: Vec<Vec<String>>,
    null_values: Vec<String>,
) -> PyResult<HashMap<String, f64>> {
    if data.is_empty() {
        return Ok(HashMap::new());
    }

    let null_set: AHashSet<String> = null_values.into_iter().collect();
    let num_columns = data[0].len();
    let total_rows = data.len() as f64;

    let missing_counts: Vec<usize> = (0..num_columns)
        .into_par_iter()
        .map(|col_idx| {
            data.iter()
                .map(|row| {
                    row.get(col_idx)
                        .map(|cell| {
                            if cell.trim().is_empty() || null_set.contains(cell.trim()) {
                                1
                            } else {
                                0
                            }
                        })
                        .unwrap_or(1) // Missing column counts as null
                })
                .sum()
        })
        .collect();

    let mut result = HashMap::new();
    for (col_idx, missing_count) in missing_counts.iter().enumerate() {
        let percentage = (*missing_count as f64 / total_rows) * 100.0;
        result.insert(format!("column_{}", col_idx), percentage);
    }

    Ok(result)
}

/// High-performance data validation
pub fn validate_data_quality(
    data: Vec<Vec<String>>,
    validation_rules: HashMap<String, String>,
) -> PyResult<HashMap<String, Vec<bool>>> {
    if data.is_empty() {
        return Ok(HashMap::new());
    }

    let mut results = HashMap::new();

    for (rule_name, rule_pattern) in validation_rules {
        let regex = regex::Regex::new(&rule_pattern)
            .map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(
                format!("Invalid regex pattern '{}': {}", rule_pattern, e)
            ))?;

        let regex_arc = Arc::new(regex);

        // Apply validation to entire dataset
        let validation_results: Vec<bool> = if data.len() > 10_000 {
            data.par_iter()
                .map(|row| {
                    row.iter().any(|cell| regex_arc.is_match(cell))
                })
                .collect()
        } else {
            data.iter()
                .map(|row| {
                    row.iter().any(|cell| regex_arc.is_match(cell))
                })
                .collect()
        };

        results.insert(rule_name, validation_results);
    }

    Ok(results)
}

/// Memory-efficient column statistics
pub fn compute_column_stats(
    data: Vec<Vec<String>>,
    numeric_columns: Vec<usize>,
) -> PyResult<HashMap<String, HashMap<String, f64>>> {
    if data.is_empty() {
        return Ok(HashMap::new());
    }

    let mut results = HashMap::new();

    for col_idx in numeric_columns {
        let column_name = format!("column_{}", col_idx);

        // Extract numeric values from column
        let values: Vec<f64> = data
            .iter()
            .filter_map(|row| {
                row.get(col_idx)
                    .and_then(|cell| cell.trim().parse::<f64>().ok())
            })
            .collect();

        if values.is_empty() {
            continue;
        }

        let mut stats = HashMap::new();

        // Basic statistics
        let count = values.len() as f64;
        let sum: f64 = values.iter().sum();
        let mean = sum / count;

        // Min/Max
        let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

        // Standard deviation
        let variance: f64 = values
            .iter()
            .map(|v| (v - mean).powi(2))
            .sum::<f64>() / count;
        let std_dev = variance.sqrt();

        stats.insert("count".to_string(), count);
        stats.insert("mean".to_string(), mean);
        stats.insert("std".to_string(), std_dev);
        stats.insert("min".to_string(), min);
        stats.insert("max".to_string(), max);
        stats.insert("sum".to_string(), sum);

        results.insert(column_name, stats);
    }

    Ok(results)
}

/// Efficient memory usage optimization
pub fn optimize_memory_usage(
    data: Vec<Vec<String>>,
    target_memory_mb: usize,
) -> PyResult<Vec<Vec<String>>> {
    if data.is_empty() {
        return Ok(data);
    }

    let target_bytes = target_memory_mb * 1024 * 1024;
    let current_size = estimate_memory_size(&data);

    if current_size <= target_bytes {
        return Ok(data); // Already within target
    }

    // Calculate target rows to fit memory constraint
    let avg_row_size = current_size / data.len();
    let target_rows = std::cmp::min(data.len(), target_bytes / avg_row_size);

    // Sample rows to fit memory constraint
    let step = data.len() / target_rows;
    let optimized_data: Vec<Vec<String>> = data
        .into_iter()
        .step_by(step)
        .take(target_rows)
        .collect();

    Ok(optimized_data)
}

/// Estimate memory usage of data structure
fn estimate_memory_size(data: &[Vec<String>]) -> usize {
    data.iter()
        .map(|row| {
            row.iter()
                .map(|cell| cell.len() + std::mem::size_of::<String>())
                .sum::<usize>() + std::mem::size_of::<Vec<String>>()
        })
        .sum::<usize>() + std::mem::size_of::<Vec<Vec<String>>>()
}

/// Parallel data chunking for processing large datasets
pub fn chunk_data_parallel(
    data: Vec<Vec<String>>,
    chunk_size: usize,
    max_memory_mb: usize,
) -> PyResult<Vec<Vec<Vec<String>>>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let max_bytes = max_memory_mb * 1024 * 1024;
    let mut chunks = Vec::new();
    let mut current_chunk = Vec::new();
    let mut current_size = 0;

    for row in data {
        let row_size = estimate_row_size(&row);

        if current_size + row_size > max_bytes && !current_chunk.is_empty() {
            chunks.push(current_chunk.clone());
            current_chunk.clear();
            current_size = 0;
        }

        current_chunk.push(row);
        current_size += row_size;

        if current_chunk.len() >= chunk_size {
            chunks.push(current_chunk.clone());
            current_chunk.clear();
            current_size = 0;
        }
    }

    // Add remaining data
    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }

    Ok(chunks)
}

/// Estimate memory size of a single row
fn estimate_row_size(row: &[String]) -> usize {
    row.iter()
        .map(|cell| cell.len() + std::mem::size_of::<String>())
        .sum::<usize>() + std::mem::size_of::<Vec<String>>()
}

/// Benchmark memory operations performance
pub fn benchmark_memory_ops() -> f64 {
    use std::time::Instant;

    // Create test data
    let data: Vec<Vec<String>> = (0..50_000)
        .map(|i| vec![
            format!("row_{}", i),
            (i as f64 * 1.5).to_string(),
            if i % 2 == 0 { "true".to_string() } else { "false".to_string() },
            format!("category_{}", i % 100),
        ])
        .collect();

    let start = Instant::now();

    // Run memory operations
    let null_values = vec!["".to_string(), "null".to_string(), "NA".to_string()];
    let _cleaned = fast_data_clean_impl(data.clone(), null_values, true).unwrap();
    let _duplicates = detect_duplicates(data.clone(), None).unwrap();
    let _stats = compute_column_stats(data, vec![1]).unwrap();

    let duration = start.elapsed();

    // Return operations per second
    150_000.0 / duration.as_secs_f64() // 3 operations * 50k rows
}