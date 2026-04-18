//! JSON parser for behavior tree definitions.
//!
//! This module provides parsing of JSON behavior tree definitions into executable
//! node structures. It's primarily used by [`SubtreeLoader`](crate::nodes::llm::SubtreeLoader)
//! to load LLM-generated plans.

use crate::core::{BTreeContext, BTreeNode};
use crate::nodes::{
    action::{SetBlackboard, ToolAction},
    composite::{Selector, Sequence},
    condition::CheckBlackboard,
};
use anyhow::{anyhow, Result};
use serde_json::Value;
use tracing::debug;

/// JsonTreeParser: Parse JSON behavior tree definitions into BTree nodes.
///
/// Converts JSON representations of behavior trees into executable node structures.
/// The parser supports the core node types needed for LLM-generated plans.
///
/// # Supported Node Types
///
/// ## Composite Nodes
/// - `"Sequence"`: Sequential execution with `children` array
/// - `"Selector"`: Fallback execution with `children` array
///
/// ## Action Nodes
/// - `"Action"`: Tool execution with `tool` name and `args` object
///
/// ## Condition Nodes
/// - `"Condition"`: Blackboard check with `key` and `expected` value
///
/// # JSON Schema
///
/// All nodes must have:
/// - `"type"`: Node type string (required)
/// - `"name"`: Human-readable name (optional, defaults to "unnamed")
///
/// ## Sequence/Selector Format
///
/// ```json
/// {
///   "type": "Sequence",
///   "name": "my_sequence",
///   "children": [
///     { /* child node */ },
///     { /* child node */ }
///   ]
/// }
/// ```
///
/// ## Action Format
///
/// ```json
/// {
///   "type": "Action",
///   "name": "navigate_forward",
///   "tool": "navigate",
///   "args": {
///     "direction": "forward",
///     "distance": 10
///   }
/// }
/// ```
///
/// ## Condition Format
///
/// ```json
/// {
///   "type": "Condition",
///   "name": "check_battery",
///   "key": "battery_level",
///   "expected": 80
/// }
/// ```
///
/// # Examples
///
/// ## Parse a Simple Action
///
/// ```
/// use igris_btree::prelude::*;
/// use igris_btree::parser::JsonTreeParser;
/// use serde_json::json;
///
/// # fn main() -> anyhow::Result<()> {
/// let json = json!({
///     "type": "Action",
///     "name": "set_status",
///     "tool": "set_status",
///     "args": {"status": "ready"}
/// });
///
/// let context = BTreeContext::new();
/// let parser = JsonTreeParser::new();
/// let node = parser.parse_node(&json, &context)?;
///
/// assert_eq!(node.name(), "set_status");
/// # Ok(())
/// # }
/// ```
///
/// ## Parse a Sequence with Children
///
/// ```
/// use igris_btree::prelude::*;
/// use igris_btree::parser::JsonTreeParser;
/// use serde_json::json;
///
/// # fn main() -> anyhow::Result<()> {
/// let json = json!({
///     "type": "Sequence",
///     "name": "startup",
///     "children": [
///         {
///             "type": "Action",
///             "name": "init_systems",
///             "tool": "initialize",
///             "args": {}
///         },
///         {
///             "type": "Condition",
///             "name": "check_ready",
///             "key": "systems_ready",
///             "expected": true
///         }
///     ]
/// });
///
/// let context = BTreeContext::new();
/// let parser = JsonTreeParser::new();
/// let node = parser.parse_node(&json, &context)?;
///
/// assert_eq!(node.name(), "startup");
/// assert_eq!(node.node_type(), "Sequence");
/// # Ok(())
/// # }
/// ```
pub struct JsonTreeParser;

impl JsonTreeParser {
    /// Create a new JSON parser.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::parser::JsonTreeParser;
    ///
    /// let parser = JsonTreeParser::new();
    /// ```
    pub fn new() -> Self {
        Self
    }

    /// Parse a JSON node into an executable BTree node.
    ///
    /// Recursively parses the JSON structure, including all children for
    /// composite nodes. The parser validates the JSON structure and returns
    /// detailed errors for missing or invalid fields.
    ///
    /// # Arguments
    ///
    /// * `json` - JSON value representing the node
    /// * `context` - Execution context (used to access tool registry)
    ///
    /// # Returns
    ///
    /// Returns a boxed node implementing the `BTreeNode` trait.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - `type` field is missing or unrecognized
    /// - Required fields are missing (e.g., `children` for Sequence)
    /// - JSON structure is invalid
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    /// use igris_btree::parser::JsonTreeParser;
    /// use serde_json::json;
    ///
    /// # fn main() -> anyhow::Result<()> {
    /// let json = json!({
    ///     "type": "Sequence",
    ///     "name": "test",
    ///     "children": []
    /// });
    ///
    /// let context = BTreeContext::new();
    /// let parser = JsonTreeParser::new();
    /// let node = parser.parse_node(&json, &context)?;
    ///
    /// assert_eq!(node.node_type(), "Sequence");
    /// # Ok(())
    /// # }
    /// ```
    pub fn parse_node(&self, json: &Value, context: &BTreeContext) -> Result<Box<dyn BTreeNode>> {
        let node_type = json
            .get("type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'type' field in node: {}", json))?;

        let name = json
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("unnamed")
            .to_string();

        debug!(
            "JsonTreeParser: Parsing node type='{}', name='{}'",
            node_type, name
        );

        match node_type {
            "Sequence" => self.parse_sequence(json, context, name),
            "Selector" => self.parse_selector(json, context, name),
            "Action" => self.parse_action(json, context, name),
            "Condition" => self.parse_condition(json, name),
            _ => Err(anyhow!("Unknown node type: {}", node_type)),
        }
    }

    fn parse_sequence(
        &self,
        json: &Value,
        context: &BTreeContext,
        name: String,
    ) -> Result<Box<dyn BTreeNode>> {
        let children = json
            .get("children")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow!("Sequence '{}' missing 'children' array", name))?;

        let mut seq = Sequence::new(name);
        for child_json in children {
            let child = self.parse_node(child_json, context)?;
            seq = seq.add_child(child);
        }

        Ok(Box::new(seq))
    }

    fn parse_selector(
        &self,
        json: &Value,
        context: &BTreeContext,
        name: String,
    ) -> Result<Box<dyn BTreeNode>> {
        let children = json
            .get("children")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow!("Selector '{}' missing 'children' array", name))?;

        let mut sel = Selector::new(name);
        for child_json in children {
            let child = self.parse_node(child_json, context)?;
            sel = sel.add_child(child);
        }

        Ok(Box::new(sel))
    }

    fn parse_action(
        &self,
        json: &Value,
        context: &BTreeContext,
        name: String,
    ) -> Result<Box<dyn BTreeNode>> {
        let tool_name = json
            .get("tool")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Action '{}' missing 'tool' field", name))?;

        let args = json
            .get("args")
            .cloned()
            .unwrap_or(Value::Object(serde_json::Map::new()));

        // Check if we have tool registry
        if let Some(registry) = &context.tool_registry {
            Ok(Box::new(ToolAction::new(
                name,
                tool_name,
                args,
                registry.clone(),
            )))
        } else {
            // Fallback: create SetBlackboard action for testing
            debug!(
                "JsonTreeParser: No tool registry, creating SetBlackboard fallback for '{}'",
                name
            );
            Ok(Box::new(SetBlackboard::new(
                name,
                format!("action_{}", tool_name),
                serde_json::json!({"tool": tool_name, "args": args}),
            )))
        }
    }

    fn parse_condition(&self, json: &Value, name: String) -> Result<Box<dyn BTreeNode>> {
        let key = json
            .get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Condition '{}' missing 'key' field", name))?;

        let expected = json
            .get("expected")
            .cloned()
            .ok_or_else(|| anyhow!("Condition '{}' missing 'expected' field", name))?;

        Ok(Box::new(CheckBlackboard::new(name, key, expected)))
    }
}

impl Default for JsonTreeParser {
    fn default() -> Self {
        Self::new()
    }
}

/// Alias for compatibility with earlier design docs.
///
/// `LlmTreeParser` is deprecated in favor of `JsonTreeParser` but maintained
/// for backward compatibility.
///
/// # Example
///
/// ```
/// use igris_btree::parser::LlmTreeParser;
///
/// let parser = LlmTreeParser::new();
/// // Equivalent to JsonTreeParser::new()
/// ```
pub type LlmTreeParser = JsonTreeParser;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_action() {
        let json = serde_json::json!({
            "type": "Action",
            "name": "Test action",
            "tool": "test_tool",
            "args": {"x": 1}
        });

        let context = BTreeContext::new();
        let parser = JsonTreeParser::new();
        let node = parser.parse_node(&json, &context).unwrap();

        assert_eq!(node.name(), "Test action");
        assert_eq!(node.node_type(), "SetBlackboard"); // Fallback without registry
    }

    #[test]
    fn test_parse_sequence() {
        let json = serde_json::json!({
            "type": "Sequence",
            "name": "Test sequence",
            "children": [
                {
                    "type": "Action",
                    "name": "Action 1",
                    "tool": "tool1",
                    "args": {}
                },
                {
                    "type": "Action",
                    "name": "Action 2",
                    "tool": "tool2",
                    "args": {}
                }
            ]
        });

        let context = BTreeContext::new();
        let parser = JsonTreeParser::new();
        let node = parser.parse_node(&json, &context).unwrap();

        assert_eq!(node.name(), "Test sequence");
        assert_eq!(node.node_type(), "Sequence");
    }

    #[test]
    fn test_parse_selector_with_fallback() {
        let json = serde_json::json!({
            "type": "Selector",
            "name": "Try approaches",
            "children": [
                {
                    "type": "Action",
                    "name": "Primary",
                    "tool": "primary",
                    "args": {}
                },
                {
                    "type": "Action",
                    "name": "Fallback",
                    "tool": "fallback",
                    "args": {}
                }
            ]
        });

        let context = BTreeContext::new();
        let parser = JsonTreeParser::new();
        let node = parser.parse_node(&json, &context).unwrap();

        assert_eq!(node.name(), "Try approaches");
        assert_eq!(node.node_type(), "Selector");
    }

    #[test]
    fn test_parse_condition() {
        let json = serde_json::json!({
            "type": "Condition",
            "name": "Check status",
            "key": "status",
            "expected": "ready"
        });

        let context = BTreeContext::new();
        let parser = JsonTreeParser::new();
        let node = parser.parse_node(&json, &context).unwrap();

        assert_eq!(node.name(), "Check status");
        assert_eq!(node.node_type(), "CheckBlackboard");
    }

    #[test]
    fn test_parse_nested_sequence() {
        let json = serde_json::json!({
            "type": "Sequence",
            "name": "Mission",
            "children": [
                {
                    "type": "Action",
                    "name": "Start",
                    "tool": "start",
                    "args": {}
                },
                {
                    "type": "Selector",
                    "name": "Try methods",
                    "children": [
                        {
                            "type": "Action",
                            "name": "Method A",
                            "tool": "method_a",
                            "args": {}
                        },
                        {
                            "type": "Action",
                            "name": "Method B",
                            "tool": "method_b",
                            "args": {}
                        }
                    ]
                }
            ]
        });

        let context = BTreeContext::new();
        let parser = JsonTreeParser::new();
        let node = parser.parse_node(&json, &context).unwrap();

        assert_eq!(node.name(), "Mission");
        assert_eq!(node.node_type(), "Sequence");
    }
}
