//! Cognitive Control Layer (Phase 11.3)
//!
//! AI-Native Operational Autonomy - Cognitive Reasoning Layer
//!
//! This module provides explainable policy decisions by synthesizing:
//! - Phase 11.1 RL agent outputs (policy suggestions)
//! - Phase 11.2 predictive forecasts (future state predictions)
//! - Current telemetry and historical performance trends
//!
//! # Architecture
//! ```text
//! ┌─────────────┐     ┌──────────────┐     ┌────────────────┐
//! │  RL Agent   │────▶│   Cognitive  │────▶│    Shadow      │
//! │  (11.1)     │     │   Reasoner   │     │   Evaluation   │
//! └─────────────┘     │              │     │   (Proposals)  │
//!                     │              │     └────────────────┘
//! ┌─────────────┐     │              │
//! │ Predictive  │────▶│  Generates:  │
//! │ Forecasts   │     │  • Rationale │
//! │  (11.2)     │     │  • Confidence│
//! └─────────────┘     │  • Risk Score│
//!                     │  • Actions   │
//! ┌─────────────┐     │              │
//! │ Telemetry + │────▶│              │
//! │  History    │     └──────────────┘
//! └─────────────┘
//! ```
//!
//! # Key Features
//! - **Shadow-Only Operation**: Never executes actions, only generates proposals
//! - **Explainable Decisions**: Human-readable rationale for every recommendation
//! - **Risk Assessment**: Quantified rollback risk and confidence scores
//! - **Multi-Signal Synthesis**: Combines RL, predictive, and telemetry signals
//! - **Structured Output**: JSON format for easy integration and analysis
//!
//! # Safety Guarantees
//! - No direct policy mutations
//! - No orchestrator state modifications
//! - All outputs written to `/experiments/cognitive/`
//! - Rollback risk quantified for every recommendation
//!
//! # Usage Example
//! ```rust,no_run
//! use schlep_kernel::cognitive::{PolicyReasoner, ReasonerConfig};
//! use schlep_kernel::orchestration::policy_engine::TelemetrySnapshot;
//!
//! let config = ReasonerConfig::default();
//! let reasoner = PolicyReasoner::new(config);
//!
//! // Ingest telemetry for context
//! reasoner.ingest_telemetry(telemetry_snapshot);
//!
//! // Generate reasoning (shadow-only)
//! let reasoning = reasoner.generate_reasoning(
//!     Some(&rl_decision),
//!     &current_telemetry,
//!     &baseline_policy,
//! )?;
//!
//! // Reasoning includes:
//! // - Recommended action (not executed)
//! // - Human-readable rationale
//! // - Confidence score
//! // - Risk assessment
//! // - Alternative actions considered
//! ```

pub mod reasoning_schema;
pub mod policy_reasoner;

pub use reasoning_schema::{
    ReasoningOutput,
    PolicyAction,
    ActionType,
    PolicyParameters,
    ExpectedImpact,
    Rationale,
    RiskAssessment,
    RiskLevel,
    SourceSignals,
    RLAgentSignal,
    PredictiveForecastSignal,
    TelemetrySignal,
    HistoricalTrends,
    TrendDirection,
    AnomalySignal,
    AlternativeAction,
    ShadowMetadata,
};

pub use policy_reasoner::{
    PolicyReasoner,
    ReasonerConfig,
    ReasonerMetrics,
};
