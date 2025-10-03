//! Schlep-Engine Rust Kernel Prototype
//!
//! Minimal FFI interface for Go integration testing
//! Demonstrates:
//! - Simple integer operations (sub-microsecond latency)
//! - String handling across FFI boundary
//! - Proper memory management

use std::ffi::{CStr, CString};
use std::os::raw::c_char;

/// Add two integers
///
/// Simple arithmetic operation to test FFI overhead
/// Expected latency: <1 microsecond
///
/// # Safety
/// This function is safe to call from C/Go
#[no_mangle]
pub extern "C" fn rust_add(x: i32, y: i32) -> i32 {
    x + y
}

/// Generate a greeting message
///
/// Tests string handling across FFI boundary
/// Caller must free the returned string with rust_free_string
///
/// # Safety
/// - `name` must be a valid null-terminated C string
/// - Caller must call rust_free_string on the returned pointer
#[no_mangle]
pub unsafe extern "C" fn rust_hello(name: *const c_char) -> *mut c_char {
    if name.is_null() {
        let default_msg = CString::new("Hello from Rust!").unwrap();
        return default_msg.into_raw();
    }

    let c_str = unsafe { CStr::from_ptr(name) };
    let name_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => "Unknown",
    };

    let message = format!("Hello {} from Rust kernel!", name_str);
    let c_message = CString::new(message).unwrap();
    c_message.into_raw()
}

/// Free a string allocated by Rust
///
/// MUST be called for every string returned by rust_hello
///
/// # Safety
/// - `s` must be a pointer previously returned by rust_hello
/// - `s` can only be freed once
/// - After calling this, `s` must not be used
#[no_mangle]
pub unsafe extern "C" fn rust_free_string(s: *mut c_char) {
    if s.is_null() {
        return;
    }
    // Take ownership and drop
    unsafe {
        let _ = CString::from_raw(s);
    }
}

/// Multiply two integers (additional test function)
///
/// # Safety
/// This function is safe to call from C/Go
#[no_mangle]
pub extern "C" fn rust_multiply(x: i32, y: i32) -> i32 {
    x * y
}

/// Sum an array of integers
///
/// Tests array passing across FFI boundary
///
/// # Safety
/// - `arr` must point to valid memory containing `len` i32 values
/// - `len` must accurately represent the array length
#[no_mangle]
pub unsafe extern "C" fn rust_sum_array(arr: *const i32, len: usize) -> i32 {
    if arr.is_null() || len == 0 {
        return 0;
    }

    let slice = unsafe { std::slice::from_raw_parts(arr, len) };
    slice.iter().sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(rust_add(5, 3), 8);
        assert_eq!(rust_add(-5, 3), -2);
        assert_eq!(rust_add(0, 0), 0);
    }

    #[test]
    fn test_multiply() {
        assert_eq!(rust_multiply(5, 3), 15);
        assert_eq!(rust_multiply(-5, 3), -15);
        assert_eq!(rust_multiply(0, 100), 0);
    }

    #[test]
    fn test_sum_array() {
        let arr = [1, 2, 3, 4, 5];
        let sum = unsafe { rust_sum_array(arr.as_ptr(), arr.len()) };
        assert_eq!(sum, 15);

        let empty: [i32; 0] = [];
        let sum_empty = unsafe { rust_sum_array(empty.as_ptr(), empty.len()) };
        assert_eq!(sum_empty, 0);
    }

    #[test]
    fn test_hello() {
        unsafe {
            let name = CString::new("World").unwrap();
            let result = rust_hello(name.as_ptr());
            let result_str = CStr::from_ptr(result).to_str().unwrap();
            assert!(result_str.contains("World"));
            rust_free_string(result);
        }
    }
}
