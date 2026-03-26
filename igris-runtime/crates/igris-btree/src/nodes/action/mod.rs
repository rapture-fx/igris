//! Action nodes for executing tasks.
//!
//! Action nodes are leaf nodes that perform concrete behaviors. They interact
//! with the environment, modify state, or execute tools. Unlike composite nodes,
//! actions have no children.
//!
//! # Node Types
//!
//! - [`SetBlackboard`]: Write values to the blackboard
//! - [`ToolAction`]: Execute igris-tools actions
//!
//! # Characteristics
//!
//! All action nodes:
//! - Are leaf nodes (no children)
//! - Perform side effects (modify state, call APIs, etc.)
//! - Return Success or Failure based on outcome
//! - May return Running for long operations (though current implementations complete in one tick)
//!
//! # Examples
//!
//! ## State Management
//!
//! ```
//! use igris_btree::prelude::*;
//! use serde_json::json;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let mut action = SetBlackboard::new("init_status", "status", json!("ready"));
//! let mut context = BTreeContext::new();
//!
//! let status = action.tick(&mut context).await?;
//! assert_eq!(status, NodeStatus::Success);
//! assert_eq!(
//!     context.blackboard.get("status").await,
//!     Some(json!("ready"))
//! );
//! # Ok(())
//! # }
//! ```
//!
//! ## Tool Execution
//!
//! ```no_run
//! use igris_btree::prelude::*;
//! use igris_tools::ToolRegistry;
//! use serde_json::json;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let mut registry = ToolRegistry::new();
//! // (Assume tools are registered)
//!
//! let mut action = ToolAction::new(
//!     "navigate",
//!     "move_forward",
//!     json!({"distance": 10, "speed": 0.5}),
//!     Arc::new(registry)
//! );
//!
//! let mut context = BTreeContext::new();
//! let status = action.tick(&mut context).await?;
//! # Ok(())
//! # }
//! ```

mod set_blackboard;
mod tool_action;

#[cfg(feature = "ros2")]
mod ros_nodes;

pub use set_blackboard::SetBlackboard;
pub use tool_action::ToolAction;

#[cfg(feature = "ros2")]
pub use ros_nodes::{RosServiceCall, RosTopicPublish, RosTopicSubscribe};
