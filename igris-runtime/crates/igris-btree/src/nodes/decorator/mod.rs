//! Decorator nodes for modifying child behavior.
//!
//! Decorator nodes wrap a single child and modify its behavior in some way.
//! They're used to add robustness, control flow, or behavioral modifications
//! without changing the child itself.
//!
//! # Node Types
//!
//! ## Robustness
//! - [`Retry`]: Retry child on failure up to N times
//! - [`Timeout`]: Fail if child exceeds time limit
//!
//! ## Logic
//! - [`Inverter`]: Flip Success/Failure (NOT logic)
//! - [`Repeat`]: Repeat child N times or infinitely
//!
//! ## LLM Integration
//! - [`ReplanOnFailure`]: Trigger LLM replanning when child fails
//!
//! # Decorator Pattern
//!
//! Decorators follow the classic **Decorator Pattern**:
//! - Single child (not zero, not multiple)
//! - Modify or enhance child's behavior
//! - Forward most operations to child
//! - Add pre/post processing or control logic
//!
//! # Common Use Cases
//!
//! ## Retry Failed Operations
//!
//! ```text
//! Retry (max: 3)
//!   └─ NetworkRequest
//! Result: Tries up to 4 times (1 initial + 3 retries)
//! ```
//!
//! ## Time-Bound Execution
//!
//! ```text
//! Timeout (5 seconds)
//!   └─ SearchDatabase
//! Result: Fails if search takes > 5 seconds
//! ```
//!
//! ## Negation Logic
//!
//! ```text
//! Inverter
//!   └─ CheckBlackboard ("ready" == true)
//! Result: Success when NOT ready
//! ```
//!
//! ## Adaptive Recovery
//!
//! ```text
//! ReplanOnFailure
//!   └─ SubtreeLoader ("current_plan")
//! Result: Generates new plan via LLM on failure
//! ```
//!
//! # Examples
//!
//! ## Robust Network Request
//!
//! ```
//! use igris_btree::prelude::*;
//!
//! let robust_request = Retry::new(
//!     "retry_request",
//!     Box::new(SetBlackboard::new("request", "status", "sent")),
//!     3  // Try up to 4 times
//! );
//! ```
//!
//! ## Time-Bounded Search
//!
//! ```
//! use igris_btree::prelude::*;
//! use std::time::Duration;
//!
//! let bounded_search = Timeout::new(
//!     "search_timeout",
//!     Box::new(SetBlackboard::new("search", "result", "found")),
//!     5000  // 5 second limit
//! );
//! ```
//!
//! ## Inverted Condition
//!
//! ```
//! use igris_btree::prelude::*;
//! use serde_json::json;
//!
//! // "While NOT ready, wait"
//! let wait_until_ready = Sequence::new("wait_loop")
//!     .add_child(Box::new(
//!         Inverter::new(
//!             "not_ready",
//!             Box::new(CheckBlackboard::new("check", "ready", true))
//!         )
//!     ))
//!     .add_child(Box::new(SetBlackboard::new("wait", "waiting", true)));
//! ```
//!
//! ## Self-Healing Behavior
//!
//! ```no_run
//! use igris_btree::prelude::*;
//! use igris_btree::MockLlmProvider;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let provider = Arc::new(MockLlmProvider::with_recovery_plan());
//! let mut context = BTreeContext::new().with_llm(provider);
//!
//! let self_healing = ReplanOnFailure::new(
//!     "adaptive",
//!     Box::new(SetBlackboard::new("task", "status", "attempting")),
//!     "mission"
//! ).with_max_replans(3);
//!
//! // Will automatically replan via LLM on failure
//! # Ok(())
//! # }
//! ```

mod inverter;
mod repeat;
mod replan_on_failure;
mod retry;
mod timeout;

pub use inverter::Inverter;
pub use repeat::Repeat;
pub use replan_on_failure::ReplanOnFailure;
pub use retry::Retry;
pub use timeout::Timeout;
