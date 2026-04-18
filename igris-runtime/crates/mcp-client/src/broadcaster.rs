use anyhow::Result;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{info, warn};

use igris_mcp_server::context::ContextStore;
use igris_mcp_server::discovery::{PeerDiscovery, PeerInfo};

use crate::client::McpClient;

/// Context Broadcaster - syncs context to all discovered peers
pub struct ContextBroadcaster {
    client: Arc<McpClient>,
    context_store: Arc<ContextStore>,
    discovery: Arc<PeerDiscovery>,
    peer_id: String,
}

impl ContextBroadcaster {
    pub fn new(
        client: Arc<McpClient>,
        context_store: Arc<ContextStore>,
        discovery: Arc<PeerDiscovery>,
        peer_id: String,
    ) -> Self {
        Self {
            client,
            context_store,
            discovery,
            peer_id,
        }
    }

    /// Start broadcasting context to peers every 10 seconds
    pub async fn start(self: Arc<Self>) {
        info!("Starting context broadcaster (peer_id={})", self.peer_id);

        let mut tick = interval(Duration::from_secs(10));

        loop {
            tick.tick().await;

            if let Err(e) = self.broadcast_to_all_peers().await {
                warn!("Broadcast error: {}", e);
            }
        }
    }

    /// Broadcast all contexts to all known peers
    async fn broadcast_to_all_peers(&self) -> Result<()> {
        let peers = self.discovery.get_peers().await;

        if peers.is_empty() {
            return Ok(());
        }

        info!("Broadcasting context to {} peers", peers.len());

        let contexts = self.context_store.get_all_contexts().await?;

        for peer in peers {
            self.broadcast_to_peer(&peer, &contexts).await;
        }

        Ok(())
    }

    /// Broadcast contexts to a specific peer
    async fn broadcast_to_peer(
        &self,
        peer: &PeerInfo,
        contexts: &[igris_mcp_server::context::SharedContext],
    ) {
        let peer_url = format!("http://{}", peer.addr);

        for context in contexts {
            let envelope = context.to_envelope(self.peer_id.clone());

            if let Err(e) = self.client.sync_context(&peer_url, envelope).await {
                warn!(
                    "Failed to sync context {} to peer {}: {}",
                    context.conversation_id, peer.peer_id, e
                );
            }
        }
    }

    /// Pull context from all peers (on-demand sync)
    pub async fn pull_from_all_peers(&self) -> Result<()> {
        let peers = self.discovery.get_peers().await;

        if peers.is_empty() {
            return Ok(());
        }

        info!("Pulling context from {} peers", peers.len());

        for peer in peers {
            if let Err(e) = self.pull_from_peer(&peer).await {
                warn!("Failed to pull from peer {}: {}", peer.peer_id, e);
            }
        }

        Ok(())
    }

    /// Pull all contexts from a specific peer
    async fn pull_from_peer(&self, peer: &PeerInfo) -> Result<()> {
        let peer_url = format!("http://{}", peer.addr);

        let context_ids = self.client.list_contexts(&peer_url).await?;

        for id in context_ids {
            if let Ok(Some(context_value)) = self.client.get_context(&peer_url, &id).await {
                // Parse and sync to local store
                if let Ok(envelope) = serde_json::from_value(context_value) {
                    self.context_store.sync_context(envelope).await?;
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_broadcaster_creation() {
        let client = Arc::new(McpClient::new("test".to_string()));
        let store = Arc::new(ContextStore::new());
        let discovery = Arc::new(PeerDiscovery::new("test".to_string(), 8080).unwrap());

        let broadcaster =
            ContextBroadcaster::new(client, store, discovery, "test-peer".to_string());

        assert_eq!(broadcaster.peer_id, "test-peer");
    }
}
