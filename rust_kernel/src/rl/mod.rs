//! Reinforcement Learning Module (Phase 11.1)
//!
//! AI-Driven Policy Autotuner using contextual bandits and lightweight RL
//! for safe, adaptive optimization of routing, batching, and prefetch policies.
//!
//! # Architecture
//! ```text
//! Telemetry → Simulator → Offline Trainer → Policy Seed
//!                ↓
//!           RL Agent → Policy Evaluator → Control Surface
//!                ↓           ↓
//!         Thompson     Shadow Eval
//!         Sampling
//! ```
//!
//! # Safety Guarantees
//! - Shadow evaluation on 0.5% traffic before commit
//! - Automatic rollback on drift >5%
//! - Checkpointed policy changes
//! - Kill-switch via configuration

pub mod simulation;
pub mod offline_trainer;
pub mod rl_agent;
pub mod policy_evaluator;
pub mod thompson_sampling;

pub use simulation::{SimulationHarness, SimulationConfig, TelemetryTrace};
pub use offline_trainer::{OfflineTrainer, TrainerConfig, PolicySeed};
pub use rl_agent::{RLAgent, AgentConfig, AgentDecision};
pub use policy_evaluator::{PolicyEvaluator, EvaluatorConfig, EvaluationResult};
pub use thompson_sampling::{ThompsonSampling, BanditArm, ActionSpace};
