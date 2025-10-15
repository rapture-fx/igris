//! On-Device RL Agent (Phase 11.1 + Phase 13.2)
//!
//! Production agent that consumes live telemetry, runs online learning,
//! and emits policy suggestions to the Policy Orchestrator.
//!
//! Phase 13.2: Integrated with cognitive reasoning for hybrid decision-making

use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use std::collections::VecDeque;
use crate::rl::thompson_sampling::{ThompsonSampling, ActionSpace};
use crate::rl::offline_trainer::PolicySeed;
use crate::orchestration::policy_engine::TelemetrySnapshot;
use crate::cognitive::{ReasoningOutput, RiskLevel};

/// Configuration for RL agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Enable online learning
    pub enabled: bool,

    /// Policy suggestion frequency (seconds)
    pub suggestion_interval_secs: u64,

    /// Minimum confidence to suggest policy
    pub min_confidence: f64,

    /// Success threshold for rewards
    pub success_threshold: f64,

    /// Telemetry window size
    pub telemetry_window_size: usize,

    /// Enable safety gates
    pub enable_safety_gates: bool,

    /// Maximum suggestions per hour
    pub max_suggestions_per_hour: usize,

    /// Warm-up period (seconds) before suggesting
    pub warmup_period_secs: u64,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            suggestion_interval_secs: 60,
            min_confidence: 0.85,
            success_threshold: 0.0,
            telemetry_window_size: 20,
            enable_safety_gates: true,
            max_suggestions_per_hour: 60,
            warmup_period_secs: 300, // 5 minutes
        }
    }
}

/// Agent decision with confidence (Phase 13.2: with cognitive integration)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDecision {
    /// Suggested batch size
    pub batch_size: usize,

    /// Suggested prefetch confidence
    pub prefetch_confidence: f64,

    /// Suggested routing split
    pub routing_split: f64,

    /// Decision confidence (0.0-1.0)
    pub confidence: f64,

    /// Expected reward improvement
    pub expected_reward_improvement: f64,

    /// Timestamp
    pub timestamp_ms: u64,

    /// Should apply this decision
    pub should_apply: bool,

    /// Reason for decision
    pub reason: String,

    /// Phase 13.2: Whether cognitive reasoning agreed with RL
    pub cognitive_agreed: bool,

    /// Phase 13.2: Source of final decision ("rl", "cognitive_override", "hybrid")
    pub decision_source: String,

    /// Phase 13.2: Cognitive confidence if available
    pub cognitive_confidence: Option<f64>,
}

/// Agent metrics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetrics {
    /// Total decisions made
    pub total_decisions: u64,

    /// Decisions applied
    pub decisions_applied: u64,

    /// Decisions rejected (confidence)
    pub decisions_rejected_confidence: u64,

    /// Decisions rejected (safety)
    pub decisions_rejected_safety: u64,

    /// Average decision latency (ms)
    pub avg_decision_latency_ms: f64,

    /// Average confidence
    pub avg_confidence: f64,

    /// Average reward
    pub avg_reward: f64,

    /// Last decision timestamp
    pub last_decision_ms: u64,
}

impl Default for AgentMetrics {
    fn default() -> Self {
        Self {
            total_decisions: 0,
            decisions_applied: 0,
            decisions_rejected_confidence: 0,
            decisions_rejected_safety: 0,
            avg_decision_latency_ms: 0.0,
            avg_confidence: 0.0,
            avg_reward: 0.0,
            last_decision_ms: 0,
        }
    }
}

/// On-device RL agent
pub struct RLAgent {
    config: Arc<RwLock<AgentConfig>>,
    thompson_sampling: Arc<RwLock<ThompsonSampling>>,
    telemetry_buffer: Arc<RwLock<VecDeque<TelemetrySnapshot>>>,
    metrics: Arc<RwLock<AgentMetrics>>,
    last_action: Arc<RwLock<Option<(usize, usize, usize)>>>,
    start_time: std::time::Instant,
    suggestion_count: Arc<RwLock<usize>>,
    current_hour: Arc<RwLock<u64>>,
}

impl RLAgent {
    /// Create a new RL agent
    pub fn new(config: AgentConfig) -> Self {
        let action_space = ActionSpace::default();
        let thompson_sampling = ThompsonSampling::new(action_space, config.success_threshold);

        Self {
            config: Arc::new(RwLock::new(config)),
            thompson_sampling: Arc::new(RwLock::new(thompson_sampling)),
            telemetry_buffer: Arc::new(RwLock::new(VecDeque::new())),
            metrics: Arc::new(RwLock::new(AgentMetrics::default())),
            last_action: Arc::new(RwLock::new(None)),
            start_time: std::time::Instant::now(),
            suggestion_count: Arc::new(RwLock::new(0)),
            current_hour: Arc::new(RwLock::new(0)),
        }
    }

    /// Initialize agent with pre-trained policy seed
    pub fn load_policy_seed(&mut self, seed: &PolicySeed) -> Result<(), String> {
        // Parse policy data and reinitialize Thompson Sampling
        // This would restore the alpha/beta values from training
        println!("Loading policy seed version {}", seed.version);
        println!("Baseline reward improvement: {:.2}%", seed.reward_improvement_percent);

        // In production, deserialize and restore arms
        // For now, we start fresh but could initialize with seed data

        Ok(())
    }

    /// Ingest telemetry snapshot
    pub fn ingest_telemetry(&self, telemetry: TelemetrySnapshot) {
        let config = self.config.read().unwrap();
        let mut buffer = self.telemetry_buffer.write().unwrap();

        buffer.push_back(telemetry);

        // Maintain window size
        while buffer.len() > config.telemetry_window_size {
            buffer.pop_front();
        }
    }

    /// Generate policy suggestion (backward-compatible wrapper)
    pub fn generate_suggestion(&self) -> Result<AgentDecision, String> {
        self.generate_suggestion_with_cognitive(None)
    }

    /// Generate policy suggestion with optional cognitive signal (Phase 13.2)
    pub fn generate_suggestion_with_cognitive(
        &self,
        cognitive_signal: Option<ReasoningOutput>,
    ) -> Result<AgentDecision, String> {
        let start = std::time::Instant::now();

        let config = self.config.read().unwrap();

        // Check if enabled
        if !config.enabled {
            return Err("Agent disabled".to_string());
        }

        // Check warm-up period
        if self.start_time.elapsed().as_secs() < config.warmup_period_secs {
            return Err("Agent in warm-up period".to_string());
        }

        // Check rate limit
        if !self.check_rate_limit()? {
            return Err("Rate limit exceeded".to_string());
        }

        // Get current telemetry state
        let current_state = self.get_current_state()?;

        // Select action using Thompson Sampling (RL baseline)
        let ts = self.thompson_sampling.read().unwrap();
        let (rl_batch_idx, rl_pf_idx, rl_rs_idx) = ts.select_action();

        // Get best arm for confidence estimation
        let best_arm = ts.get_best_arm();
        let rl_confidence = if let Some((_, reward)) = best_arm {
            // Normalize reward to confidence (0.0-1.0)
            ((reward + 1.0) / 2.0).clamp(0.0, 1.0)
        } else {
            0.5
        };

        drop(ts);

        // Phase 13.2: Hybrid decision with cognitive override
        let (final_batch_idx, final_pf_idx, final_rs_idx, cognitive_agreed, decision_source, cognitive_conf) =
            if let Some(ref cog) = cognitive_signal {
                if cog.should_override_rl() {
                    // High confidence + low risk → override with cognitive action
                    let cog_action = cog.proposed_action.unwrap();
                    let agreed = cog_action == (rl_batch_idx, rl_pf_idx, rl_rs_idx);
                    (cog_action.0, cog_action.1, cog_action.2, agreed, "cognitive_override".to_string(), Some(cog.confidence))
                } else {
                    // Fall back to RL (low confidence or high risk)
                    let agreed = cog.proposed_action == Some((rl_batch_idx, rl_pf_idx, rl_rs_idx));
                    (rl_batch_idx, rl_pf_idx, rl_rs_idx, agreed, "rl_fallback".to_string(), Some(cog.confidence))
                }
            } else {
                // No cognitive signal → pure RL
                (rl_batch_idx, rl_pf_idx, rl_rs_idx, false, "rl".to_string(), None)
            };

        // Convert final action to policy parameters
        let batch_size = Self::batch_idx_to_size(final_batch_idx);
        let prefetch_confidence = Self::prefetch_idx_to_value(final_pf_idx);
        let routing_split = Self::routing_idx_to_value(final_rs_idx);

        // Estimate reward improvement
        let expected_reward_improvement = self.estimate_reward_improvement(
            &current_state,
            batch_size,
            prefetch_confidence,
            routing_split,
        );

        // Apply safety gates
        let should_apply = rl_confidence >= config.min_confidence
            && self.passes_safety_gates(&current_state);

        let reason = if !should_apply {
            if rl_confidence < config.min_confidence {
                format!("Confidence {:.3} < threshold {:.3}", rl_confidence, config.min_confidence)
            } else {
                "Failed safety gates".to_string()
            }
        } else {
            format!("{}: batch={}, prefetch={:.2}, routing={:.2}{}",
                decision_source,
                batch_size,
                prefetch_confidence,
                routing_split,
                if cognitive_agreed { " (cognitive agreed)" } else { "" })
        };

        // Store last action for reward feedback
        *self.last_action.write().unwrap() = Some((final_batch_idx, final_pf_idx, final_rs_idx));

        // Update metrics
        let decision_latency = start.elapsed().as_secs_f64() * 1000.0;
        self.update_metrics(should_apply, rl_confidence, decision_latency);

        Ok(AgentDecision {
            batch_size,
            prefetch_confidence,
            routing_split,
            confidence: rl_confidence,
            expected_reward_improvement,
            timestamp_ms: Self::current_timestamp_ms(),
            should_apply,
            reason,
            cognitive_agreed,
            decision_source,
            cognitive_confidence: cognitive_conf,
        })
    }

    /// Provide reward feedback for last action
    pub fn feedback_reward(&self, reward: f64) {
        let last_action = self.last_action.read().unwrap();

        if let Some((batch_idx, pf_idx, rs_idx)) = *last_action {
            let mut ts = self.thompson_sampling.write().unwrap();
            ts.update(batch_idx, pf_idx, rs_idx, reward);

            // Update average reward metric
            let mut metrics = self.metrics.write().unwrap();
            let total = metrics.total_decisions;
            metrics.avg_reward = (metrics.avg_reward * total as f64 + reward) / (total + 1) as f64;
        }
    }

    /// Get current state from telemetry buffer
    fn get_current_state(&self) -> Result<TelemetrySnapshot, String> {
        let buffer = self.telemetry_buffer.read().unwrap();

        buffer.back()
            .cloned()
            .ok_or_else(|| "No telemetry available".to_string())
    }

    /// Check rate limit
    fn check_rate_limit(&self) -> Result<bool, String> {
        let config = self.config.read().unwrap();
        let current_hour = Self::current_timestamp_ms() / 3600000;

        let mut last_hour = self.current_hour.write().unwrap();
        let mut count = self.suggestion_count.write().unwrap();

        if current_hour != *last_hour {
            // New hour, reset count
            *last_hour = current_hour;
            *count = 0;
        }

        if *count >= config.max_suggestions_per_hour {
            return Ok(false);
        }

        *count += 1;
        Ok(true)
    }

    /// Estimate reward improvement for action
    fn estimate_reward_improvement(
        &self,
        current_state: &TelemetrySnapshot,
        _batch_size: usize,
        _prefetch_confidence: f64,
        _routing_split: f64,
    ) -> f64 {
        // Simplified reward estimation
        // In production, use learned model or heuristics

        let baseline_reward = -(current_state.avg_latency_ms / 150.0)
            - (1.0 - current_state.cache_hit_rate)
            - (current_state.error_rate * 100.0);

        // Estimate improvement (placeholder)
        let estimated_reward = baseline_reward * 1.05; // 5% improvement estimate

        estimated_reward - baseline_reward
    }

    /// Check safety gates
    fn passes_safety_gates(&self, state: &TelemetrySnapshot) -> bool {
        let config = self.config.read().unwrap();

        if !config.enable_safety_gates {
            return true;
        }

        // Safety checks
        if state.error_rate > 0.05 {
            return false; // Too many errors
        }

        if state.cpu_utilization > 0.90 {
            return false; // System overloaded
        }

        if state.memory_utilization > 0.90 {
            return false; // Memory pressure
        }

        true
    }

    /// Update agent metrics
    fn update_metrics(&self, applied: bool, confidence: f64, latency_ms: f64) {
        let mut metrics = self.metrics.write().unwrap();

        metrics.total_decisions += 1;

        if applied {
            metrics.decisions_applied += 1;
        } else if confidence < self.config.read().unwrap().min_confidence {
            metrics.decisions_rejected_confidence += 1;
        } else {
            metrics.decisions_rejected_safety += 1;
        }

        let total = metrics.total_decisions;
        metrics.avg_confidence = (metrics.avg_confidence * (total - 1) as f64 + confidence) / total as f64;
        metrics.avg_decision_latency_ms = (metrics.avg_decision_latency_ms * (total - 1) as f64 + latency_ms) / total as f64;
        metrics.last_decision_ms = Self::current_timestamp_ms();
    }

    /// Get agent metrics
    pub fn get_metrics(&self) -> AgentMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Helper: Convert batch index to size
    fn batch_idx_to_size(idx: usize) -> usize {
        match idx {
            0 => 8,
            1 => 16,
            2 => 32,
            3 => 64,
            _ => 32,
        }
    }

    /// Helper: Convert prefetch index to value
    fn prefetch_idx_to_value(idx: usize) -> f64 {
        match idx {
            0 => 0.70,
            1 => 0.80,
            2 => 0.90,
            3 => 0.95,
            _ => 0.85,
        }
    }

    /// Helper: Convert routing index to value
    fn routing_idx_to_value(idx: usize) -> f64 {
        match idx {
            0 => 0.70,
            1 => 0.80,
            2 => 0.90,
            3 => 1.00,
            _ => 0.80,
        }
    }

    /// Get current timestamp in milliseconds
    fn current_timestamp_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_creation() {
        let config = AgentConfig::default();
        let agent = RLAgent::new(config);

        let metrics = agent.get_metrics();
        assert_eq!(metrics.total_decisions, 0);
    }

    #[test]
    fn test_telemetry_ingestion() {
        let config = AgentConfig::default();
        let agent = RLAgent::new(config);

        let telemetry = TelemetrySnapshot::default();
        agent.ingest_telemetry(telemetry);

        let buffer = agent.telemetry_buffer.read().unwrap();
        assert_eq!(buffer.len(), 1);
    }

    #[test]
    fn test_telemetry_window_size() {
        let config = AgentConfig {
            telemetry_window_size: 5,
            ..Default::default()
        };
        let agent = RLAgent::new(config);

        // Add more than window size
        for _ in 0..10 {
            agent.ingest_telemetry(TelemetrySnapshot::default());
        }

        let buffer = agent.telemetry_buffer.read().unwrap();
        assert_eq!(buffer.len(), 5);
    }

    #[test]
    fn test_suggestion_warmup() {
        let config = AgentConfig {
            warmup_period_secs: 1000,
            ..Default::default()
        };
        let agent = RLAgent::new(config);

        agent.ingest_telemetry(TelemetrySnapshot::default());

        let result = agent.generate_suggestion();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("warm-up"));
    }

    #[test]
    fn test_suggestion_after_warmup() {
        let config = AgentConfig {
            warmup_period_secs: 0,
            ..Default::default()
        };
        let agent = RLAgent::new(config);

        agent.ingest_telemetry(TelemetrySnapshot::default());

        let result = agent.generate_suggestion();
        assert!(result.is_ok());
    }

    #[test]
    fn test_safety_gates() {
        let config = AgentConfig::default();
        let agent = RLAgent::new(config);

        // Normal state
        let normal_state = TelemetrySnapshot {
            error_rate: 0.01,
            cpu_utilization: 0.60,
            memory_utilization: 0.60,
            ..Default::default()
        };
        assert!(agent.passes_safety_gates(&normal_state));

        // High error rate
        let high_error_state = TelemetrySnapshot {
            error_rate: 0.10,
            ..Default::default()
        };
        assert!(!agent.passes_safety_gates(&high_error_state));

        // High CPU
        let high_cpu_state = TelemetrySnapshot {
            cpu_utilization: 0.95,
            ..Default::default()
        };
        assert!(!agent.passes_safety_gates(&high_cpu_state));
    }

    #[test]
    fn test_reward_feedback() {
        let config = AgentConfig {
            warmup_period_secs: 0,
            ..Default::default()
        };
        let agent = RLAgent::new(config);

        agent.ingest_telemetry(TelemetrySnapshot::default());

        // Generate suggestion to set last_action
        agent.generate_suggestion().ok();

        // Provide reward feedback
        agent.feedback_reward(0.8);

        let metrics = agent.get_metrics();
        assert!(metrics.avg_reward > 0.0);
    }

    #[test]
    fn test_rate_limit() {
        let config = AgentConfig {
            warmup_period_secs: 0,
            max_suggestions_per_hour: 2,
            ..Default::default()
        };
        let agent = RLAgent::new(config);

        agent.ingest_telemetry(TelemetrySnapshot::default());

        // First two should succeed
        assert!(agent.generate_suggestion().is_ok());
        assert!(agent.generate_suggestion().is_ok());

        // Third should fail (rate limit)
        let result = agent.generate_suggestion();
        assert!(result.is_err());
    }

    #[test]
    fn test_decision_metrics() {
        let config = AgentConfig {
            warmup_period_secs: 0,
            ..Default::default()
        };
        let agent = RLAgent::new(config);

        agent.ingest_telemetry(TelemetrySnapshot::default());

        // Generate multiple suggestions
        for _ in 0..5 {
            agent.generate_suggestion().ok();
        }

        let metrics = agent.get_metrics();
        assert_eq!(metrics.total_decisions, 5);
        assert!(metrics.avg_decision_latency_ms > 0.0);
    }

    #[test]
    fn test_index_conversions() {
        assert_eq!(RLAgent::batch_idx_to_size(0), 8);
        assert_eq!(RLAgent::batch_idx_to_size(1), 16);
        assert_eq!(RLAgent::batch_idx_to_size(2), 32);
        assert_eq!(RLAgent::batch_idx_to_size(3), 64);

        assert_eq!(RLAgent::prefetch_idx_to_value(2), 0.90);
        assert_eq!(RLAgent::routing_idx_to_value(3), 1.00);
    }
}
