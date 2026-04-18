//! Behavior tree node implementations.
//!
//! This module contains all the concrete node types that implement the [`BTreeNode`](crate::core::BTreeNode)
//! trait. Nodes are organized by category:
//!
//! # Node Categories
//!
//! ## Composite Nodes
//!
//! Control flow nodes that manage multiple children:
//! - [`Sequence`](composite::Sequence): Execute children in order (AND logic)
//! - [`Selector`](composite::Selector): Try children until success (OR logic)
//! - [`Parallel`](composite::Parallel): Execute children concurrently
//!
//! ## Decorator Nodes
//!
//! Modify or enhance a single child's behavior:
//! - [`Retry`](decorator::Retry): Retry child on failure
//! - [`Timeout`](decorator::Timeout): Fail if child exceeds time limit
//! - [`Inverter`](decorator::Inverter): Flip Success/Failure
//! - [`Repeat`](decorator::Repeat): Repeat child N times or infinitely
//! - [`ReplanOnFailure`](decorator::ReplanOnFailure): Trigger LLM replanning on failure
//!
//! ## Action Nodes
//!
//! Execute concrete behaviors:
//! - [`SetBlackboard`](action::SetBlackboard): Write to blackboard
//! - [`ToolAction`](action::ToolAction): Execute igris-tools
//!
//! ## Condition Nodes
//!
//! Check conditions without side effects:
//! - [`CheckBlackboard`](condition::CheckBlackboard): Verify blackboard value
//!
//! ## LLM Nodes
//!
//! Dynamic, LLM-powered nodes:
//! - [`LLMPlannerNode`](llm::LLMPlannerNode): Generate behavior trees via LLM
//! - [`SubtreeLoader`](llm::SubtreeLoader): Load and execute dynamic subtrees
//!
//! # Examples
//!
//! ## Building a Tree
//!
//! ```
//! use igris_btree::prelude::*;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let tree = Sequence::new("mission")
//!     .add_child(Box::new(SetBlackboard::new("init", "phase", "starting")))
//!     .add_child(Box::new(
//!         Selector::new("try_approaches")
//!             .add_child(Box::new(CheckBlackboard::new("check_primary", "primary_ready", true)))
//!             .add_child(Box::new(SetBlackboard::new("fallback", "using_backup", true)))
//!     ))
//!     .add_child(Box::new(SetBlackboard::new("done", "phase", "complete")));
//! # Ok(())
//! # }
//! ```

pub mod action;
pub mod composite;
pub mod condition;
pub mod decorator;
pub mod llm;
