//! Node execution status types.
//!
//! This module defines the core status values that behavior tree nodes return
//! during execution, following BehaviorTree.CPP conventions.

use serde::{Deserialize, Serialize};

/// Node execution status following BehaviorTree.CPP conventions.
///
/// Each node's `tick()` method returns a `NodeStatus` to indicate its current
/// execution state. The status determines how parent nodes respond and whether
/// execution should continue.
///
/// # Status Flow
///
/// Nodes typically transition through these states:
/// - Initial tick: Returns `Running` if async work is needed
/// - Subsequent ticks: Continues returning `Running` until complete
/// - Final tick: Returns `Success` or `Failure` (terminal states)
///
/// # Examples
///
/// ```
/// use igris_btree::core::NodeStatus;
///
/// let status = NodeStatus::Success;
/// assert!(status.is_terminal());
/// assert!(status.is_success());
///
/// let running = NodeStatus::Running;
/// assert!(!running.is_terminal());
/// assert!(running.is_running());
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeStatus {
    /// Node is currently executing (async operations in progress).
    ///
    /// The node should be ticked again in the next cycle to continue execution.
    /// Used for long-running operations like network requests, sensor readings,
    /// or multi-step processes.
    Running,

    /// Node completed successfully.
    ///
    /// This is a terminal state. Parent nodes (like Sequence) will move to
    /// the next child. The node should be reset before being executed again.
    Success,

    /// Node failed.
    ///
    /// This is a terminal state. Parent nodes (like Sequence) will stop
    /// execution and propagate failure. Selector nodes will try the next child.
    Failure,

    /// Node execution was skipped.
    ///
    /// Rare status used when a node determines it doesn't need to execute
    /// (e.g., preconditions not met). Parent nodes typically treat this
    /// like a neutral outcome and continue to the next child.
    Skipped,
}

impl NodeStatus {
    /// Check if status is terminal (Success or Failure).
    ///
    /// Terminal statuses indicate the node has completed execution and should
    /// be reset before running again. Non-terminal statuses (Running, Skipped)
    /// indicate the node may need to be ticked again.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::NodeStatus;
    ///
    /// assert!(NodeStatus::Success.is_terminal());
    /// assert!(NodeStatus::Failure.is_terminal());
    /// assert!(!NodeStatus::Running.is_terminal());
    /// ```
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Success | Self::Failure)
    }

    /// Check if status is Running.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::NodeStatus;
    ///
    /// assert!(NodeStatus::Running.is_running());
    /// assert!(!NodeStatus::Success.is_running());
    /// ```
    pub fn is_running(&self) -> bool {
        matches!(self, Self::Running)
    }

    /// Check if status is Success.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::NodeStatus;
    ///
    /// assert!(NodeStatus::Success.is_success());
    /// assert!(!NodeStatus::Failure.is_success());
    /// ```
    pub fn is_success(&self) -> bool {
        matches!(self, Self::Success)
    }

    /// Check if status is Failure.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::NodeStatus;
    ///
    /// assert!(NodeStatus::Failure.is_failure());
    /// assert!(!NodeStatus::Success.is_failure());
    /// ```
    pub fn is_failure(&self) -> bool {
        matches!(self, Self::Failure)
    }
}

impl std::fmt::Display for NodeStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Running => write!(f, "Running"),
            Self::Success => write!(f, "Success"),
            Self::Failure => write!(f, "Failure"),
            Self::Skipped => write!(f, "Skipped"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_terminal() {
        assert!(NodeStatus::Success.is_terminal());
        assert!(NodeStatus::Failure.is_terminal());
        assert!(!NodeStatus::Running.is_terminal());
        assert!(!NodeStatus::Skipped.is_terminal());
    }

    #[test]
    fn test_status_checks() {
        assert!(NodeStatus::Running.is_running());
        assert!(NodeStatus::Success.is_success());
        assert!(NodeStatus::Failure.is_failure());
    }
}
