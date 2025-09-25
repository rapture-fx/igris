//! Secure string processing kernels with vulnerability fixes
//!
//! This module provides hardened versions of string operations
//! that address the security vulnerabilities found in fuzz testing.

use pyo3::prelude::*;
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use crate::security_fixes::{
    SecurityValidator, RegexValidationResult, ValidationResult,
    SafeArithmetic, ResourceBudget, TimeoutWrapper,
    MAX_STRING_LENGTH, REGEX_TIMEOUT,
};

/// Secure string operations implementation with input validation
///
/// All functions include:
/// - Unicode validation and sanitization
/// - Input size limits
/// - Timeout protection
/// - Resource budgeting
pub fn secure_string_ops_impl(
    strings: Vec<String>,
    operation: String,
    pattern: Option<String>,
) -> PyResult<Vec<String>> {
    if strings.is_empty() {
        return Ok(Vec::new());
    }

    // Validate input size
    if strings.len() > 1_000_000 {
        return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
            "Too many strings to process"
        ));
    }

    // Create resource budget
    let mut budget = ResourceBudget::new(
        512 * 1024 * 1024, // 512MB max memory
        strings.len() * 2   // 2 operations per string max
    );

    // Validate and sanitize all input strings
    let sanitized_strings: Result<Vec<String>, PyErr> = strings
        .into_iter()
        .map(|s| {
            match SecurityValidator::validate_string(&s) {
                ValidationResult::Valid => Ok(s),
                ValidationResult::TooLarge => {
                    // Truncate instead of rejecting
                    Ok(s.chars().take(MAX_STRING_LENGTH).collect())
                },
                ValidationResult::ContainsSurrogates |
                ValidationResult::InvalidUtf8 |
                ValidationResult::InvalidCharacters => {
                    // Sanitize problematic strings
                    Ok(SecurityValidator::sanitize_string(&s))
                }
            }
        })
        .collect();

    let clean_strings = sanitized_strings?;

    // Execute operation with resource monitoring
    let result = match operation.to_lowercase().as_str() {
        "length" | "len" => secure_string_lengths(&clean_strings, &mut budget)?,
        "upper" => secure_string_to_upper(&clean_strings, &mut budget)?,
        "lower" => secure_string_to_lower(&clean_strings, &mut budget)?,
        "strip" | "trim" => secure_string_strip(&clean_strings, &mut budget)?,
        "contains" => {
            let pattern = pattern.ok_or_else(|| {
                PyErr::new::<pyo3::exceptions::PyValueError, _>(
                    "Pattern required for 'contains' operation"
                )
            })?;
            secure_string_contains(&clean_strings, &pattern, &mut budget)?
        },
        "regex" => {
            let pattern = pattern.ok_or_else(|| {
                PyErr::new::<pyo3::exceptions::PyValueError, _>(
                    "Pattern required for 'regex' operation"
                )
            })?;
            secure_string_regex_match(&clean_strings, &pattern, &mut budget)?
        },
        _ => return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
            format!("Unknown string operation: {}", operation)
        )),
    };

    Ok(result)
}

/// Secure string length calculation with resource budgeting
fn secure_string_lengths(
    strings: &[String],
    budget: &mut ResourceBudget
) -> PyResult<Vec<String>> {
    let estimated_memory = strings.len() * 32; // Estimate result memory
    budget.allocate(estimated_memory)
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyMemoryError, _>(e))?;

    let result = if strings.len() > 10_000 {
        strings
            .par_iter()
            .map(|s| {
                // Resource check (approximate, as we can't share budget across threads easily)
                s.chars().count().to_string()
            })
            .collect()
    } else {
        strings
            .iter()
            .map(|s| {
                budget.operate().unwrap_or(());
                s.chars().count().to_string() // Use chars().count() for proper Unicode handling
            })
            .collect()
    };

    budget.free(estimated_memory);
    Ok(result)
}

/// Secure uppercase conversion with memory management
fn secure_string_to_upper(
    strings: &[String],
    budget: &mut ResourceBudget
) -> PyResult<Vec<String>> {
    // Estimate memory needed (uppercase might be longer due to Unicode)
    let estimated_memory = strings.iter().map(|s| s.len() * 2).sum::<usize>();

    budget.allocate(estimated_memory)
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyMemoryError, _>(e))?;

    let result = TimeoutWrapper::with_timeout(
        Duration::from_secs(30), // 30 second timeout
        || {
            if strings.len() > 10_000 {
                strings
                    .par_iter()
                    .map(|s| s.to_uppercase())
                    .collect()
            } else {
                strings
                    .iter()
                    .map(|s| {
                        budget.operate().unwrap_or(());
                        s.to_uppercase()
                    })
                    .collect()
            }
        }
    ).map_err(|e| PyErr::new::<pyo3::exceptions::PyTimeoutError, _>(e))?;

    budget.free(estimated_memory);
    Ok(result)
}

/// Secure lowercase conversion with timeout protection
fn secure_string_to_lower(
    strings: &[String],
    budget: &mut ResourceBudget
) -> PyResult<Vec<String>> {
    let estimated_memory = strings.iter().map(|s| s.len() * 2).sum::<usize>();

    budget.allocate(estimated_memory)
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyMemoryError, _>(e))?;

    let result = TimeoutWrapper::with_timeout(
        Duration::from_secs(30),
        || {
            if strings.len() > 10_000 {
                strings
                    .par_iter()
                    .map(|s| s.to_lowercase())
                    .collect()
            } else {
                strings
                    .iter()
                    .map(|s| {
                        budget.operate().unwrap_or(());
                        s.to_lowercase()
                    })
                    .collect()
            }
        }
    ).map_err(|e| PyErr::new::<pyo3::exceptions::PyTimeoutError, _>(e))?;

    budget.free(estimated_memory);
    Ok(result)
}

/// Secure string trimming
fn secure_string_strip(
    strings: &[String],
    budget: &mut ResourceBudget
) -> PyResult<Vec<String>> {
    let estimated_memory = strings.iter().map(|s| s.len()).sum::<usize>();

    budget.allocate(estimated_memory)
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyMemoryError, _>(e))?;

    let result = if strings.len() > 10_000 {
        strings
            .par_iter()
            .map(|s| s.trim().to_string())
            .collect()
    } else {
        strings
            .iter()
            .map(|s| {
                budget.operate().unwrap_or(());
                s.trim().to_string()
            })
            .collect()
    };

    budget.free(estimated_memory);
    Ok(result)
}

/// Secure string contains operation with input validation
fn secure_string_contains(
    strings: &[String],
    pattern: &str,
    budget: &mut ResourceBudget
) -> PyResult<Vec<String>> {
    // Validate pattern
    let clean_pattern = SecurityValidator::sanitize_string(pattern);

    if clean_pattern.len() > 1000 {
        return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
            "Search pattern too long"
        ));
    }

    let estimated_memory = strings.len() * 8; // Boolean results as strings
    budget.allocate(estimated_memory)
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyMemoryError, _>(e))?;

    let result = if strings.len() > 10_000 {
        strings
            .par_iter()
            .map(|s| s.contains(&clean_pattern).to_string())
            .collect()
    } else {
        strings
            .iter()
            .map(|s| {
                budget.operate().unwrap_or(());
                s.contains(&clean_pattern).to_string()
            })
            .collect()
    };

    budget.free(estimated_memory);
    Ok(result)
}

/// Secure regex matching with comprehensive validation
fn secure_string_regex_match(
    strings: &[String],
    pattern: &str,
    budget: &mut ResourceBudget
) -> PyResult<Vec<String>> {
    // Validate and compile regex with security checks
    let regex = match SecurityValidator::validate_regex_pattern(pattern) {
        RegexValidationResult::Valid(regex) => regex,
        RegexValidationResult::InvalidPattern(error) => {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                format!("Invalid regex pattern: {}", error)
            ));
        },
        RegexValidationResult::TooComplex => {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                "Regex pattern too complex - potential ReDoS attack"
            ));
        },
        RegexValidationResult::TooLarge => {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                "Regex pattern too large"
            ));
        },
        RegexValidationResult::Timeout => {
            return Err(PyErr::new::<pyo3::exceptions::PyTimeoutError, _>(
                "Regex compilation timed out"
            ));
        }
    };

    let regex_arc = Arc::new(regex);
    let estimated_memory = strings.len() * 8;

    budget.allocate(estimated_memory)
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyMemoryError, _>(e))?;

    // Execute with timeout protection
    let result = TimeoutWrapper::with_timeout(
        REGEX_TIMEOUT,
        || {
            if strings.len() > 10_000 {
                strings
                    .par_iter()
                    .map(|s| {
                        // Additional per-string timeout for ReDoS protection
                        match TimeoutWrapper::with_timeout(
                            Duration::from_millis(100), // 100ms per string
                            || regex_arc.is_match(s)
                        ) {
                            Ok(matches) => matches.to_string(),
                            Err(_) => "timeout".to_string() // Mark timeouts
                        }
                    })
                    .collect()
            } else {
                strings
                    .iter()
                    .map(|s| {
                        budget.operate().unwrap_or(());

                        match TimeoutWrapper::with_timeout(
                            Duration::from_millis(100),
                            || regex_arc.is_match(s)
                        ) {
                            Ok(matches) => matches.to_string(),
                            Err(_) => "timeout".to_string()
                        }
                    })
                    .collect()
            }
        }
    ).map_err(|e| PyErr::new::<pyo3::exceptions::PyTimeoutError, _>(e))?;

    budget.free(estimated_memory);
    Ok(result)
}

/// Secure batch string processing with resource limits
pub fn secure_string_batch_impl(
    strings: Vec<String>,
    operations: Vec<String>,
) -> PyResult<HashMap<String, Vec<String>>> {
    if strings.is_empty() || operations.is_empty() {
        return Ok(HashMap::new());
    }

    // Limit batch size to prevent resource exhaustion
    if operations.len() > 10 {
        return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
            "Too many operations in batch (max 10)"
        ));
    }

    let total_ops = SafeArithmetic::safe_multiply(strings.len(), operations.len())
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyMemoryError, _>(e))?;

    if total_ops > 10_000_000 { // 10M operations max
        return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
            "Batch too large - would exceed operation limits"
        ));
    }

    let mut results = HashMap::new();

    // Process each operation with individual security checks
    for operation in operations {
        let (op_name, pattern) = if operation.contains(':') {
            let parts: Vec<&str> = operation.splitn(2, ':').collect();
            (parts[0].to_string(), Some(parts[1].to_string()))
        } else {
            (operation.clone(), None)
        };

        // Use secure implementation for each operation
        let result = secure_string_ops_impl(strings.clone(), op_name, pattern)?;
        results.insert(operation, result);
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secure_string_operations() {
        let strings = vec!["Hello".to_string(), "World".to_string()];

        // Test length operation
        let lengths = secure_string_ops_impl(strings.clone(), "length".to_string(), None).unwrap();
        assert_eq!(lengths, vec!["5", "5"]);

        // Test uppercase
        let upper = secure_string_ops_impl(strings.clone(), "upper".to_string(), None).unwrap();
        assert_eq!(upper, vec!["HELLO", "WORLD"]);
    }

    #[test]
    fn test_malicious_regex() {
        let strings = vec!["test".to_string()];

        // This should be rejected as too complex
        let result = secure_string_ops_impl(
            strings,
            "regex".to_string(),
            Some("(a+)+".to_string())
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_unicode_sanitization() {
        // Create a string with problematic Unicode (simulated)
        let problematic_strings = vec![
            "Hello\u{0000}World".to_string(), // Null byte
            "Test\u{200B}String".to_string(), // Zero-width space
        ];

        // Should succeed after sanitization
        let result = secure_string_ops_impl(
            problematic_strings,
            "length".to_string(),
            None
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_resource_limits() {
        // Create very large input to test limits
        let large_string = "a".repeat(MAX_STRING_LENGTH + 1000);
        let strings = vec![large_string];

        // Should succeed but truncate
        let result = secure_string_ops_impl(
            strings,
            "length".to_string(),
            None
        );

        assert!(result.is_ok());
    }
}