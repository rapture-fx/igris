use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{info, warn};

use crate::context::ContextStore;
use crate::protocol::*;

/// MCP Router State
#[derive(Clone)]
pub struct McpState {
    pub context_store: Arc<ContextStore>,
    pub peer_id: String,
    pub server_info: ServerInfo,
}

/// Build MCP Router with all endpoints
pub fn build_mcp_router(state: McpState) -> Router {
    Router::new()
        .route("/mcp", post(handle_jsonrpc))
        .with_state(state)
}

/// Main JSON-RPC 2.0 handler
async fn handle_jsonrpc(
    State(state): State<McpState>,
    Json(req): Json<JsonRpcRequest>,
) -> Response {
    info!("MCP Request: method={}", req.method);

    // Route based on method
    let result = match req.method.as_str() {
        "initialize" => handle_initialize(state, req.params).await,
        "ping" => handle_ping(),
        "context/sync" => handle_context_sync(state, req.params).await,
        "context/get" => handle_context_get(state, req.params).await,
        "context/list" => handle_context_list(state).await,
        "tools/list" => handle_tools_list(),
        "resources/list" => handle_resources_list(),
        "prompts/list" => handle_prompts_list(),
        _ => Err(JsonRpcError::method_not_found(
            req.id.clone().unwrap_or(Value::Null),
        )),
    };

    match result {
        Ok(result) => {
            let response = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: req.id.unwrap_or(Value::Null),
                result,
            };
            Json(response).into_response()
        }
        Err(error) => (StatusCode::OK, Json(error)).into_response(),
    }
}

async fn handle_initialize(
    state: McpState,
    params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    let _params: InitializeParams = params
        .and_then(|v| serde_json::from_value(v).ok())
        .ok_or_else(|| JsonRpcError::invalid_params(Value::Null))?;

    info!("Initializing MCP connection with peer");

    let result = InitializeResult {
        protocol_version: MCP_VERSION.to_string(),
        capabilities: McpCapabilities {
            tools: Some(ToolsCapability {
                list_changed: false,
            }),
            resources: Some(ResourcesCapability {
                subscribe: false,
                list_changed: false,
            }),
            prompts: Some(PromptsCapability {
                list_changed: false,
            }),
            context_sync: Some(ContextSyncCapability {
                swarm_mode: true,
                auto_discovery: true,
                encrypted_storage: true,
            }),
        },
        server_info: state.server_info,
    };

    Ok(serde_json::to_value(result).unwrap())
}

fn handle_ping() -> Result<Value, JsonRpcError> {
    Ok(json!({}))
}

async fn handle_context_sync(
    state: McpState,
    params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    let envelope: SharedContextEnvelope = params
        .and_then(|v| serde_json::from_value(v).ok())
        .ok_or_else(|| JsonRpcError::invalid_params(Value::Null))?;

    info!(
        "Syncing context: conversation_id={}, messages={}",
        envelope.conversation_id,
        envelope.messages.len()
    );

    state
        .context_store
        .sync_context(envelope)
        .await
        .map_err(|e| {
            warn!("Context sync error: {}", e);
            JsonRpcError::internal_error(Value::Null)
        })?;

    Ok(json!({"status": "synced"}))
}

async fn handle_context_get(
    state: McpState,
    params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    let conversation_id: String = params
        .and_then(|v| v.get("conversation_id").and_then(|c| c.as_str()).map(String::from))
        .ok_or_else(|| JsonRpcError::invalid_params(Value::Null))?;

    let context = state
        .context_store
        .get_context(&conversation_id)
        .await
        .map_err(|_| JsonRpcError::internal_error(Value::Null))?;

    Ok(serde_json::to_value(context).unwrap())
}

async fn handle_context_list(state: McpState) -> Result<Value, JsonRpcError> {
    let contexts = state
        .context_store
        .list_contexts()
        .await
        .map_err(|_| JsonRpcError::internal_error(Value::Null))?;

    Ok(json!({ "contexts": contexts }))
}

fn handle_tools_list() -> Result<Value, JsonRpcError> {
    Ok(json!({
        "tools": []
    }))
}

fn handle_resources_list() -> Result<Value, JsonRpcError> {
    Ok(json!({
        "resources": []
    }))
}

fn handle_prompts_list() -> Result<Value, JsonRpcError> {
    Ok(json!({
        "prompts": []
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ping() {
        let result = handle_ping();
        assert!(result.is_ok());
    }
}
