use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Bounds {
    pub max_cpu_percent: u8,
    pub max_tick_ms: u64,
}

impl Bounds {
    pub fn new(max_cpu_percent: u8, max_tick_ms: u64) -> Self {
        assert!(
            max_cpu_percent > 0 && max_cpu_percent <= 100,
            "max_cpu_percent must be 1–100, got {}",
            max_cpu_percent
        );
        Self {
            max_cpu_percent,
            max_tick_ms,
        }
    }
}
