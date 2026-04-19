//! Federated Learning integration for igris-server.
//!
//! Provides API endpoints for federated learning coordination:
//! - POST /v1/federated/update - Submit a model update
//! - GET  /v1/federated/model/latest - Get latest global model
//! - GET  /v1/federated/status - Get coordinator status

#![allow(dead_code)]

use anyhow::Result;
use igris_federated::{
    FederatedConfig, FederatedCoordinator, FederatedStatus, GlobalModel, ModelUpdate,
};
use std::sync::Arc;

/// Manages the federated learning lifecycle within the runtime server
pub struct FederatedManager {
    coordinator: Arc<FederatedCoordinator>,
}

impl FederatedManager {
    /// Initialize with persistence support
    pub async fn new(config: FederatedConfig, state_dir: &str) -> Result<Self> {
        let coordinator = FederatedCoordinator::with_persistence(config, state_dir).await?;
        Ok(Self {
            coordinator: Arc::new(coordinator),
        })
    }

    /// Initialize without persistence (in-memory only)
    pub async fn new_in_memory(config: FederatedConfig) -> Result<Self> {
        let coordinator = FederatedCoordinator::new(config).await?;
        Ok(Self {
            coordinator: Arc::new(coordinator),
        })
    }

    /// Submit a model update and auto-aggregate if threshold is met
    pub async fn submit_update(&self, update: ModelUpdate) -> Result<Option<GlobalModel>> {
        self.coordinator
            .submit_update_and_maybe_aggregate(update)
            .await
    }

    /// Get the latest global model
    pub async fn get_latest_model(&self) -> Option<GlobalModel> {
        self.coordinator.get_global_model().await
    }

    /// Get coordinator status
    pub async fn get_status(&self) -> FederatedStatus {
        self.coordinator.get_status().await
    }

    /// Get participant statistics
    pub async fn get_participants(&self) -> Vec<igris_federated::ParticipantInfo> {
        self.coordinator.get_participant_stats().await
    }

    /// Force aggregation (admin endpoint)
    pub async fn force_aggregate(&self) -> Result<GlobalModel> {
        self.coordinator.aggregate_updates().await
    }
}
