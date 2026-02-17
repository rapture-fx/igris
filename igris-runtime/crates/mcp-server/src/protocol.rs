use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JSON-RPC 2.0 Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Value>,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// JSON-RPC 2.0 Response (Success)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Value,
    pub result: Value,
}

/// JSON-RPC 2.0 Error Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub jsonrpc: String,
    pub id: Value,
    pub error: ErrorDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorDetail {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl JsonRpcError {
    pub fn new(id: Value, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            error: ErrorDetail {
                code,
                message: message.into(),
                data: None,
            },
        }
    }

    pub fn parse_error(id: Value) -> Self {
        Self::new(id, -32700, "Parse error")
    }

    pub fn invalid_request(id: Value) -> Self {
        Self::new(id, -32600, "Invalid Request")
    }

    pub fn method_not_found(id: Value) -> Self {
        Self::new(id, -32601, "Method not found")
    }

    pub fn invalid_params(id: Value) -> Self {
        Self::new(id, -32602, "Invalid params")
    }

    pub fn internal_error(id: Value) -> Self {
        Self::new(id, -32603, "Internal error")
    }
}

/// MCP Protocol Version
pub const MCP_VERSION: &str = "2025-11-25";

/// MCP Server Capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsCapability>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<ResourcesCapability>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompts: Option<PromptsCapability>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_sync: Option<ContextSyncCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsCapability {
    #[serde(default)]
    pub list_changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourcesCapability {
    #[serde(default)]
    pub subscribe: bool,
    #[serde(default)]
    pub list_changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptsCapability {
    #[serde(default)]
    pub list_changed: bool,
}

/// Custom capability for peer context synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSyncCapability {
    pub swarm_mode: bool,
    pub auto_discovery: bool,
    pub encrypted_storage: bool,
}

/// Initialize Request Params
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,
    pub capabilities: McpCapabilities,
    #[serde(rename = "clientInfo")]
    pub client_info: ClientInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

/// Initialize Response Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,
    pub capabilities: McpCapabilities,
    #[serde(rename = "serverInfo")]
    pub server_info: ServerInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub version: String,
}

/// Tool Definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
}

/// Resource Definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub uri: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "mimeType", skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

/// Prompt Definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub arguments: Vec<PromptArgument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptArgument {
    pub name: String,
    pub description: String,
    pub required: bool,
}

/// Context Message (for peer synchronization)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMessage {
    pub role: String,
    pub content: String,
    pub timestamp: u64,
    pub peer_id: String,
}

/// Shared Context Envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedContextEnvelope {
    pub conversation_id: String,
    pub messages: Vec<ContextMessage>,
    pub tool_state: Value,
    pub last_updated: u64,
    pub peer_id: String,
}

/// Parameters for tools/call JSON-RPC method
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallParams {
    /// Name of the tool to invoke
    pub name: String,
    /// Arguments to pass to the tool
    #[serde(default)]
    pub arguments: Value,
}

/// Result returned from a tools/call invocation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallResult {
    /// Content blocks returned by the tool
    pub content: Vec<ToolResultContent>,
    /// Whether the tool execution resulted in an error
    #[serde(rename = "isError", skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

/// A single content block within a tool call result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResultContent {
    /// Content type (e.g. "text")
    #[serde(rename = "type")]
    pub type_field: String,
    /// Text content
    pub text: String,
}

/// Signed execution envelope for verified tool execution results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedExecutionEnvelope {
    /// The tool execution result payload
    pub result: Value,
    /// Cryptographic signature over the result
    pub signature: String,
    /// ISO-8601 timestamp of execution
    pub timestamp: String,
    /// Unique identifier for this execution
    pub execution_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jsonrpc_request_serialize() {
        let req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(1)),
            method: "initialize".to_string(),
            params: Some(serde_json::json!({})),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"method\":\"initialize\""));
    }

    #[test]
    fn test_error_construction() {
        let err = JsonRpcError::method_not_found(serde_json::json!(1));
        assert_eq!(err.error.code, -32601);
        assert_eq!(err.error.message, "Method not found");
    }
}
