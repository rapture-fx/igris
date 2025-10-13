//! Cognitive Control Layer (Phase 13.2)
//!
//! Integrates cognitive reasoning outputs with RL agent for hybrid decision-making.
//! Loads shadow-mode reasoning artifacts and provides safe override signals.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::collections::VecDeque;

/// Risk level assessment for cognitive decisions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    /// Low risk - safe for override
    Low,
    /// Medium risk - use with caution
    Medium,
    /// High risk - do not override RL
    High,
}

impl Default for RiskLevel {
    fn default() -> Self {
        RiskLevel::Medium
    }
}

/// Reasoning output from cognitive layer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningOutput {
    /// Confidence in the reasoning (0.0-1.0)
    pub confidence: f64,

    /// Proposed action (batch_idx, prefetch_idx, routing_idx)
    pub proposed_action: Option<(usize, usize, usize)>,

    /// Risk assessment for this decision
    pub risk_assessment: RiskLevel,

    /// Human-readable explanation
    pub explanation: String,

    /// Signal sources used (e.g., ["rl", "predictive", "telemetry"])
    pub signal_sources: Vec<String>,

    /// Timestamp of reasoning
    pub timestamp_ms: u64,

    /// Expected improvement over baseline
    pub expected_improvement: f64,
}

impl Default for ReasoningOutput {
    fn default() -> Self {
        Self {
            confidence: 0.0,
            proposed_action: None,
            risk_assessment: RiskLevel::Medium,
            explanation: "No reasoning output available".to_string(),
            signal_sources: vec![],
            timestamp_ms: Self::current_timestamp_ms(),
            expected_improvement: 0.0,
        }
    }
}

impl ReasoningOutput {
    /// Check if this reasoning output should override RL
    pub fn should_override_rl(&self) -> bool {
        // Only override if:
        // 1. High confidence (>0.90)
        // 2. Low risk
        // 3. Has a proposed action
        self.confidence > 0.90
            && self.risk_assessment == RiskLevel::Low
            && self.proposed_action.is_some()
    }

    /// Get current timestamp in milliseconds
    fn current_timestamp_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

/// Configuration for cognitive controller
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveConfig {
    /// Path to shadow cognitive artifacts
    pub artifacts_path: String,

    /// Enable cognitive override
    pub enabled: bool,

    /// Minimum confidence for override
    pub min_confidence: f64,

    /// Maximum age of reasoning output (ms)
    pub max_age_ms: u64,

    /// History size for tracking
    pub history_size: usize,
}

impl Default for CognitiveConfig {
    fn default() -> Self {
        Self {
            artifacts_path: "experiments/cognitive".to_string(),
            enabled: true,
            min_confidence: 0.90,
            max_age_ms: 60000, // 1 minute
            history_size: 100,
        }
    }
}

/// Cognitive controller for loading and managing reasoning outputs
pub struct CognitiveController {
    config: CognitiveConfig,
    latest_output: Option<ReasoningOutput>,
    reasoning_history: VecDeque<ReasoningOutput>,
    override_count: usize,
    fallback_count: usize,
}

impl CognitiveController {
    /// Create a new cognitive controller
    pub fn new(config: CognitiveConfig) -> Self {
        Self {
            config,
            latest_output: None,
            reasoning_history: VecDeque::new(),
            override_count: 0,
            fallback_count: 0,
        }
    }

    /// Create with default configuration
    pub fn default() -> Self {
        Self::new(CognitiveConfig::default())
    }

    /// Load latest reasoning output from shadow artifacts
    ///
    /// Phase 2 Implementation: Loads from experiments/cognitive/*.json
    /// In production, this would integrate with real cognitive reasoning pipeline
    pub fn load_latest(&mut self) -> Result<Option<ReasoningOutput>, String> {
        if !self.config.enabled {
            return Ok(None);
        }

        // Phase 2: Load from shadow artifacts directory
        let artifacts_path = Path::new(&self.config.artifacts_path);

        if !artifacts_path.exists() {
            // Directory doesn't exist yet - create it
            fs::create_dir_all(artifacts_path)
                .map_err(|e| format!("Failed to create cognitive artifacts directory: {}", e))?;
            return Ok(None);
        }

        // Find most recent .json file
        let entries = fs::read_dir(artifacts_path)
            .map_err(|e| format!("Failed to read cognitive artifacts directory: {}", e))?;

        let mut json_files: Vec<PathBuf> = entries
            .filter_map(|entry| entry.ok())
            .map(|e| e.path())
            .filter(|path| {
                path.extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext == "json")
                    .unwrap_or(false)
            })
            .collect();

        if json_files.is_empty() {
            return Ok(None);
        }

        // Sort by modification time (most recent first)
        json_files.sort_by(|a, b| {
            let a_meta = fs::metadata(a).ok();
            let b_meta = fs::metadata(b).ok();

            match (a_meta, b_meta) {
                (Some(a_m), Some(b_m)) => {
                    let a_time = a_m.modified().ok();
                    let b_time = b_m.modified().ok();
                    b_time.cmp(&a_time) // Reverse for descending
                }
                _ => std::cmp::Ordering::Equal,
            }
        });

        // Load the most recent file
        let latest_file = &json_files[0];
        let content = fs::read_to_string(latest_file)
            .map_err(|e| format!("Failed to read cognitive artifact: {}", e))?;

        let output: ReasoningOutput = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse cognitive artifact: {}", e))?;

        // Check if output is too old
        let current_time = ReasoningOutput::current_timestamp_ms();
        if current_time - output.timestamp_ms > self.config.max_age_ms {
            return Ok(None);
        }

        // Store in history
        self.reasoning_history.push_back(output.clone());
        if self.reasoning_history.len() > self.config.history_size {
            self.reasoning_history.pop_front();
        }

        self.latest_output = Some(output.clone());
        Ok(Some(output))
    }

    /// Get latest reasoning output (cached)
    pub fn get_latest(&self) -> Option<&ReasoningOutput> {
        self.latest_output.as_ref()
    }

    /// Generate a synthetic reasoning output for testing
    ///
    /// Phase 2: Used for testing when no real cognitive pipeline exists
    pub fn generate_synthetic_reasoning(
        &mut self,
        rl_action: (usize, usize, usize),
        confidence: f64,
        risk: RiskLevel,
    ) -> ReasoningOutput {
        let output = ReasoningOutput {
            confidence,
            proposed_action: Some(rl_action),
            risk_assessment: risk,
            explanation: format!(
                "Synthetic reasoning output for testing (confidence={:.2}, risk={:?})",
                confidence, risk
            ),
            signal_sources: vec!["rl".to_string(), "test".to_string()],
            timestamp_ms: ReasoningOutput::current_timestamp_ms(),
            expected_improvement: confidence * 0.1, // Assume 10% max improvement
        };

        // Store in history (same as load_latest)
        self.reasoning_history.push_back(output.clone());
        if self.reasoning_history.len() > self.config.history_size {
            self.reasoning_history.pop_front();
        }

        self.latest_output = Some(output.clone());
        output
    }

    /// Record an override decision
    pub fn record_override(&mut self) {
        self.override_count += 1;
    }

    /// Record a fallback to RL
    pub fn record_fallback(&mut self) {
        self.fallback_count += 1;
    }

    /// Get override statistics
    pub fn get_statistics(&self) -> CognitiveStatistics {
        CognitiveStatistics {
            total_reasoning_outputs: self.reasoning_history.len(),
            override_count: self.override_count,
            fallback_count: self.fallback_count,
            override_rate: if self.override_count + self.fallback_count > 0 {
                self.override_count as f64 / (self.override_count + self.fallback_count) as f64
            } else {
                0.0
            },
        }
    }

    /// Get reasoning history
    pub fn get_history(&self) -> Vec<ReasoningOutput> {
        self.reasoning_history.iter().cloned().collect()
    }
}

/// Statistics for cognitive integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveStatistics {
    pub total_reasoning_outputs: usize,
    pub override_count: usize,
    pub fallback_count: usize,
    pub override_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_risk_level_default() {
        let risk = RiskLevel::default();
        assert_eq!(risk, RiskLevel::Medium);
    }

    #[test]
    fn test_reasoning_output_default() {
        let output = ReasoningOutput::default();
        assert_eq!(output.confidence, 0.0);
        assert!(output.proposed_action.is_none());
        assert_eq!(output.risk_assessment, RiskLevel::Medium);
        assert!(!output.should_override_rl());
    }

    #[test]
    fn test_should_override_rl_conditions() {
        // Should override: high confidence + low risk + has action
        let output = ReasoningOutput {
            confidence: 0.95,
            proposed_action: Some((2, 2, 1)),
            risk_assessment: RiskLevel::Low,
            explanation: "Test".to_string(),
            signal_sources: vec![],
            timestamp_ms: 0,
            expected_improvement: 0.05,
        };
        assert!(output.should_override_rl());

        // Should not override: low confidence
        let output = ReasoningOutput {
            confidence: 0.80,
            proposed_action: Some((2, 2, 1)),
            risk_assessment: RiskLevel::Low,
            explanation: "Test".to_string(),
            signal_sources: vec![],
            timestamp_ms: 0,
            expected_improvement: 0.05,
        };
        assert!(!output.should_override_rl());

        // Should not override: high risk
        let output = ReasoningOutput {
            confidence: 0.95,
            proposed_action: Some((2, 2, 1)),
            risk_assessment: RiskLevel::High,
            explanation: "Test".to_string(),
            signal_sources: vec![],
            timestamp_ms: 0,
            expected_improvement: 0.05,
        };
        assert!(!output.should_override_rl());

        // Should not override: no proposed action
        let output = ReasoningOutput {
            confidence: 0.95,
            proposed_action: None,
            risk_assessment: RiskLevel::Low,
            explanation: "Test".to_string(),
            signal_sources: vec![],
            timestamp_ms: 0,
            expected_improvement: 0.05,
        };
        assert!(!output.should_override_rl());
    }

    #[test]
    fn test_cognitive_controller_creation() {
        let controller = CognitiveController::default();
        assert!(controller.config.enabled);
        assert_eq!(controller.config.min_confidence, 0.90);
        assert!(controller.latest_output.is_none());
    }

    #[test]
    fn test_synthetic_reasoning_generation() {
        let mut controller = CognitiveController::default();

        let output = controller.generate_synthetic_reasoning(
            (2, 2, 1),
            0.95,
            RiskLevel::Low,
        );

        assert_eq!(output.confidence, 0.95);
        assert_eq!(output.proposed_action, Some((2, 2, 1)));
        assert_eq!(output.risk_assessment, RiskLevel::Low);
        assert!(output.should_override_rl());
    }

    #[test]
    fn test_override_tracking() {
        let mut controller = CognitiveController::default();

        controller.record_override();
        controller.record_override();
        controller.record_fallback();

        let stats = controller.get_statistics();
        assert_eq!(stats.override_count, 2);
        assert_eq!(stats.fallback_count, 1);
        assert!((stats.override_rate - 0.666).abs() < 0.01);
    }

    #[test]
    fn test_reasoning_history() {
        let mut controller = CognitiveController::new(CognitiveConfig {
            history_size: 3,
            ..Default::default()
        });

        // Add 5 outputs
        for i in 0..5 {
            controller.generate_synthetic_reasoning(
                (i % 4, i % 4, i % 4),
                0.90,
                RiskLevel::Low,
            );
        }

        // Should only keep last 3
        let history = controller.get_history();
        assert_eq!(history.len(), 3);
    }

    #[test]
    fn test_load_latest_creates_directory() {
        let test_path = "/tmp/test_cognitive_artifacts";
        let config = CognitiveConfig {
            artifacts_path: test_path.to_string(),
            ..Default::default()
        };

        let mut controller = CognitiveController::new(config);

        // Should create directory and return None (no files yet)
        let result = controller.load_latest();
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());

        // Verify directory exists
        assert!(Path::new(test_path).exists());

        // Cleanup
        let _ = fs::remove_dir_all(test_path);
    }

    #[test]
    fn test_cognitive_statistics() {
        let mut controller = CognitiveController::default();

        controller.record_override();
        controller.record_override();
        controller.record_override();
        controller.record_fallback();

        let stats = controller.get_statistics();
        assert_eq!(stats.override_count, 3);
        assert_eq!(stats.fallback_count, 1);
        assert_eq!(stats.override_rate, 0.75);
    }
}
