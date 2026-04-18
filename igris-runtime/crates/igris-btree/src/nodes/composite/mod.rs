//! Composite nodes for control flow.
//!
//! Composite nodes have multiple children and control which children execute
//! and when. They implement the core control flow patterns used in behavior trees.
//!
//! # Node Types
//!
//! - [`Sequence`]: AND logic - all children must succeed
//! - [`Selector`]: OR logic - try until one succeeds
//! - [`Parallel`]: Concurrent execution with policy-based termination
//!
//! # Control Flow Patterns
//!
//! ## Sequence (AND)
//!
//! Executes children left-to-right. Succeeds only if all children succeed.
//! Fails immediately if any child fails.
//!
//! ```text
//! Sequence
//!   ├─ Child A → Success
//!   ├─ Child B → Success
//!   └─ Child C → Success
//! Result: Success
//! ```
//!
//! ## Selector (OR)
//!
//! Tries children left-to-right. Succeeds on first success.
//! Fails only if all children fail.
//!
//! ```text
//! Selector
//!   ├─ Child A → Failure
//!   ├─ Child B → Success ✓ (stop here)
//!   └─ Child C → (not tried)
//! Result: Success
//! ```
//!
//! ## Parallel (ALL/ANY)
//!
//! Ticks all children every cycle. Termination based on policy:
//! - RequireAll: Success if all succeed, Failure if any fails
//! - RequireOne: Success if any succeeds, Failure if all fail
//!
//! # Examples
//!
//! ## Multi-Step Procedure (Sequence)
//!
//! ```
//! use igris_btree::prelude::*;
//!
//! let procedure = Sequence::new("startup")
//!     .add_child(Box::new(SetBlackboard::new("step1", "systems", "initializing")))
//!     .add_child(Box::new(CheckBlackboard::new("check", "power", true)))
//!     .add_child(Box::new(SetBlackboard::new("step2", "systems", "ready")));
//! ```
//!
//! ## Fallback Strategy (Selector)
//!
//! ```
//! use igris_btree::prelude::*;
//!
//! let fallback = Selector::new("communication")
//!     .add_child(Box::new(CheckBlackboard::new("wifi", "wifi_available", true)))
//!     .add_child(Box::new(CheckBlackboard::new("cellular", "cellular_available", true)))
//!     .add_child(Box::new(SetBlackboard::new("offline", "mode", "offline")));
//! ```
//!
//! ## Concurrent Monitoring (Parallel)
//!
//! ```
//! use igris_btree::prelude::*;
//! use igris_btree::nodes::composite::ParallelPolicy;
//!
//! let monitoring = Parallel::new("monitors", ParallelPolicy::RequireAll)
//!     .add_child(Box::new(CheckBlackboard::new("battery", "battery_ok", true)))
//!     .add_child(Box::new(CheckBlackboard::new("temp", "temp_ok", true)))
//!     .add_child(Box::new(CheckBlackboard::new("connection", "connected", true)));
//! ```

mod parallel;
mod selector;
mod sequence;

pub use parallel::{Parallel, ParallelPolicy};
pub use selector::Selector;
pub use sequence::Sequence;
