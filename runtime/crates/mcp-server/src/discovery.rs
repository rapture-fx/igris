use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

/// Peer Discovery Manager (placeholder - full mDNS in next commit)
#[derive(Clone)]
pub struct PeerDiscovery {
    peers: Arc<RwLock<Vec<PeerInfo>>>,
    local_peer_id: String,
}

#[derive(Debug, Clone)]
pub struct PeerInfo {
    pub peer_id: String,
    pub addr: SocketAddr,
    pub last_seen: u64,
}

impl PeerDiscovery {
    pub fn new(local_peer_id: String) -> Self {
        Self {
            peers: Arc::new(RwLock::new(Vec::new())),
            local_peer_id,
        }
    }

    /// Start discovery service (placeholder)
    pub async fn start(&self) -> anyhow::Result<()> {
        info!("Peer discovery initialized (peer_id={})", self.local_peer_id);
        info!("Full mDNS implementation in next commit");
        Ok(())
    }

    /// Get all known peers
    pub async fn get_peers(&self) -> Vec<PeerInfo> {
        self.peers.read().await.clone()
    }

    /// Manually add a peer (for testing)
    pub async fn add_peer(&self, peer: PeerInfo) {
        let mut peers = self.peers.write().await;
        peers.push(peer);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_peer_discovery() {
        let discovery = PeerDiscovery::new("test-peer".to_string());
        discovery.start().await.unwrap();

        let peers = discovery.get_peers().await;
        assert_eq!(peers.len(), 0);
    }
}
