use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::time::Instant;

extern "C" {
    fn rust_validate_json(json_str: *const c_char) -> bool;
    fn rust_transform_json(json_str: *const c_char, transform_type: *const c_char) -> *mut c_char;
    fn rust_filter_array(json_array: *const c_char, filter_key: *const c_char, filter_value: *const c_char) -> *mut c_char;
    fn rust_free_string(s: *mut c_char);
}

fn main() {
    println!("🧪 Rust Kernel Data Processing Micro-Benchmark");
    println!("================================================\n");

    // Generate 10k sample JSON records
    let sample_json = r#"{"id": 1, "name": "test", "value": 42.5, "category": "A", "timestamp": "2025-10-04T12:00:00Z"}"#;
    let array_json = format!("[{}]", (0..100).map(|i|
        format!(r#"{{"id": {}, "name": "item_{}", "value": {}, "category": "A"}}"#, i, i, i as f64 * 1.5)
    ).collect::<Vec<_>>().join(","));

    // Test 1: JSON Validation (10k iterations)
    println!("Test 1: JSON Validation (10,000 iterations)");
    let json_cstr = CString::new(sample_json).unwrap();
    let start = Instant::now();

    for _ in 0..10000 {
        unsafe {
            let valid = rust_validate_json(json_cstr.as_ptr());
            assert!(valid);
        }
    }

    let duration = start.elapsed();
    let ops_per_sec = 10000.0 / duration.as_secs_f64();
    println!("  ✓ Duration: {:?}", duration);
    println!("  ✓ Ops/sec: {:.0}", ops_per_sec);
    println!("  ✓ Avg latency: {:.2}μs\n", duration.as_micros() as f64 / 10000.0);

    // Test 2: JSON Transformation (10k iterations)
    println!("Test 2: JSON Transformation - Uppercase Keys (10,000 iterations)");
    let transform_type = CString::new("uppercase_keys").unwrap();
    let start = Instant::now();

    for _ in 0..10000 {
        unsafe {
            let result = rust_transform_json(json_cstr.as_ptr(), transform_type.as_ptr());
            rust_free_string(result);
        }
    }

    let duration = start.elapsed();
    let ops_per_sec = 10000.0 / duration.as_secs_f64();
    println!("  ✓ Duration: {:?}", duration);
    println!("  ✓ Ops/sec: {:.0}", ops_per_sec);
    println!("  ✓ Avg latency: {:.2}μs\n", duration.as_micros() as f64 / 10000.0);

    // Test 3: Array Filtering (1k iterations on 100-item arrays)
    println!("Test 3: Array Filtering (1,000 iterations, 100 items each)");
    let array_cstr = CString::new(array_json.as_str()).unwrap();
    let filter_key = CString::new("category").unwrap();
    let filter_value = CString::new("A").unwrap();
    let start = Instant::now();

    for _ in 0..1000 {
        unsafe {
            let result = rust_filter_array(
                array_cstr.as_ptr(),
                filter_key.as_ptr(),
                filter_value.as_ptr()
            );
            rust_free_string(result);
        }
    }

    let duration = start.elapsed();
    let ops_per_sec = 1000.0 / duration.as_secs_f64();
    println!("  ✓ Duration: {:?}", duration);
    println!("  ✓ Ops/sec: {:.0}", ops_per_sec);
    println!("  ✓ Avg latency: {:.2}ms\n", duration.as_millis() as f64 / 1000.0);

    // Memory usage estimate
    println!("Memory Analysis:");
    println!("  • Each JSON record: ~{} bytes", sample_json.len());
    println!("  • FFI overhead per call: ~24 bytes (CString allocation)");
    println!("  • Total processed: ~{} MB (10k + 10k + 100k records)",
        (10000 + 10000 + 100000) * sample_json.len() / 1024 / 1024);
}
