// SLO Enforcer FFI Library
// Production-ready SLO monitoring and autonomous remediation

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use serde::{Deserialize, Serialize};

mod enforcer;
mod types;
mod remediation;

pub use enforcer::SLOEnforcer;
pub use types::*;
pub use remediation::*;

/// FFI-safe result structure
#[repr(C)]
pub struct FFIResult {
    pub json_output: *mut c_char,
    pub error: *mut c_char,
}

/// Main FFI entry point: evaluate metrics and return actions
///
/// Input: JSON string with Prometheus metrics
/// Output: JSON string with { breached: bool, actions: [...] }
///
/// # Safety
/// Caller must free the returned pointers using free_string()
#[no_mangle]
pub extern "C" fn evaluate_and_act(metrics_json: *const c_char) -> FFIResult {
    // Convert C string to Rust string
    let metrics_str = unsafe {
        if metrics_json.is_null() {
            return FFIResult {
                json_output: std::ptr::null_mut(),
                error: make_c_string("Input JSON is null"),
            };
        }
        match CStr::from_ptr(metrics_json).to_str() {
            Ok(s) => s,
            Err(e) => {
                return FFIResult {
                    json_output: std::ptr::null_mut(),
                    error: make_c_string(&format!("Invalid UTF-8: {}", e)),
                };
            }
        }
    };

    // Parse input metrics
    let metrics: MetricsInput = match serde_json::from_str(metrics_str) {
        Ok(m) => m,
        Err(e) => {
            return FFIResult {
                json_output: std::ptr::null_mut(),
                error: make_c_string(&format!("Failed to parse JSON: {}", e)),
            };
        }
    };

    // Create enforcer with default config
    let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());

    // Evaluate all SLOs
    let mut actions = Vec::new();
    let mut any_breached = false;

    // P99 Latency
    if let Some(p99) = metrics.p99_latency_ms {
        let eval = enforcer.evaluate_slo(SLOType::P99Latency, p99);
        if let Some(action) = enforcer.should_remediate(&eval) {
            actions.push(action);
            any_breached = true;
        }
    }

    // P95 Latency
    if let Some(p95) = metrics.p95_latency_ms {
        let eval = enforcer.evaluate_slo(SLOType::P95Latency, p95);
        if let Some(action) = enforcer.should_remediate(&eval) {
            actions.push(action);
            any_breached = true;
        }
    }

    // Error Rate
    if let Some(error_rate) = metrics.error_rate {
        let eval = enforcer.evaluate_slo(SLOType::ErrorRate, error_rate);
        if let Some(action) = enforcer.should_remediate(&eval) {
            actions.push(action);
            any_breached = true;
        }
    }

    // Availability
    if let Some(availability) = metrics.availability {
        let eval = enforcer.evaluate_slo(SLOType::Availability, availability);
        if let Some(action) = enforcer.should_remediate(&eval) {
            actions.push(action);
            any_breached = true;
        }
    }

    // Throughput
    if let Some(throughput) = metrics.throughput_rps {
        let eval = enforcer.evaluate_slo(SLOType::Throughput, throughput);
        if let Some(action) = enforcer.should_remediate(&eval) {
            actions.push(action);
            any_breached = true;
        }
    }

    // Build response
    let response = EvaluationResponse {
        breached: any_breached,
        actions,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    // Serialize to JSON
    let json_output = match serde_json::to_string(&response) {
        Ok(json) => json,
        Err(e) => {
            return FFIResult {
                json_output: std::ptr::null_mut(),
                error: make_c_string(&format!("Failed to serialize response: {}", e)),
            };
        }
    };

    FFIResult {
        json_output: make_c_string(&json_output),
        error: std::ptr::null_mut(),
    }
}

/// Free a C string allocated by this library
#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            drop(CString::from_raw(s));
        }
    }
}

/// Get library version
#[no_mangle]
pub extern "C" fn get_version() -> *mut c_char {
    make_c_string("1.0.0")
}

// Helper to create C strings
fn make_c_string(s: &str) -> *mut c_char {
    match CString::new(s) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_evaluate_and_act() {
        let metrics = MetricsInput {
            p99_latency_ms: Some(200.0), // Breached (threshold 150)
            p95_latency_ms: Some(60.0),
            error_rate: Some(0.005),
            availability: Some(0.9999),
            throughput_rps: Some(12000.0),
        };

        let json = serde_json::to_string(&metrics).unwrap();
        let c_json = CString::new(json).unwrap();

        let result = evaluate_and_act(c_json.as_ptr());

        assert!(!result.json_output.is_null());
        assert!(result.error.is_null());

        let output = unsafe {
            CStr::from_ptr(result.json_output)
                .to_str()
                .unwrap()
                .to_string()
        };

        let response: EvaluationResponse = serde_json::from_str(&output).unwrap();
        assert!(response.breached);
        assert!(!response.actions.is_empty());

        // Cleanup
        free_string(result.json_output);
    }
}
