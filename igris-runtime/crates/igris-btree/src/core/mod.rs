//! Core behavior tree types and traits.
//!
//! This module contains the fundamental building blocks of the behavior tree system:
//!
//! - [`NodeStatus`]: Execution status values (Running, Success, Failure, Skipped)
//! - [`Blackboard`]: Shared state storage for inter-node communication
//! - [`BTreeContext`]: Execution context with blackboard, LLM, tools, and RT executor
//! - [`BTreeNode`]: Base trait that all behavior tree nodes implement
//! - [`NodeMetadata`]: Metadata for visualization and debugging
//!
//! # Architecture
//!
//! The core module provides the foundation that all other modules build upon:
//!
//! ```text
//! ┌────────────────────────────────────────────────┐
//! │  BTreeNode Trait                               │
//! │  - tick() → NodeStatus                         │
//! │  - reset(), halt()                             │
//! │  - name(), node_type()                         │
//! └────────────────────────────────────────────────┘
//!          ▲                           ▲
//!          │                           │
//! ┌────────┴──────────┐      ┌────────┴──────────┐
//! │  BTreeContext      │      │  NodeStatus       │
//! │  - blackboard      │      │  - Running        │
//! │  - llm_provider    │      │  - Success        │
//! │  - tool_registry   │      │  - Failure        │
//! │  - rt_executor     │      │  - Skipped        │
//! └────────────────────┘      └───────────────────┘
//! ```
//!
//! # Examples
//!
//! ## Using Core Types
//!
//! ```
//! use igris_btree::core::{BTreeContext, BTreeNode, NodeStatus, Blackboard};
//! use serde_json::json;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! // Create a context
//! let mut context = BTreeContext::new();
//!
//! // Use the blackboard
//! context.blackboard.set("mission_id", json!(42)).await;
//! let value = context.blackboard.get("mission_id").await;
//! assert_eq!(value, Some(json!(42)));
//!
//! // Check execution status
//! let status = NodeStatus::Success;
//! assert!(status.is_terminal());
//! # Ok(())
//! # }
//! ```

mod blackboard;
mod context;
mod node;
mod status;

pub use blackboard::{Blackboard, BlackboardEntry, ScopedBlackboard};
pub use context::BTreeContext;
#[cfg(feature = "wal")]
pub use context::BtWalSession;
pub use node::{BTreeNode, NodeMetadata};
pub use status::NodeStatus;
