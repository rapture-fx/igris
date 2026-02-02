//! Condition nodes for boolean checks.
//!
//! Condition nodes test conditions without side effects. They're used to make
//! decisions in the behavior tree, often as guards before actions or as children
//! of Selector nodes for branching logic.
//!
//! # Node Types
//!
//! - [`CheckBlackboard`]: Check if blackboard value matches expected
//!
//! # Characteristics
//!
//! All condition nodes:
//! - Are leaf nodes (no children)
//! - Have no side effects (read-only)
//! - Return Success or Failure based on condition
//! - Complete in a single tick (never Running)
//! - Are idempotent (can be called multiple times safely)
//!
//! # Design Philosophy
//!
//! Conditions should be **pure functions** - they observe state but don't
//! modify it. This makes behavior trees easier to reason about and debug.
//!
//! # Common Patterns
//!
//! ## Precondition Checks
//!
//! Use in Sequence to verify preconditions before actions:
//!
//! ```text
//! Sequence
//!   ├─ CheckBlackboard (battery > 20%)
//!   └─ Action (start motors)
//! ```
//!
//! ## Branching Logic
//!
//! Use in Selector for conditional execution:
//!
//! ```text
//! Selector
//!   ├─ Sequence
//!   │   ├─ CheckBlackboard (mode == "auto")
//!   │   └─ Action (autonomous behavior)
//!   └─ Sequence
//!       ├─ CheckBlackboard (mode == "manual")
//!       └─ Action (manual control)
//! ```
//!
//! # Examples
//!
//! ## Guard Before Action
//!
//! ```
//! use igris_btree::prelude::*;
//! use serde_json::json;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let guarded_action = Sequence::new("safe_start")
//!     .add_child(Box::new(CheckBlackboard::new("check", "ready", true)))
//!     .add_child(Box::new(SetBlackboard::new("act", "status", "running")));
//!
//! let mut context = BTreeContext::new();
//!
//! // Without "ready" flag, sequence fails at first child
//! let status = guarded_action.tick(&mut context).await?;
//! assert_eq!(status, NodeStatus::Failure);
//! # Ok(())
//! # }
//! ```
//!
//! ## Conditional Branch
//!
//! ```
//! use igris_btree::prelude::*;
//! use serde_json::json;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let branching = Selector::new("mode_switch")
//!     .add_child(Box::new(
//!         Sequence::new("auto_mode")
//!             .add_child(Box::new(CheckBlackboard::new("is_auto", "mode", "auto")))
//!             .add_child(Box::new(SetBlackboard::new("do_auto", "behavior", "autonomous")))
//!     ))
//!     .add_child(Box::new(SetBlackboard::new("fallback", "behavior", "manual")));
//!
//! let mut context = BTreeContext::new();
//! context.blackboard.set("mode", json!("auto")).await;
//!
//! let status = branching.tick(&mut context).await?;
//! assert_eq!(status, NodeStatus::Success);
//! # Ok(())
//! # }
//! ```

mod check_blackboard;

pub use check_blackboard::CheckBlackboard;
