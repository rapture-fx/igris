//! Transport abstractions for federated learning.
//!
//! Provides both in-process channel transport (for testing and single-node)
//! and HTTP transport (for multi-device federated learning).

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::debug;

use crate::{GlobalModel, ModelUpdate};

/// Messages exchanged between participants and coordinator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FederatedMessage {
    /// Participant submits a model update
    SubmitUpdate(ModelUpdate),
    /// Coordinator broadcasts aggregated global model
    GlobalModelReady(GlobalModel),
    /// Request to join the federated round
    JoinRound { participant_id: String, round: u64 },
    /// Acknowledgment of round join
    RoundJoined { round: u64 },
    /// Request current global model
    RequestGlobalModel,
    /// Status query
    StatusRequest,
    /// Status response
    StatusResponse(FederatedStatus),
}

/// Federated learning status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederatedStatus {
    pub current_round: u64,
    pub pending_updates: usize,
    pub total_participants: usize,
    pub min_participants: usize,
    pub ready_to_aggregate: bool,
    pub latest_model_round: Option<u64>,
}

/// Transport trait for sending/receiving federated messages
#[async_trait]
pub trait FederatedTransport: Send + Sync {
    /// Send an update to the coordinator
    async fn send_update(&self, update: ModelUpdate) -> Result<()>;

    /// Receive the latest global model from the coordinator
    async fn receive_global_model(&self) -> Result<Option<GlobalModel>>;

    /// Get coordinator status
    async fn get_status(&self) -> Result<FederatedStatus>;
}

/// In-process channel-based transport (for testing and single-node deployment)
pub struct ChannelTransport {
    update_tx: mpsc::Sender<ModelUpdate>,
    model_rx: Arc<RwLock<Option<GlobalModel>>>,
    status: Arc<RwLock<FederatedStatus>>,
}

/// Coordinator-side handle for the channel transport
pub struct ChannelCoordinatorHandle {
    update_rx: mpsc::Receiver<ModelUpdate>,
    model_broadcast: Arc<RwLock<Option<GlobalModel>>>,
    status: Arc<RwLock<FederatedStatus>>,
}

/// Create a linked pair of channel transport and coordinator handle
pub fn create_channel_transport(
    buffer_size: usize,
) -> (ChannelTransport, ChannelCoordinatorHandle) {
    let (tx, rx) = mpsc::channel(buffer_size);
    let model = Arc::new(RwLock::new(None));
    let status = Arc::new(RwLock::new(FederatedStatus {
        current_round: 0,
        pending_updates: 0,
        total_participants: 0,
        min_participants: 3,
        ready_to_aggregate: false,
        latest_model_round: None,
    }));

    let transport = ChannelTransport {
        update_tx: tx,
        model_rx: model.clone(),
        status: status.clone(),
    };

    let handle = ChannelCoordinatorHandle {
        update_rx: rx,
        model_broadcast: model,
        status,
    };

    (transport, handle)
}

#[async_trait]
impl FederatedTransport for ChannelTransport {
    async fn send_update(&self, update: ModelUpdate) -> Result<()> {
        self.update_tx
            .send(update)
            .await
            .map_err(|_| anyhow::anyhow!("Channel closed"))?;
        Ok(())
    }

    async fn receive_global_model(&self) -> Result<Option<GlobalModel>> {
        Ok(self.model_rx.read().await.clone())
    }

    async fn get_status(&self) -> Result<FederatedStatus> {
        Ok(self.status.read().await.clone())
    }
}

impl ChannelCoordinatorHandle {
    /// Receive the next update from a participant
    pub async fn recv_update(&mut self) -> Option<ModelUpdate> {
        self.update_rx.recv().await
    }

    /// Try to receive an update without blocking
    pub fn try_recv_update(&mut self) -> Option<ModelUpdate> {
        self.update_rx.try_recv().ok()
    }

    /// Broadcast a new global model to all participants
    pub async fn broadcast_model(&self, model: GlobalModel) {
        let mut m = self.model_broadcast.write().await;
        *m = Some(model);
    }

    /// Update the coordinator status
    pub async fn update_status(&self, status: FederatedStatus) {
        let mut s = self.status.write().await;
        *s = status;
    }
}

/// HTTP-based transport for multi-device federated learning
pub struct HttpTransport {
    coordinator_url: String,
    #[allow(dead_code)]
    participant_id: String,
    client: reqwest::Client,
}

impl HttpTransport {
    pub fn new(coordinator_url: &str, participant_id: &str) -> Self {
        Self {
            coordinator_url: coordinator_url.trim_end_matches('/').to_string(),
            participant_id: participant_id.to_string(),
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl FederatedTransport for HttpTransport {
    async fn send_update(&self, update: ModelUpdate) -> Result<()> {
        let url = format!("{}/v1/federated/update", self.coordinator_url);

        let response = self.client.post(&url).json(&update).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to submit update: {} - {}",
                status,
                body
            ));
        }

        debug!("Submitted update for round {}", update.round);
        Ok(())
    }

    async fn receive_global_model(&self) -> Result<Option<GlobalModel>> {
        let url = format!("{}/v1/federated/model/latest", self.coordinator_url);

        let response = self.client.get(&url).send().await?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to fetch global model: {} - {}",
                status,
                body
            ));
        }

        let model: GlobalModel = response.json().await?;
        Ok(Some(model))
    }

    async fn get_status(&self) -> Result<FederatedStatus> {
        let url = format!("{}/v1/federated/status", self.coordinator_url);

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to fetch status: {}",
                response.status()
            ));
        }

        let status: FederatedStatus = response.json().await?;
        Ok(status)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_channel_transport_roundtrip() {
        let (transport, mut handle) = create_channel_transport(10);

        // Send update
        let mut weights = HashMap::new();
        weights.insert("layer1".to_string(), vec![1.0, 2.0, 3.0]);

        let update = ModelUpdate {
            participant_id: "agent-1".to_string(),
            round: 0,
            weights,
            num_samples: 100,
            loss: 0.5,
            timestamp: 1234567890,
        };

        transport.send_update(update.clone()).await.unwrap();

        // Receive update on coordinator side
        let received = handle.recv_update().await.unwrap();
        assert_eq!(received.participant_id, "agent-1");
        assert_eq!(received.num_samples, 100);
    }

    #[tokio::test]
    async fn test_channel_transport_global_model() {
        let (transport, handle) = create_channel_transport(10);

        // Initially no model
        let model = transport.receive_global_model().await.unwrap();
        assert!(model.is_none());

        // Broadcast model
        let mut weights = HashMap::new();
        weights.insert("layer1".to_string(), vec![1.0, 2.0]);

        let global_model = GlobalModel {
            round: 1,
            weights,
            num_participants: 3,
            average_loss: 0.4,
            timestamp: 1234567890,
        };

        handle.broadcast_model(global_model).await;

        // Now should be available
        let model = transport.receive_global_model().await.unwrap();
        assert!(model.is_some());
        assert_eq!(model.unwrap().round, 1);
    }

    #[tokio::test]
    async fn test_channel_transport_status() {
        let (transport, handle) = create_channel_transport(10);

        let status = transport.get_status().await.unwrap();
        assert_eq!(status.current_round, 0);

        handle
            .update_status(FederatedStatus {
                current_round: 5,
                pending_updates: 2,
                total_participants: 4,
                min_participants: 3,
                ready_to_aggregate: false,
                latest_model_round: Some(4),
            })
            .await;

        let status = transport.get_status().await.unwrap();
        assert_eq!(status.current_round, 5);
        assert_eq!(status.pending_updates, 2);
    }
}
