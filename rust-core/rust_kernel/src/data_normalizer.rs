// Data normalization module for multi-format ingestion
// Converts CSV, JSON, Parquet, and Avro to standardized ML-ready format

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::io::Cursor;

// Parquet support
use parquet::file::reader::{FileReader, SerializedFileReader};
use parquet::record::reader::RowIter;
use arrow::array::{Array, Float64Array, StringArray};
use arrow::datatypes::DataType;

// Avro support
use avro_rs::{Reader, Schema, from_value, types::Value as AvroValue};

/// Normalized data record in ML-ready format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedRecord {
    pub features: Vec<f64>,
    pub metadata: HashMap<String, String>,
    pub schema_version: String,
}

/// Data format types supported
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DataFormat {
    JSON,
    CSV,
    Parquet,
    Avro,
}

/// Parse JSON data to normalized format
pub fn parse_json(json_str: &str) -> Result<Vec<NormalizedRecord>, String> {
    let value: JsonValue = serde_json::from_str(json_str)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let mut records = Vec::new();

    match value {
        JsonValue::Array(arr) => {
            for item in arr {
                if let Some(record) = extract_record_from_json(&item) {
                    records.push(record);
                }
            }
        }
        JsonValue::Object(_) => {
            if let Some(record) = extract_record_from_json(&value) {
                records.push(record);
            }
        }
        _ => return Err("JSON must be an object or array".to_string()),
    }

    Ok(records)
}

/// Extract a normalized record from JSON value
fn extract_record_from_json(value: &JsonValue) -> Option<NormalizedRecord> {
    match value {
        JsonValue::Object(map) => {
            // Try to extract "features" array
            let features = if let Some(JsonValue::Array(feat_arr)) = map.get("features") {
                feat_arr
                    .iter()
                    .filter_map(|v| v.as_f64())
                    .collect::<Vec<f64>>()
            } else {
                // Fallback: extract all numeric values
                map.values()
                    .filter_map(|v| v.as_f64())
                    .collect::<Vec<f64>>()
            };

            if features.is_empty() {
                return None;
            }

            // Extract metadata (non-numeric fields)
            let metadata = map
                .iter()
                .filter(|(k, v)| k.as_str() != "features" && !v.is_number())
                .map(|(k, v)| (k.clone(), v.to_string()))
                .collect();

            Some(NormalizedRecord {
                features,
                metadata,
                schema_version: "1.0".to_string(),
            })
        }
        _ => None,
    }
}

/// Parse CSV data to normalized format
pub fn parse_csv(csv_str: &str) -> Result<Vec<NormalizedRecord>, String> {
    let mut reader = csv::Reader::from_reader(csv_str.as_bytes());
    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| format!("CSV header error: {}", e))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let mut records = Vec::new();

    for result in reader.records() {
        let record = result.map_err(|e| format!("CSV record error: {}", e))?;

        let mut features = Vec::new();
        let mut metadata = HashMap::new();

        for (i, field) in record.iter().enumerate() {
            let header = headers.get(i).unwrap_or(&format!("col_{}", i));

            // Try to parse as number
            if let Ok(num) = field.parse::<f64>() {
                features.push(num);
            } else {
                // Store as metadata if not numeric
                metadata.insert(header.clone(), field.to_string());
            }
        }

        if !features.is_empty() {
            records.push(NormalizedRecord {
                features,
                metadata,
                schema_version: "1.0".to_string(),
            });
        }
    }

    Ok(records)
}

/// Parse Parquet data to normalized format
pub fn parse_parquet(parquet_bytes: &[u8]) -> Result<Vec<NormalizedRecord>, String> {
    let cursor = Cursor::new(parquet_bytes);
    let reader = SerializedFileReader::new(cursor)
        .map_err(|e| format!("Parquet reader error: {}", e))?;

    let mut records = Vec::new();
    let metadata = reader.metadata().file_metadata();
    let schema = metadata.schema();

    // Read row groups
    for row_group in 0..reader.num_row_groups() {
        let row_group_reader = reader.get_row_group(row_group)
            .map_err(|e| format!("Row group error: {}", e))?;

        // Extract features from numeric columns
        for col_idx in 0..schema.num_columns() {
            let col_desc = schema.get_column(col_idx);
            let col_name = col_desc.name();

            // Read column data (simplified - assumes numeric data)
            // In production, use Arrow arrays for better performance
            // This is a simplified version for demonstration
        }
    }

    // Use Polars for simpler Parquet handling (better approach)
    // This avoids low-level Parquet API complexity
    Ok(records)
}

/// Parse Parquet using Polars (recommended approach)
pub fn parse_parquet_polars(parquet_bytes: &[u8]) -> Result<Vec<NormalizedRecord>, String> {
    use polars::prelude::*;

    let cursor = Cursor::new(parquet_bytes);
    let df = ParquetReader::new(cursor)
        .finish()
        .map_err(|e| format!("Polars Parquet error: {}", e))?;

    let mut records = Vec::new();
    let height = df.height();

    // Extract numeric columns as features
    let numeric_cols: Vec<&str> = df.get_columns()
        .iter()
        .filter(|col| matches!(col.dtype(), DataType::Float64 | DataType::Float32 | DataType::Int64 | DataType::Int32))
        .map(|col| col.name())
        .collect();

    // Extract non-numeric columns as metadata
    let string_cols: Vec<&str> = df.get_columns()
        .iter()
        .filter(|col| matches!(col.dtype(), DataType::Utf8))
        .map(|col| col.name())
        .collect();

    for row_idx in 0..height {
        let mut features = Vec::new();
        let mut metadata = HashMap::new();

        // Extract numeric features
        for col_name in &numeric_cols {
            if let Ok(series) = df.column(col_name) {
                match series.dtype() {
                    DataType::Float64 => {
                        if let Ok(ca) = series.f64() {
                            if let Some(val) = ca.get(row_idx) {
                                features.push(val);
                            }
                        }
                    }
                    DataType::Float32 => {
                        if let Ok(ca) = series.f32() {
                            if let Some(val) = ca.get(row_idx) {
                                features.push(val as f64);
                            }
                        }
                    }
                    DataType::Int64 => {
                        if let Ok(ca) = series.i64() {
                            if let Some(val) = ca.get(row_idx) {
                                features.push(val as f64);
                            }
                        }
                    }
                    DataType::Int32 => {
                        if let Ok(ca) = series.i32() {
                            if let Some(val) = ca.get(row_idx) {
                                features.push(val as f64);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        // Extract string metadata
        for col_name in &string_cols {
            if let Ok(series) = df.column(col_name) {
                if let Ok(ca) = series.utf8() {
                    if let Some(val) = ca.get(row_idx) {
                        metadata.insert(col_name.to_string(), val.to_string());
                    }
                }
            }
        }

        if !features.is_empty() {
            records.push(NormalizedRecord {
                features,
                metadata,
                schema_version: "1.0".to_string(),
            });
        }
    }

    Ok(records)
}

/// Parse Avro data to normalized format
pub fn parse_avro(avro_bytes: &[u8]) -> Result<Vec<NormalizedRecord>, String> {
    let reader = Reader::new(avro_bytes)
        .map_err(|e| format!("Avro reader error: {}", e))?;

    let mut records = Vec::new();

    for value_result in reader {
        let value = value_result.map_err(|e| format!("Avro value error: {}", e))?;

        match value {
            AvroValue::Record(fields) => {
                let mut features = Vec::new();
                let mut metadata = HashMap::new();

                for (field_name, field_value) in fields {
                    match field_value {
                        AvroValue::Double(d) => features.push(d),
                        AvroValue::Float(f) => features.push(f as f64),
                        AvroValue::Long(l) => features.push(l as f64),
                        AvroValue::Int(i) => features.push(i as f64),
                        AvroValue::String(s) => {
                            metadata.insert(field_name, s);
                        }
                        AvroValue::Array(arr) => {
                            // Try to extract numeric array as features
                            for item in arr {
                                match item {
                                    AvroValue::Double(d) => features.push(d),
                                    AvroValue::Float(f) => features.push(f as f64),
                                    AvroValue::Long(l) => features.push(l as f64),
                                    AvroValue::Int(i) => features.push(i as f64),
                                    _ => {}
                                }
                            }
                        }
                        _ => {
                            // Store other types as metadata string
                            metadata.insert(field_name, format!("{:?}", field_value));
                        }
                    }
                }

                if !features.is_empty() {
                    records.push(NormalizedRecord {
                        features,
                        metadata,
                        schema_version: "1.0".to_string(),
                    });
                }
            }
            _ => {
                return Err("Avro data must contain records".to_string());
            }
        }
    }

    Ok(records)
}

/// Normalize data from any supported format
pub fn normalize_data(data: &str, format: DataFormat) -> Result<Vec<NormalizedRecord>, String> {
    match format {
        DataFormat::JSON => parse_json(data),
        DataFormat::CSV => parse_csv(data),
        DataFormat::Parquet => {
            // For string input, assume base64 encoded or error
            Err("Parquet requires binary data - use parse_parquet_polars() with bytes".to_string())
        }
        DataFormat::Avro => {
            // For string input, assume base64 encoded or error
            Err("Avro requires binary data - use parse_avro() with bytes".to_string())
        }
    }
}

/// Detect data format from content
pub fn detect_format(data: &str) -> DataFormat {
    let trimmed = data.trim();

    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        DataFormat::JSON
    } else if trimmed.lines().next().map_or(false, |line| line.contains(',')) {
        DataFormat::CSV
    } else {
        DataFormat::JSON // Default fallback
    }
}

// FFI exports for Go integration

/// Parse JSON and return normalized data (FFI)
#[no_mangle]
pub extern "C" fn rust_normalize_json(json_str: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(json_str) };
    let data = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return CString::new("").unwrap().into_raw(),
    };

    match parse_json(data) {
        Ok(records) => {
            let json = serde_json::to_string(&records).unwrap_or_else(|_| "[]".to_string());
            CString::new(json).unwrap().into_raw()
        }
        Err(e) => {
            eprintln!("Normalize JSON error: {}", e);
            CString::new("[]").unwrap().into_raw()
        }
    }
}

/// Parse CSV and return normalized data (FFI)
#[no_mangle]
pub extern "C" fn rust_normalize_csv(csv_str: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(csv_str) };
    let data = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return CString::new("").unwrap().into_raw(),
    };

    match parse_csv(data) {
        Ok(records) => {
            let json = serde_json::to_string(&records).unwrap_or_else(|_| "[]".to_string());
            CString::new(json).unwrap().into_raw()
        }
        Err(e) => {
            eprintln!("Normalize CSV error: {}", e);
            CString::new("[]").unwrap().into_raw()
        }
    }
}

/// Auto-detect format and normalize (FFI)
#[no_mangle]
pub extern "C" fn rust_auto_normalize(data_str: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(data_str) };
    let data = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return CString::new("").unwrap().into_raw(),
    };

    let format = detect_format(data);
    match normalize_data(data, format) {
        Ok(records) => {
            let json = serde_json::to_string(&records).unwrap_or_else(|_| "[]".to_string());
            CString::new(json).unwrap().into_raw()
        }
        Err(e) => {
            eprintln!("Auto-normalize error: {}", e);
            CString::new("[]").unwrap().into_raw()
        }
    }
}

/// Free string allocated by Rust (FFI)
#[no_mangle]
pub extern "C" fn rust_free_string(s: *mut c_char) {
    unsafe {
        if !s.is_null() {
            let _ = CString::from_raw(s);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_json_object() {
        let json = r#"{"features": [1.0, 2.0, 3.0], "name": "test"}"#;
        let records = parse_json(json).unwrap();

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].features, vec![1.0, 2.0, 3.0]);
        assert_eq!(records[0].metadata.get("name").unwrap(), "\"test\"");
    }

    #[test]
    fn test_parse_json_array() {
        let json = r#"[
            {"features": [1.0, 2.0]},
            {"features": [3.0, 4.0]}
        ]"#;
        let records = parse_json(json).unwrap();

        assert_eq!(records.len(), 2);
        assert_eq!(records[0].features, vec![1.0, 2.0]);
        assert_eq!(records[1].features, vec![3.0, 4.0]);
    }

    #[test]
    fn test_parse_csv() {
        let csv = "feature1,feature2,label\n1.0,2.0,A\n3.0,4.0,B";
        let records = parse_csv(csv).unwrap();

        assert_eq!(records.len(), 2);
        assert_eq!(records[0].features, vec![1.0, 2.0]);
        assert_eq!(records[0].metadata.get("label").unwrap(), "A");
    }

    #[test]
    fn test_detect_format() {
        assert_eq!(detect_format(r#"{"key": "value"}"#), DataFormat::JSON);
        assert_eq!(detect_format("a,b,c\n1,2,3"), DataFormat::CSV);
    }
}
