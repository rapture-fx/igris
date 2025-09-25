#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;
use schlep_compute_kernels::security_fixes::SafeArithmetic;

#[derive(Arbitrary, Debug)]
struct ArithmeticInput {
    a: usize,
    b: usize,
    operation: ArithmeticOperation,
}

#[derive(Arbitrary, Debug)]
enum ArithmeticOperation {
    Multiply,
    Add,
    Divide,
}

/// Fuzzing harness for arithmetic operations
///
/// Tests for:
/// - VUL-009: Integer overflow protection
fuzz_target!(|input: ArithmeticInput| {
    // Test safe arithmetic operations - should never panic
    let result = std::panic::catch_unwind(|| {
        match input.operation {
            ArithmeticOperation::Multiply => {
                SafeArithmetic::safe_multiply(input.a, input.b)
            },
            ArithmeticOperation::Add => {
                SafeArithmetic::safe_add(input.a, input.b)
            },
            ArithmeticOperation::Divide => {
                SafeArithmetic::safe_divide(input.a, input.b)
            }
        }
    });

    match result {
        Ok(arithmetic_result) => {
            match arithmetic_result {
                Ok(value) => {
                    // Operation succeeded - validate result makes sense
                    match input.operation {
                        ArithmeticOperation::Multiply => {
                            if input.a > 0 && input.b > 0 {
                                assert!(value >= input.a, "Multiplication result too small");
                                assert!(value >= input.b, "Multiplication result too small");
                            }
                        },
                        ArithmeticOperation::Add => {
                            if input.a > 0 {
                                assert!(value > input.a, "Addition result too small");
                            }
                            if input.b > 0 {
                                assert!(value > input.b, "Addition result too small");
                            }
                        },
                        ArithmeticOperation::Divide => {
                            if input.b > 0 {
                                assert!(value <= input.a, "Division result too large");
                            }
                        }
                    }
                },
                Err(_) => {
                    // Operation failed safely - good for overflow protection
                    // Common reasons: overflow, underflow, division by zero
                }
            }
        },
        Err(_) => {
            panic!("Safe arithmetic operation panicked unexpectedly!");
        }
    }

    // Test that unsafe operations would actually overflow
    if let ArithmeticOperation::Multiply = input.operation {
        if input.a > 0 && input.b > 0 {
            let would_overflow = input.a.checked_mul(input.b).is_none();
            let safe_result = SafeArithmetic::safe_multiply(input.a, input.b);

            if would_overflow {
                // If it would overflow, our safe function should return an error
                assert!(safe_result.is_err(), "Safe multiply should detect overflow");
            }
        }
    }
});