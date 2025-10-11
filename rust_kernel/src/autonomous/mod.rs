//! Autonomous Reliability Layer (Phase 12)
//!
//! Self-healing, auto-scaling, and SLA enforcement with minimum human intervention.

pub mod control_core;
pub mod policy_guard;

pub use control_core::{AutonomousControlCore, ControlDecision, RecoveryWorkflow};
pub use policy_guard::{PolicyGuard, PolicyChangeRequest, SafetyCheck};
