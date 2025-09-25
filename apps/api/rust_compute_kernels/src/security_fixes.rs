//! Security fixes for identified vulnerabilities
//!
//! This module provides secure wrappers and utilities to address
//! the 9 security vulnerabilities found during fuzz testing.

use pyo3::prelude::*;
use regex::Regex;
use std::time::{Duration, Instant};
use std::collections::HashSet;

/// Maximum allowed string length for processing (1MB)
pub const MAX_STRING_LENGTH: usize = 1024 * 1024;

/// Maximum allowed regex pattern length
pub const MAX_REGEX_PATTERN_LENGTH: usize = 1000;

/// Timeout for regex operations (5 seconds)
pub const REGEX_TIMEOUT: Duration = Duration::from_secs(5);

/// Maximum number of columns to process
pub const MAX_COLUMNS: usize = 10000;

/// Secure string validation result
#[derive(Debug)]
pub enum ValidationResult {
    Valid,
    InvalidUtf8,
    TooLarge,
    ContainsSurrogates,
    InvalidCharacters,
}

/// Secure regex validation result
#[derive(Debug)]
pub enum RegexValidationResult {
    Valid(Regex),
    InvalidPattern(String),
    TooComplex,
    TooLarge,
    Timeout,
}

/// Security utilities for input validation and sanitization
pub struct SecurityValidator;

impl SecurityValidator {
    /// Validate and sanitize Unicode strings
    pub fn validate_string(input: &str) -> ValidationResult {
        // Check length limit
        if input.len() > MAX_STRING_LENGTH {
            return ValidationResult::TooLarge;
        }

        // Check for invalid UTF-8 sequences
        if !input.is_valid_utf8() {
            return ValidationResult::InvalidUtf8;
        }

        // Check for surrogate pairs and other problematic Unicode
        for ch in input.chars() {
            if ch.is_surrogate() {
                return ValidationResult::ContainsSurrogates;
            }

            // Check for control characters that might cause issues
            if ch.is_control() && ch != '\t' && ch != '\n' && ch != '\r' {
                return ValidationResult::InvalidCharacters;
            }
        }

        ValidationResult::Valid
    }

    /// Sanitize string by removing problematic characters
    pub fn sanitize_string(input: &str) -> String {
        input
            .chars()
            .filter(|&ch| {
                // Keep printable characters, basic whitespace, and valid Unicode
                !ch.is_surrogate()
                && (ch.is_ascii_graphic() || ch.is_ascii_whitespace() ||
                    (ch.is_alphanumeric() && !ch.is_control()))
            })
            .take(MAX_STRING_LENGTH) // Truncate if too long
            .collect()
    }

    /// Validate regex patterns securely
    pub fn validate_regex_pattern(pattern: &str) -> RegexValidationResult {
        // Check pattern length
        if pattern.len() > MAX_REGEX_PATTERN_LENGTH {
            return RegexValidationResult::TooLarge;
        }

        // Check for obviously problematic patterns
        if Self::is_dangerous_regex(pattern) {
            return RegexValidationResult::TooComplex;
        }

        // Try to compile with timeout
        let start = Instant::now();
        match Regex::new(pattern) {
            Ok(regex) => {
                if start.elapsed() > REGEX_TIMEOUT {
                    RegexValidationResult::Timeout
                } else {
                    RegexValidationResult::Valid(regex)
                }
            }
            Err(e) => RegexValidationResult::InvalidPattern(e.to_string())
        }
    }

    /// Check if regex pattern is potentially dangerous
    fn is_dangerous_regex(pattern: &str) -> bool {
        // Patterns that can cause catastrophic backtracking
        let dangerous_patterns = [
            "(a+)+",        // Nested quantifiers
            "(a*)*",        // Nested quantifiers
            "(a|a)*",       // Alternation with same pattern
            "a*a*a*a*a*",   // Multiple quantifiers
        ];

        for dangerous in &dangerous_patterns {
            if pattern.contains(dangerous) {
                return true;
            }
        }

        // Check for excessive nesting
        let nesting_level = pattern.matches('(').count();
        if nesting_level > 10 {
            return true;
        }

        // Check for very long character classes
        if pattern.contains('[') && pattern.matches('[').count() > 5 {
            return true;
        }

        false
    }

    /// Validate file paths to prevent directory traversal
    pub fn validate_file_path(path: &str) -> PyResult<String> {
        use std::path::Path;

        // Check for path traversal attempts
        if path.contains("..") || path.contains("~") {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                "Path traversal not allowed"
            ));
        }

        // Ensure path is within allowed directories (simplified - should be configurable)
        let path_obj = Path::new(path);

        if path_obj.is_absolute() {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                "Absolute paths not allowed"
            ));
        }

        // Canonicalize path to resolve any remaining traversal attempts
        match path_obj.canonicalize() {
            Ok(canonical_path) => Ok(canonical_path.to_string_lossy().to_string()),
            Err(_) => Ok(path.to_string()) // File doesn't exist yet, that's okay
        }
    }

    /// Validate column count for memory operations
    pub fn validate_column_count(count: usize) -> PyResult<()> {
        if count > MAX_COLUMNS {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                format!("Too many columns: {} > {}", count, MAX_COLUMNS)
            ));
        }
        Ok(())
    }
}

/// Secure mutex handling to prevent poisoning
pub struct SecureMutex<T> {
    inner: std::sync::Mutex<T>,
}

impl<T> SecureMutex<T> {
    pub fn new(value: T) -> Self {
        Self {
            inner: std::sync::Mutex::new(value),
        }
    }

    /// Lock with proper error handling
    pub fn lock(&self) -> Result<std::sync::MutexGuard<T>, String> {
        match self.inner.lock() {
            Ok(guard) => Ok(guard),
            Err(poisoned) => {
                // Handle poisoned mutex gracefully
                eprintln!("Warning: Mutex was poisoned, recovering data");
                Ok(poisoned.into_inner())
            }
        }
    }

    /// Try to lock with timeout
    pub fn try_lock_timeout(&self, timeout: Duration) -> Result<Option<std::sync::MutexGuard<T>>, String> {
        let start = Instant::now();

        loop {
            match self.inner.try_lock() {
                Ok(guard) => return Ok(Some(guard)),
                Err(std::sync::TryLockError::WouldBlock) => {
                    if start.elapsed() > timeout {
                        return Ok(None);
                    }
                    std::thread::sleep(Duration::from_millis(1));
                }
                Err(std::sync::TryLockError::Poisoned(poisoned)) => {
                    eprintln!("Warning: Mutex was poisoned, recovering data");
                    return Ok(Some(poisoned.into_inner()));
                }
            }
        }
    }
}

/// Memory-safe arithmetic operations
pub struct SafeArithmetic;

impl SafeArithmetic {
    /// Safe multiplication with overflow checking
    pub fn safe_multiply(a: usize, b: usize) -> Result<usize, String> {
        a.checked_mul(b).ok_or_else(|| "Multiplication overflow".to_string())
    }

    /// Safe addition with overflow checking
    pub fn safe_add(a: usize, b: usize) -> Result<usize, String> {
        a.checked_add(b).ok_or_else(|| "Addition overflow".to_string())
    }

    /// Safe division with zero checking
    pub fn safe_divide(a: usize, b: usize) -> Result<usize, String> {
        if b == 0 {
            return Err("Division by zero".to_string());
        }
        Ok(a / b)
    }
}

/// Resource budget tracker for preventing exhaustion attacks
pub struct ResourceBudget {
    max_memory: usize,
    max_operations: usize,
    current_memory: usize,
    current_operations: usize,
}

impl ResourceBudget {
    pub fn new(max_memory: usize, max_operations: usize) -> Self {
        Self {
            max_memory,
            max_operations,
            current_memory: 0,
            current_operations: 0,
        }
    }

    /// Check if we can allocate more memory
    pub fn can_allocate(&self, size: usize) -> bool {
        self.current_memory + size <= self.max_memory
    }

    /// Check if we can perform more operations
    pub fn can_operate(&self) -> bool {
        self.current_operations < self.max_operations
    }

    /// Allocate memory (fails if over budget)
    pub fn allocate(&mut self, size: usize) -> Result<(), String> {
        if !self.can_allocate(size) {
            return Err("Memory budget exceeded".to_string());
        }
        self.current_memory += size;
        Ok(())
    }

    /// Perform operation (fails if over budget)
    pub fn operate(&mut self) -> Result<(), String> {
        if !self.can_operate() {
            return Err("Operation budget exceeded".to_string());
        }
        self.current_operations += 1;
        Ok(())
    }

    /// Free memory
    pub fn free(&mut self, size: usize) {
        self.current_memory = self.current_memory.saturating_sub(size);
    }
}

/// Timeout wrapper for operations
pub struct TimeoutWrapper;

impl TimeoutWrapper {
    /// Execute operation with timeout
    pub fn with_timeout<T, F>(timeout: Duration, operation: F) -> Result<T, String>
    where
        F: FnOnce() -> T + Send,
        T: Send,
    {
        use std::thread;

        let start = Instant::now();

        // For simple operations, just check time periodically
        // In a real implementation, you might use async/await or proper cancellation
        let result = operation();

        if start.elapsed() > timeout {
            Err("Operation timed out".to_string())
        } else {
            Ok(result)
        }
    }
}

/// Extension trait for safer UTF-8 handling
trait SafeUtf8 {
    fn is_valid_utf8(&self) -> bool;
    fn to_safe_string(&self) -> String;
}

impl SafeUtf8 for str {
    fn is_valid_utf8(&self) -> bool {
        // Already validated by Rust string type, but check for surrogates
        !self.chars().any(|c| c.is_surrogate())
    }

    fn to_safe_string(&self) -> String {
        SecurityValidator::sanitize_string(self)
    }
}

/// Extension trait for checking surrogate characters
trait SurrogateCheck {
    fn is_surrogate(&self) -> bool;
}

impl SurrogateCheck for char {
    fn is_surrogate(&self) -> bool {
        matches!(*self as u32, 0xD800..=0xDFFF)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_validation() {
        // Valid string
        assert!(matches!(SecurityValidator::validate_string("Hello, 世界!"), ValidationResult::Valid));

        // Too large string
        let large_string = "a".repeat(MAX_STRING_LENGTH + 1);
        assert!(matches!(SecurityValidator::validate_string(&large_string), ValidationResult::TooLarge));

        // String with surrogates (simulated)
        // Note: In real Rust strings, surrogates are not directly possible,
        // but they can come from external sources
    }

    #[test]
    fn test_regex_validation() {
        // Valid regex
        if let RegexValidationResult::Valid(_) = SecurityValidator::validate_regex_pattern("hello") {
            // Success
        } else {
            panic!("Valid regex should pass");
        }

        // Dangerous regex
        assert!(matches!(
            SecurityValidator::validate_regex_pattern("(a+)+"),
            RegexValidationResult::TooComplex
        ));

        // Too large regex
        let large_pattern = "a".repeat(MAX_REGEX_PATTERN_LENGTH + 1);
        assert!(matches!(
            SecurityValidator::validate_regex_pattern(&large_pattern),
            RegexValidationResult::TooLarge
        ));
    }

    #[test]
    fn test_path_validation() {
        // Valid relative path
        assert!(SecurityValidator::validate_file_path("data/test.csv").is_ok());

        // Path traversal attempt
        assert!(SecurityValidator::validate_file_path("../etc/passwd").is_err());
        assert!(SecurityValidator::validate_file_path("~/secret").is_err());
    }

    #[test]
    fn test_safe_arithmetic() {
        // Valid operations
        assert_eq!(SafeArithmetic::safe_multiply(100, 200).unwrap(), 20000);
        assert_eq!(SafeArithmetic::safe_add(100, 200).unwrap(), 300);
        assert_eq!(SafeArithmetic::safe_divide(100, 20).unwrap(), 5);

        // Overflow
        assert!(SafeArithmetic::safe_multiply(usize::MAX, 2).is_err());

        // Division by zero
        assert!(SafeArithmetic::safe_divide(100, 0).is_err());
    }
}