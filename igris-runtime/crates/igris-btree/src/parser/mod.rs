//! Tree parsers for loading behavior trees from JSON.
//!
//! This module provides parsers that convert JSON behavior tree definitions
//! into executable node structures. The primary use case is loading LLM-generated
//! plans dynamically at runtime.
//!
//! # Components
//!
//! - [`JsonTreeParser`]: Parse JSON into executable nodes
//! - [`LlmTreeParser`]: Alias for `JsonTreeParser` (compatibility)
//!
//! # JSON Format
//!
//! The parser expects a JSON structure following this schema:
//!
//! ```json
//! {
//!   "type": "Sequence|Selector|Action|Condition",
//!   "name": "node_name",
//!   "children": [...],  // For Sequence/Selector
//!   "tool": "tool_name", // For Action
//!   "args": {...},       // For Action
//!   "key": "key_name",   // For Condition
//!   "expected": value    // For Condition
//! }
//! ```
//!
//! # Use Cases
//!
//! - Loading LLM-generated behavior trees
//! - Deserializing saved trees
//! - Network transmission of trees
//! - Dynamic tree composition
//!
//! # Examples
//!
//! ## Parse a Navigation Plan
//!
//! ```
//! use igris_btree::prelude::*;
//! use igris_btree::parser::JsonTreeParser;
//! use serde_json::json;
//!
//! # fn main() -> anyhow::Result<()> {
//! let plan = json!({
//!     "type": "Sequence",
//!     "name": "navigate_to_target",
//!     "children": [
//!         {
//!             "type": "Condition",
//!             "name": "check_path_clear",
//!             "key": "path_clear",
//!             "expected": true
//!         },
//!         {
//!             "type": "Action",
//!             "name": "move_forward",
//!             "tool": "navigate",
//!             "args": {"direction": "forward", "distance": 10}
//!         },
//!         {
//!             "type": "Action",
//!             "name": "stop",
//!             "tool": "stop",
//!             "args": {}
//!         }
//!     ]
//! });
//!
//! let context = BTreeContext::new();
//! let parser = JsonTreeParser::new();
//! let tree = parser.parse_node(&plan, &context)?;
//!
//! assert_eq!(tree.name(), "navigate_to_target");
//! assert_eq!(tree.node_type(), "Sequence");
//! # Ok(())
//! # }
//! ```
//!
//! ## Integration with LLM
//!
//! ```no_run
//! use igris_btree::prelude::*;
//! use igris_btree::parser::JsonTreeParser;
//! use serde_json::json;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! # use igris_btree::MockLlmProvider;
//! # use std::sync::Arc;
//! // 1. LLM generates plan
//! let provider = Arc::new(MockLlmProvider::with_navigation_plan());
//! let plan_json = provider.generate("Navigate to warehouse").await?;
//! let plan: serde_json::Value = serde_json::from_str(&plan_json)?;
//!
//! // 2. Parse into executable tree
//! let context = BTreeContext::new();
//! let parser = JsonTreeParser::new();
//! let mut tree = parser.parse_node(&plan, &context)?;
//!
//! // 3. Execute
//! let mut context = BTreeContext::new();
//! let status = tree.tick(&mut context).await?;
//! # Ok(())
//! # }
//! ```

mod json_parser;

pub use json_parser::JsonTreeParser;
pub use json_parser::LlmTreeParser; // Alias for compatibility
