//! Safety mechanisms for behavior trees.
//!
//! This module provides safety layers for preventing infinite loops, stuck nodes,
//! and other failure modes that can occur during behavior tree execution.
//!
//! # Components
//!
//! - [`Watchdog`]: Monitor and enforce timeouts on child execution
//!
//! # Safety Philosophy
//!
//! Behavior trees can run indefinitely and interact with real-world systems.
//! Safety mechanisms provide multiple layers of protection:
//!
//! 1. **Time Bounds**: Watchdog enforces maximum execution time
//! 2. **Loop Detection**: Tracks consecutive Running status
//! 3. **Emergency Stop**: Halts child nodes when limits exceeded
//! 4. **Graceful Degradation**: Returns Failure instead of hanging
//!
//! # Use Cases
//!
//! - Robotics: Prevent runaway behaviors that could damage hardware
//! - Production systems: Ensure timely responses to requests
//! - Testing: Catch infinite loops in development
//! - Resource management: Prevent CPU/memory exhaustion
//!
//! # Examples
//!
//! ## Watchdog for Long Operations
//!
//! ```
//! use igris_btree::prelude::*;
//! use std::time::Duration;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let child = Box::new(
//!     Sequence::new("long_operation")
//!         .add_child(Box::new(SetBlackboard::new("start", "phase", "starting")))
//!         // ... potentially long sequence
//! );
//!
//! let mut watchdog = Watchdog::new(
//!     "safety",
//!     child,
//!     Duration::from_secs(10)
//! );
//!
//! let mut context = BTreeContext::new();
//!
//! // Will fail if operation takes more than 10 seconds
//! let status = watchdog.tick(&mut context).await?;
//! # Ok(())
//! # }
//! ```
//!
//! ## Detecting Infinite Loops
//!
//! ```
//! use igris_btree::prelude::*;
//! use std::time::Duration;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let infinite_loop = Box::new(
//!     Repeat::infinite("loop", Box::new(SetBlackboard::new("tick", "active", true)))
//! );
//!
//! let mut watchdog = Watchdog::new(
//!     "loop_detector",
//!     infinite_loop,
//!     Duration::from_secs(5)
//! ).with_max_consecutive_running(100);
//!
//! let mut context = BTreeContext::new();
//!
//! // Will warn after 100 consecutive Running statuses
//! // Will fail after 5 seconds
//! for _ in 0..200 {
//!     let status = watchdog.tick(&mut context).await?;
//!     if status != NodeStatus::Running {
//!         break;
//!     }
//! }
//! # Ok(())
//! # }
//! ```

mod watchdog;

pub use watchdog::Watchdog;

// Future: FallbackChain, CircuitBreaker, ResourceMonitor
