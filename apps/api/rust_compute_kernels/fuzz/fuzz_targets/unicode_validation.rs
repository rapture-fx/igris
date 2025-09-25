#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;
use schlep_compute_kernels::security_fixes::{SecurityValidator, ValidationResult};

#[derive(Arbitrary, Debug)]
struct UnicodeInput {
    data: Vec<u8>,
}

/// Fuzzing harness for Unicode validation
///
/// Tests for:
/// - VUL-001: Unicode surrogate validation
/// - VUL-007: Invalid UTF-8 sanitization
fuzz_target!(|input: UnicodeInput| {
    // Limit input size to prevent excessive memory usage
    let data = if input.data.len() > 100000 {
        &input.data[..100000]
    } else {
        &input.data
    };

    // Try to create a string from the raw bytes (may be invalid UTF-8)
    let string_result = String::from_utf8(data.to_vec());

    let test_string = match string_result {
        Ok(valid_string) => valid_string,
        Err(utf8_error) => {
            // Use the lossy conversion for invalid UTF-8
            String::from_utf8_lossy(&utf8_error.into_bytes()).to_string()
        }
    };

    // Test string validation - should never panic
    let validation_result = std::panic::catch_unwind(|| {
        SecurityValidator::validate_string(&test_string)
    });

    match validation_result {
        Ok(result) => {
            match result {
                ValidationResult::Valid => {
                    // String is valid - ensure it doesn't contain surrogates
                    for ch in test_string.chars() {
                        let code_point = ch as u32;
                        assert!(
                            !(0xD800..=0xDFFF).contains(&code_point),
                            "Valid string contains surrogate: U+{:04X}",
                            code_point
                        );
                    }
                },
                ValidationResult::InvalidUtf8 => {
                    // Should not happen since we already converted to valid UTF-8
                    // But if it does, it's properly detected
                },
                ValidationResult::TooLarge => {
                    // String is too large - proper protection
                    assert!(test_string.len() > 1024 * 1024, "String marked as too large but isn't");
                },
                ValidationResult::ContainsSurrogates => {
                    // String contains surrogates - should be detected
                    let contains_surrogates = test_string.chars().any(|ch| {
                        let code_point = ch as u32;
                        (0xD800..=0xDFFF).contains(&code_point)
                    });
                    assert!(contains_surrogates, "String marked as containing surrogates but doesn't");
                },
                ValidationResult::InvalidCharacters => {
                    // String contains invalid characters - should be detected
                }
            }
        },
        Err(_) => {
            panic!("Unicode validation panicked unexpectedly!");
        }
    }

    // Test string sanitization - should never panic
    let sanitization_result = std::panic::catch_unwind(|| {
        SecurityValidator::sanitize_string(&test_string)
    });

    match sanitization_result {
        Ok(sanitized) => {
            // Sanitized string should be valid and safe
            assert!(sanitized.len() <= test_string.len(), "Sanitized string is longer than original");

            // Should not contain surrogates
            for ch in sanitized.chars() {
                let code_point = ch as u32;
                assert!(
                    !(0xD800..=0xDFFF).contains(&code_point),
                    "Sanitized string contains surrogate: U+{:04X}",
                    code_point
                );

                // Should not contain most control characters (except basic whitespace)
                if ch.is_control() {
                    assert!(
                        ch == '\t' || ch == '\n' || ch == '\r',
                        "Sanitized string contains control character: U+{:04X}",
                        code_point
                    );
                }
            }
        },
        Err(_) => {
            panic!("Unicode sanitization panicked unexpectedly!");
        }
    }
});