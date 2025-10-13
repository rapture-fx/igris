//! Cognitive Reasoning Module (Phase 13.2)
//!
//! Provides cognitive reasoning integration for hybrid RL/cognitive decision-making.
//! Loads shadow-mode reasoning outputs and provides them to the RL agent for
//! high-confidence, low-risk action overrides.
//!
//! # Architecture
//! ```text
//! Shadow Artifacts (experiments/cognitive/*.json)
//!       ↓
//! CognitiveController (loads & validates)
//!       ↓
//! ReasoningOutput
//!       ↓
//! RLAgent.generate_suggestion(cognitive_signal)
//!       ↓
//! Hybrid Decision (RL + Cognitive)
//! ```
//!
//! # Safety Guarantees
//! - Shadow-only mode (no live policy writes)
//! - High confidence threshold (>0.90)
//! - Low risk requirement (RiskLevel::Low)
//! - Optional fallback to pure RL
//! - All outputs persisted to experiments/optimizer/cognitive_integration/

pub mod cognitive_control;

pub use cognitive_control::{
    CognitiveController,
    ReasoningOutput,
    RiskLevel,
    CognitiveConfig,
};
