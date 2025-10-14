//! Cognitive Control Layer (Phase 11.5 - Advisory Mode)
//!
//! AI-Native Operational Autonomy - Cognitive Reasoning Layer with Advisory Output
//!
//! This module provides explainable policy proposals by synthesizing:
//! - Phase 11.3 Cognitive reasoning outputs
//! - Phase 11.4 Simulation comparison data
//! - Phase 11.2 predictive forecasts
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
//! │ Forecasts   │     │  • Proposals │
//! │  (11.2)     │     │  • Rationale │
//! └─────────────┘     │  • Confidence│
//!                     │  • Risk Score│
//! ┌─────────────┐     │  • Evidence │
//! │ Telemetry + │────▶│              │
//! │  History    │     └──────────────┘
//! └─────────────┘
//! ```
//!
//! # Key Features (Phase 11.5)
//! - **Advisory Mode**: Generate actionable proposals (no execution)
//! - **Safety Gate Integration**: Confidence ≥0.85, Risk ≤0.15, Drift ≤5%
//! - **JSON Export**: Structured proposals to `experiments/cognitive/proposals/`
//! - **Evidence Links**: Connect to reasoning and simulation data
//! - **Human Review**: Automatic flagging for questionable proposals
//!
//! # Safety Guarantees
//! - No direct policy mutations
//! - All outputs written to experiments/cognitive/proposals/
//! - Safety gate enforcement before emission
//! - Human review required for uncertain proposals
//!
//! # Usage Example
//! ```rust,no_run
//! use schlep_kernel::cognitive::{ProposalEngine, ProposalEngineConfig};
//! use schlep_kernel::cognitive::{ProposalInput, TelemetrySnapshot};
//!
//! let config = ProposalEngineConfig::default();
//! let engine = ProposalEngine::new(config)?;
//!
//! // Create input with reasoning and telemetry
//! let input = ProposalInput {
//!     reasoning: reasoning_output,
//!     current_telemetry: telemetry_snapshot,
//!     simulation_data: Some(simulation_data),
//!     forecast_data: Some(forecast_data),
//! };
//!
//! // Generate proposals (advisory-only)
//! let proposals = engine.generate_proposals(vec![input])?;
//!
//! // All proposals persisted to experiments/cognitive/proposals/
//! println!("Generated {} advisory proposals", proposals.len());
//! ```

pub mod reasoning_schema;
pub mod policy_reasoner;

// Phase 11.5 Advisory modules
pub mod proposal_schema;
pub mod proposal_engine;
pub mod proposal_actions;
pub mod proposal_safety;

pub mod utils {
    pub mod json_writer;
}

pub use reasoning_schema::{
    ReasoningOutput,
    PolicyAction,
    ActionType as LegacyActionType,
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

// Phase 11.5 Cognitive Advisory exports
pub use proposal_schema::{
    PolicyProposal, ActionType, SafetyLevel, EvidenceType, EvidenceReference,
    EvidenceLinks, SafetyAssessment, ProposalRationale, SystemState,
    ExpectedImpact as ProposalExpectedImpact, ProposalMetadata,
    GateResult, GateSeverity, SafetyValidationResult,
};

pub use proposal_engine::{
    ProposalEngine, ProposalEngineConfig, ProposalInput, TelemetrySnapshot,
    SimulationData, ForecastData,
};

pub use proposal_actions::ProposalActions;

pub use proposal_safety::{
    ProposalSafetyValidator, SafetyValidationResult as ProposalSafetyResult,
    ProposalSafetyConfig, GateResult as SafetyGateResult,
    GateSeverity as SafetyGateSeverity,
};

pub use utils::json_writer::JsonWriter;
