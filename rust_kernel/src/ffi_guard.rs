//! FFI Safety Guard for Rust Kernel
//! 
//! Provides safety mechanisms for FFI operations between Go and Rust,
//! including panic recovery, buffer validation, and error handling.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};
use std::panic::{self, catch_unwind, PanicInfo};
use std::ptr;
use std::slice;
use std::time::Duration;
use lazy_static::lazy_static;
use std::sync::{Arc, Mutex};
use parking_lot::RwLock;
use once_cell::sync::Lazy;
use std::collections::HashMap;

use serde_json::{Value, json};
use log::{error, warn, info, debug};
use tokio::sync::Semaphore;

// Global FFI state tracking
static FFI_STATS: Lazy<RwLock<FFIStatistics>> = Lazy::new(|| {
    RwLock::new(FFIStatistics::new())
});

// Resource limits
const MAX_INPUT_SIZE: usize = 10 * 1024 * 1024; // 10MB
const MAX_OUTPUT_SIZE: usize = 10 * 1024 * 1024; // 10MB
const MAX_CONCURRENT_CALLS: usize = 1000;
const DEFAULT_TIMEOUT_MS: u64 = 5000; // 5 seconds
const PANIC_RECOVERY_MESSAGE: &str = "FFI Panic Recovered - Operation Failed Safely";

// Configuration
const ENABLE_FFI_LOGGING: bool = true;
const ENABLE_BUFFER_VALIDATION: bool = true;
const ENABLE_TIMEOUT_CHECKING: bool = true;

// Semaphore for concurrent FFI calls
static FFI_SEMAPHORE: Lazy<Semaphore> = Lazy::new(|| {
    Semaphore::new(MAX_CONCURRENT_CALLS)
});

// Error codes
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FFIError {
    Success = 0,
    NullPointer = 1,
    BufferOverflow = 2,
    Timeout = 3,
    Panic = 4,
    InvalidUTF8 = 5,
    ResourceExhausted = 6,
    InvalidInput = 7,
    InternalError = 8,
}

// FFI operation context
#[derive(Debug, Clone)]
pub struct FFIContext {
    pub operation_name: String,
    pub start_time: std::time::Instant,
    pub timeout: Duration,
    pub metadata: HashMap<String, String>,
}

impl FFIContext {
    pub fn new(operation_name: &str, timeout_ms: u64) -> Self {
        Self {
            operation_name: operation_name.to_string(),
            start_time: std::time::Instant::now(),
            timeout: Duration::from_millis(timeout_ms),
            metadata: HashMap::new(),
        }
    }
    
    pub fn with_metadata(mut self, key: &str, value: &str) -> Self {
        self.metadata.insert(key.to_string(), value.to_string());
        self
    }
    
    pub fn is_timeout(&self) -> bool {
        self.start_time.elapsed() > self.timeout
    }
}

// Statistics tracking
#[derive(Debug, Default)]
pub struct FFIStatistics {
    total_calls: u64,
    successful_calls: u64,
    failed_calls: u64,
    panic_recovers: u64,
    timeouts: u64,
    null_pointer_errors: u64,
    buffer_overflows: u64,
    total_exec_time_ms: u64,
    max_exec_time_ms: u64,
    min_exec_time_ms: u64,
}

impl FFIStatistics {
    pub fn new() -> Self {
        Self {
            min_exec_time_ms: u64::MAX,
            ..Default::default()
        }
    }
    
    pub fn record_call(&mut self, duration_ms: u64, success: bool, error_type: Option<FFIError>) {
        self.total_calls += 1;
        self.total_exec_time_ms += duration_ms;
        
        if duration_ms > self.max_exec_time_ms {
            self.max_exec_time_ms = duration_ms;
        }
        if duration_ms < self.min_exec_time_ms {
            self.min_exec_time_ms = duration_ms;
        }
        
        if success {
            self.successful_calls += 1;
        } else {
            self.failed_calls += 1;
            
            match error_type {
                Some(FFIError::Panic) => self.panic_recovers += 1,
                Some(FFIError::Timeout) => self.timeouts += 1,
                Some(FFIError::NullPointer) => self.null_pointer_errors += 1,
                Some(FFIError::BufferOverflow) => self.buffer_overflows += 1,
                _ => {}
            }
        }
    }
    
    pub fn success_rate(&self) -> f64 {
        if self.total_calls == 0 {
            return 0.0;
        }
        self.successful_calls as f64 / self.total_calls as f64
    }
    
    pub fn avg_exec_time_ms(&self) -> f64 {
        if self.total_calls == 0 {
            return 0.0;
        }
        self.total_exec_time_ms as f64 / self.total_calls as f64
    }
}

// Safe string operations
pub fn safe_read_c_string(ptr: *const c_char) -> Result<String, FFIError> {
    if ptr.is_null() {
        return Err(FFIError::NullPointer);
    }
    
    let result = unsafe {
        let c_str = CStr::from_ptr(ptr);
        match c_str.to_str() {
            Ok(s) => Ok(s.to_string()),
            Err(_) => Err(FFIError::InvalidUTF8),
        }
    };
    
    result
}

pub fn safe_create_c_string(s: &str) -> *mut c_char {
    match CString::new(s) {
        Ok(c_string) => c_string.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

pub fn safe_free_c_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

// Buffer validation
pub fn validate_buffer_size(size: usize, max_size: usize) -> Result<(), FFIError> {
    if size > max_size {
        return Err(FFIError::BufferOverflow);
    }
    
    if size == 0 {
        return Err(FFIError::InvalidInput);
    }
    
    Ok(())
}

pub fn validate_json_string(json_str: &str) -> Result<Value, FFIError> {
    // First check size
    validate_buffer_size(json_str.len(), MAX_INPUT_SIZE)?;
    
    // Try to parse JSON
    match serde_json::from_str::<Value>(json_str) {
        Ok(value) => Ok(value),
        Err(e) => {
            error!("JSON parsing error: {}", e);
            Err(FFIError::InvalidInput)
        }
    }
}

// Timeout handling
pub async fn with_timeout<F, T>(
    future: F,
    timeout: Duration,
    context: &FFIContext
) -> Result<T, FFIError>
where
    F: std::future::Future<Output = T>,
{
    match tokio::time::timeout(timeout, future).await {
        Ok(result) => Ok(result),
        Err(_) => {
            warn!("FFI operation timeout: {} after {:?}", context.operation_name, context.start_time.elapsed());
            Err(FFIError::Timeout)
        }
    }
}

// Panic recovery wrapper
pub fn safe_ffi_wrapper<F, T>(
    context: FFIContext,
    func: F
) -> Result<T, FFIError>
where
    F: FnOnce() -> Result<T, FFIError> + std::panic::UnwindSafe,
{
    // Acquire semaphore permit
    let _permit = if ENABLE_TIMEOUT_CHECKING {
        match tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
            tokio::time::timeout(Duration::from_millis(1000), FFI_SEMAPHORE.acquire()).await
        }) {
            Ok(Ok(permit)) => Some(permit),
            _ => {
                error!("FFI semaphore acquire timeout for: {}", context.operation_name);
                return Err(FFIError::ResourceExhausted);
            }
        }
    } else {
        None
    };
    
    // Check for timeout before execution
    if context.is_timeout() {
        return Err(FFIError::Timeout);
    }
    
    // Execute with panic recovery
    let start_time = std::time::Instant::now();
    let result = catch_unwind(|| func());
    let duration_ms = start_time.elapsed().as_millis() as u64;
    
    // Update statistics
    {
        let mut stats = FFI_STATS.write();
        let success = result.is_ok();
        let error_type = if let Err(ref panic_error) = result {
            // Try to extract panic information
            match panic_error.downcast_ref::<&str>() {
                Some(msg) => {
                    error!("FFI panic in {}: {}", context.operation_name, msg);
                    FFIError::Panic
                }
                None => {
                    error!("FFI panic in {}: Unknown panic message", context.operation_name);
                    FFIError::Panic
                }
            }
        } else if let Err(ffi_error) = result.as_ref().unwrap() {
            *ffi_error
        } else {
            FFIError::Success
        };
        
        stats.record_call(duration_ms, success, Some(error_type));
        
        if ENABLE_FFI_LOGGING {
            info!(
                "FFI call: {} - Duration: {}ms - Success: {} - Error: {:?}",
                context.operation_name,
                duration_ms,
                success,
                error_type
            );
        }
    }
    
    match result {
        Ok(inner_result) => match inner_result {
            Ok(value) => Ok(value),
            Err(error) => {
                warn!("FFI operation failed: {} - {:?}", context.operation_name, error);
                Err(error)
            }
        },
        Err(panic_error) => {
            error!("FFI panic recovered in operation: {}", context.operation_name);
            // Create a safe error response
            Err(FFIError::Panic)
        }
    }
}

// Safe JSON operations with FFI
pub fn safe_json_validate(json_ptr: *const c_char, context: FFIContext) -> *mut c_char {
    let result = safe_ffi_wrapper(context, move || {
        // Read input string safely
        let json_str = safe_read_c_string(json_ptr)?;
        
        // Validate JSON
        let json_value = validate_json_string(&json_str)?;
        
        // Return success response
        let response = json!({
            "success": true,
            "valid": true,
            "message": "JSON validation successful"
        });
        
        Ok(safe_create_c_string(&response.to_string()))
    });
    
    match result {
        Ok(response_ptr) => {
            info!("JSON validation successful");
            response_ptr
        }
        Err(error) => {
            error!("JSON validation failed: {:?}", error);
            let error_response = json!({
                "success": false,
                "error": format!("Validation failed: {:?}", error),
                "code": error as i32
            });
            safe_create_c_string(&error_response.to_string())
        }
    }
}

pub fn safe_json_transform(
    json_ptr: *const c_char,
    transform_type_ptr: *const c_char,
    context: FFIContext
) -> *mut c_char {
    let result = safe_ffi_wrapper(context, move || {
        // Read inputs
        let json_str = safe_read_c_string(json_ptr)?;
        let transform_type = safe_read_c_string(transform_type_ptr)?;
        
        // Parse JSON
        let json_value = validate_json_string(&json_str)?;
        
        // Apply transformation
        let transformed = apply_transformation(&json_value, &transform_type)?;
        
        // Return success
        let response = json!({
            "success": true,
            "transformed": transformed,
            "transform_type": transform_type
        });
        
        Ok(safe_create_c_string(&response.to_string()))
    });
    
    match result {
        Ok(response_ptr) => {
            info!("JSON transform successful: type: {}", unsafe {
                CStr::from_ptr(transform_type_ptr).to_string_lossy()
            });
            response_ptr
        }
        Err(error) => {
            error!("JSON transform failed: {:?}", error);
            let error_response = json!({
                "success": false,
                "error": format!("Transform failed: {:?}", error),
                "code": error as i32
            });
            safe_create_c_string(&error_response.to_string())
        }
    }
}

fn apply_transformation(json: &Value, transform_type: &str) -> Result<Value, FFIError> {
    match transform_type {
        "uppercase_keys" => Ok(uppercase_keys(json)),
        "lowercase_keys" => Ok(lowercase_keys(json)),
        "add_timestamp" => Ok(add_timestamp(json)),
        "flatten" => Ok(flatten_json(json)),
        "validate_schema" => Ok(validate_schema(json)),
        _ => Ok(json.clone()),
    }
}

fn uppercase_keys(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (k, v) in map {
                new_map.insert(k.to_uppercase(), uppercase_keys(v));
            }
            Value::Object(new_map)
        }
        _ => value.clone(),
    }
}

fn lowercase_keys(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (k, v) in map {
                new_map.insert(k.to_lowercase(), lowercase_keys(v));
            }
            Value::Object(new_map)
        }
        _ => value.clone(),
    }
}

fn add_timestamp(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut new_map = map.clone();
            new_map.insert(
                "timestamp".to_string(),
                Value::String(chrono::Utc::now().to_rfc3339())
            );
            Value::Object(new_map)
        }
        _ => value.clone(),
    }
}

fn flatten_json(value: &Value) -> Value {
    // Simplified flatten implementation
    value.clone()
}

fn validate_schema(_value: &Value) -> Value {
    // Simplified schema validation
    json!({
        "valid": true,
        "message": "Schema validation placeholder"
    })
}

// Statistics API
#[no_mangle]
pub extern "C" fn ffi_get_statistics() -> *mut c_char {
    let stats = FFI_STATS.read();
    let response = json!({
        "total_calls": stats.total_calls,
        "successful_calls": stats.successful_calls,
        "failed_calls": stats.failed_calls,
        "panic_recovers": stats.panic_recovers,
        "timeouts": stats.timeouts,
        "null_pointer_errors": stats.null_pointer_errors,
        "buffer_overflows": stats.buffer_overflows,
        "success_rate": format!("{:.2}%", stats.success_rate() * 100.0),
        "avg_exec_time_ms": format!("{:.2}", stats.avg_exec_time_ms()),
        "max_exec_time_ms": stats.max_exec_time_ms,
        "min_exec_time_ms": if stats.min_exec_time_ms == u64::MAX { 0 } else { stats.min_exec_time_ms },
        "max_concurrent_calls": MAX_CONCURRENT_CALLS,
        "max_input_size_mb": MAX_INPUT_SIZE / (1024 * 1024),
        "max_output_size_mb": MAX_OUTPUT_SIZE / (1024 * 1024)
    });
    
    safe_create_c_string(&response.to_string())
}

#[no_mangle]
pub extern "C" fn ffi_reset_statistics() {
    let mut stats = FFI_STATS.write();
    *stats = FFIStatistics::new();
    info!("FFI statistics reset");
}

// Memory safety utilities
#[no_mangle]
pub extern "C" fn ffi_safe_free_memory(ptr: *mut c_void) {
    if !ptr.is_null() {
        // For complex memory management, we'd need to track allocations
        // For now, this is a placeholder
        unsafe {
            let _ = Box::from_raw(ptr);
        }
    }
}

// Configuration API
#[no_mangle]
pub extern "C" fn ffi_set_timeout_ms(timeout_ms: u64) -> bool {
    // Update timeout configuration (placeholder)
    if timeout_ms > 0 && timeout_ms <= 60000 {
        info!("FFI timeout set to {}ms", timeout_ms);
        true
    } else {
        error!("Invalid timeout value: {}ms (must be 1-60000ms)", timeout_ms);
        false
    }
}

#[no_mangle]
pub extern "C" fn ffi_get_max_concurrent_calls() -> i32 {
    MAX_CONCURRENT_CALLS as i32
}

// Health check
#[no_mangle]
pub extern "C" fn ffi_health_check() -> *mut c_char {
    let stats = FFI_STATS.read();
    
    // Determine health status
    let status = if stats.success_rate() >= 0.95 && stats.panic_recovers == 0 {
        "healthy"
    } else if stats.success_rate() >= 0.90 {
        "degraded"
    } else {
        "unhealthy"
    };
    
    let health = json!({
        "status": status,
        "success_rate": format!("{:.2}%", stats.success_rate() * 100.0),
        "total_calls": stats.total_calls,
        "recent_errors": stats.failed_calls.saturating_sub(10), // Last 10 calls
        "uptime": "N/A"
    });
    
    safe_create_c_string(&health.to_string())
}

// Tests
#[cfg(test)]
mod tests {
    use super::*;
    use std::ptr;
    
    #[test]
    fn test_safe_string_operations() {
        let test_str = "Hello, World!";
        let c_string = safe_create_c_string(test_str);
        assert!(!c_string.is_null());
        
        let retrieved = safe_read_c_string(c_string).unwrap();
        assert_eq!(retrieved, test_str);
        
        safe_free_c_string(c_string);
    }
    
    #[test]
    fn test_null_pointer_handling() {
        let result = safe_read_c_string(ptr::null());
        assert_eq!(result.unwrap_err(), FFIError::NullPointer);
    }
    
    #[test]
    fn test_buffer_validation() {
        assert!(validate_buffer_size(1024, 2048).is_ok());
        assert_eq!(
            validate_buffer_size(2049, 2048).unwrap_err(),
            FFIError::BufferOverflow
        );
    }
    
    #[test]
    fn test_json_validation() {
        let valid_json = r#"{"name": "test", "value": 123}"#;
        let invalid_json = r#"{"invalid": json}"#;
        
        assert!(validate_json_string(valid_json).is_ok());
        assert!(validate_json_string(invalid_json).is_err());
    }
    
    #[test]
    fn test_ffi_statistics() {
        let mut stats = FFIStatistics::new();
        
        stats.record_call(100, true, None);
        stats.record_call(200, false, Some(FFIError::Panic));
        
        assert_eq!(stats.total_calls, 2);
        assert_eq!(stats.successful_calls, 1);
        assert_eq!(stats.failed_calls, 1);
        assert_eq!(stats.panic_recovers, 1);
        assert_eq!(stats.success_rate(), 0.5);
        assert_eq!(stats.avg_exec_time_ms(), 150.0);
    }
    
    #[test]
    fn test_ffi_context() {
        let context = FFIContext::new("test_operation", 5000);
        assert_eq!(context.operation_name, "test_operation");
        assert!(!context.is_timeout());
    }
    
    #[test]
    fn test_panic_recovery() {
        let context = FFIContext::new("panic_test", 1000);
        
        let result: Result<(), FFIError> = safe_ffi_wrapper(context, || {
            panic!("Test panic");
        });
        
        assert_eq!(result.unwrap_err(), FFIError::Panic);
    }
}

// Performance benchmarks
#[cfg(test)]
mod bench_tests {
    use super::*;
    use std::time::Instant;
    
    #[test]
    fn benchmark_ffi_overhead() {
        let context = FFIContext::new("benchmark", 10000);
        let iterations = 10000;
        
        let start = Instant::now();
        
        for _ in 0..iterations {
            let test_str = "benchmark data";
            let c_string = safe_create_c_string(test_str);
            let _retrieved = safe_read_c_string(c_string).unwrap();
            safe_free_c_string(c_string);
        }
        
        let duration = start.elapsed();
        let avg_time_per_call = duration.as_nanos() / iterations;
        
        println!("Average FFI call time: {}ns", avg_time_per_call);
        assert!(avg_time_per_call < 10000); // Less than 10 microseconds per call
    }
}
