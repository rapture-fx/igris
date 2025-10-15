//! FFI boundary for Go integration
//!
//! Provides C-compatible functions for calling Rust optimizer from Go via cgo.
//! All functions use catch_unwind for panic safety.

use super::bandits::{ThompsonSampling, ThompsonSamplingConfig};
use super::rewards::RewardMetrics;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::panic::catch_unwind;
use std::ptr;

/// Opaque handle for ThompsonSampling optimizer
#[repr(C)]
pub struct OptimizerHandle {
    _private: [u8; 0],
}

/// Helper to catch panics in FFI functions
fn catch_ffi_panic<F, T>(f: F) -> Result<T, Box<dyn std::any::Any + Send>>
where
    F: FnOnce() -> T + std::panic::UnwindSafe,
{
    catch_unwind(f)
}

/// Initialize optimizer with JSON configuration
///
/// Returns opaque handle, or null on error.
/// Caller must call optimizer_free() to release resources.
///
/// # Safety
/// config_json must be a valid null-terminated UTF-8 string
#[no_mangle]
pub unsafe extern "C" fn optimizer_init(config_json: *const c_char) -> *mut OptimizerHandle {
    catch_ffi_panic(|| {
        if config_json.is_null() {
            return ptr::null_mut();
        }

        let config_str = match CStr::from_ptr(config_json).to_str() {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        };

        let config: ThompsonSamplingConfig = match serde_json::from_str(config_str) {
            Ok(c) => c,
            Err(_) => return ptr::null_mut(),
        };

        let optimizer = Box::new(ThompsonSampling::new(config));
        Box::into_raw(optimizer) as *mut OptimizerHandle
    })
    .unwrap_or(ptr::null_mut())
}

/// Select best action using Thompson Sampling
///
/// Returns action ID as JSON string, or null on error.
/// Caller must call optimizer_free_string() to release.
///
/// # Safety
/// handle must be a valid OptimizerHandle from optimizer_init()
#[no_mangle]
pub unsafe extern "C" fn optimizer_select_action(
    handle: *mut OptimizerHandle,
) -> *mut c_char {
    catch_ffi_panic(|| {
        if handle.is_null() {
            return ptr::null_mut();
        }

        let optimizer = &*(handle as *mut ThompsonSampling);
        let action_id = optimizer.select_action();

        let result = serde_json::json!({
            "action_id": action_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        match CString::new(result.to_string()) {
            Ok(cstring) => cstring.into_raw(),
            Err(_) => ptr::null_mut(),
        }
    })
    .unwrap_or(ptr::null_mut())
}

/// Update optimizer with reward for selected action
///
/// Returns 0 on success, negative error code on failure.
///
/// # Safety
/// - handle must be valid OptimizerHandle
/// - action_id must be valid null-terminated UTF-8 string
#[no_mangle]
pub unsafe extern "C" fn optimizer_update_reward(
    handle: *mut OptimizerHandle,
    action_id: *const c_char,
    reward: f64,
) -> i32 {
    catch_ffi_panic(|| {
        if handle.is_null() || action_id.is_null() {
            return -1;
        }

        let optimizer = &mut *(handle as *mut ThompsonSampling);
        let action_str = match CStr::from_ptr(action_id).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        };

        optimizer.update_reward(action_str, reward);
        0
    })
    .unwrap_or(-1)
}

/// Update optimizer with detailed metrics
///
/// Returns 0 on success, negative error code on failure.
///
/// # Safety
/// - handle must be valid OptimizerHandle
/// - action_id must be valid null-terminated UTF-8 string
/// - metrics_json must be valid null-terminated JSON string
#[no_mangle]
pub unsafe extern "C" fn optimizer_update_metrics(
    handle: *mut OptimizerHandle,
    action_id: *const c_char,
    metrics_json: *const c_char,
) -> i32 {
    catch_ffi_panic(|| {
        if handle.is_null() || action_id.is_null() || metrics_json.is_null() {
            return -1;
        }

        let optimizer = &mut *(handle as *mut ThompsonSampling);

        let action_str = match CStr::from_ptr(action_id).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        };

        let metrics_str = match CStr::from_ptr(metrics_json).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        };

        let metrics: RewardMetrics = match serde_json::from_str(metrics_str) {
            Ok(m) => m,
            Err(_) => return -1,
        };

        optimizer.update(action_str, &metrics);
        0
    })
    .unwrap_or(-1)
}

/// Export optimizer state as JSON
///
/// Returns JSON string, or null on error.
/// Caller must call optimizer_free_string() to release.
///
/// # Safety
/// handle must be valid OptimizerHandle
#[no_mangle]
pub unsafe extern "C" fn optimizer_export_state(
    handle: *mut OptimizerHandle,
) -> *mut c_char {
    catch_ffi_panic(|| {
        if handle.is_null() {
            return ptr::null_mut();
        }

        let optimizer = &*(handle as *mut ThompsonSampling);
        let state_json = match optimizer.export_state() {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        };

        match CString::new(state_json) {
            Ok(cstring) => cstring.into_raw(),
            Err(_) => ptr::null_mut(),
        }
    })
    .unwrap_or(ptr::null_mut())
}

/// Get arm statistics as JSON
///
/// Returns JSON array of arm stats, or null on error.
/// Caller must call optimizer_free_string() to release.
///
/// # Safety
/// handle must be valid OptimizerHandle
#[no_mangle]
pub unsafe extern "C" fn optimizer_get_stats(
    handle: *mut OptimizerHandle,
) -> *mut c_char {
    catch_ffi_panic(|| {
        if handle.is_null() {
            return ptr::null_mut();
        }

        let optimizer = &*(handle as *mut ThompsonSampling);
        let stats = optimizer.get_arm_stats();

        let stats_json = match serde_json::to_string_pretty(&stats) {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        };

        match CString::new(stats_json) {
            Ok(cstring) => cstring.into_raw(),
            Err(_) => ptr::null_mut(),
        }
    })
    .unwrap_or(ptr::null_mut())
}

/// Free optimizer resources
///
/// # Safety
/// handle must be valid OptimizerHandle from optimizer_init(), or null
#[no_mangle]
pub unsafe extern "C" fn optimizer_free(handle: *mut OptimizerHandle) {
    if !handle.is_null() {
        let _ = Box::from_raw(handle as *mut ThompsonSampling);
    }
}

/// Free string returned by FFI functions
///
/// # Safety
/// s must be a string allocated by Rust FFI functions, or null
#[no_mangle]
pub unsafe extern "C" fn optimizer_free_string(s: *mut c_char) {
    if !s.is_null() {
        let _ = CString::from_raw(s);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_init_and_free() {
        let config = r#"{
            "arms": ["provider1", "provider2"],
            "success_threshold": 0.6,
            "initial_alpha": 1.0,
            "initial_beta": 1.0,
            "reward_policy": {
                "latency_weight": 0.4,
                "success_weight": 0.3,
                "cache_weight": 0.1,
                "cost_weight": 0.15,
                "quality_weight": 0.05,
                "target_latency_ms": 100.0,
                "max_latency_ms": 2000.0,
                "target_cost_usd": 0.001,
                "max_cost_usd": 0.01
            }
        }"#;

        unsafe {
            let config_c = CString::new(config).unwrap();
            let handle = optimizer_init(config_c.as_ptr());

            assert!(!handle.is_null());

            optimizer_free(handle);
        }
    }

    #[test]
    fn test_ffi_select_action() {
        let config = r#"{
            "arms": ["provider1", "provider2"],
            "success_threshold": 0.6,
            "initial_alpha": 1.0,
            "initial_beta": 1.0,
            "reward_policy": {
                "latency_weight": 0.4,
                "success_weight": 0.3,
                "cache_weight": 0.1,
                "cost_weight": 0.15,
                "quality_weight": 0.05,
                "target_latency_ms": 100.0,
                "max_latency_ms": 2000.0,
                "target_cost_usd": 0.001,
                "max_cost_usd": 0.01
            }
        }"#;

        unsafe {
            let config_c = CString::new(config).unwrap();
            let handle = optimizer_init(config_c.as_ptr());

            let action_json = optimizer_select_action(handle);
            assert!(!action_json.is_null());

            let action_str = CStr::from_ptr(action_json).to_str().unwrap();
            assert!(action_str.contains("action_id"));

            optimizer_free_string(action_json);
            optimizer_free(handle);
        }
    }

    #[test]
    fn test_ffi_update_reward() {
        let config = r#"{
            "arms": ["provider1", "provider2"],
            "success_threshold": 0.6,
            "initial_alpha": 1.0,
            "initial_beta": 1.0,
            "reward_policy": {
                "latency_weight": 0.4,
                "success_weight": 0.3,
                "cache_weight": 0.1,
                "cost_weight": 0.15,
                "quality_weight": 0.05,
                "target_latency_ms": 100.0,
                "max_latency_ms": 2000.0,
                "target_cost_usd": 0.001,
                "max_cost_usd": 0.01
            }
        }"#;

        unsafe {
            let config_c = CString::new(config).unwrap();
            let handle = optimizer_init(config_c.as_ptr());

            let action_id = CString::new("provider1").unwrap();
            let result = optimizer_update_reward(handle, action_id.as_ptr(), 0.8);

            assert_eq!(result, 0);

            optimizer_free(handle);
        }
    }

    #[test]
    fn test_ffi_export_state() {
        let config = r#"{
            "arms": ["provider1", "provider2"],
            "success_threshold": 0.6,
            "initial_alpha": 1.0,
            "initial_beta": 1.0,
            "reward_policy": {
                "latency_weight": 0.4,
                "success_weight": 0.3,
                "cache_weight": 0.1,
                "cost_weight": 0.15,
                "quality_weight": 0.05,
                "target_latency_ms": 100.0,
                "max_latency_ms": 2000.0,
                "target_cost_usd": 0.001,
                "max_cost_usd": 0.01
            }
        }"#;

        unsafe {
            let config_c = CString::new(config).unwrap();
            let handle = optimizer_init(config_c.as_ptr());

            let state_json = optimizer_export_state(handle);
            assert!(!state_json.is_null());

            let state_str = CStr::from_ptr(state_json).to_str().unwrap();
            assert!(state_str.contains("arms"));

            optimizer_free_string(state_json);
            optimizer_free(handle);
        }
    }

    #[test]
    fn test_ffi_null_safety() {
        unsafe {
            // All operations with null should not panic
            let result = optimizer_init(ptr::null());
            assert!(result.is_null());

            let action = optimizer_select_action(ptr::null_mut());
            assert!(action.is_null());

            let update_result = optimizer_update_reward(ptr::null_mut(), ptr::null(), 0.5);
            assert_eq!(update_result, -1);

            optimizer_free(ptr::null_mut()); // Should not crash
            optimizer_free_string(ptr::null_mut()); // Should not crash
        }
    }
}
