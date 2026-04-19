//! Igris Real-Time Execution Module
//!
//! Provides deterministic execution with bounded latency for critical AI inference tasks.
//! Supports priority-based task scheduling and latency monitoring.

use serde::{Deserialize, Serialize};
use std::time::Duration;

pub mod config;
pub mod executor;
pub mod metrics;

pub use config::RtConfig;
pub use executor::{RtExecutor, RtTask, TaskPriority};
pub use metrics::RtMetrics;

/// Priority levels for real-time tasks
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Priority {
    /// Critical priority - must complete within 50ms
    Critical = 3,
    /// High priority - must complete within 200ms
    High = 2,
    /// Normal priority - best effort
    Normal = 1,
    /// Low priority - background tasks
    Low = 0,
}

impl Priority {
    /// Get the target latency bound for this priority level
    pub fn latency_bound(&self) -> Duration {
        match self {
            Priority::Critical => Duration::from_millis(50),
            Priority::High => Duration::from_millis(200),
            Priority::Normal => Duration::from_millis(1000),
            Priority::Low => Duration::from_millis(5000),
        }
    }
}

/// Real-time execution result with latency metrics
#[derive(Debug)]
pub struct RtResult<T> {
    pub value: T,
    pub latency: Duration,
    pub priority: Priority,
    pub deadline_met: bool,
}

impl<T> RtResult<T> {
    pub fn new(value: T, latency: Duration, priority: Priority) -> Self {
        let deadline_met = latency <= priority.latency_bound();
        Self {
            value,
            latency,
            priority,
            deadline_met,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_priority_ordering() {
        assert!(Priority::Critical > Priority::High);
        assert!(Priority::High > Priority::Normal);
        assert!(Priority::Normal > Priority::Low);
    }

    #[test]
    fn test_latency_bounds() {
        assert_eq!(
            Priority::Critical.latency_bound(),
            Duration::from_millis(50)
        );
        assert_eq!(Priority::High.latency_bound(), Duration::from_millis(200));
        assert_eq!(
            Priority::Normal.latency_bound(),
            Duration::from_millis(1000)
        );
        assert_eq!(Priority::Low.latency_bound(), Duration::from_millis(5000));
    }

    #[test]
    fn test_rt_result_deadline() {
        let result = RtResult::new("test", Duration::from_millis(30), Priority::Critical);
        assert!(result.deadline_met);

        let result = RtResult::new("test", Duration::from_millis(100), Priority::Critical);
        assert!(!result.deadline_met);
    }
}
