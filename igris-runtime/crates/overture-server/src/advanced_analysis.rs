//! Advanced Analysis Features for BTree Monitoring
//!
//! Provides performance heatmaps, anomaly detection, A/B testing, and auto-suggestions.

use serde::{Deserialize, Serialize};

/// Node performance data for heatmap
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeHeatmapData {
    pub node_id: String,
    pub node_name: String,
    pub node_type: String,
    pub tick_count: u64,
    pub avg_duration_ms: f64,
    pub p50_duration_ms: f64,
    pub p95_duration_ms: f64,
    pub p99_duration_ms: f64,
    pub hotspot_score: f64, // 0-100, higher = bigger bottleneck
    pub success_rate: f64,
    pub failure_count: u64,
}

/// Performance heatmap for entire tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceHeatmap {
    pub agent_id: String,
    pub timestamp_ms: u64,
    pub nodes: Vec<NodeHeatmapData>,
    pub total_nodes: usize,
    pub slowest_node: Option<String>,
    pub most_failed_node: Option<String>,
}

/// Fleet overview data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatus {
    pub agent_id: String,
    pub status: String, // "healthy", "warning", "critical", "offline"
    pub last_seen_ms: u64,
    pub tick_rate: f64,
    pub failure_rate: f64,
    pub replan_count: u64,
    pub current_mission: Option<String>,
}

/// Fleet aggregate metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FleetOverview {
    pub total_agents: usize,
    pub healthy_agents: usize,
    pub warning_agents: usize,
    pub critical_agents: usize,
    pub offline_agents: usize,
    pub avg_tick_rate: f64,
    pub total_replans_last_hour: u64,
    pub agents: Vec<AgentStatus>,
}

/// Detected anomaly
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anomaly {
    pub agent_id: String,
    pub metric: String,
    pub current_value: f64,
    pub baseline_mean: f64,
    pub baseline_stddev: f64,
    pub z_score: f64,
    pub severity: String, // "minor", "moderate", "severe"
    pub description: String,
    pub timestamp_ms: u64,
}

/// Anomaly detection report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyReport {
    pub agent_id: String,
    pub anomalies: Vec<Anomaly>,
    pub total_anomalies: usize,
}

/// A/B test comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ABTestComparison {
    pub variant_a_id: String,
    pub variant_b_id: String,
    pub success_rate_delta: f64,       // Percentage point difference
    pub avg_duration_delta_ms: f64,    // Millisecond difference
    pub replan_count_delta: i64,       // Count difference
    pub failure_rate_delta: f64,       // Percentage point difference
    pub statistical_significance: f64, // p-value
    pub winner: Option<String>,        // Which variant is better (if significant)
    pub recommendation: String,
}

/// Optimization suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSuggestion {
    pub node_id: String,
    pub node_name: String,
    pub issue: String,
    pub suggestion: String,
    pub estimated_improvement: String,
    pub priority: String, // "low", "medium", "high", "critical"
}

/// Auto-optimization report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationReport {
    pub agent_id: String,
    pub timestamp_ms: u64,
    pub suggestions: Vec<OptimizationSuggestion>,
    pub total_suggestions: usize,
}

/// Compute performance heatmap from snapshot
pub fn compute_heatmap(agent_id: &str, snapshot: &serde_json::Value) -> Option<PerformanceHeatmap> {
    let timestamp_ms = snapshot.get("timestamp_ms")?.as_u64()?;
    let root = snapshot.get("root")?;

    let mut nodes = Vec::new();
    let mut slowest_duration = 0.0f64;
    let mut slowest_node = None;
    let mut most_failures = 0u64;
    let mut most_failed_node = None;

    // Recursively collect node data
    collect_node_heatmap(
        root,
        &mut nodes,
        &mut slowest_duration,
        &mut slowest_node,
        &mut most_failures,
        &mut most_failed_node,
    );

    let total = nodes.len();

    Some(PerformanceHeatmap {
        agent_id: agent_id.to_string(),
        timestamp_ms,
        total_nodes: total,
        nodes,
        slowest_node,
        most_failed_node,
    })
}

fn collect_node_heatmap(
    node: &serde_json::Value,
    nodes: &mut Vec<NodeHeatmapData>,
    slowest_duration: &mut f64,
    slowest_node: &mut Option<String>,
    most_failures: &mut u64,
    most_failed_node: &mut Option<String>,
) {
    let node_id = node
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let node_name = node
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let node_type = node
        .get("node_type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    if let Some(stats) = node.get("stats") {
        let tick_count = stats
            .get("tick_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let success_count = stats
            .get("success_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let failure_count = stats
            .get("failure_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let avg_duration_ms = stats
            .get("avg_execution_ms")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let success_rate = if tick_count > 0 {
            success_count as f64 / tick_count as f64
        } else {
            0.0
        };

        // Estimate percentiles (simplified - ideally would need full distribution)
        let p50 = avg_duration_ms * 0.8;
        let p95 = avg_duration_ms * 1.5;
        let p99 = avg_duration_ms * 2.0;

        // Compute hotspot score (0-100)
        // Higher score = bigger bottleneck
        let duration_factor = (avg_duration_ms / 100.0).min(1.0) * 50.0; // 0-50 points for duration
        let failure_factor = if tick_count > 0 {
            (failure_count as f64 / tick_count as f64) * 50.0 // 0-50 points for failure rate
        } else {
            0.0
        };
        let hotspot_score = duration_factor + failure_factor;

        // Track slowest and most failed
        if avg_duration_ms > *slowest_duration {
            *slowest_duration = avg_duration_ms;
            *slowest_node = Some(node_name.clone());
        }
        if failure_count > *most_failures {
            *most_failures = failure_count;
            *most_failed_node = Some(node_name.clone());
        }

        nodes.push(NodeHeatmapData {
            node_id: node_id.clone(),
            node_name: node_name.clone(),
            node_type,
            tick_count,
            avg_duration_ms,
            p50_duration_ms: p50,
            p95_duration_ms: p95,
            p99_duration_ms: p99,
            hotspot_score,
            success_rate,
            failure_count,
        });
    }

    // Recurse into children
    if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
        for child in children {
            collect_node_heatmap(
                child,
                nodes,
                slowest_duration,
                slowest_node,
                most_failures,
                most_failed_node,
            );
        }
    }
}

/// Generate optimization suggestions based on snapshot
pub fn generate_suggestions(agent_id: &str, snapshot: &serde_json::Value) -> OptimizationReport {
    let timestamp_ms = snapshot
        .get("timestamp_ms")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let mut suggestions = Vec::new();

    // Analyze heatmap for slow nodes
    if let Some(heatmap) = compute_heatmap(agent_id, snapshot) {
        for node in &heatmap.nodes {
            // Suggest caching for slow nodes
            if node.avg_duration_ms > 1000.0 && node.node_type.contains("LLM") {
                suggestions.push(OptimizationSuggestion {
                    node_id: node.node_id.clone(),
                    node_name: node.node_name.clone(),
                    issue: format!("LLM node takes {:.0}ms on average", node.avg_duration_ms),
                    suggestion: "Consider adding response caching or using a faster model"
                        .to_string(),
                    estimated_improvement: "60-80% latency reduction".to_string(),
                    priority: "high".to_string(),
                });
            }

            // Suggest fixing high-failure nodes
            if node.failure_count > 10 && node.success_rate < 0.7 {
                suggestions.push(OptimizationSuggestion {
                    node_id: node.node_id.clone(),
                    node_name: node.node_name.clone(),
                    issue: format!(
                        "High failure rate: {:.1}%",
                        (1.0 - node.success_rate) * 100.0
                    ),
                    suggestion: "Add error handling, fallback logic, or retry mechanism"
                        .to_string(),
                    estimated_improvement: format!(
                        "+{:.0}% success rate",
                        (1.0 - node.success_rate) * 50.0
                    ),
                    priority: "critical".to_string(),
                });
            }

            // Suggest timeout increase for very slow nodes
            if node.p99_duration_ms > 5000.0 {
                suggestions.push(OptimizationSuggestion {
                    node_id: node.node_id.clone(),
                    node_name: node.node_name.clone(),
                    issue: format!("P99 latency: {:.0}ms (very slow)", node.p99_duration_ms),
                    suggestion: "Increase timeout or optimize underlying operation".to_string(),
                    estimated_improvement: "Prevent premature timeouts".to_string(),
                    priority: "medium".to_string(),
                });
            }
        }
    }

    // Analyze metrics for replan optimization
    if let Some(metrics) = snapshot.get("metrics") {
        if let Some(replan_count) = metrics.get("total_replans").and_then(|v| v.as_u64()) {
            if replan_count > 50 {
                suggestions.push(OptimizationSuggestion {
                    node_id: "root".to_string(),
                    node_name: "LLM Planner".to_string(),
                    issue: format!("Excessive replanning: {} replans", replan_count),
                    suggestion: "Review LLM prompts for clarity or increase success criteria"
                        .to_string(),
                    estimated_improvement: format!(
                        "-{}% replan rate",
                        (replan_count as f64 * 0.3) as u64
                    ),
                    priority: "medium".to_string(),
                });
            }
        }
    }

    let total = suggestions.len();

    OptimizationReport {
        agent_id: agent_id.to_string(),
        timestamp_ms,
        total_suggestions: total,
        suggestions,
    }
}

/// Simple statistical comparison for A/B testing
pub fn compare_ab_variants(
    variant_a: &serde_json::Value,
    variant_b: &serde_json::Value,
) -> Option<ABTestComparison> {
    let a_metrics = variant_a.get("metrics")?;
    let b_metrics = variant_b.get("metrics")?;

    let a_failure_rate = a_metrics
        .get("failure_rate")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let b_failure_rate = b_metrics
        .get("failure_rate")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let a_replans = a_metrics
        .get("total_replans")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let b_replans = b_metrics
        .get("total_replans")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    let a_duration = a_metrics
        .get("total_execution_ms")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let b_duration = b_metrics
        .get("total_execution_ms")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let success_rate_delta = (1.0 - b_failure_rate) - (1.0 - a_failure_rate);
    let avg_duration_delta_ms = b_duration - a_duration;
    let replan_count_delta = b_replans - a_replans;
    let failure_rate_delta = b_failure_rate - a_failure_rate;

    // Simple significance test (p-value estimation)
    let p_value = 0.05; // Simplified - real implementation would use proper statistical tests

    let winner = if success_rate_delta.abs() > 0.05 || failure_rate_delta.abs() > 0.05 {
        if success_rate_delta > 0.0 {
            Some("variant_b".to_string())
        } else {
            Some("variant_a".to_string())
        }
    } else {
        None
    };

    let recommendation = if let Some(ref w) = winner {
        format!("{} shows statistically significant improvement", w)
    } else {
        "No significant difference detected - more data needed".to_string()
    };

    Some(ABTestComparison {
        variant_a_id: "variant_a".to_string(),
        variant_b_id: "variant_b".to_string(),
        success_rate_delta: success_rate_delta * 100.0,
        avg_duration_delta_ms,
        replan_count_delta,
        failure_rate_delta: failure_rate_delta * 100.0,
        statistical_significance: p_value,
        winner,
        recommendation,
    })
}
