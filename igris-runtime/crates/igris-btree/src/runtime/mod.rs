//! BTree runtime and executor.
//!
//! This module provides high-level execution management for behavior trees,
//! including lifecycle control, deadline enforcement, and cancellation support.
//!
//! # Components
//!
//! - [`BTreeExecutor`]: High-level executor with automatic tick loop
//! - [`ExecutorConfig`]: Configuration for execution bounds and tracing
//! - [`ExecutionResult`]: Detailed execution results with metadata
//!
//! # Features
//!
//! ## Automatic Tick Loop
//!
//! The executor manages the tick loop automatically, handling:
//! - Repeated ticking until completion or limits reached
//! - Status propagation
//! - Error handling
//!
//! ## Execution Bounds
//!
//! Enforce limits on execution:
//! - **Max ticks**: Prevent infinite loops
//! - **Deadline**: Time-based limits
//! - **Tick delay**: Rate limiting between ticks
//!
//! ## Cancellation
//!
//! Support for graceful cancellation via `watch` channels, allowing
//! external signals to stop execution.
//!
//! ## Metadata Collection
//!
//! Track execution metrics:
//! - Tick count
//! - Duration
//! - Termination reason (success, failure, timeout, etc.)
//!
//! # Examples
//!
//! ## Basic Execution
//!
//! ```
//! use igris_btree::prelude::*;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let executor = BTreeExecutor::new();
//! let mut tree = Sequence::new("mission")
//!     .add_child(Box::new(SetBlackboard::new("step1", "phase", "init")))
//!     .add_child(Box::new(SetBlackboard::new("step2", "phase", "execute")));
//!
//! let mut context = BTreeContext::new();
//! let result = executor.execute(&mut tree, &mut context).await?;
//!
//! assert!(result.is_success());
//! println!("Completed in {} ticks", result.tick_count);
//! # Ok(())
//! # }
//! ```
//!
//! ## With Bounds
//!
//! ```
//! use igris_btree::prelude::*;
//! use std::time::Duration;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let executor = BTreeExecutor::new()
//!     .with_max_ticks(1000)
//!     .with_deadline(Duration::from_secs(30))
//!     .with_tracing(true);
//!
//! let mut tree = Repeat::infinite(
//!     "background",
//!     Box::new(SetBlackboard::new("tick", "active", true))
//! );
//!
//! let mut context = BTreeContext::new();
//! let result = executor.execute(&mut tree, &mut context).await?;
//!
//! if result.max_ticks_reached {
//!     println!("Stopped at max ticks");
//! }
//! # Ok(())
//! # }
//! ```
//!
//! ## With Cancellation
//!
//! ```
//! use igris_btree::prelude::*;
//! use tokio::sync::watch;
//! use std::time::Duration;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let executor = BTreeExecutor::new();
//! let mut tree = Repeat::infinite(
//!     "loop",
//!     Box::new(SetBlackboard::new("tick", "count", 1))
//! );
//! let mut context = BTreeContext::new();
//!
//! let (cancel_tx, cancel_rx) = watch::channel(false);
//!
//! // Spawn execution
//! let handle = tokio::spawn(async move {
//!     executor.execute_with_cancel(&mut tree, &mut context, cancel_rx).await
//! });
//!
//! // Wait then cancel
//! tokio::time::sleep(Duration::from_millis(10)).await;
//! cancel_tx.send(true)?;
//!
//! let result = handle.await??;
//! assert!(result.cancelled);
//! # Ok(())
//! # }
//! ```

mod executor;
mod result;

pub use executor::{BTreeExecutor, ExecutorConfig};
pub use result::ExecutionResult;

// Future: Visualizer, BoundedExecutor
