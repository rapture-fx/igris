//! Visualization and monitoring for behavior trees
//!
//! This module provides real-time tree inspection, metrics collection,
//! and dashboard integration for debugging and monitoring hybrid BTree execution.
//!
//! # Components
//!
//! - [`TreeVisualizer`]: Main visualizer that exports tree state
//! - [`TreeSnapshot`]: Complete tree state for a given tick
//! - [`TreeDiff`]: Lightweight diff between snapshots
//! - Metrics collection and export
//!
//! # Features
//!
//! ## Tree State Export
//!
//! - Full tree structure with node IDs, types, and statuses
//! - Filtered blackboard snapshot
//! - Execution trace (last N ticks)
//! - Replan events with before/after diffs
//!
//! ## Metrics
//!
//! - Replan count and triggers
//! - Average tick rate
//! - LLM call latency
//! - Watchdog triggers
//! - Failure rates
//!
//! ## Dashboard Integration
//!
//! - JSON export ready for WebSocket streaming
//! - Lightweight diffs to reduce bandwidth
//! - Configurable export frequency
//! - Non-blocking async export
//!
//! # Examples
//!
//! ## Basic Usage
//!
//! ```
//! use igris_btree::prelude::*;
//! use igris_btree::visualizer::{TreeVisualizer, VisualizerConfig};
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let visualizer = TreeVisualizer::new();
//!
//! let mut tree = Sequence::new("mission");
//! let mut context = BTreeContext::new();
//!
//! // Export state after execution
//! let snapshot = visualizer.export_snapshot(&tree, &context, 1).await?;
//!
//! // Serialize to JSON for dashboard
//! let json = serde_json::to_string_pretty(&snapshot)?;
//! println!("{}", json);
//! # Ok(())
//! # }
//! ```
//!
//! ## With Custom Config
//!
//! ```
//! use igris_btree::visualizer::{TreeVisualizer, VisualizerConfig};
//!
//! let config = VisualizerConfig {
//!     enabled: true,
//!     max_trace_entries: 50,
//!     export_frequency: 5, // Every 5 ticks
//!     blackboard_filter: Some(vec!["mission_task".to_string()]),
//!     ..Default::default()
//! };
//!
//! let visualizer = TreeVisualizer::with_config(config);
//! ```

mod alerts;
mod exporter;
mod types;

pub use alerts::{Alert, AlertConfig, AlertManager, AlertSeverity};
pub use exporter::TreeVisualizer;
pub use types::*;
