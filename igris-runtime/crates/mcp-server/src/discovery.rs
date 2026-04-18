use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::sleep;
use tracing::{error, info, warn};

use crate::multicast::MulticastDiscovery;

const SERVICE_TYPE: &str = "_igris-mcp._tcp.local.";
const DISCOVERY_INTERVAL_SECS: u64 = 5;

/// Peer Discovery Manager with mDNS + UDP multicast fallback
#[derive(Clone)]
pub struct PeerDiscovery {
    peers: Arc<RwLock<Vec<PeerInfo>>>,
    local_peer_id: String,
    local_port: u16,
    mdns: Arc<ServiceDaemon>,
    multicast: Arc<MulticastDiscovery>,
}

#[derive(Debug, Clone)]
pub struct PeerInfo {
    pub peer_id: String,
    pub addr: SocketAddr,
    pub last_seen: u64,
}

impl PeerDiscovery {
    pub fn new(local_peer_id: String, local_port: u16) -> anyhow::Result<Self> {
        let mdns = ServiceDaemon::new()?;
        let multicast = MulticastDiscovery::new(local_peer_id.clone(), local_port);

        Ok(Self {
            peers: Arc::new(RwLock::new(Vec::new())),
            local_peer_id,
            local_port,
            mdns: Arc::new(mdns),
            multicast: Arc::new(multicast),
        })
    }

    /// Start mDNS + multicast discovery and announcement
    pub async fn start(self: Arc<Self>) -> anyhow::Result<()> {
        info!(
            "Starting hybrid peer discovery (mDNS + multicast) (peer_id={}, port={})",
            self.local_peer_id, self.local_port
        );

        // Register mDNS service
        self.register_service().await?;

        // Start mDNS discovery loop
        let discovery_handle = self.clone();
        tokio::spawn(async move {
            discovery_handle.discovery_loop().await;
        });

        // Start multicast fallback
        self.multicast.clone().start().await?;

        Ok(())
    }

    /// Register this instance as a discoverable service
    async fn register_service(&self) -> anyhow::Result<()> {
        let service_hostname = format!("{}.local.", self.local_peer_id);

        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            &self.local_peer_id,
            &service_hostname,
            (),
            self.local_port,
            None,
        )?;

        self.mdns.register(service_info)?;

        info!(
            "Registered mDNS service: {} on port {}",
            self.local_peer_id, self.local_port
        );

        Ok(())
    }

    /// Continuous discovery loop
    async fn discovery_loop(&self) {
        loop {
            if let Err(e) = self.discover_peers().await {
                warn!("Discovery error: {}", e);
            }

            sleep(Duration::from_secs(DISCOVERY_INTERVAL_SECS)).await;
        }
    }

    /// Discover peers via mDNS
    async fn discover_peers(&self) -> anyhow::Result<()> {
        let browse_receiver = self.mdns.browse(SERVICE_TYPE)?;

        // Collect events for a short duration
        let timeout = tokio::time::sleep(Duration::from_secs(2));
        tokio::pin!(timeout);

        loop {
            tokio::select! {
                _ = &mut timeout => break,
                event = browse_receiver.recv_async() => {
                    match event {
                        Ok(event) => {
                            use mdns_sd::ServiceEvent::*;
                            match event {
                                ServiceResolved(info) => {
                                    self.handle_discovered_peer(info).await;
                                }
                                ServiceRemoved(_, fullname) => {
                                    info!("Peer removed: {}", fullname);
                                    self.remove_peer_by_name(&fullname).await;
                                }
                                _ => {}
                            }
                        }
                        Err(e) => {
                            error!("mDNS receiver error: {}", e);
                            break;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Handle a discovered peer
    async fn handle_discovered_peer(&self, info: ServiceInfo) {
        let peer_id = info
            .get_fullname()
            .split('.')
            .next()
            .unwrap_or("unknown")
            .to_string();

        // Don't add ourselves
        if peer_id == self.local_peer_id {
            return;
        }

        // Get first IPv4 address
        if let Some(ipv4) = info.get_addresses_v4().iter().next() {
            let addr = SocketAddr::new(IpAddr::V4(**ipv4), info.get_port());
            let peer = PeerInfo {
                peer_id: peer_id.clone(),
                addr,
                last_seen: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            };

            self.add_or_update_peer(peer).await;
            info!("Discovered peer: {} at {}", peer_id, addr);
        }
    }

    /// Add or update a peer
    async fn add_or_update_peer(&self, peer: PeerInfo) {
        let mut peers = self.peers.write().await;

        if let Some(existing) = peers.iter_mut().find(|p| p.peer_id == peer.peer_id) {
            existing.addr = peer.addr;
            existing.last_seen = peer.last_seen;
        } else {
            peers.push(peer);
        }
    }

    /// Remove peer by service name
    async fn remove_peer_by_name(&self, fullname: &str) {
        let peer_id = fullname.split('.').next().unwrap_or("").to_string();
        let mut peers = self.peers.write().await;
        peers.retain(|p| p.peer_id != peer_id);
    }

    /// Get all known peers (merged from mDNS and multicast)
    pub async fn get_peers(&self) -> Vec<PeerInfo> {
        let mut peers = self.peers.read().await.clone();

        // Merge multicast-discovered peers
        let multicast_peers = self.multicast.get_peers().await;
        for mp in multicast_peers {
            if !peers.iter().any(|p| p.peer_id == mp.peer_id) {
                peers.push(mp);
            }
        }

        // Filter out stale peers (not seen in 60 seconds)
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        peers.retain(|p| now - p.last_seen < 60);

        peers
    }

    /// Manually add a peer (for testing/fallback)
    pub async fn add_peer(&self, peer: PeerInfo) {
        let mut peers = self.peers.write().await;
        peers.push(peer);
    }

    /// Shutdown and unregister
    pub async fn shutdown(&self) -> anyhow::Result<()> {
        info!("Shutting down peer discovery");
        self.mdns.shutdown()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_peer_discovery_creation() {
        let discovery = PeerDiscovery::new("test-peer".to_string(), 8080);
        assert!(discovery.is_ok());

        let discovery = discovery.unwrap();
        assert_eq!(discovery.local_peer_id, "test-peer");
        assert_eq!(discovery.local_port, 8080);
    }

    #[tokio::test]
    async fn test_manual_peer_add() {
        let discovery = PeerDiscovery::new("test-peer".to_string(), 8080).unwrap();

        let peer = PeerInfo {
            peer_id: "peer-1".to_string(),
            addr: "127.0.0.1:8081".parse().unwrap(),
            last_seen: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        discovery.add_peer(peer).await;

        let peers = discovery.get_peers().await;
        assert_eq!(peers.len(), 1);
        assert_eq!(peers[0].peer_id, "peer-1");
    }
}
