use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Bounds {
    pub max_cpu_percent: u8,
    pub max_tick_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_memory_mb: Option<u32>,
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
            max_memory_mb: None,
        }
    }

    pub fn with_memory_mb(mut self, max_memory_mb: Option<u32>) -> Self {
        self.max_memory_mb = max_memory_mb;
        self
    }
}
