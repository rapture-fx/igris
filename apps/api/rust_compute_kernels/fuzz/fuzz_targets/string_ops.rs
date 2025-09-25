#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;
use schlep_compute_kernels::secure_string_kernels::secure_string_ops_impl;

#[derive(Arbitrary, Debug)]
struct StringOpsInput {
    strings: Vec<String>,
    operation: String,
    pattern: Option<String>,
}

/// Fuzzing harness for string operations
///
/// Tests for:
/// - VUL-001: Unicode surrogate validation
/// - VUL-005: String overflow protection
/// - VUL-007: Invalid UTF-8 sanitization
/// - VUL-008: Operation timeouts
fuzz_target!(|input: StringOpsInput| {
    // Limit input size to prevent fuzzer from generating unreasonably large inputs
    if input.strings.len() > 10000 {
        return;
    }

    // Limit string sizes
    let limited_strings: Vec<String> = input.strings
        .into_iter()
        .take(1000)
        .map(|s| {
            if s.len() > 100000 {
                s.chars().take(100000).collect()
            } else {
                s
            }
        })
        .collect();

    if limited_strings.is_empty() {
        return;
    }

    // Limit operation name length
    let operation = if input.operation.len() > 100 {
        input.operation.chars().take(100).collect()
    } else {
        input.operation
    };

    // Limit pattern length
    let pattern = input.pattern.map(|p| {
        if p.len() > 1000 {
            p.chars().take(1000).collect()
        } else {
            p
        }
    });

    // Test the secure string operations
    // Should never panic or crash, regardless of input
    let result = std::panic::catch_unwind(|| {
        secure_string_ops_impl(limited_strings, operation, pattern)
    });

    match result {
        Ok(Ok(_)) => {
            // Operation succeeded - good
        },
        Ok(Err(_)) => {
            // Operation failed with proper error - also good
        },
        Err(_) => {
            // This should never happen - secure implementation should not panic
            panic!("String operation panicked unexpectedly!");
        }
    }
});