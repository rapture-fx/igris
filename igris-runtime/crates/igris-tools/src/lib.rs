/// Igris Tools - External Tool Integration for LLMs (v1.5)
///
/// This crate provides tool use capabilities for local LLMs:
/// - HTTP requests (GET, POST, etc.)
/// - Shell command execution (sandboxed)
/// - File system operations (read, write, list)
/// - Tool result sharing via MCP
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub mod database;
pub mod filesystem;
pub mod http;
pub mod redaction;
pub mod registry;
pub mod shell;

pub use redaction::{
    allowlisted_http_headers, safe_content_output, safe_empty_output, safe_error_message,
    safe_file_metadata, sanitize_json_value, sanitize_tool_output, REDACTION_POLICY_VERSION,
};
pub use registry::{ToolDefinition, ToolRegistry};

/// SHA-256 of `bytes`, lowercase hex. Used to expose a *safe* digest of a tool's
/// payload (file contents, HTTP response body) in action evidence without ever
/// revealing the payload itself.
pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(64);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

/// Tool execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// Tool name that was executed
    pub tool_name: String,

    /// Whether execution succeeded
    pub success: bool,

    /// Output from the tool
    pub output: String,

    /// Error message if failed
    pub error: Option<String>,

    /// Execution time in milliseconds
    pub execution_time_ms: u64,

    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl ToolResult {
    /// Create a successful result
    pub fn success(tool_name: String, output: String, execution_time_ms: u64) -> Self {
        Self {
            tool_name,
            success: true,
            output,
            error: None,
            execution_time_ms,
            metadata: HashMap::new(),
        }
    }

    /// Create a failed result
    pub fn failure(tool_name: String, error: String, execution_time_ms: u64) -> Self {
        Self {
            tool_name,
            success: false,
            output: String::new(),
            error: Some(error),
            execution_time_ms,
            metadata: HashMap::new(),
        }
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// Tool trait that all tools must implement
#[async_trait::async_trait]
pub trait Tool: Send + Sync {
    /// Get the tool name
    fn name(&self) -> &str;

    /// Get the tool description
    fn description(&self) -> &str;

    /// Get the tool's parameter schema (JSON Schema)
    fn parameters_schema(&self) -> serde_json::Value;

    /// Execute the tool with given arguments
    async fn execute(&self, args: serde_json::Value) -> Result<ToolResult>;

    /// Validate arguments before execution (optional)
    async fn validate_args(&self, _args: &serde_json::Value) -> Result<()> {
        Ok(())
    }
}

/// Tool execution configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolConfig {
    /// Enable HTTP tools
    #[serde(default)]
    pub enable_http: bool,

    /// Enable shell tools (requires sandboxing)
    #[serde(default)]
    pub enable_shell: bool,

    /// Enable file system tools
    #[serde(default)]
    pub enable_filesystem: bool,

    /// Allowed HTTP domains (whitelist)
    #[serde(default)]
    pub allowed_http_domains: Vec<String>,

    /// Allowed shell commands (whitelist)
    #[serde(default)]
    pub allowed_shell_commands: Vec<String>,

    /// Allowed filesystem paths (whitelist)
    #[serde(default)]
    pub allowed_filesystem_paths: Vec<String>,

    /// Maximum execution time per tool (milliseconds)
    #[serde(default = "default_max_execution_time")]
    pub max_execution_time_ms: u64,

    /// Maximum concurrent tool executions
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent_executions: usize,
}

fn default_max_execution_time() -> u64 {
    30000 // 30 seconds
}

fn default_max_concurrent() -> usize {
    5
}

impl Default for ToolConfig {
    fn default() -> Self {
        Self {
            enable_http: false,
            enable_shell: false,
            enable_filesystem: false,
            allowed_http_domains: vec![],
            allowed_shell_commands: vec![],
            allowed_filesystem_paths: vec![],
            max_execution_time_ms: 30000,
            max_concurrent_executions: 5,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_result_success() {
        let result =
            ToolResult::success("test_tool".to_string(), "success output".to_string(), 100);

        assert!(result.success);
        assert_eq!(result.tool_name, "test_tool");
        assert_eq!(result.output, "success output");
        assert!(result.error.is_none());
    }

    #[test]
    fn test_tool_result_failure() {
        let result = ToolResult::failure("test_tool".to_string(), "error message".to_string(), 50);

        assert!(!result.success);
        assert_eq!(result.error, Some("error message".to_string()));
    }

    #[test]
    fn test_sha256_hex_known_vector() {
        // SHA-256("") and SHA-256("abc") — standard test vectors.
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(sha256_hex(b"abc").len(), 64);
    }

    #[test]
    fn test_tool_config_default() {
        let config = ToolConfig::default();
        assert!(!config.enable_http);
        assert!(!config.enable_shell);
        assert!(!config.enable_filesystem);
        assert_eq!(config.max_execution_time_ms, 30000);
    }
}
