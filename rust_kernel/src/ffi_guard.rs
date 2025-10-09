// ============================================================================
// FFI Safety Layer for Schlep-Engine
// ============================================================================
//
// Provides a safety wrapper for FFI calls with:
// - Panic recovery at FFI boundaries
// - Input validation and sanitization
// - Buffer overflow protection
// - Error propagation to Go
//
// Critical for production stability - ensures Rust panics don't crash the
// Go process and all errors are properly propagated across the FFI boundary.
//
// Phase: 2 - Runtime Abstraction
// ============================================================================

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::panic;
use serde_json::json;

// ============================================================================
// Constants
// ============================================================================

/// Maximum allowed string length for FFI inputs (1MB)
const MAX_STRING_LENGTH: usize = 1024 * 1024;

/// Maximum allowed array length for FFI inputs
const MAX_ARRAY_LENGTH: usize = 1_000_000;

/// Maximum allowed feature vector size
const MAX_FEATURES_LENGTH: usize = 10_000;

// ============================================================================
// FFI Error Result
// ============================================================================

/// FFI-safe result structure returned to Go
///
/// Encoded as JSON string for easy parsing on Go side:
/// Success: {"success": true, "data": {...}}
/// Error: {"success": false, "error": "...", "error_type": "..."}
#[derive(Debug)]
pub struct FFIResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
    pub error_type: Option<String>,
}

impl FFIResult {
    /// Create a success result
    pub fn success(data: serde_json::Value) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            error_type: None,
        }
    }

    /// Create an error result
    pub fn error(error_type: &str, message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
            error_type: Some(error_type.to_string()),
        }
    }

    /// Convert to JSON string for FFI return
    pub fn to_json_string(&self) -> String {
        if self.success {
            json!({
                "success": true,
                "data": self.data
            }).to_string()
        } else {
            json!({
                "success": false,
                "error": self.error,
                "error_type": self.error_type
            }).to_string()
        }
    }

    /// Convert to C string for FFI return
    pub fn to_c_string(&self) -> *mut c_char {
        let json_str = self.to_json_string();
        match CString::new(json_str) {
            Ok(c_str) => c_str.into_raw(),
            Err(_) => {
                // Fallback error if JSON contains null bytes
                let fallback = CString::new(r#"{"success":false,"error":"JSON serialization failed"}"#).unwrap();
                fallback.into_raw()
            }
        }
    }
}

// ============================================================================
// Input Validation
// ============================================================================

/// Validate and convert C string to Rust String
///
/// # Safety
/// This function assumes ptr is a valid null-terminated C string
pub unsafe fn validate_c_string(ptr: *const c_char, max_len: usize) -> Result<String, String> {
    if ptr.is_null() {
        return Err("Null pointer".to_string());
    }

    // Convert to CStr
    let c_str = CStr::from_ptr(ptr);

    // Check length
    let bytes = c_str.to_bytes();
    if bytes.len() > max_len {
        return Err(format!("String too long: {} > {}", bytes.len(), max_len));
    }

    // Convert to UTF-8
    c_str.to_str()
        .map(|s| s.to_string())
        .map_err(|e| format!("Invalid UTF-8: {}", e))
}

/// Validate array pointer and length
///
/// # Safety
/// This function assumes ptr is a valid pointer to an array of T
pub unsafe fn validate_array<T>(ptr: *const T, len: usize) -> Result<&'static [T], String> {
    if ptr.is_null() {
        return Err("Null array pointer".to_string());
    }

    if len == 0 {
        return Err("Empty array".to_string());
    }

    if len > MAX_ARRAY_LENGTH {
        return Err(format!("Array too long: {} > {}", len, MAX_ARRAY_LENGTH));
    }

    Ok(std::slice::from_raw_parts(ptr, len))
}

/// Validate feature vector
pub fn validate_features(features: &[f64]) -> Result<(), String> {
    if features.is_empty() {
        return Err("Empty feature vector".to_string());
    }

    if features.len() > MAX_FEATURES_LENGTH {
        return Err(format!("Feature vector too long: {} > {}", features.len(), MAX_FEATURES_LENGTH));
    }

    // Check for invalid values
    for (i, &value) in features.iter().enumerate() {
        if value.is_nan() {
            return Err(format!("NaN value at index {}", i));
        }
        if value.is_infinite() {
            return Err(format!("Infinite value at index {}", i));
        }
    }

    Ok(())
}

// ============================================================================
// Panic Handling
// ============================================================================

/// Execute a function with panic recovery
///
/// If the function panics, catches the panic and returns an error result.
/// This prevents Rust panics from crashing the Go process.
pub fn catch_panic<F>(f: F) -> FFIResult
where
    F: FnOnce() -> FFIResult + panic::UnwindSafe,
{
    match panic::catch_unwind(f) {
        Ok(result) => result,
        Err(panic_info) => {
            let error_message = if let Some(s) = panic_info.downcast_ref::<&str>() {
                format!("Panic: {}", s)
            } else if let Some(s) = panic_info.downcast_ref::<String>() {
                format!("Panic: {}", s)
            } else {
                "Unknown panic".to_string()
            };

            FFIResult::error("panic", error_message)
        }
    }
}

/// Macro to wrap FFI function with safety checks
///
/// Usage:
/// ```rust
/// ffi_guard!("function_name", || {
///     // Your FFI implementation here
///     FFIResult::success(json!({"result": 42}))
/// })
/// ```
#[macro_export]
macro_rules! ffi_guard {
    ($fn_name:expr, $body:expr) => {{
        $crate::ffi_guard::catch_panic(|| {
            // Execute the function body
            $body
        })
    }};
}

// ============================================================================
// Safe FFI Wrappers
// ============================================================================

/// Safe wrapper for converting Rust result to FFI result
pub fn to_ffi_result<T, E>(result: Result<T, E>) -> FFIResult
where
    T: serde::Serialize,
    E: std::fmt::Display,
{
    match result {
        Ok(value) => {
            match serde_json::to_value(value) {
                Ok(json_value) => FFIResult::success(json_value),
                Err(e) => FFIResult::error("serialization", format!("Serialization failed: {}", e)),
            }
        }
        Err(e) => FFIResult::error("runtime", e.to_string()),
    }
}

/// Parse JSON string from C string
///
/// # Safety
/// This function assumes ptr is a valid null-terminated C string
pub unsafe fn parse_json_from_c_str(ptr: *const c_char) -> Result<serde_json::Value, String> {
    let json_str = validate_c_string(ptr, MAX_STRING_LENGTH)?;

    serde_json::from_str(&json_str)
        .map_err(|e| format!("JSON parse error: {}", e))
}

// ============================================================================
// FFI Memory Management
// ============================================================================

/// Free a C string allocated by Rust
///
/// This must be called from Go after receiving a string result from Rust
///
/// # Safety
/// This function assumes ptr was allocated by Rust via CString::into_raw()
#[no_mangle]
pub unsafe extern "C" fn rust_free_ffi_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        let _ = CString::from_raw(ptr);
    }
}

/// Allocate a C string from Rust string
pub fn allocate_c_string(s: String) -> *mut c_char {
    match CString::new(s) {
        Ok(c_str) => c_str.into_raw(),
        Err(_) => {
            // If string contains null bytes, return error JSON
            let error = FFIResult::error("allocation", "String contains null bytes".to_string());
            error.to_c_string()
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_result_success() {
        let result = FFIResult::success(json!({"value": 42}));
        assert!(result.success);
        assert!(result.data.is_some());
        assert!(result.error.is_none());

        let json_str = result.to_json_string();
        assert!(json_str.contains("\"success\":true"));
        assert!(json_str.contains("\"value\":42"));
    }

    #[test]
    fn test_ffi_result_error() {
        let result = FFIResult::error("validation", "Invalid input".to_string());
        assert!(!result.success);
        assert!(result.data.is_none());
        assert!(result.error.is_some());

        let json_str = result.to_json_string();
        assert!(json_str.contains("\"success\":false"));
        assert!(json_str.contains("Invalid input"));
    }

    #[test]
    fn test_validate_features_empty() {
        let features: Vec<f64> = vec![];
        let result = validate_features(&features);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_features_nan() {
        let features = vec![1.0, 2.0, f64::NAN, 4.0];
        let result = validate_features(&features);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("NaN"));
    }

    #[test]
    fn test_validate_features_infinite() {
        let features = vec![1.0, 2.0, f64::INFINITY, 4.0];
        let result = validate_features(&features);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Infinite"));
    }

    #[test]
    fn test_validate_features_valid() {
        let features = vec![1.0, 2.0, 3.0, 4.0];
        let result = validate_features(&features);
        assert!(result.is_ok());
    }

    #[test]
    fn test_catch_panic_success() {
        let result = catch_panic(|| {
            FFIResult::success(json!({"test": true}))
        });

        assert!(result.success);
    }

    #[test]
    fn test_catch_panic_panic() {
        let result = catch_panic(|| {
            panic!("Test panic");
        });

        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("Test panic"));
    }

    #[test]
    fn test_to_ffi_result_ok() {
        let result: Result<i32, String> = Ok(42);
        let ffi_result = to_ffi_result(result);

        assert!(ffi_result.success);
        assert_eq!(ffi_result.data.unwrap(), json!(42));
    }

    #[test]
    fn test_to_ffi_result_err() {
        let result: Result<i32, String> = Err("test error".to_string());
        let ffi_result = to_ffi_result(result);

        assert!(!ffi_result.success);
        assert!(ffi_result.error.as_ref().unwrap().contains("test error"));
    }

    #[test]
    fn test_validate_c_string() {
        let test_str = CString::new("hello").unwrap();
        let ptr = test_str.as_ptr();

        unsafe {
            let result = validate_c_string(ptr, MAX_STRING_LENGTH);
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), "hello");
        }
    }

    #[test]
    fn test_validate_c_string_null() {
        unsafe {
            let result = validate_c_string(std::ptr::null(), MAX_STRING_LENGTH);
            assert!(result.is_err());
            assert!(result.unwrap_err().contains("Null"));
        }
    }
}
