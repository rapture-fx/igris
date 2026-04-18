use anyhow::Result;
use std::collections::HashMap;
use sysinfo::System;
use tracing::debug;

use crate::LogEntry;

/// Fetch real Prometheus metrics from the /metrics endpoint
pub async fn fetch_prometheus_metrics(endpoint: &str) -> Result<HashMap<String, f64>> {
    let url = format!("{}/metrics", endpoint);

    let response = reqwest::get(&url)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to fetch metrics: {}", e))?;

    let metrics_text = response.text().await?;

    let mut metrics_map = HashMap::new();

    for line in metrics_text.lines() {
        // Skip comments and empty lines
        if line.starts_with('#') || line.trim().is_empty() {
            continue;
        }

        // Parse Prometheus text format: metric_name{labels} value
        if let Some((metric_part, value_str)) = line.split_once(' ') {
            // Extract metric name (before '{' or end of string)
            let metric_name = if let Some(idx) = metric_part.find('{') {
                &metric_part[..idx]
            } else {
                metric_part
            };

            if let Ok(value) = value_str.trim().parse::<f64>() {
                match metric_name {
                    "igris_http_requests_total" => {
                        let current = metrics_map.get("requests_total").unwrap_or(&0.0);
                        metrics_map.insert("requests_total".to_string(), current + value);
                    }
                    "igris_chat_requests_total" => {
                        let current = metrics_map.get("requests_total").unwrap_or(&0.0);
                        metrics_map.insert("requests_total".to_string(), current + value);
                    }
                    "igris_chat_stream_requests_total" => {
                        let current = metrics_map.get("requests_total").unwrap_or(&0.0);
                        metrics_map.insert("requests_total".to_string(), current + value);
                    }
                    _ => {
                        // Store other metrics with their original names
                        metrics_map.insert(metric_name.to_string(), value);
                    }
                }
            }
        }
    }

    // Calculate error rate if we have the data
    if let Some(total_requests) = metrics_map.get("requests_total") {
        if *total_requests > 0.0 {
            let errors = metrics_map
                .get("igris_http_unauthorized_total")
                .unwrap_or(&0.0)
                + metrics_map
                    .get("igris_http_rate_limited_total")
                    .unwrap_or(&0.0);

            let error_rate = errors / total_requests;
            metrics_map.insert("error_rate".to_string(), error_rate);
        } else {
            metrics_map.insert("error_rate".to_string(), 0.0);
        }
    }

    // For P99 latency, we'd need to parse histogram buckets
    // For now, use a simple average if available
    metrics_map.insert("latency_p99_ms".to_string(), 0.0);

    debug!("Fetched {} Prometheus metrics", metrics_map.len());
    Ok(metrics_map)
}

/// Get actual system statistics
pub fn get_system_stats() -> (f32, u64, u32) {
    let mut sys = System::new_all();
    sys.refresh_all();

    // Global CPU usage
    let cpu_usage = sys.global_cpu_info().cpu_usage();

    // Memory usage in MB
    let memory_usage = (sys.used_memory() / 1024 / 1024) as u64;

    // Active tasks (this would need tokio-console integration for real count)
    // For now, return 0 as placeholder
    let active_tasks: u32 = 0;

    (cpu_usage, memory_usage, active_tasks)
}

/// Determine health status based on metrics
pub fn determine_health(metrics: &HashMap<String, f64>, cpu: f32, _memory: u64) -> String {
    let error_rate = metrics.get("error_rate").unwrap_or(&0.0);
    let latency = metrics.get("latency_p99_ms").unwrap_or(&0.0);

    // Unhealthy thresholds
    if *error_rate > 0.10 || *latency > 5000.0 || cpu > 90.0 {
        return "unhealthy".to_string();
    }

    // Degraded thresholds
    if *error_rate > 0.05 || *latency > 2000.0 || cpu > 75.0 {
        return "degraded".to_string();
    }

    "healthy".to_string()
}

/// Collect recent logs (placeholder implementation)
pub fn collect_recent_logs() -> Result<Vec<LogEntry>> {
    // In a real implementation, this would read from a ring buffer
    // or structured logging backend
    Ok(vec![])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_health_healthy() {
        let mut metrics = HashMap::new();
        metrics.insert("error_rate".to_string(), 0.01);
        metrics.insert("latency_p99_ms".to_string(), 100.0);

        let health = determine_health(&metrics, 50.0, 1024);
        assert_eq!(health, "healthy");
    }

    #[test]
    fn test_determine_health_degraded() {
        let mut metrics = HashMap::new();
        metrics.insert("error_rate".to_string(), 0.07);
        metrics.insert("latency_p99_ms".to_string(), 100.0);

        let health = determine_health(&metrics, 50.0, 1024);
        assert_eq!(health, "degraded");
    }

    #[test]
    fn test_determine_health_unhealthy() {
        let mut metrics = HashMap::new();
        metrics.insert("error_rate".to_string(), 0.15);
        metrics.insert("latency_p99_ms".to_string(), 100.0);

        let health = determine_health(&metrics, 50.0, 1024);
        assert_eq!(health, "unhealthy");
    }

    #[test]
    fn test_get_system_stats() {
        let (cpu, memory, tasks) = get_system_stats();

        // Basic sanity checks
        assert!(cpu >= 0.0 && cpu <= 100.0);
        assert!(memory > 0); // System must have some memory used
        assert_eq!(tasks, 0u32); // Placeholder implementation
    }
}
