//! RUNTIME-05: Resource Safety Limits
//!
//! Prevents runaway execution with hard limits:
//! - Max tool calls per execution
//! - Max recursion depth
//! - Max speculative branches
//! - Max wall-clock execution time
#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::{Duration, SystemTime};

/// ResourceLimits defines safety limits for execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    /// Maximum number of tool calls per execution
    pub max_tool_calls: usize,

    /// Maximum recursion depth
    pub max_recursion_depth: usize,

    /// Maximum speculative branches
    pub max_speculative_branches: usize,

    /// Maximum wall-clock execution time
    pub max_execution_time: Duration,

    /// Maximum tool calls per step (prevents parallel explosion)
    pub max_tool_calls_per_step: usize,

    /// Maximum output size per tool call (bytes)
    pub max_tool_output_size: usize,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_tool_calls: 100,                          // Total tool calls
            max_recursion_depth: 10,                      // Recursion depth
            max_speculative_branches: 5,                  // Speculative branches
            max_execution_time: Duration::from_secs(300), // 5 minutes
            max_tool_calls_per_step: 10,                  // Parallel tool calls per step
            max_tool_output_size: 10 * 1024 * 1024,       // 10MB per tool
        }
    }
}

impl ResourceLimits {
    /// Create conservative limits (lower values for safety)
    pub fn conservative() -> Self {
        Self {
            max_tool_calls: 50,
            max_recursion_depth: 5,
            max_speculative_branches: 3,
            max_execution_time: Duration::from_secs(120), // 2 minutes
            max_tool_calls_per_step: 5,
            max_tool_output_size: 5 * 1024 * 1024, // 5MB
        }
    }

    /// Create permissive limits (higher values for complex tasks)
    pub fn permissive() -> Self {
        Self {
            max_tool_calls: 200,
            max_recursion_depth: 20,
            max_speculative_branches: 10,
            max_execution_time: Duration::from_secs(600), // 10 minutes
            max_tool_calls_per_step: 20,
            max_tool_output_size: 50 * 1024 * 1024, // 50MB
        }
    }

    /// Validate that limits are reasonable
    pub fn validate(&self) -> Result<(), String> {
        if self.max_tool_calls == 0 {
            return Err("max_tool_calls must be > 0".to_string());
        }

        if self.max_recursion_depth == 0 {
            return Err("max_recursion_depth must be > 0".to_string());
        }

        if self.max_speculative_branches == 0 {
            return Err("max_speculative_branches must be > 0".to_string());
        }

        if self.max_execution_time.as_secs() == 0 {
            return Err("max_execution_time must be > 0".to_string());
        }

        if self.max_tool_calls_per_step == 0 {
            return Err("max_tool_calls_per_step must be > 0".to_string());
        }

        if self.max_tool_output_size == 0 {
            return Err("max_tool_output_size must be > 0".to_string());
        }

        // Sanity checks
        if self.max_tool_calls > 10000 {
            return Err("max_tool_calls suspiciously high (> 10000)".to_string());
        }

        if self.max_recursion_depth > 100 {
            return Err("max_recursion_depth suspiciously high (> 100)".to_string());
        }

        if self.max_execution_time.as_secs() > 3600 {
            return Err("max_execution_time suspiciously high (> 1 hour)".to_string());
        }

        Ok(())
    }
}

/// ResourceTracker tracks resource usage during execution
#[derive(Debug, Clone)]
pub struct ResourceTracker {
    limits: ResourceLimits,
    total_tool_calls: usize,
    current_recursion_depth: usize,
    speculative_branches: usize,
    start_time: SystemTime,
}

impl ResourceTracker {
    /// Create a new resource tracker with given limits
    pub fn new(limits: ResourceLimits) -> Self {
        Self {
            limits,
            total_tool_calls: 0,
            current_recursion_depth: 0,
            speculative_branches: 0,
            start_time: SystemTime::now(),
        }
    }

    /// Check if adding N tool calls would exceed limits
    pub fn check_tool_calls(&self, count: usize) -> Result<(), ResourceLimitError> {
        let new_total = self.total_tool_calls + count;

        if new_total > self.limits.max_tool_calls {
            return Err(ResourceLimitError::MaxToolCallsExceeded {
                limit: self.limits.max_tool_calls,
                current: new_total,
            });
        }

        if count > self.limits.max_tool_calls_per_step {
            return Err(ResourceLimitError::MaxToolCallsPerStepExceeded {
                limit: self.limits.max_tool_calls_per_step,
                requested: count,
            });
        }

        Ok(())
    }

    /// Record tool calls
    pub fn record_tool_calls(&mut self, count: usize) {
        self.total_tool_calls += count;
    }

    /// Check if increasing recursion depth would exceed limits
    pub fn check_recursion_depth(&self) -> Result<(), ResourceLimitError> {
        let new_depth = self.current_recursion_depth + 1;

        if new_depth > self.limits.max_recursion_depth {
            return Err(ResourceLimitError::MaxRecursionDepthExceeded {
                limit: self.limits.max_recursion_depth,
                current: new_depth,
            });
        }

        Ok(())
    }

    /// Enter a recursion level
    pub fn enter_recursion(&mut self) {
        self.current_recursion_depth += 1;
    }

    /// Exit a recursion level
    pub fn exit_recursion(&mut self) {
        if self.current_recursion_depth > 0 {
            self.current_recursion_depth -= 1;
        }
    }

    /// Check if adding a speculative branch would exceed limits
    pub fn check_speculative_branch(&self) -> Result<(), ResourceLimitError> {
        let new_branches = self.speculative_branches + 1;

        if new_branches > self.limits.max_speculative_branches {
            return Err(ResourceLimitError::MaxSpeculativeBranchesExceeded {
                limit: self.limits.max_speculative_branches,
                current: new_branches,
            });
        }

        Ok(())
    }

    /// Record a speculative branch
    pub fn record_speculative_branch(&mut self) {
        self.speculative_branches += 1;
    }

    /// Check if execution time has exceeded limit
    pub fn check_execution_time(&self) -> Result<(), ResourceLimitError> {
        let elapsed = self
            .start_time
            .elapsed()
            .map_err(|_| ResourceLimitError::ExecutionTimeCheckFailed)?;

        if elapsed > self.limits.max_execution_time {
            return Err(ResourceLimitError::MaxExecutionTimeExceeded {
                limit: self.limits.max_execution_time,
                elapsed,
            });
        }

        Ok(())
    }

    /// Check if tool output size is within limits
    pub fn check_tool_output_size(&self, size: usize) -> Result<(), ResourceLimitError> {
        if size > self.limits.max_tool_output_size {
            return Err(ResourceLimitError::MaxToolOutputSizeExceeded {
                limit: self.limits.max_tool_output_size,
                actual: size,
            });
        }

        Ok(())
    }

    /// Get current resource usage
    pub fn get_usage(&self) -> ResourceUsage {
        let elapsed = self.start_time.elapsed().unwrap_or(Duration::from_secs(0));

        ResourceUsage {
            total_tool_calls: self.total_tool_calls,
            current_recursion_depth: self.current_recursion_depth,
            speculative_branches: self.speculative_branches,
            elapsed_time: elapsed,
        }
    }

    /// Get resource limits
    pub fn get_limits(&self) -> &ResourceLimits {
        &self.limits
    }
}

/// ResourceUsage represents current resource consumption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub total_tool_calls: usize,
    pub current_recursion_depth: usize,
    pub speculative_branches: usize,
    pub elapsed_time: Duration,
}

/// ResourceLimitError represents resource limit violations
#[derive(Debug, Clone)]
pub enum ResourceLimitError {
    MaxToolCallsExceeded { limit: usize, current: usize },
    MaxToolCallsPerStepExceeded { limit: usize, requested: usize },
    MaxRecursionDepthExceeded { limit: usize, current: usize },
    MaxSpeculativeBranchesExceeded { limit: usize, current: usize },
    MaxExecutionTimeExceeded { limit: Duration, elapsed: Duration },
    MaxToolOutputSizeExceeded { limit: usize, actual: usize },
    ExecutionTimeCheckFailed,
}

impl fmt::Display for ResourceLimitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResourceLimitError::MaxToolCallsExceeded { limit, current } => {
                write!(
                    f,
                    "Maximum tool calls exceeded: limit={}, current={}",
                    limit, current
                )
            }
            ResourceLimitError::MaxToolCallsPerStepExceeded { limit, requested } => {
                write!(
                    f,
                    "Maximum tool calls per step exceeded: limit={}, requested={}",
                    limit, requested
                )
            }
            ResourceLimitError::MaxRecursionDepthExceeded { limit, current } => {
                write!(
                    f,
                    "Maximum recursion depth exceeded: limit={}, current={}",
                    limit, current
                )
            }
            ResourceLimitError::MaxSpeculativeBranchesExceeded { limit, current } => {
                write!(
                    f,
                    "Maximum speculative branches exceeded: limit={}, current={}",
                    limit, current
                )
            }
            ResourceLimitError::MaxExecutionTimeExceeded { limit, elapsed } => {
                write!(
                    f,
                    "Maximum execution time exceeded: limit={:.1}s, elapsed={:.1}s",
                    limit.as_secs_f64(),
                    elapsed.as_secs_f64()
                )
            }
            ResourceLimitError::MaxToolOutputSizeExceeded { limit, actual } => {
                write!(
                    f,
                    "Maximum tool output size exceeded: limit={} bytes, actual={} bytes",
                    limit, actual
                )
            }
            ResourceLimitError::ExecutionTimeCheckFailed => {
                write!(f, "Failed to check execution time (system clock error)")
            }
        }
    }
}

impl std::error::Error for ResourceLimitError {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn test_default_limits_validation() {
        let limits = ResourceLimits::default();
        assert!(limits.validate().is_ok());
    }

    #[test]
    fn test_conservative_limits_validation() {
        let limits = ResourceLimits::conservative();
        assert!(limits.validate().is_ok());
    }

    #[test]
    fn test_permissive_limits_validation() {
        let limits = ResourceLimits::permissive();
        assert!(limits.validate().is_ok());
    }

    #[test]
    fn test_invalid_limits() {
        let mut limits = ResourceLimits::default();

        limits.max_tool_calls = 0;
        assert!(limits.validate().is_err());

        limits.max_tool_calls = 100;
        limits.max_recursion_depth = 0;
        assert!(limits.validate().is_err());

        limits.max_recursion_depth = 10;
        limits.max_execution_time = Duration::from_secs(0);
        assert!(limits.validate().is_err());
    }

    #[test]
    fn test_tool_calls_limit() {
        let limits = ResourceLimits {
            max_tool_calls: 10,
            ..Default::default()
        };
        let mut tracker = ResourceTracker::new(limits);

        // Should succeed
        assert!(tracker.check_tool_calls(5).is_ok());
        tracker.record_tool_calls(5);

        // Should succeed (5 + 5 = 10)
        assert!(tracker.check_tool_calls(5).is_ok());
        tracker.record_tool_calls(5);

        // Should fail (10 + 1 = 11 > 10)
        assert!(tracker.check_tool_calls(1).is_err());
    }

    #[test]
    fn test_tool_calls_per_step_limit() {
        let limits = ResourceLimits {
            max_tool_calls_per_step: 5,
            ..Default::default()
        };
        let tracker = ResourceTracker::new(limits);

        // Should succeed
        assert!(tracker.check_tool_calls(5).is_ok());

        // Should fail (6 > 5)
        assert!(tracker.check_tool_calls(6).is_err());
    }

    #[test]
    fn test_recursion_depth_limit() {
        let limits = ResourceLimits {
            max_recursion_depth: 3,
            ..Default::default()
        };
        let mut tracker = ResourceTracker::new(limits);

        // Depth 1
        assert!(tracker.check_recursion_depth().is_ok());
        tracker.enter_recursion();

        // Depth 2
        assert!(tracker.check_recursion_depth().is_ok());
        tracker.enter_recursion();

        // Depth 3
        assert!(tracker.check_recursion_depth().is_ok());
        tracker.enter_recursion();

        // Depth 4 - should fail
        assert!(tracker.check_recursion_depth().is_err());

        // Exit and try again
        tracker.exit_recursion();
        assert!(tracker.check_recursion_depth().is_ok());
    }

    #[test]
    fn test_speculative_branches_limit() {
        let limits = ResourceLimits {
            max_speculative_branches: 2,
            ..Default::default()
        };
        let mut tracker = ResourceTracker::new(limits);

        // Branch 1
        assert!(tracker.check_speculative_branch().is_ok());
        tracker.record_speculative_branch();

        // Branch 2
        assert!(tracker.check_speculative_branch().is_ok());
        tracker.record_speculative_branch();

        // Branch 3 - should fail
        assert!(tracker.check_speculative_branch().is_err());
    }

    #[test]
    fn test_execution_time_limit() {
        let limits = ResourceLimits {
            max_execution_time: Duration::from_millis(100),
            ..Default::default()
        };
        let tracker = ResourceTracker::new(limits);

        // Should succeed initially
        assert!(tracker.check_execution_time().is_ok());

        // Wait for limit to be exceeded
        sleep(Duration::from_millis(150));

        // Should fail now
        assert!(tracker.check_execution_time().is_err());
    }

    #[test]
    fn test_tool_output_size_limit() {
        let limits = ResourceLimits {
            max_tool_output_size: 1000,
            ..Default::default()
        };
        let tracker = ResourceTracker::new(limits);

        // Should succeed
        assert!(tracker.check_tool_output_size(500).is_ok());
        assert!(tracker.check_tool_output_size(1000).is_ok());

        // Should fail
        assert!(tracker.check_tool_output_size(1001).is_err());
    }

    #[test]
    fn test_resource_usage() {
        let limits = ResourceLimits::default();
        let mut tracker = ResourceTracker::new(limits);

        tracker.record_tool_calls(5);
        tracker.enter_recursion();
        tracker.enter_recursion();
        tracker.record_speculative_branch();

        let usage = tracker.get_usage();
        assert_eq!(usage.total_tool_calls, 5);
        assert_eq!(usage.current_recursion_depth, 2);
        assert_eq!(usage.speculative_branches, 1);
    }
}
