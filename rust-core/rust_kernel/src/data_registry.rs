// Data Registry Service - Metadata store for datasets
// Tracks format, schema, size, lineage, and last_updated information

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

/// Dataset metadata record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetMetadata {
    pub dataset_id: String,
    pub schema_version: String,
    pub format: DataFormat,
    pub size_bytes: u64,
    pub record_count: u64,
    pub created_at: u64,
    pub last_updated: u64,
    pub lineage: Vec<String>,
    pub tags: HashMap<String, String>,
    pub schema_json: String,
}

/// Data format enum
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum DataFormat {
    JSON,
    CSV,
    Parquet,
    Avro,
}

impl DataFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            DataFormat::JSON => "json",
            DataFormat::CSV => "csv",
            DataFormat::Parquet => "parquet",
            DataFormat::Avro => "avro",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "json" => Some(DataFormat::JSON),
            "csv" => Some(DataFormat::CSV),
            "parquet" => Some(DataFormat::Parquet),
            "avro" => Some(DataFormat::Avro),
            _ => None,
        }
    }
}

/// In-memory data registry with thread-safe access
pub struct DataRegistry {
    datasets: Arc<RwLock<HashMap<String, DatasetMetadata>>>,
}

impl DataRegistry {
    /// Create a new data registry
    pub fn new() -> Self {
        DataRegistry {
            datasets: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new dataset
    pub fn register(&self, metadata: DatasetMetadata) -> Result<(), String> {
        let mut datasets = self.datasets.write()
            .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

        datasets.insert(metadata.dataset_id.clone(), metadata);
        Ok(())
    }

    /// Get dataset metadata by ID
    pub fn get(&self, dataset_id: &str) -> Result<Option<DatasetMetadata>, String> {
        let datasets = self.datasets.read()
            .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

        Ok(datasets.get(dataset_id).cloned())
    }

    /// Update dataset metadata
    pub fn update<F>(&self, dataset_id: &str, update_fn: F) -> Result<(), String>
    where
        F: FnOnce(&mut DatasetMetadata),
    {
        let mut datasets = self.datasets.write()
            .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

        if let Some(metadata) = datasets.get_mut(dataset_id) {
            update_fn(metadata);
            metadata.last_updated = current_timestamp();
            Ok(())
        } else {
            Err(format!("Dataset not found: {}", dataset_id))
        }
    }

    /// Delete dataset metadata
    pub fn delete(&self, dataset_id: &str) -> Result<(), String> {
        let mut datasets = self.datasets.write()
            .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

        datasets.remove(dataset_id);
        Ok(())
    }

    /// List all dataset IDs
    pub fn list_ids(&self) -> Result<Vec<String>, String> {
        let datasets = self.datasets.read()
            .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

        Ok(datasets.keys().cloned().collect())
    }

    /// Search datasets by format
    pub fn find_by_format(&self, format: DataFormat) -> Result<Vec<DatasetMetadata>, String> {
        let datasets = self.datasets.read()
            .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

        Ok(datasets
            .values()
            .filter(|m| m.format == format)
            .cloned()
            .collect())
    }

    /// Search datasets by tag
    pub fn find_by_tag(&self, key: &str, value: &str) -> Result<Vec<DatasetMetadata>, String> {
        let datasets = self.datasets.read()
            .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

        Ok(datasets
            .values()
            .filter(|m| m.tags.get(key).map_or(false, |v| v == value))
            .cloned()
            .collect())
    }

    /// Get registry statistics
    pub fn stats(&self) -> Result<RegistryStats, String> {
        let datasets = self.datasets.read()
            .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

        let mut stats = RegistryStats {
            total_datasets: datasets.len(),
            total_records: 0,
            total_size_bytes: 0,
            by_format: HashMap::new(),
        };

        for metadata in datasets.values() {
            stats.total_records += metadata.record_count;
            stats.total_size_bytes += metadata.size_bytes;

            *stats.by_format.entry(metadata.format.as_str().to_string())
                .or_insert(0) += 1;
        }

        Ok(stats)
    }
}

/// Registry statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct RegistryStats {
    pub total_datasets: usize,
    pub total_records: u64,
    pub total_size_bytes: u64,
    pub by_format: HashMap<String, usize>,
}

/// Get current Unix timestamp in seconds
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Builder for DatasetMetadata
pub struct DatasetMetadataBuilder {
    dataset_id: String,
    schema_version: String,
    format: DataFormat,
    size_bytes: u64,
    record_count: u64,
    lineage: Vec<String>,
    tags: HashMap<String, String>,
    schema_json: String,
}

impl DatasetMetadataBuilder {
    pub fn new(dataset_id: impl Into<String>) -> Self {
        DatasetMetadataBuilder {
            dataset_id: dataset_id.into(),
            schema_version: "1.0".to_string(),
            format: DataFormat::JSON,
            size_bytes: 0,
            record_count: 0,
            lineage: Vec::new(),
            tags: HashMap::new(),
            schema_json: "{}".to_string(),
        }
    }

    pub fn schema_version(mut self, version: impl Into<String>) -> Self {
        self.schema_version = version.into();
        self
    }

    pub fn format(mut self, format: DataFormat) -> Self {
        self.format = format;
        self
    }

    pub fn size_bytes(mut self, size: u64) -> Self {
        self.size_bytes = size;
        self
    }

    pub fn record_count(mut self, count: u64) -> Self {
        self.record_count = count;
        self
    }

    pub fn add_lineage(mut self, parent: impl Into<String>) -> Self {
        self.lineage.push(parent.into());
        self
    }

    pub fn add_tag(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.tags.insert(key.into(), value.into());
        self
    }

    pub fn schema_json(mut self, schema: impl Into<String>) -> Self {
        self.schema_json = schema.into();
        self
    }

    pub fn build(self) -> DatasetMetadata {
        let now = current_timestamp();
        DatasetMetadata {
            dataset_id: self.dataset_id,
            schema_version: self.schema_version,
            format: self.format,
            size_bytes: self.size_bytes,
            record_count: self.record_count,
            created_at: now,
            last_updated: now,
            lineage: self.lineage,
            tags: self.tags,
            schema_json: self.schema_json,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_basic_operations() {
        let registry = DataRegistry::new();

        let metadata = DatasetMetadataBuilder::new("test_dataset")
            .format(DataFormat::CSV)
            .record_count(100)
            .size_bytes(1024)
            .add_tag("env", "test")
            .build();

        // Register dataset
        registry.register(metadata.clone()).unwrap();

        // Get dataset
        let retrieved = registry.get("test_dataset").unwrap().unwrap();
        assert_eq!(retrieved.dataset_id, "test_dataset");
        assert_eq!(retrieved.record_count, 100);

        // Update dataset
        registry.update("test_dataset", |m| {
            m.record_count = 200;
        }).unwrap();

        let updated = registry.get("test_dataset").unwrap().unwrap();
        assert_eq!(updated.record_count, 200);

        // Delete dataset
        registry.delete("test_dataset").unwrap();
        assert!(registry.get("test_dataset").unwrap().is_none());
    }

    #[test]
    fn test_registry_search() {
        let registry = DataRegistry::new();

        // Register multiple datasets
        for i in 0..5 {
            let format = if i % 2 == 0 {
                DataFormat::JSON
            } else {
                DataFormat::CSV
            };

            let metadata = DatasetMetadataBuilder::new(format!("dataset_{}", i))
                .format(format)
                .add_tag("env", if i < 3 { "dev" } else { "prod" })
                .build();

            registry.register(metadata).unwrap();
        }

        // Search by format
        let json_datasets = registry.find_by_format(DataFormat::JSON).unwrap();
        assert_eq!(json_datasets.len(), 3);

        // Search by tag
        let dev_datasets = registry.find_by_tag("env", "dev").unwrap();
        assert_eq!(dev_datasets.len(), 3);

        // Check stats
        let stats = registry.stats().unwrap();
        assert_eq!(stats.total_datasets, 5);
    }

    #[test]
    fn test_data_format_conversion() {
        assert_eq!(DataFormat::from_str("json"), Some(DataFormat::JSON));
        assert_eq!(DataFormat::from_str("CSV"), Some(DataFormat::CSV));
        assert_eq!(DataFormat::from_str("parquet"), Some(DataFormat::Parquet));
        assert_eq!(DataFormat::from_str("invalid"), None);

        assert_eq!(DataFormat::JSON.as_str(), "json");
        assert_eq!(DataFormat::Parquet.as_str(), "parquet");
    }
}
