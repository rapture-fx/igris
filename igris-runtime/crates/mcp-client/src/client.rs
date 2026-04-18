use anyhow::Result;
use reqwest::Client;
use serde_json::Value;
use std::time::Duration;
use tracing::{info, warn};

use igris_mcp_server::protocol::{
    InitializeResult, JsonRpcRequest, JsonRpcResponse, SharedContextEnvelope,
};

/// MCP Client for communicating with peer Igris Runtime instances
#[derive(Clone)]
pub struct McpClient {
    http_client: Client,
    #[allow(dead_code)]
    peer_id: String,
}

impl McpClient {
    pub fn new(peer_id: String) -> Self {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap();

        Self {
            http_client,
            peer_id,
        }
    }

    /// Initialize connection with a peer
    pub async fn initialize(
        &self,
        peer_url: &str,
        capabilities: Value,
    ) -> Result<InitializeResult> {
        info!("Initializing MCP connection to {}", peer_url);

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(1)),
            method: "initialize".to_string(),
            params: Some(capabilities),
        };

        let response: JsonRpcResponse = self.send_request(peer_url, request).await?;

        let result: InitializeResult = serde_json::from_value(response.result)?;
        Ok(result)
    }

    /// Ping a peer
    pub async fn ping(&self, peer_url: &str) -> Result<()> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(uuid::Uuid::new_v4().to_string())),
            method: "ping".to_string(),
            params: None,
        };

        self.send_request(peer_url, request).await?;
        Ok(())
    }

    /// Sync context with a peer
    pub async fn sync_context(
        &self,
        peer_url: &str,
        envelope: SharedContextEnvelope,
    ) -> Result<()> {
        info!(
            "Syncing context {} to peer {}",
            envelope.conversation_id, peer_url
        );

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(uuid::Uuid::new_v4().to_string())),
            method: "context/sync".to_string(),
            params: Some(serde_json::to_value(envelope)?),
        };

        self.send_request(peer_url, request).await?;
        info!("Context synced successfully");
        Ok(())
    }

    /// Get context from a peer
    pub async fn get_context(
        &self,
        peer_url: &str,
        conversation_id: &str,
    ) -> Result<Option<Value>> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(uuid::Uuid::new_v4().to_string())),
            method: "context/get".to_string(),
            params: Some(serde_json::json!({
                "conversation_id": conversation_id
            })),
        };

        let response: JsonRpcResponse = self.send_request(peer_url, request).await?;
        Ok(Some(response.result))
    }

    /// List all contexts from a peer
    pub async fn list_contexts(&self, peer_url: &str) -> Result<Vec<String>> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(uuid::Uuid::new_v4().to_string())),
            method: "context/list".to_string(),
            params: None,
        };

        let response: JsonRpcResponse = self.send_request(peer_url, request).await?;
        let contexts: Vec<String> = serde_json::from_value(
            response
                .result
                .get("contexts")
                .cloned()
                .unwrap_or(serde_json::json!([])),
        )?;
        Ok(contexts)
    }

    /// Send JSON-RPC request to peer
    async fn send_request(
        &self,
        peer_url: &str,
        request: JsonRpcRequest,
    ) -> Result<JsonRpcResponse> {
        let url = format!("{}/mcp", peer_url);

        let response = self.http_client.post(&url).json(&request).send().await?;

        if !response.status().is_success() {
            anyhow::bail!("Peer returned error: {}", response.status());
        }

        let json_response: JsonRpcResponse = response.json().await?;
        Ok(json_response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = McpClient::new("test-peer".to_string());
        assert_eq!(client.peer_id, "test-peer");
    }
}
