#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;
use schlep_compute_kernels::security_fixes::{SecurityValidator, RegexValidationResult};

#[derive(Arbitrary, Debug)]
struct RegexInput {
    pattern: String,
}

/// Fuzzing harness for regex validation
///
/// Tests for:
/// - VUL-002: Regex ReDoS protection
/// - VUL-008: Operation timeouts
fuzz_target!(|input: RegexInput| {
    // Limit pattern size to reasonable bounds
    let pattern = if input.pattern.len() > 10000 {
        input.pattern.chars().take(10000).collect()
    } else {
        input.pattern
    };

    // Test regex validation - should never panic
    let result = std::panic::catch_unwind(|| {
        SecurityValidator::validate_regex_pattern(&pattern)
    });

    match result {
        Ok(validation_result) => {
            match validation_result {
                RegexValidationResult::Valid(regex) => {
                    // Valid regex was created - test it doesn't cause ReDoS
                    let test_string = "a".repeat(100);

                    // Test with timeout
                    let regex_result = std::panic::catch_unwind(|| {
                        let start = std::time::Instant::now();
                        let matches = regex.is_match(&test_string);
                        let elapsed = start.elapsed();

                        // Should complete quickly (within 1 second)
                        if elapsed > std::time::Duration::from_secs(1) {
                            panic!("Regex took too long: {:?}", elapsed);
                        }

                        matches
                    });

                    // Should not panic during execution
                    if regex_result.is_err() {
                        panic!("Valid regex caused panic during execution");
                    }
                },
                RegexValidationResult::InvalidPattern(_) => {
                    // Invalid pattern rejected - good
                },
                RegexValidationResult::TooComplex => {
                    // Complex pattern rejected - good (prevents ReDoS)
                },
                RegexValidationResult::TooLarge => {
                    // Large pattern rejected - good
                },
                RegexValidationResult::Timeout => {
                    // Compilation timed out - good protection
                }
            }
        },
        Err(_) => {
            panic!("Regex validation panicked unexpectedly!");
        }
    }
});