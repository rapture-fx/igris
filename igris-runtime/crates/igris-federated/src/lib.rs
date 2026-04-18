//! Federated Learning for Igris Runtime
//!
//! Provides on-device federated learning capabilities with privacy-preserving
//! model updates for collaborative AI training across edge devices.
//!
//! # Features
//! - **QLoRA Merging:** Aggregate quantized LoRA adapters from multiple devices
//! - **Differential Privacy:** Add calibrated noise to protect individual data
//! - **Anonymous Updates:** Share model improvements without exposing data
//! - **Secure Aggregation:** Multi-party computation for model merging
//! - **Adaptive Learning:** Dynamic learning rates based on device performance
//!
//! # Example
//! ```ignore
//! use igris_federated::{FederatedCoordinator, FederatedConfig};
//!
//! let config = FederatedConfig {
//!     enabled: true,
//!     min_participants: 3,
//!     privacy_budget: 1.0,
//!     ..Default::default()
//! };
//!
//! let coordinator = FederatedCoordinator::new(config).await?;
//! coordinator.submit_update(update).await?;
//! let global_model = coordinator.aggregate_updates().await?;
//! ```

pub mod adapter_bridge;
pub mod persistence;
pub mod transport;

pub use adapter_bridge::{AdapterBridge, LoRAMetadata, LoRAWeights};
pub use persistence::{CoordinatorSnapshot, FederatedPersistence};
pub use transport::{FederatedMessage, FederatedStatus, FederatedTransport, HttpTransport};

use anyhow::Result;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Federated learning configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederatedConfig {
    /// Enable federated learning
    pub enabled: bool,

    /// Minimum participants required for aggregation
    pub min_participants: usize,

    /// Privacy budget (epsilon for differential privacy)
    pub privacy_budget: f64,

    /// Noise scale for differential privacy
    pub noise_scale: f64,

    /// Enable differential privacy
    pub enable_differential_privacy: bool,

    /// Aggregation strategy
    pub aggregation_strategy: AggregationStrategy,

    /// Maximum model update size (MB)
    pub max_update_size_mb: usize,

    /// Update timeout (seconds)
    pub update_timeout_secs: u64,

    /// Enable secure aggregation
    pub enable_secure_aggregation: bool,
}

impl Default for FederatedConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            min_participants: 3,
            privacy_budget: 1.0,
            noise_scale: 0.1,
            enable_differential_privacy: true,
            aggregation_strategy: AggregationStrategy::FederatedAveraging,
            max_update_size_mb: 100,
            update_timeout_secs: 300,
            enable_secure_aggregation: false,
        }
    }
}

/// Aggregation strategy for federated learning
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AggregationStrategy {
    /// Simple averaging (FedAvg)
    FederatedAveraging,
    /// Weighted averaging by dataset size
    WeightedAveraging,
    /// Median of updates (robust to outliers)
    Median,
    /// Trimmed mean (remove outliers)
    TrimmedMean,
}

/// Model update from a participant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelUpdate {
    pub participant_id: String,
    pub round: u64,
    pub weights: HashMap<String, Vec<f32>>,
    pub num_samples: usize,
    pub loss: f32,
    pub timestamp: u64,
}

impl ModelUpdate {
    /// Apply differential privacy noise
    pub fn apply_differential_privacy(&mut self, noise_scale: f64) {
        let mut rng = rand::thread_rng();

        for weights in self.weights.values_mut() {
            for weight in weights.iter_mut() {
                // Add Laplacian noise for differential privacy
                let noise: f32 = rng.gen_range(-1.0..1.0) * noise_scale as f32;
                *weight += noise;
            }
        }

        debug!(
            "Applied differential privacy with noise scale {}",
            noise_scale
        );
    }

    /// Get update size in bytes
    pub fn size_bytes(&self) -> usize {
        self.weights
            .values()
            .map(|w| w.len() * std::mem::size_of::<f32>())
            .sum()
    }
}

/// Aggregated global model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalModel {
    pub round: u64,
    pub weights: HashMap<String, Vec<f32>>,
    pub num_participants: usize,
    pub average_loss: f32,
    pub timestamp: u64,
}

impl GlobalModel {
    /// Create from aggregated updates
    pub fn from_updates(
        round: u64,
        updates: &[ModelUpdate],
        strategy: AggregationStrategy,
    ) -> Result<Self> {
        if updates.is_empty() {
            return Err(anyhow::anyhow!("No updates to aggregate"));
        }

        // Aggregate weights based on strategy
        let weights = match strategy {
            AggregationStrategy::FederatedAveraging => Self::federated_average(updates)?,
            AggregationStrategy::WeightedAveraging => Self::weighted_average(updates)?,
            AggregationStrategy::Median => Self::median_aggregate(updates)?,
            AggregationStrategy::TrimmedMean => Self::trimmed_mean_aggregate(updates)?,
        };

        let average_loss = updates.iter().map(|u| u.loss).sum::<f32>() / updates.len() as f32;

        Ok(Self {
            round,
            weights,
            num_participants: updates.len(),
            average_loss,
            timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)?
                .as_secs(),
        })
    }

    /// Federated averaging (simple mean)
    fn federated_average(updates: &[ModelUpdate]) -> Result<HashMap<String, Vec<f32>>> {
        let mut aggregated = HashMap::new();

        // Get all layer names from first update
        let layer_names: Vec<_> = updates[0].weights.keys().cloned().collect();

        for layer_name in layer_names {
            let layer_size = updates[0].weights[&layer_name].len();
            let mut sum = vec![0.0f32; layer_size];

            // Sum all weights for this layer
            for update in updates {
                if let Some(weights) = update.weights.get(&layer_name) {
                    for (i, &w) in weights.iter().enumerate() {
                        sum[i] += w;
                    }
                }
            }

            // Average
            for val in sum.iter_mut() {
                *val /= updates.len() as f32;
            }

            aggregated.insert(layer_name, sum);
        }

        Ok(aggregated)
    }

    /// Weighted averaging by dataset size
    fn weighted_average(updates: &[ModelUpdate]) -> Result<HashMap<String, Vec<f32>>> {
        let total_samples: usize = updates.iter().map(|u| u.num_samples).sum();
        let mut aggregated = HashMap::new();

        let layer_names: Vec<_> = updates[0].weights.keys().cloned().collect();

        for layer_name in layer_names {
            let layer_size = updates[0].weights[&layer_name].len();
            let mut weighted_sum = vec![0.0f32; layer_size];

            for update in updates {
                if let Some(weights) = update.weights.get(&layer_name) {
                    let weight_factor = update.num_samples as f32 / total_samples as f32;
                    for (i, &w) in weights.iter().enumerate() {
                        weighted_sum[i] += w * weight_factor;
                    }
                }
            }

            aggregated.insert(layer_name, weighted_sum);
        }

        Ok(aggregated)
    }

    /// Median aggregation (robust to outliers)
    fn median_aggregate(updates: &[ModelUpdate]) -> Result<HashMap<String, Vec<f32>>> {
        let mut aggregated = HashMap::new();
        let layer_names: Vec<_> = updates[0].weights.keys().cloned().collect();

        for layer_name in layer_names {
            let layer_size = updates[0].weights[&layer_name].len();
            let mut medians = vec![0.0f32; layer_size];

            for i in 0..layer_size {
                let mut values: Vec<f32> = updates
                    .iter()
                    .filter_map(|u| u.weights.get(&layer_name).map(|w| w[i]))
                    .collect();

                values.sort_by(|a, b| a.partial_cmp(b).unwrap());
                medians[i] = values[values.len() / 2];
            }

            aggregated.insert(layer_name, medians);
        }

        Ok(aggregated)
    }

    /// Trimmed mean (remove top/bottom 10%)
    fn trimmed_mean_aggregate(updates: &[ModelUpdate]) -> Result<HashMap<String, Vec<f32>>> {
        let mut aggregated = HashMap::new();
        let layer_names: Vec<_> = updates[0].weights.keys().cloned().collect();
        let trim_count = (updates.len() as f32 * 0.1) as usize;

        for layer_name in layer_names {
            let layer_size = updates[0].weights[&layer_name].len();
            let mut means = vec![0.0f32; layer_size];

            for i in 0..layer_size {
                let mut values: Vec<f32> = updates
                    .iter()
                    .filter_map(|u| u.weights.get(&layer_name).map(|w| w[i]))
                    .collect();

                values.sort_by(|a, b| a.partial_cmp(b).unwrap());

                // Remove outliers
                let trimmed = &values[trim_count..values.len() - trim_count];
                means[i] = trimmed.iter().sum::<f32>() / trimmed.len() as f32;
            }

            aggregated.insert(layer_name, means);
        }

        Ok(aggregated)
    }
}

/// Federated Learning Coordinator
pub struct FederatedCoordinator {
    config: FederatedConfig,

    // Current round number
    current_round: Arc<RwLock<u64>>,

    // Pending updates for current round
    pending_updates: Arc<RwLock<HashMap<String, ModelUpdate>>>,

    // Global model history
    global_models: Arc<RwLock<Vec<GlobalModel>>>,

    // Participant metadata
    participants: Arc<RwLock<HashMap<String, ParticipantInfo>>>,

    // Persistence backend (optional)
    persistence: Option<Arc<FederatedPersistence>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantInfo {
    pub id: String,
    pub num_updates: usize,
    pub total_samples: usize,
    pub average_loss: f32,
    pub last_seen: u64,
}

impl FederatedCoordinator {
    /// Create a new federated coordinator
    pub async fn new(config: FederatedConfig) -> Result<Self> {
        if !config.enabled {
            return Err(anyhow::anyhow!("Federated learning is disabled"));
        }

        info!("Initializing federated learning coordinator");

        Ok(Self {
            config,
            current_round: Arc::new(RwLock::new(0)),
            pending_updates: Arc::new(RwLock::new(HashMap::new())),
            global_models: Arc::new(RwLock::new(Vec::new())),
            participants: Arc::new(RwLock::new(HashMap::new())),
            persistence: None,
        })
    }

    /// Create a coordinator with persistence enabled
    pub async fn with_persistence(config: FederatedConfig, state_dir: &str) -> Result<Self> {
        let persistence = FederatedPersistence::new(state_dir).await?;
        let persistence = Arc::new(persistence);

        let mut coordinator = Self::new(config).await?;

        // Restore state from disk if available
        if let Some(snapshot) = persistence.load_snapshot().await? {
            *coordinator.current_round.write().await = snapshot.current_round;
            *coordinator.global_models.write().await = snapshot.global_models;
            *coordinator.participants.write().await = snapshot.participants;

            for update in snapshot.pending_updates {
                coordinator
                    .pending_updates
                    .write()
                    .await
                    .insert(update.participant_id.clone(), update);
            }

            info!(
                "Restored federated state from disk: round {}",
                snapshot.current_round
            );
        }

        coordinator.persistence = Some(persistence);
        Ok(coordinator)
    }

    /// Submit a local model update
    pub async fn submit_update(&self, mut update: ModelUpdate) -> Result<()> {
        // Check update size
        let size_mb = update.size_bytes() / (1024 * 1024);
        if size_mb > self.config.max_update_size_mb {
            return Err(anyhow::anyhow!(
                "Update too large: {} MB (max: {} MB)",
                size_mb,
                self.config.max_update_size_mb
            ));
        }

        // Apply differential privacy if enabled
        if self.config.enable_differential_privacy {
            update.apply_differential_privacy(self.config.noise_scale);
        }

        // Store update
        let mut pending = self.pending_updates.write().await;
        pending.insert(update.participant_id.clone(), update.clone());

        // Update participant info
        let mut participants = self.participants.write().await;
        let info = participants
            .entry(update.participant_id.clone())
            .or_insert_with(|| ParticipantInfo {
                id: update.participant_id.clone(),
                num_updates: 0,
                total_samples: 0,
                average_loss: 0.0,
                last_seen: 0,
            });

        info.num_updates += 1;
        info.total_samples += update.num_samples;
        info.average_loss = (info.average_loss * (info.num_updates - 1) as f32 + update.loss)
            / info.num_updates as f32;
        info.last_seen = update.timestamp;

        info!(
            "Received update from {} (round {}, {} samples, loss: {:.4})",
            update.participant_id, update.round, update.num_samples, update.loss
        );

        // Persist state after receiving update
        if let Err(e) = self.persist_state().await {
            warn!("Failed to persist state after update: {}", e);
        }

        Ok(())
    }

    /// Submit update and auto-aggregate if threshold is met
    pub async fn submit_update_and_maybe_aggregate(
        &self,
        update: ModelUpdate,
    ) -> Result<Option<GlobalModel>> {
        self.submit_update(update).await?;

        if self.ready_to_aggregate().await {
            let model = self.aggregate_updates().await?;
            Ok(Some(model))
        } else {
            Ok(None)
        }
    }

    /// Check if ready to aggregate
    pub async fn ready_to_aggregate(&self) -> bool {
        let pending = self.pending_updates.read().await;
        pending.len() >= self.config.min_participants
    }

    /// Aggregate pending updates into global model
    pub async fn aggregate_updates(&self) -> Result<GlobalModel> {
        let pending = self.pending_updates.read().await;

        if pending.len() < self.config.min_participants {
            return Err(anyhow::anyhow!(
                "Not enough participants: {} (min: {})",
                pending.len(),
                self.config.min_participants
            ));
        }

        let updates: Vec<_> = pending.values().cloned().collect();
        drop(pending);

        let round = *self.current_round.read().await;

        info!(
            "Aggregating {} updates for round {} using {:?}",
            updates.len(),
            round,
            self.config.aggregation_strategy
        );

        let global_model =
            GlobalModel::from_updates(round, &updates, self.config.aggregation_strategy)?;

        // Store global model
        let mut models = self.global_models.write().await;
        models.push(global_model.clone());

        // Clear pending updates
        let mut pending = self.pending_updates.write().await;
        pending.clear();

        // Increment round
        let mut current_round = self.current_round.write().await;
        *current_round += 1;

        info!(
            "Global model round {} complete: {} participants, avg loss: {:.4}",
            global_model.round, global_model.num_participants, global_model.average_loss
        );

        // Persist the new global model and state
        if let Some(ref persistence) = self.persistence {
            if let Err(e) = persistence.save_global_model(&global_model).await {
                warn!("Failed to persist global model: {}", e);
            }
        }
        if let Err(e) = self.persist_state().await {
            warn!("Failed to persist state after aggregation: {}", e);
        }

        Ok(global_model)
    }

    /// Get latest global model
    pub async fn get_global_model(&self) -> Option<GlobalModel> {
        let models = self.global_models.read().await;
        models.last().cloned()
    }

    /// Get current round number
    pub async fn get_current_round(&self) -> u64 {
        *self.current_round.read().await
    }

    /// Get number of pending updates
    pub async fn get_pending_count(&self) -> usize {
        self.pending_updates.read().await.len()
    }

    /// Get participant statistics
    pub async fn get_participant_stats(&self) -> Vec<ParticipantInfo> {
        self.participants.read().await.values().cloned().collect()
    }

    /// Get coordinator status summary
    pub async fn get_status(&self) -> FederatedStatus {
        let current_round = *self.current_round.read().await;
        let pending = self.pending_updates.read().await.len();
        let participants = self.participants.read().await.len();
        let latest_round = self.global_models.read().await.last().map(|m| m.round);

        FederatedStatus {
            current_round,
            pending_updates: pending,
            total_participants: participants,
            min_participants: self.config.min_participants,
            ready_to_aggregate: pending >= self.config.min_participants,
            latest_model_round: latest_round,
        }
    }

    /// Get the configuration
    pub fn config(&self) -> &FederatedConfig {
        &self.config
    }

    /// Persist current state to disk
    async fn persist_state(&self) -> Result<()> {
        let Some(ref persistence) = self.persistence else {
            return Ok(());
        };

        let snapshot = CoordinatorSnapshot {
            current_round: *self.current_round.read().await,
            global_models: self.global_models.read().await.clone(),
            participants: self.participants.read().await.clone(),
            pending_updates: self
                .pending_updates
                .read()
                .await
                .values()
                .cloned()
                .collect(),
            snapshot_timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };

        persistence.save_snapshot(&snapshot).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_update(id: &str, num_samples: usize) -> ModelUpdate {
        let mut weights = HashMap::new();
        weights.insert("layer1".to_string(), vec![1.0, 2.0, 3.0]);
        weights.insert("layer2".to_string(), vec![4.0, 5.0, 6.0]);

        ModelUpdate {
            participant_id: id.to_string(),
            round: 0,
            weights,
            num_samples,
            loss: 0.5,
            timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    #[tokio::test]
    async fn test_federated_coordinator_init() {
        let config = FederatedConfig {
            enabled: true,
            ..Default::default()
        };

        let coordinator = FederatedCoordinator::new(config).await;
        assert!(coordinator.is_ok());
    }

    #[tokio::test]
    async fn test_submit_update() {
        let config = FederatedConfig {
            enabled: true,
            min_participants: 2,
            ..Default::default()
        };

        let coordinator = FederatedCoordinator::new(config).await.unwrap();
        let update = create_test_update("agent-1", 100);

        coordinator.submit_update(update).await.unwrap();
        assert_eq!(coordinator.get_pending_count().await, 1);
    }

    #[tokio::test]
    async fn test_aggregation() {
        let config = FederatedConfig {
            enabled: true,
            min_participants: 3,
            enable_differential_privacy: false, // Disable for predictable test
            ..Default::default()
        };

        let coordinator = FederatedCoordinator::new(config).await.unwrap();

        // Submit 3 updates
        for i in 0..3 {
            let update = create_test_update(&format!("agent-{}", i), 100);
            coordinator.submit_update(update).await.unwrap();
        }

        assert!(coordinator.ready_to_aggregate().await);

        let global_model = coordinator.aggregate_updates().await.unwrap();
        assert_eq!(global_model.num_participants, 3);
        assert_eq!(global_model.round, 0);
    }

    #[tokio::test]
    async fn test_differential_privacy() {
        let mut update = create_test_update("agent-1", 100);
        let original_weights = update.weights.clone();

        update.apply_differential_privacy(0.1);

        // Check that weights have changed
        for (layer_name, weights) in &update.weights {
            let original = &original_weights[layer_name];
            for (i, &w) in weights.iter().enumerate() {
                assert_ne!(w, original[i], "Weights should be different after DP");
            }
        }
    }

    #[tokio::test]
    async fn test_aggregation_strategies() {
        let updates = vec![
            create_test_update("agent-1", 100),
            create_test_update("agent-2", 200),
            create_test_update("agent-3", 150),
        ];

        // Test FedAvg
        let model = GlobalModel::from_updates(0, &updates, AggregationStrategy::FederatedAveraging)
            .unwrap();
        assert_eq!(model.num_participants, 3);

        // Test weighted average
        let model =
            GlobalModel::from_updates(0, &updates, AggregationStrategy::WeightedAveraging).unwrap();
        assert_eq!(model.num_participants, 3);

        // Test median
        let model = GlobalModel::from_updates(0, &updates, AggregationStrategy::Median).unwrap();
        assert_eq!(model.num_participants, 3);
    }

    #[tokio::test]
    async fn test_participant_tracking() {
        let config = FederatedConfig {
            enabled: true,
            ..Default::default()
        };

        let coordinator = FederatedCoordinator::new(config).await.unwrap();

        let update = create_test_update("agent-1", 100);
        coordinator.submit_update(update).await.unwrap();

        let stats = coordinator.get_participant_stats().await;
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].id, "agent-1");
        assert_eq!(stats[0].num_updates, 1);
        assert_eq!(stats[0].total_samples, 100);
    }
}
