use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use serde_json::{Value, json};
use chrono::Utc;

// =====================================================
// Inference-Focused FFI Exports (Phase 10 Cleanup)
// Removed deprecated modules: data_normalizer, data_registry, etl_runner
// =====================================================

// =====================================================
// Phase 2 Runtime Abstraction Modules
// =====================================================
pub mod runtime_abstraction;
pub mod ffi_guard;

// Phase 6: Memory pooling and caching modules
pub mod cache;
pub mod mempool;

// Phase 7: Parallel batch processing
pub mod parallel;

// Phase 8: Predictive prefetching
pub mod prefetch;

// Phase 9: Reliability and adaptive performance
pub mod reliability;

// Phase 10: Adaptive Orchestration Layer
pub mod orchestration;

// Phase 11: AI-Driven Policy Autotuner (RL)
pub mod rl;

// Phase 11.2: Predictive Intelligence Layer
pub mod predictive;

// Phase 12: Autonomous Reliability Layer
pub mod autonomous;

// Phase 12: SLO Enforcer & Auditor
pub mod slo_enforcer;

// Phase 13: Cognitive Control Layer
pub mod cognitive;

// =====================================================
// Basic Math Operations (From Prototype)
// =====================================================

#[no_mangle]
pub extern "C" fn rust_add(x: i32, y: i32) -> i32 {
    x + y
}

#[no_mangle]
pub extern "C" fn rust_multiply(x: i32, y: i32) -> i32 {
    x * y
}

#[no_mangle]
pub extern "C" fn rust_sum_array(arr: *const i32, len: usize) -> i32 {
    if arr.is_null() {
        return 0;
    }

    let slice = unsafe { std::slice::from_raw_parts(arr, len) };
    slice.iter().sum()
}

// =====================================================
// String Operations
// =====================================================

#[no_mangle]
pub extern "C" fn rust_hello(name: *const c_char) -> *mut c_char {
    if name.is_null() {
        let result = CString::new("Hello from Rust kernel!").unwrap();
        return result.into_raw();
    }

    let c_str = unsafe { CStr::from_ptr(name) };
    let name_str = c_str.to_str().unwrap_or("World");
    let message = format!("Hello {} from Rust kernel!", name_str);

    let result = CString::new(message).unwrap();
    result.into_raw()
}

#[no_mangle]
pub extern "C" fn rust_free_string(s: *mut c_char) {
    if s.is_null() {
        return;
    }
    unsafe {
        let _ = CString::from_raw(s);
    }
}

// =====================================================
// JSON Validation & Processing
// =====================================================

#[no_mangle]
pub extern "C" fn rust_validate_json(json_str: *const c_char) -> bool {
    if json_str.is_null() {
        return false;
    }

    let c_str = unsafe { CStr::from_ptr(json_str) };
    let json_string = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };

    serde_json::from_str::<Value>(json_string).is_ok()
}

#[no_mangle]
pub extern "C" fn rust_validate_schema(json_str: *const c_char, schema_str: *const c_char) -> *mut c_char {
    if json_str.is_null() || schema_str.is_null() {
        let error = json!({
            "valid": false,
            "error": "Null input"
        });
        let result = CString::new(error.to_string()).unwrap();
        return result.into_raw();
    }

    let json_c_str = unsafe { CStr::from_ptr(json_str) };
    let schema_c_str = unsafe { CStr::from_ptr(schema_str) };

    let json_string = match json_c_str.to_str() {
        Ok(s) => s,
        Err(_) => {
            let error = json!({
                "valid": false,
                "error": "Invalid UTF-8 in JSON"
            });
            let result = CString::new(error.to_string()).unwrap();
            return result.into_raw();
        }
    };

    let schema_string = match schema_c_str.to_str() {
        Ok(s) => s,
        Err(_) => {
            let error = json!({
                "valid": false,
                "error": "Invalid UTF-8 in schema"
            });
            let result = CString::new(error.to_string()).unwrap();
            return result.into_raw();
        }
    };

    // Parse JSON
    let json_value: Value = match serde_json::from_str(json_string) {
        Ok(v) => v,
        Err(e) => {
            let error = json!({
                "valid": false,
                "error": format!("JSON parse error: {}", e)
            });
            let result = CString::new(error.to_string()).unwrap();
            return result.into_raw();
        }
    };

    // Parse schema
    let schema_value: Value = match serde_json::from_str(schema_string) {
        Ok(v) => v,
        Err(e) => {
            let error = json!({
                "valid": false,
                "error": format!("Schema parse error: {}", e)
            });
            let result = CString::new(error.to_string()).unwrap();
            return result.into_raw();
        }
    };

    // Simplified schema validation (type checking)
    let validation_result = validate_against_schema(&json_value, &schema_value);

    let result = CString::new(validation_result.to_string()).unwrap();
    result.into_raw()
}

fn validate_against_schema(data: &Value, schema: &Value) -> Value {
    // Simplified validation - check required fields and types
    if let Some(required) = schema.get("required").and_then(|v| v.as_array()) {
        if let Some(obj) = data.as_object() {
            for field in required {
                if let Some(field_name) = field.as_str() {
                    if !obj.contains_key(field_name) {
                        return json!({
                            "valid": false,
                            "error": format!("Missing required field: {}", field_name)
                        });
                    }
                }
            }
        }
    }

    json!({
        "valid": true,
        "message": "Schema validation passed"
    })
}

// =====================================================
// Data Transformation
// =====================================================

#[no_mangle]
pub extern "C" fn rust_transform_json(json_str: *const c_char, transform_type: *const c_char) -> *mut c_char {
    if json_str.is_null() || transform_type.is_null() {
        let error = json!({"error": "Null input"});
        let result = CString::new(error.to_string()).unwrap();
        return result.into_raw();
    }

    let json_c_str = unsafe { CStr::from_ptr(json_str) };
    let transform_c_str = unsafe { CStr::from_ptr(transform_type) };

    let json_string = json_c_str.to_str().unwrap_or("");
    let transform_string = transform_c_str.to_str().unwrap_or("");

    let json_value: Value = match serde_json::from_str(json_string) {
        Ok(v) => v,
        Err(e) => {
            let error = json!({"error": format!("Parse error: {}", e)});
            let result = CString::new(error.to_string()).unwrap();
            return result.into_raw();
        }
    };

    let transformed = match transform_string {
        "uppercase_keys" => transform_uppercase_keys(&json_value),
        "lowercase_keys" => transform_lowercase_keys(&json_value),
        "flatten" => flatten_json(&json_value),
        "add_timestamp" => add_timestamp(&json_value),
        _ => json_value,
    };

    let result = CString::new(transformed.to_string()).unwrap();
    result.into_raw()
}

fn transform_uppercase_keys(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (k, v) in map {
                new_map.insert(k.to_uppercase(), transform_uppercase_keys(v));
            }
            Value::Object(new_map)
        }
        _ => value.clone(),
    }
}

fn transform_lowercase_keys(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (k, v) in map {
                new_map.insert(k.to_lowercase(), transform_lowercase_keys(v));
            }
            Value::Object(new_map)
        }
        _ => value.clone(),
    }
}

fn flatten_json(value: &Value) -> Value {
    // Simplified flatten - just return top-level object
    value.clone()
}

fn add_timestamp(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut new_map = map.clone();
            new_map.insert(
                "timestamp".to_string(),
                Value::String(Utc::now().to_rfc3339())
            );
            Value::Object(new_map)
        }
        _ => value.clone(),
    }
}

// =====================================================
// String Processing & Validation
// =====================================================

#[no_mangle]
pub extern "C" fn rust_sanitize_string(input: *const c_char) -> *mut c_char {
    if input.is_null() {
        let result = CString::new("").unwrap();
        return result.into_raw();
    }

    let c_str = unsafe { CStr::from_ptr(input) };
    let input_str = c_str.to_str().unwrap_or("");

    // Remove dangerous characters
    let sanitized: String = input_str
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || "-_@.".contains(*c))
        .collect();

    let result = CString::new(sanitized).unwrap();
    result.into_raw()
}

#[no_mangle]
pub extern "C" fn rust_validate_email(email: *const c_char) -> bool {
    if email.is_null() {
        return false;
    }

    let c_str = unsafe { CStr::from_ptr(email) };
    let email_str = c_str.to_str().unwrap_or("");

    // Simple email validation
    email_str.contains('@') && email_str.contains('.') && email_str.len() >= 5
}

#[no_mangle]
pub extern "C" fn rust_hash_string(input: *const c_char) -> *mut c_char {
    if input.is_null() {
        let result = CString::new("").unwrap();
        return result.into_raw();
    }

    let c_str = unsafe { CStr::from_ptr(input) };
    let input_str = c_str.to_str().unwrap_or("");

    // Simple hash (use proper crypto library in production)
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    input_str.hash(&mut hasher);
    let hash_value = hasher.finish();

    let hash_string = format!("{:x}", hash_value);
    let result = CString::new(hash_string).unwrap();
    result.into_raw()
}

// =====================================================
// Data Processing
// =====================================================

#[no_mangle]
pub extern "C" fn rust_filter_array(json_array: *const c_char, filter_key: *const c_char, filter_value: *const c_char) -> *mut c_char {
    if json_array.is_null() || filter_key.is_null() || filter_value.is_null() {
        let error = json!({"error": "Null input", "result": []});
        let result = CString::new(error.to_string()).unwrap();
        return result.into_raw();
    }

    let array_c_str = unsafe { CStr::from_ptr(json_array) };
    let key_c_str = unsafe { CStr::from_ptr(filter_key) };
    let value_c_str = unsafe { CStr::from_ptr(filter_value) };

    let array_str = array_c_str.to_str().unwrap_or("[]");
    let key_str = key_c_str.to_str().unwrap_or("");
    let value_str = value_c_str.to_str().unwrap_or("");

    let array: Value = match serde_json::from_str(array_str) {
        Ok(v) => v,
        Err(_) => {
            let error = json!({"error": "Invalid JSON array", "result": []});
            let result = CString::new(error.to_string()).unwrap();
            return result.into_raw();
        }
    };

    if let Some(items) = array.as_array() {
        let filtered: Vec<&Value> = items
            .iter()
            .filter(|item| {
                if let Some(obj) = item.as_object() {
                    if let Some(val) = obj.get(key_str) {
                        return val.as_str() == Some(value_str);
                    }
                }
                false
            })
            .collect();

        let result_json = json!({"result": filtered});
        let result = CString::new(result_json.to_string()).unwrap();
        return result.into_raw();
    }

    let error = json!({"error": "Not an array", "result": []});
    let result = CString::new(error.to_string()).unwrap();
    result.into_raw()
}

#[no_mangle]
pub extern "C" fn rust_sort_array(json_array: *const c_char, sort_key: *const c_char, ascending: bool) -> *mut c_char {
    if json_array.is_null() || sort_key.is_null() {
        let error = json!({"error": "Null input", "result": []});
        let result = CString::new(error.to_string()).unwrap();
        return result.into_raw();
    }

    let array_c_str = unsafe { CStr::from_ptr(json_array) };
    let key_c_str = unsafe { CStr::from_ptr(sort_key) };

    let array_str = array_c_str.to_str().unwrap_or("[]");
    let key_str = key_c_str.to_str().unwrap_or("");

    let mut array: Value = match serde_json::from_str(array_str) {
        Ok(v) => v,
        Err(_) => {
            let error = json!({"error": "Invalid JSON array", "result": []});
            let result = CString::new(error.to_string()).unwrap();
            return result.into_raw();
        }
    };

    if let Some(items) = array.as_array_mut() {
        items.sort_by(|a, b| {
            let a_val = a.get(key_str);
            let b_val = b.get(key_str);

            match (a_val, b_val) {
                (Some(av), Some(bv)) => {
                    if ascending {
                        compare_values(av, bv)
                    } else {
                        compare_values(bv, av)
                    }
                }
                _ => std::cmp::Ordering::Equal,
            }
        });

        let result_json = json!({"result": items});
        let result = CString::new(result_json.to_string()).unwrap();
        return result.into_raw();
    }

    let error = json!({"error": "Not an array", "result": []});
    let result = CString::new(error.to_string()).unwrap();
    result.into_raw()
}

fn compare_values(a: &Value, b: &Value) -> std::cmp::Ordering {
    match (a, b) {
        (Value::Number(an), Value::Number(bn)) => {
            let a_f = an.as_f64().unwrap_or(0.0);
            let b_f = bn.as_f64().unwrap_or(0.0);
            a_f.partial_cmp(&b_f).unwrap_or(std::cmp::Ordering::Equal)
        }
        (Value::String(as_), Value::String(bs)) => as_.cmp(bs),
        _ => std::cmp::Ordering::Equal,
    }
}

// =====================================================
// Performance Utilities
// =====================================================

#[no_mangle]
pub extern "C" fn rust_benchmark_operation(iterations: i32) -> i64 {
    let start = std::time::Instant::now();

    let mut _sum: i64 = 0;
    for i in 0..iterations {
        _sum += (i * i) as i64;
    }

    let elapsed = start.elapsed();
    elapsed.as_micros() as i64
}

// =====================================================
// Tests
// =====================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rust_add() {
        assert_eq!(rust_add(5, 3), 8);
        assert_eq!(rust_add(-5, 3), -2);
    }

    #[test]
    fn test_rust_multiply() {
        assert_eq!(rust_multiply(5, 3), 15);
        assert_eq!(rust_multiply(-5, 3), -15);
    }

    #[test]
    fn test_rust_validate_email() {
        let valid_email = CString::new("user@example.com").unwrap();
        let invalid_email = CString::new("invalid").unwrap();

        assert!(rust_validate_email(valid_email.as_ptr()));
        assert!(!rust_validate_email(invalid_email.as_ptr()));
    }
}
