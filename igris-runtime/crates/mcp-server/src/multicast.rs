use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::interval;
use tracing::{info, warn};

use crate::discovery::PeerInfo;

const MULTICAST_ADDR: Ipv4Addr = Ipv4Addr::new(239, 255, 42, 99);
const MULTICAST_PORT: u16 = 42099;
const BEACON_INTERVAL_SECS: u64 = 10;

/// UDP Multicast fallback for peer discovery
#[derive(Clone)]
pub struct MulticastDiscovery {
    peers: Arc<RwLock<Vec<PeerInfo>>>,
    local_peer_id: String,
    local_port: u16,
}

#[derive(Debug, Serialize, Deserialize)]
struct BeaconMessage {
    peer_id: String,
    port: u16,
    timestamp: u64,
}

impl MulticastDiscovery {
    pub fn new(local_peer_id: String, local_port: u16) -> Self {
        Self {
            peers: Arc::new(RwLock::new(Vec::new())),
            local_peer_id,
            local_port,
        }
    }

    /// Start multicast discovery (send beacons + listen)
    pub async fn start(self: Arc<Self>) -> Result<()> {
        info!(
            "Starting UDP multicast fallback (peer_id={}, port={})",
            self.local_peer_id, self.local_port
        );

        // Start beacon sender
        let sender_handle = self.clone();
        tokio::spawn(async move {
            if let Err(e) = sender_handle.beacon_loop().await {
                warn!("Beacon sender error: {}", e);
            }
        });

        // Start beacon listener
        let listener_handle = self.clone();
        tokio::spawn(async move {
            if let Err(e) = listener_handle.listen_loop().await {
                warn!("Beacon listener error: {}", e);
            }
        });

        Ok(())
    }

    /// Send beacons periodically
    async fn beacon_loop(&self) -> Result<()> {
        let socket = UdpSocket::bind("0.0.0.0:0")?;
        socket.set_multicast_ttl_v4(2)?;

        let mut tick = interval(Duration::from_secs(BEACON_INTERVAL_SECS));

        loop {
            tick.tick().await;

            let beacon = BeaconMessage {
                peer_id: self.local_peer_id.clone(),
                port: self.local_port,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            };

            let data = serde_json::to_vec(&beacon)?;
            let dest = SocketAddr::new(IpAddr::V4(MULTICAST_ADDR), MULTICAST_PORT);

            if let Err(e) = socket.send_to(&data, dest) {
                warn!("Failed to send beacon: {}", e);
            }
        }
    }

    /// Listen for beacons from other peers
    async fn listen_loop(&self) -> Result<()> {
        let socket = UdpSocket::bind(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            MULTICAST_PORT,
        ))?;

        socket.set_read_timeout(Some(Duration::from_secs(1)))?;
        socket.join_multicast_v4(&MULTICAST_ADDR, &Ipv4Addr::UNSPECIFIED)?;

        info!("Listening for multicast beacons on {}", MULTICAST_PORT);

        let mut buf = [0u8; 1024];

        loop {
            match socket.recv_from(&mut buf) {
                Ok((len, src_addr)) => {
                    if let Ok(beacon) = serde_json::from_slice::<BeaconMessage>(&buf[..len]) {
                        self.handle_beacon(beacon, src_addr).await;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // Timeout - expected behavior
                    tokio::task::yield_now().await;
                }
                Err(e) => {
                    warn!("Multicast receive error: {}", e);
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }

    /// Handle received beacon
    async fn handle_beacon(&self, beacon: BeaconMessage, src_addr: SocketAddr) {
        // Ignore own beacons
        if beacon.peer_id == self.local_peer_id {
            return;
        }

        let peer_ip = match src_addr.ip() {
            IpAddr::V4(ip) => ip,
            _ => return,
        };

        let peer = PeerInfo {
            peer_id: beacon.peer_id.clone(),
            addr: SocketAddr::new(IpAddr::V4(peer_ip), beacon.port),
            last_seen: beacon.timestamp,
        };

        self.add_or_update_peer(peer).await;
    }

    /// Add or update peer
    async fn add_or_update_peer(&self, peer: PeerInfo) {
        let mut peers = self.peers.write().await;

        if let Some(existing) = peers.iter_mut().find(|p| p.peer_id == peer.peer_id) {
            existing.addr = peer.addr;
            existing.last_seen = peer.last_seen;
        } else {
            info!(
                "Discovered peer via multicast: {} at {}",
                peer.peer_id, peer.addr
            );
            peers.push(peer);
        }
    }

    /// Get all known peers
    pub async fn get_peers(&self) -> Vec<PeerInfo> {
        let mut peers = self.peers.read().await.clone();

        // Filter stale peers (not seen in 60s)
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        peers.retain(|p| now - p.last_seen < 60);

        peers
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multicast_creation() {
        let discovery = MulticastDiscovery::new("test-peer".to_string(), 8080);
        assert_eq!(discovery.local_peer_id, "test-peer");
        assert_eq!(discovery.local_port, 8080);
    }

    #[tokio::test]
    async fn test_beacon_serialization() {
        let beacon = BeaconMessage {
            peer_id: "test".to_string(),
            port: 8080,
            timestamp: 12345,
        };

        let data = serde_json::to_vec(&beacon).unwrap();
        let parsed: BeaconMessage = serde_json::from_slice(&data).unwrap();

        assert_eq!(parsed.peer_id, "test");
        assert_eq!(parsed.port, 8080);
    }
}
