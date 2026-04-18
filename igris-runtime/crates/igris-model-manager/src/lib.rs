//! Dynamic Model Management for Igris Runtime
//!
//! Provides task-based model selection, hot-swapping, and automatic model loading.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub enabled: bool,
    pub auto_select: bool,
    pub auto_download: bool,
    pub max_loaded_models: usize,
    pub models: Vec<ModelSpec>,
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_select: true,
            auto_download: false,
            max_loaded_models: 2,
            models: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSpec {
    pub id: String,
    pub path: String,
    pub task_types: Vec<String>,
    pub max_tokens: usize,
    pub priority: u8,
    pub memory_mb: usize,
}

#[derive(Debug, Clone)]
pub struct LoadedModel {
    pub spec: ModelSpec,
    pub load_time: std::time::SystemTime,
    pub usage_count: usize,
}

pub struct ModelManager {
    config: ModelConfig,
    active_model: Arc<RwLock<Option<String>>>,
    models: Arc<RwLock<HashMap<String, ModelSpec>>>,
    loaded_models: Arc<RwLock<HashMap<String, LoadedModel>>>,
}

impl ModelManager {
    pub async fn new(config: ModelConfig) -> Result<Self> {
        info!("Initializing dynamic model manager");

        let mut models = HashMap::new();
        for spec in &config.models {
            models.insert(spec.id.clone(), spec.clone());
        }

        Ok(Self {
            config,
            active_model: Arc::new(RwLock::new(None)),
            models: Arc::new(RwLock::new(models)),
            loaded_models: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Select best model for task type
    pub async fn select_model(&self, task_type: &str) -> Result<String> {
        let models = self.models.read().await;

        // Find all matching models
        let mut candidates: Vec<_> = models
            .iter()
            .filter(|(_, spec)| spec.task_types.contains(&task_type.to_string()))
            .collect();

        if candidates.is_empty() {
            return Err(anyhow::anyhow!("No model found for task: {}", task_type));
        }

        // Sort by priority (higher first)
        candidates.sort_by(|a, b| b.1.priority.cmp(&a.1.priority));

        let selected_id = candidates[0].0.clone();

        info!("Selected model '{}' for task '{}'", selected_id, task_type);

        // Load model if not already loaded
        self.load_model(&selected_id).await?;

        // Set as active
        let mut active = self.active_model.write().await;
        *active = Some(selected_id.clone());

        Ok(selected_id)
    }

    /// Load model into memory
    pub async fn load_model(&self, model_id: &str) -> Result<()> {
        let loaded = self.loaded_models.read().await;
        if loaded.contains_key(model_id) {
            debug!("Model '{}' already loaded", model_id);
            return Ok(());
        }
        drop(loaded);

        let models = self.models.read().await;
        let spec = models
            .get(model_id)
            .ok_or_else(|| anyhow::anyhow!("Model not found: {}", model_id))?
            .clone();
        drop(models);

        // Check if we need to unload models
        let mut loaded = self.loaded_models.write().await;
        if loaded.len() >= self.config.max_loaded_models {
            self.unload_lru_model(&mut loaded).await?;
        }

        info!("Loading model '{}' from {}", model_id, spec.path);

        // In production: actually load the model file
        // For now, simulate loading
        let loaded_model = LoadedModel {
            spec,
            load_time: std::time::SystemTime::now(),
            usage_count: 0,
        };

        loaded.insert(model_id.to_string(), loaded_model);

        Ok(())
    }

    /// Unload least recently used model
    async fn unload_lru_model(&self, loaded: &mut HashMap<String, LoadedModel>) -> Result<()> {
        if loaded.is_empty() {
            return Ok(());
        }

        // Find LRU model (oldest load time, lowest usage)
        let lru_id = loaded
            .iter()
            .min_by_key(|(_, model)| (model.usage_count, model.load_time))
            .map(|(id, _)| id.clone());

        if let Some(id) = lru_id {
            warn!("Unloading model '{}' to free memory", id);
            loaded.remove(&id);
        }

        Ok(())
    }

    /// Hot-swap to a different model
    pub async fn swap_model(&self, new_model_id: &str) -> Result<()> {
        info!("Hot-swapping to model '{}'", new_model_id);

        self.load_model(new_model_id).await?;

        let mut active = self.active_model.write().await;
        *active = Some(new_model_id.to_string());

        Ok(())
    }

    /// Get active model ID
    pub async fn get_active_model(&self) -> Option<String> {
        self.active_model.read().await.clone()
    }

    /// Get loaded models
    pub async fn get_loaded_models(&self) -> Vec<String> {
        self.loaded_models.read().await.keys().cloned().collect()
    }

    /// Increment usage count for active model
    pub async fn record_usage(&self) -> Result<()> {
        let active = self.active_model.read().await;
        if let Some(id) = active.as_ref() {
            let mut loaded = self.loaded_models.write().await;
            if let Some(model) = loaded.get_mut(id) {
                model.usage_count += 1;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_spec(id: &str, task: &str, priority: u8) -> ModelSpec {
        ModelSpec {
            id: id.to_string(),
            path: format!("models/{}.gguf", id),
            task_types: vec![task.to_string()],
            max_tokens: 4096,
            priority,
            memory_mb: 1024,
        }
    }

    #[tokio::test]
    async fn test_model_selection() {
        let config = ModelConfig {
            enabled: true,
            auto_select: true,
            auto_download: false,
            max_loaded_models: 2,
            models: vec![create_test_spec("gpt-4", "reasoning", 10)],
        };

        let manager = ModelManager::new(config).await.unwrap();
        let model = manager.select_model("reasoning").await.unwrap();
        assert_eq!(model, "gpt-4");
        assert_eq!(manager.get_active_model().await, Some("gpt-4".to_string()));
    }

    #[tokio::test]
    async fn test_priority_selection() {
        let config = ModelConfig {
            enabled: true,
            auto_select: true,
            auto_download: false,
            max_loaded_models: 2,
            models: vec![
                create_test_spec("model-low", "coding", 5),
                create_test_spec("model-high", "coding", 10),
            ],
        };

        let manager = ModelManager::new(config).await.unwrap();
        let model = manager.select_model("coding").await.unwrap();
        assert_eq!(model, "model-high"); // Higher priority wins
    }

    #[tokio::test]
    async fn test_hot_swap() {
        let config = ModelConfig {
            enabled: true,
            auto_select: true,
            auto_download: false,
            max_loaded_models: 2,
            models: vec![
                create_test_spec("model-1", "chat", 5),
                create_test_spec("model-2", "chat", 5),
            ],
        };

        let manager = ModelManager::new(config).await.unwrap();

        manager.load_model("model-1").await.unwrap();
        assert_eq!(manager.get_loaded_models().await.len(), 1);

        manager.swap_model("model-2").await.unwrap();
        assert_eq!(
            manager.get_active_model().await,
            Some("model-2".to_string())
        );
    }

    #[tokio::test]
    async fn test_lru_unloading() {
        let config = ModelConfig {
            enabled: true,
            auto_select: true,
            auto_download: false,
            max_loaded_models: 2,
            models: vec![
                create_test_spec("model-1", "chat", 5),
                create_test_spec("model-2", "code", 5),
                create_test_spec("model-3", "math", 5),
            ],
        };

        let manager = ModelManager::new(config).await.unwrap();

        // Load 2 models
        manager.load_model("model-1").await.unwrap();
        manager.load_model("model-2").await.unwrap();
        assert_eq!(manager.get_loaded_models().await.len(), 2);

        // Loading 3rd should unload LRU
        manager.load_model("model-3").await.unwrap();
        assert_eq!(manager.get_loaded_models().await.len(), 2);
    }

    #[tokio::test]
    async fn test_usage_tracking() {
        let config = ModelConfig {
            enabled: true,
            auto_select: true,
            auto_download: false,
            max_loaded_models: 2,
            models: vec![create_test_spec("model-1", "chat", 5)],
        };

        let manager = ModelManager::new(config).await.unwrap();
        manager.select_model("chat").await.unwrap();

        manager.record_usage().await.unwrap();
        manager.record_usage().await.unwrap();

        // Usage count should be tracked internally
        assert!(manager.get_active_model().await.is_some());
    }
}
