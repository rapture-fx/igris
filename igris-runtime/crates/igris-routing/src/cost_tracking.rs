use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

pub struct CostTracker {
    total_cost_usd: Arc<AtomicU64>, // Store as microdollars (μUSD) for atomic ops
    winner_cost_usd: Arc<AtomicU64>,
    wasted_cost_usd: Arc<AtomicU64>,
}

impl CostTracker {
    pub fn new() -> Self {
        Self {
            total_cost_usd: Arc::new(AtomicU64::new(0)),
            winner_cost_usd: Arc::new(AtomicU64::new(0)),
            wasted_cost_usd: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn record_winner_cost(&self, cost_usd: f64) {
        let microdollars = (cost_usd * 1_000_000.0) as u64;
        self.winner_cost_usd
            .fetch_add(microdollars, Ordering::SeqCst);
        self.total_cost_usd
            .fetch_add(microdollars, Ordering::SeqCst);
    }

    pub fn record_wasted_cost(&self, cost_usd: f64) {
        let microdollars = (cost_usd * 1_000_000.0) as u64;
        self.wasted_cost_usd
            .fetch_add(microdollars, Ordering::SeqCst);
        self.total_cost_usd
            .fetch_add(microdollars, Ordering::SeqCst);
    }

    pub fn get_total_cost(&self) -> f64 {
        self.total_cost_usd.load(Ordering::SeqCst) as f64 / 1_000_000.0
    }

    pub fn get_winner_cost(&self) -> f64 {
        self.winner_cost_usd.load(Ordering::SeqCst) as f64 / 1_000_000.0
    }

    pub fn get_wasted_cost(&self) -> f64 {
        self.wasted_cost_usd.load(Ordering::SeqCst) as f64 / 1_000_000.0
    }

    pub fn get_waste_ratio(&self) -> f64 {
        let total = self.get_total_cost();
        if total == 0.0 {
            0.0
        } else {
            self.get_wasted_cost() / total
        }
    }

    pub fn reset(&self) {
        self.total_cost_usd.store(0, Ordering::SeqCst);
        self.winner_cost_usd.store(0, Ordering::SeqCst);
        self.wasted_cost_usd.store(0, Ordering::SeqCst);
    }
}

impl Default for CostTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cost_tracking() {
        let tracker = CostTracker::new();

        tracker.record_winner_cost(0.01);
        tracker.record_wasted_cost(0.005);

        assert_eq!(tracker.get_winner_cost(), 0.01);
        assert_eq!(tracker.get_wasted_cost(), 0.005);
        assert_eq!(tracker.get_total_cost(), 0.015);
        assert!((tracker.get_waste_ratio() - 0.333).abs() < 0.01);
    }

    #[test]
    fn test_cost_reset() {
        let tracker = CostTracker::new();

        tracker.record_winner_cost(1.0);
        tracker.reset();

        assert_eq!(tracker.get_total_cost(), 0.0);
    }
}
