#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;
use schlep_compute_kernels::security_fixes::SecurityValidator;

#[derive(Arbitrary, Debug)]
struct PathInput {
    path: String,
}

/// Fuzzing harness for path validation
///
/// Tests for:
/// - VUL-006: Path traversal validation
fuzz_target!(|input: PathInput| {
    // Limit path length to reasonable bounds
    let path = if input.path.len() > 4096 {
        input.path.chars().take(4096).collect()
    } else {
        input.path
    };

    // Test path validation - should never panic
    let result = std::panic::catch_unwind(|| {
        SecurityValidator::validate_file_path(&path)
    });

    match result {
        Ok(validation_result) => {
            match validation_result {
                Ok(validated_path) => {
                    // Path was validated - should not contain traversal attempts
                    assert!(!validated_path.contains(".."), "Validated path contains '..'");
                    assert!(!validated_path.contains("~"), "Validated path contains '~'");

                    // Should be a relative path (not absolute)
                    #[cfg(unix)]
                    assert!(!validated_path.starts_with('/'), "Validated path is absolute");

                    #[cfg(windows)]
                    {
                        assert!(!validated_path.contains(":\\"), "Validated path contains drive letter");
                        assert!(!validated_path.starts_with("\\\\"), "Validated path is UNC");
                    }
                },
                Err(_) => {
                    // Path was rejected - good for security
                    // Common reasons: contains "..", is absolute, contains "~", etc.
                }
            }
        },
        Err(_) => {
            panic!("Path validation panicked unexpectedly!");
        }
    }
});