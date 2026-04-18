use crate::TrainingExample;
use anyhow::{Context, Result};
use redb::{Database, ReadableTable, ReadableTableMetadata, TableDefinition};
use std::path::Path;
use std::sync::Arc;
use tracing::{debug, info};

/// Redb table definitions for conversation history
const CONVERSATION_HISTORY_TABLE: TableDefinition<u64, &[u8]> =
    TableDefinition::new("conversation_history");
const REQUEST_COUNTER_TABLE: TableDefinition<&str, u64> = TableDefinition::new("request_counter");
const LAST_TRAINING_TABLE: TableDefinition<&str, u64> = TableDefinition::new("last_training");

/// Training data store using Redb
#[derive(Clone)]
pub struct TrainingDataStore {
    db: Arc<Database>,
}

impl TrainingDataStore {
    /// Open or create a training data store
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let db =
            Database::create(path.as_ref()).context("Failed to create/open training database")?;

        // Ensure tables exist
        {
            let write_txn = db.begin_write()?;
            {
                let _ = write_txn.open_table(CONVERSATION_HISTORY_TABLE)?;
                let _ = write_txn.open_table(REQUEST_COUNTER_TABLE)?;
                let _ = write_txn.open_table(LAST_TRAINING_TABLE)?;
            }
            write_txn.commit()?;
        }

        info!("Training data store opened at {:?}", path.as_ref());

        Ok(Self { db: Arc::new(db) })
    }

    /// Store a conversation example
    pub fn store_example(&self, example: &TrainingExample) -> Result<()> {
        let write_txn = self.db.begin_write()?;
        {
            let mut table = write_txn.open_table(CONVERSATION_HISTORY_TABLE)?;
            let key = example.timestamp;
            let value = bincode::serialize(example)?;
            table.insert(key, value.as_slice())?;
        }
        write_txn.commit()?;

        debug!("Stored training example at timestamp {}", example.timestamp);
        Ok(())
    }

    /// Increment request counter and return new count
    pub fn increment_request_counter(&self) -> Result<u64> {
        let write_txn = self.db.begin_write()?;
        let new_count = {
            let mut table = write_txn.open_table(REQUEST_COUNTER_TABLE)?;
            let key = "total_requests";
            let current = table.get(key)?.map(|v| v.value()).unwrap_or(0);
            let new_count = current + 1;
            table.insert(key, new_count)?;
            new_count
        };
        write_txn.commit()?;

        debug!("Request counter incremented to {}", new_count);
        Ok(new_count)
    }

    /// Get current request counter value
    pub fn get_request_counter(&self) -> Result<u64> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(REQUEST_COUNTER_TABLE)?;
        let key = "total_requests";
        let count = table.get(key)?.map(|v| v.value()).unwrap_or(0);
        Ok(count)
    }

    /// Get all conversation history since last training
    pub fn get_history_since_last_training(&self) -> Result<Vec<TrainingExample>> {
        let read_txn = self.db.begin_read()?;

        // Get last training timestamp
        let last_training_ts = {
            let last_training_table = read_txn.open_table(LAST_TRAINING_TABLE)?;
            last_training_table
                .get("last_training_timestamp")?
                .map(|v| v.value())
                .unwrap_or(0)
        };

        // Get all examples since last training
        let history_table = read_txn.open_table(CONVERSATION_HISTORY_TABLE)?;
        let mut examples = Vec::new();

        for entry in history_table.iter()? {
            let (timestamp, data) = entry?;
            if timestamp.value() > last_training_ts {
                let example: TrainingExample = bincode::deserialize(data.value())?;
                examples.push(example);
            }
        }

        info!(
            "Retrieved {} training examples since last training (ts: {})",
            examples.len(),
            last_training_ts
        );

        Ok(examples)
    }

    /// Mark training as completed at current time
    pub fn mark_training_completed(&self) -> Result<()> {
        let write_txn = self.db.begin_write()?;
        {
            let mut table = write_txn.open_table(LAST_TRAINING_TABLE)?;
            let current_time = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs();
            table.insert("last_training_timestamp", current_time)?;
        }
        write_txn.commit()?;

        info!("Marked training as completed");
        Ok(())
    }

    /// Get total number of examples in history
    pub fn get_total_examples(&self) -> Result<usize> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(CONVERSATION_HISTORY_TABLE)?;
        let count = table.len()?;
        Ok(count as usize)
    }

    /// Reset request counter (useful for testing)
    pub fn reset_request_counter(&self) -> Result<()> {
        let write_txn = self.db.begin_write()?;
        {
            let mut table = write_txn.open_table(REQUEST_COUNTER_TABLE)?;
            table.insert("total_requests", 0)?;
        }
        write_txn.commit()?;
        Ok(())
    }
}

/// Alias for conversation history management
pub type ConversationHistory = TrainingDataStore;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_store_and_retrieve() -> Result<()> {
        let dir = tempdir()?;
        let db_path = dir.path().join("test.db");
        let store = TrainingDataStore::open(&db_path)?;

        let example = TrainingExample {
            prompt: "Test prompt".to_string(),
            completion: "Test completion".to_string(),
            timestamp: 1000,
            model_used: "phi-3".to_string(),
        };

        store.store_example(&example)?;
        assert_eq!(store.get_total_examples()?, 1);

        Ok(())
    }

    #[test]
    fn test_request_counter() -> Result<()> {
        let dir = tempdir()?;
        let db_path = dir.path().join("test.db");
        let store = TrainingDataStore::open(&db_path)?;

        assert_eq!(store.get_request_counter()?, 0);
        store.increment_request_counter()?;
        assert_eq!(store.get_request_counter()?, 1);
        store.increment_request_counter()?;
        assert_eq!(store.get_request_counter()?, 2);

        Ok(())
    }

    #[test]
    fn test_history_since_last_training() -> Result<()> {
        let dir = tempdir()?;
        let db_path = dir.path().join("test.db");
        let store = TrainingDataStore::open(&db_path)?;

        // Use current time minus 10 seconds for before-training examples
        let base_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs()
            - 10; // 10 seconds in the past

        // Add some examples before training
        for i in 0..5 {
            let example = TrainingExample {
                prompt: format!("Prompt {}", i),
                completion: format!("Completion {}", i),
                timestamp: base_time + i as u64,
                model_used: "phi-3".to_string(),
            };
            store.store_example(&example)?;
        }

        // Get all (no training yet)
        let history = store.get_history_since_last_training()?;
        assert_eq!(history.len(), 5);

        // Mark training completed (sets timestamp to NOW)
        store.mark_training_completed()?;

        // Sleep 1 second to ensure separation
        std::thread::sleep(std::time::Duration::from_secs(1));

        // Add more examples after training (with timestamps in the future)
        let post_training_base = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();

        for i in 0..3 {
            let example = TrainingExample {
                prompt: format!("Prompt {}", i + 5),
                completion: format!("Completion {}", i + 5),
                timestamp: post_training_base + i as u64,
                model_used: "phi-3".to_string(),
            };
            store.store_example(&example)?;
        }

        // Should only get examples after last training
        let history = store.get_history_since_last_training()?;
        assert_eq!(history.len(), 3);

        Ok(())
    }
}
