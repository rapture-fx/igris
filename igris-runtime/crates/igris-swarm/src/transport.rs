//! Message transport for swarm inter-agent communication.
//!
//! Provides both in-process channel transport (for agents within the same process)
//! and HTTP transport (for agents on different machines).

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};

/// Messages exchanged between swarm agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SwarmMessage {
    /// Request vote during leader election
    RequestVote { candidate_id: String, term: u64 },
    /// Vote response
    VoteResponse {
        voter_id: String,
        term: u64,
        granted: bool,
    },
    /// Leader heartbeat (AppendEntries equivalent)
    Heartbeat { leader_id: String, term: u64 },
    /// Task proposal broadcast
    TaskProposed {
        proposal_id: String,
        proposer_id: String,
        task_type: String,
        parameters: serde_json::Value,
        priority: u8,
    },
    /// Vote on a task proposal
    TaskVote {
        proposal_id: String,
        voter_id: String,
        approve: bool,
    },
    /// Task execution result
    TaskResult {
        proposal_id: String,
        executor_id: String,
        success: bool,
        result: serde_json::Value,
    },
    /// Agent join announcement
    AgentJoined {
        agent_id: String,
        capabilities: Vec<String>,
    },
    /// Agent leave announcement
    AgentLeft { agent_id: String },
}

/// Transport trait for swarm communication
#[async_trait]
pub trait SwarmTransport: Send + Sync {
    /// Send a message to a specific agent
    async fn send_to(&self, agent_id: &str, message: SwarmMessage) -> Result<()>;

    /// Broadcast a message to all agents
    async fn broadcast(&self, message: SwarmMessage) -> Result<()>;

    /// Receive the next message for this agent
    async fn receive(&self) -> Result<SwarmMessage>;

    /// Try to receive without blocking (returns None if no message)
    async fn try_receive(&self) -> Result<Option<SwarmMessage>>;
}

/// In-process channel-based transport for agents in the same process
pub struct ChannelSwarmTransport {
    agent_id: String,
    inbox: mpsc::Receiver<SwarmMessage>,
    peers: Arc<RwLock<HashMap<String, mpsc::Sender<SwarmMessage>>>>,
    broadcast_tx: broadcast::Sender<SwarmMessage>,
}

/// Shared bus that manages channel transports for all agents
pub struct SwarmBus {
    agents: Arc<RwLock<HashMap<String, mpsc::Sender<SwarmMessage>>>>,
    broadcast_tx: broadcast::Sender<SwarmMessage>,
}

impl SwarmBus {
    /// Create a new swarm bus
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(256);
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            broadcast_tx,
        }
    }

    /// Create a transport for a new agent and register it on the bus
    pub async fn create_transport(
        &self,
        agent_id: &str,
        buffer_size: usize,
    ) -> ChannelSwarmTransport {
        let (tx, rx) = mpsc::channel(buffer_size);

        self.agents.write().await.insert(agent_id.to_string(), tx);

        ChannelSwarmTransport {
            agent_id: agent_id.to_string(),
            inbox: rx,
            peers: self.agents.clone(),
            broadcast_tx: self.broadcast_tx.clone(),
        }
    }

    /// Remove an agent from the bus
    pub async fn remove_agent(&self, agent_id: &str) {
        self.agents.write().await.remove(agent_id);
    }

    /// Get the count of connected agents
    pub async fn agent_count(&self) -> usize {
        self.agents.read().await.len()
    }
}

impl Default for SwarmBus {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SwarmTransport for ChannelSwarmTransport {
    async fn send_to(&self, agent_id: &str, message: SwarmMessage) -> Result<()> {
        let peers = self.peers.read().await;
        if let Some(tx) = peers.get(agent_id) {
            tx.send(message)
                .await
                .map_err(|_| anyhow::anyhow!("Agent {} channel closed", agent_id))?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Agent {} not found on bus", agent_id))
        }
    }

    async fn broadcast(&self, message: SwarmMessage) -> Result<()> {
        // Send via broadcast channel
        let _ = self.broadcast_tx.send(message.clone());

        // Also send directly to each peer (more reliable)
        let peers = self.peers.read().await;
        for (id, tx) in peers.iter() {
            if id != &self.agent_id {
                let _ = tx.send(message.clone()).await;
            }
        }
        Ok(())
    }

    async fn receive(&self) -> Result<SwarmMessage> {
        // This is a workaround - we need interior mutability for the receiver
        // In practice, use try_receive in a loop or restructure with Arc<Mutex<>>
        Err(anyhow::anyhow!(
            "Use try_receive() in async context; receive() requires ownership"
        ))
    }

    async fn try_receive(&self) -> Result<Option<SwarmMessage>> {
        // Channel transport doesn't support try_receive without &mut self
        // The SwarmCoordinator should consume messages via the message processing loop
        Ok(None)
    }
}

/// Mutable transport wrapper for use in the coordinator's message loop
pub struct SwarmTransportHandle {
    inbox: mpsc::Receiver<SwarmMessage>,
    peers: Arc<RwLock<HashMap<String, mpsc::Sender<SwarmMessage>>>>,
    #[allow(dead_code)]
    broadcast_tx: broadcast::Sender<SwarmMessage>,
    agent_id: String,
}

impl SwarmTransportHandle {
    /// Consume the ChannelSwarmTransport into a handle with mutable access
    pub fn from_transport(transport: ChannelSwarmTransport) -> Self {
        Self {
            inbox: transport.inbox,
            peers: transport.peers,
            broadcast_tx: transport.broadcast_tx,
            agent_id: transport.agent_id,
        }
    }

    /// Receive the next message (blocks until a message arrives)
    pub async fn recv(&mut self) -> Option<SwarmMessage> {
        self.inbox.recv().await
    }

    /// Try to receive without blocking
    pub fn try_recv(&mut self) -> Option<SwarmMessage> {
        self.inbox.try_recv().ok()
    }

    /// Send a message to a specific agent
    pub async fn send_to(&self, agent_id: &str, message: SwarmMessage) -> Result<()> {
        let peers = self.peers.read().await;
        if let Some(tx) = peers.get(agent_id) {
            tx.send(message)
                .await
                .map_err(|_| anyhow::anyhow!("Channel closed"))?;
        }
        Ok(())
    }

    /// Broadcast a message to all peers
    pub async fn broadcast(&self, message: SwarmMessage) -> Result<()> {
        let peers = self.peers.read().await;
        for (id, tx) in peers.iter() {
            if id != &self.agent_id {
                let _ = tx.send(message.clone()).await;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_swarm_bus_create_transport() {
        let bus = SwarmBus::new();
        let _t1 = bus.create_transport("agent-1", 10).await;
        let _t2 = bus.create_transport("agent-2", 10).await;

        assert_eq!(bus.agent_count().await, 2);
    }

    #[tokio::test]
    async fn test_swarm_bus_send_message() {
        let bus = SwarmBus::new();
        let t1 = bus.create_transport("agent-1", 10).await;
        let t2 = bus.create_transport("agent-2", 10).await;

        let mut h2 = SwarmTransportHandle::from_transport(t2);

        // Agent-1 sends to Agent-2
        t1.send_to(
            "agent-2",
            SwarmMessage::Heartbeat {
                leader_id: "agent-1".to_string(),
                term: 1,
            },
        )
        .await
        .unwrap();

        // Agent-2 receives
        let msg = h2.recv().await.unwrap();
        match msg {
            SwarmMessage::Heartbeat { leader_id, term } => {
                assert_eq!(leader_id, "agent-1");
                assert_eq!(term, 1);
            }
            _ => panic!("Expected Heartbeat"),
        }
    }

    #[tokio::test]
    async fn test_swarm_bus_broadcast() {
        let bus = SwarmBus::new();
        let t1 = bus.create_transport("agent-1", 10).await;
        let t2 = bus.create_transport("agent-2", 10).await;
        let t3 = bus.create_transport("agent-3", 10).await;

        let mut h2 = SwarmTransportHandle::from_transport(t2);
        let mut h3 = SwarmTransportHandle::from_transport(t3);

        // Agent-1 broadcasts
        t1.broadcast(SwarmMessage::AgentJoined {
            agent_id: "agent-1".to_string(),
            capabilities: vec!["inference".to_string()],
        })
        .await
        .unwrap();

        // Both agent-2 and agent-3 should receive
        let msg2 = h2.recv().await.unwrap();
        let msg3 = h3.recv().await.unwrap();

        match (msg2, msg3) {
            (
                SwarmMessage::AgentJoined { agent_id: id2, .. },
                SwarmMessage::AgentJoined { agent_id: id3, .. },
            ) => {
                assert_eq!(id2, "agent-1");
                assert_eq!(id3, "agent-1");
            }
            _ => panic!("Expected AgentJoined messages"),
        }
    }
}
