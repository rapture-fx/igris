//! Real-time execution metrics

use crate::{Priority, RtResult};
use serde::{Deserialize, Serialize};

/// Metrics for real-time task execution
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RtMetrics {
    /// Total number of task executions
    pub total_executions: u64,

    /// Number of deadlines met
    pub deadlines_met: u64,

    /// Number of deadlines missed
    pub deadlines_missed: u64,

    /// Average latency in milliseconds
    pub avg_latency_ms: f64,

    /// Minimum latency observed
    pub min_latency_ms: f64,

    /// Maximum latency observed
    pub max_latency_ms: f64,

    /// Per-priority metrics
    pub critical_count: u64,
    pub high_count: u64,
    pub normal_count: u64,
    pub low_count: u64,

    /// Per-priority deadline miss counts
    pub critical_missed: u64,
    pub high_missed: u64,
    pub normal_missed: u64,
    pub low_missed: u64,
}

impl RtMetrics {
    /// Record a task execution
    pub fn record_execution<T>(&mut self, result: &RtResult<T>) {
        self.total_executions += 1;

        if result.deadline_met {
            self.deadlines_met += 1;
        } else {
            self.deadlines_missed += 1;
        }

        let latency_ms = result.latency.as_secs_f64() * 1000.0;

        // Update average latency
        if self.total_executions == 1 {
            self.avg_latency_ms = latency_ms;
            self.min_latency_ms = latency_ms;
            self.max_latency_ms = latency_ms;
        } else {
            let total = self.total_executions as f64;
            self.avg_latency_ms = ((self.avg_latency_ms * (total - 1.0)) + latency_ms) / total;
            self.min_latency_ms = self.min_latency_ms.min(latency_ms);
            self.max_latency_ms = self.max_latency_ms.max(latency_ms);
        }

        // Update per-priority counts
        match result.priority {
            Priority::Critical => {
                self.critical_count += 1;
                if !result.deadline_met {
                    self.critical_missed += 1;
                }
            }
            Priority::High => {
                self.high_count += 1;
                if !result.deadline_met {
                    self.high_missed += 1;
                }
            }
            Priority::Normal => {
                self.normal_count += 1;
                if !result.deadline_met {
                    self.normal_missed += 1;
                }
            }
            Priority::Low => {
                self.low_count += 1;
                if !result.deadline_met {
                    self.low_missed += 1;
                }
            }
        }
    }

    /// Get deadline hit rate (0.0 to 1.0)
    pub fn deadline_hit_rate(&self) -> f64 {
        if self.total_executions == 0 {
            return 1.0;
        }
        self.deadlines_met as f64 / self.total_executions as f64
    }

    /// Get priority-specific hit rate
    pub fn priority_hit_rate(&self, priority: Priority) -> f64 {
        let (count, missed) = match priority {
            Priority::Critical => (self.critical_count, self.critical_missed),
            Priority::High => (self.high_count, self.high_missed),
            Priority::Normal => (self.normal_count, self.normal_missed),
            Priority::Low => (self.low_count, self.low_missed),
        };

        if count == 0 {
            return 1.0;
        }
        (count - missed) as f64 / count as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_metrics_basic() {
        let mut metrics = RtMetrics::default();

        let result = RtResult::new((), Duration::from_millis(30), Priority::Critical);
        metrics.record_execution(&result);

        assert_eq!(metrics.total_executions, 1);
        assert_eq!(metrics.deadlines_met, 1);
        assert_eq!(metrics.deadlines_missed, 0);
        assert_eq!(metrics.critical_count, 1);
        assert_eq!(metrics.critical_missed, 0);
    }

    #[test]
    fn test_metrics_deadline_miss() {
        let mut metrics = RtMetrics::default();

        let result = RtResult::new((), Duration::from_millis(100), Priority::Critical);
        metrics.record_execution(&result);

        assert_eq!(metrics.total_executions, 1);
        assert_eq!(metrics.deadlines_met, 0);
        assert_eq!(metrics.deadlines_missed, 1);
        assert_eq!(metrics.critical_count, 1);
        assert_eq!(metrics.critical_missed, 1);
    }

    #[test]
    fn test_metrics_average() {
        let mut metrics = RtMetrics::default();

        metrics.record_execution(&RtResult::new(
            (),
            Duration::from_millis(10),
            Priority::Normal,
        ));
        metrics.record_execution(&RtResult::new(
            (),
            Duration::from_millis(20),
            Priority::Normal,
        ));
        metrics.record_execution(&RtResult::new(
            (),
            Duration::from_millis(30),
            Priority::Normal,
        ));

        assert_eq!(metrics.total_executions, 3);
        assert!((metrics.avg_latency_ms - 20.0).abs() < 0.1);
        assert!((metrics.min_latency_ms - 10.0).abs() < 0.1);
        assert!((metrics.max_latency_ms - 30.0).abs() < 0.1);
    }

    #[test]
    fn test_hit_rate() {
        let mut metrics = RtMetrics::default();

        metrics.record_execution(&RtResult::new(
            (),
            Duration::from_millis(10),
            Priority::Critical,
        ));
        metrics.record_execution(&RtResult::new(
            (),
            Duration::from_millis(100),
            Priority::Critical,
        ));

        assert_eq!(metrics.deadline_hit_rate(), 0.5);
        assert_eq!(metrics.priority_hit_rate(Priority::Critical), 0.5);
    }
}
