//! Execution results and metadata

use crate::core::NodeStatus;
use std::time::Duration;

/// Result of a behavior tree execution
///
/// Contains the final status along with execution metadata
/// like tick count, duration, and any errors encountered.
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    /// Final status of the tree execution
    pub status: NodeStatus,

    /// Number of ticks executed
    pub tick_count: u64,

    /// Total execution duration
    pub duration: Duration,

    /// Optional error message if execution failed
    pub error: Option<String>,

    /// Whether execution was cancelled
    pub cancelled: bool,

    /// Whether max ticks limit was reached
    pub max_ticks_reached: bool,

    /// Whether deadline was exceeded
    pub deadline_exceeded: bool,

    /// Last WAL checkpoint from this execution (when WAL session was active).
    /// Overture persists this so execution can resume on a new runtime if this
    /// one crashes before the next scheduled checkpoint.
    #[cfg(feature = "wal")]
    pub checkpoint: Option<igris_wal::BtCheckpointPayload>,
}

impl ExecutionResult {
    /// Create a new execution result
    pub fn new(status: NodeStatus, tick_count: u64, duration: Duration) -> Self {
        Self {
            status,
            tick_count,
            duration,
            error: None,
            cancelled: false,
            max_ticks_reached: false,
            deadline_exceeded: false,
            #[cfg(feature = "wal")]
            checkpoint: None,
        }
    }

    /// Mark result as cancelled
    pub fn with_cancelled(mut self) -> Self {
        self.cancelled = true;
        self
    }

    /// Mark result as max ticks reached
    pub fn with_max_ticks_reached(mut self) -> Self {
        self.max_ticks_reached = true;
        self
    }

    /// Mark result as deadline exceeded
    pub fn with_deadline_exceeded(mut self) -> Self {
        self.deadline_exceeded = true;
        self
    }

    /// Attach a WAL checkpoint to the result.
    #[cfg(feature = "wal")]
    pub fn with_checkpoint(mut self, cp: igris_wal::BtCheckpointPayload) -> Self {
        self.checkpoint = Some(cp);
        self
    }

    /// Add error message
    pub fn with_error(mut self, error: String) -> Self {
        self.error = Some(error);
        self
    }

    /// Check if execution completed successfully
    pub fn is_success(&self) -> bool {
        self.status.is_success() && !self.cancelled && self.error.is_none()
    }

    /// Check if execution failed
    pub fn is_failure(&self) -> bool {
        self.status.is_failure() || self.error.is_some()
    }

    /// Check if execution was interrupted
    pub fn is_interrupted(&self) -> bool {
        self.cancelled || self.max_ticks_reached || self.deadline_exceeded
    }
}

impl std::fmt::Display for ExecutionResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "ExecutionResult(status={:?}, ticks={}, duration={:?}",
            self.status, self.tick_count, self.duration
        )?;

        if self.cancelled {
            write!(f, ", cancelled")?;
        }
        if self.max_ticks_reached {
            write!(f, ", max_ticks_reached")?;
        }
        if self.deadline_exceeded {
            write!(f, ", deadline_exceeded")?;
        }
        if let Some(ref err) = self.error {
            write!(f, ", error={}", err)?;
        }

        write!(f, ")")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_execution_result_success() {
        let result = ExecutionResult::new(NodeStatus::Success, 5, Duration::from_millis(100));

        assert!(result.is_success());
        assert!(!result.is_failure());
        assert!(!result.is_interrupted());
    }

    #[test]
    fn test_execution_result_failure() {
        let result = ExecutionResult::new(NodeStatus::Failure, 3, Duration::from_millis(50));

        assert!(!result.is_success());
        assert!(result.is_failure());
    }

    #[test]
    fn test_execution_result_cancelled() {
        let result = ExecutionResult::new(NodeStatus::Running, 10, Duration::from_millis(200))
            .with_cancelled();

        assert!(!result.is_success());
        assert!(result.is_interrupted());
        assert!(result.cancelled);
    }

    #[test]
    fn test_execution_result_max_ticks() {
        let result = ExecutionResult::new(NodeStatus::Running, 100, Duration::from_secs(1))
            .with_max_ticks_reached();

        assert!(result.is_interrupted());
        assert!(result.max_ticks_reached);
    }

    #[test]
    fn test_execution_result_deadline() {
        let result = ExecutionResult::new(NodeStatus::Running, 50, Duration::from_secs(5))
            .with_deadline_exceeded();

        assert!(result.is_interrupted());
        assert!(result.deadline_exceeded);
    }

    #[test]
    fn test_execution_result_with_error() {
        let result = ExecutionResult::new(NodeStatus::Failure, 2, Duration::from_millis(10))
            .with_error("Test error".to_string());

        assert!(result.is_failure());
        assert_eq!(result.error, Some("Test error".to_string()));
    }
}
