//! Persistence layer for federated learning state.
//!
//! Saves and restores coordinator state (rounds, global models, participant info)
//! so that federated learning progress survives process restarts.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::info;

use crate::{GlobalModel, ModelUpdate, ParticipantInfo};

/// Serializable coordinator state for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinatorSnapshot {
    pub current_round: u64,
    pub global_models: Vec<GlobalModel>,
    pub participants: HashMap<String, ParticipantInfo>,
    pub pending_updates: Vec<ModelUpdate>,
    pub snapshot_timestamp: u64,
}

/// File-based persistence backend for federated state
pub struct FederatedPersistence {
    state_dir: PathBuf,
}

impl FederatedPersistence {
    /// Create a new persistence backend at the given directory
    pub async fn new(state_dir: impl AsRef<Path>) -> Result<Self> {
        let state_dir = state_dir.as_ref().to_path_buf();
        fs::create_dir_all(&state_dir).await.with_context(|| {
            format!("Failed to create state directory: {}", state_dir.display())
        })?;

        Ok(Self { state_dir })
    }

    /// Save coordinator state to disk
    pub async fn save_snapshot(&self, snapshot: &CoordinatorSnapshot) -> Result<()> {
        let snapshot_path = self.state_dir.join("coordinator_state.json");
        let temp_path = self.state_dir.join("coordinator_state.json.tmp");

        let data = serde_json::to_string_pretty(snapshot)
            .context("Failed to serialize coordinator snapshot")?;

        // Atomic write: write to temp file, then rename
        fs::write(&temp_path, &data)
            .await
            .with_context(|| format!("Failed to write snapshot to {}", temp_path.display()))?;

        fs::rename(&temp_path, &snapshot_path)
            .await
            .with_context(|| "Failed to rename snapshot file")?;

        info!(
            "Saved federated state: round={}, models={}, participants={}",
            snapshot.current_round,
            snapshot.global_models.len(),
            snapshot.participants.len()
        );

        Ok(())
    }

    /// Load coordinator state from disk
    pub async fn load_snapshot(&self) -> Result<Option<CoordinatorSnapshot>> {
        let snapshot_path = self.state_dir.join("coordinator_state.json");

        if !snapshot_path.exists() {
            info!("No existing federated state found, starting fresh");
            return Ok(None);
        }

        let data = fs::read_to_string(&snapshot_path)
            .await
            .with_context(|| format!("Failed to read snapshot from {}", snapshot_path.display()))?;

        let snapshot: CoordinatorSnapshot = serde_json::from_str(&data)
            .with_context(|| "Failed to deserialize coordinator snapshot")?;

        info!(
            "Restored federated state: round={}, models={}, participants={}",
            snapshot.current_round,
            snapshot.global_models.len(),
            snapshot.participants.len()
        );

        Ok(Some(snapshot))
    }

    /// Save a global model as a standalone artifact
    pub async fn save_global_model(&self, model: &GlobalModel) -> Result<PathBuf> {
        let models_dir = self.state_dir.join("global_models");
        fs::create_dir_all(&models_dir).await?;

        let filename = format!("global_model_round_{}.json", model.round);
        let model_path = models_dir.join(&filename);

        let data =
            serde_json::to_string_pretty(model).context("Failed to serialize global model")?;

        fs::write(&model_path, &data).await?;

        info!(
            "Saved global model round {} to {}",
            model.round,
            model_path.display()
        );
        Ok(model_path)
    }

    /// Load the latest global model
    pub async fn load_latest_global_model(&self) -> Result<Option<GlobalModel>> {
        let models_dir = self.state_dir.join("global_models");
        if !models_dir.exists() {
            return Ok(None);
        }

        let mut entries = fs::read_dir(&models_dir).await?;
        let mut latest: Option<(u64, PathBuf)> = None;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                if let Some(round_str) = name.strip_prefix("global_model_round_") {
                    if let Ok(round) = round_str.parse::<u64>() {
                        if latest.is_none() || round > latest.as_ref().unwrap().0 {
                            latest = Some((round, path));
                        }
                    }
                }
            }
        }

        if let Some((_, path)) = latest {
            let data = fs::read_to_string(&path).await?;
            let model: GlobalModel = serde_json::from_str(&data)?;
            return Ok(Some(model));
        }

        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_save_and_load_snapshot() {
        let dir = tempdir().unwrap();
        let persistence = FederatedPersistence::new(dir.path()).await.unwrap();

        let snapshot = CoordinatorSnapshot {
            current_round: 5,
            global_models: vec![],
            participants: HashMap::new(),
            pending_updates: vec![],
            snapshot_timestamp: 1234567890,
        };

        persistence.save_snapshot(&snapshot).await.unwrap();
        let loaded = persistence.load_snapshot().await.unwrap().unwrap();

        assert_eq!(loaded.current_round, 5);
        assert_eq!(loaded.snapshot_timestamp, 1234567890);
    }

    #[tokio::test]
    async fn test_load_nonexistent_snapshot() {
        let dir = tempdir().unwrap();
        let persistence = FederatedPersistence::new(dir.path()).await.unwrap();

        let loaded = persistence.load_snapshot().await.unwrap();
        assert!(loaded.is_none());
    }

    #[tokio::test]
    async fn test_save_and_load_global_model() {
        let dir = tempdir().unwrap();
        let persistence = FederatedPersistence::new(dir.path()).await.unwrap();

        let mut weights = HashMap::new();
        weights.insert("layer1".to_string(), vec![1.0, 2.0, 3.0]);

        let model = GlobalModel {
            round: 3,
            weights,
            num_participants: 5,
            average_loss: 0.42,
            timestamp: 1234567890,
        };

        persistence.save_global_model(&model).await.unwrap();
        let loaded = persistence
            .load_latest_global_model()
            .await
            .unwrap()
            .unwrap();

        assert_eq!(loaded.round, 3);
        assert_eq!(loaded.num_participants, 5);
    }
}
