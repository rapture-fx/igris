use redb::{Database, ReadableTable, TableDefinition};
use serde::{Deserialize, Serialize};
use std::path::Path;

// Table definitions
const TENANTS: TableDefinition<&str, &[u8]> = TableDefinition::new("tenants");
const API_KEYS: TableDefinition<&str, &[u8]> = TableDefinition::new("api_keys");
const BUDGETS: TableDefinition<&str, &[u8]> = TableDefinition::new("budgets");
const OPTIMIZER_STATES: TableDefinition<&str, &[u8]> = TableDefinition::new("optimizer_states");
const BANDIT_ARMS: TableDefinition<&str, &[u8]> = TableDefinition::new("bandit_arms");
const RATE_LIMITS: TableDefinition<&str, &[u8]> = TableDefinition::new("rate_limits");
const PROVIDER_REGISTRY: TableDefinition<&str, &[u8]> = TableDefinition::new("providers");

pub struct RedbStorage {
    db: Database,
}

impl RedbStorage {
    pub fn new<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let db = Database::create(path)?;

        // Initialize tables
        let write_txn = db.begin_write()?;
        {
            write_txn.open_table(TENANTS)?;
            write_txn.open_table(API_KEYS)?;
            write_txn.open_table(BUDGETS)?;
            write_txn.open_table(OPTIMIZER_STATES)?;
            write_txn.open_table(BANDIT_ARMS)?;
            write_txn.open_table(RATE_LIMITS)?;
            write_txn.open_table(PROVIDER_REGISTRY)?;
        }
        write_txn.commit()?;

        Ok(Self { db })
    }

    // Generic get/set
    pub fn get<T: for<'de> Deserialize<'de>>(
        &self,
        table: TableDefinition<&str, &[u8]>,
        key: &str,
    ) -> anyhow::Result<Option<T>> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(table)?;

        match table.get(key)? {
            Some(value) => {
                let deserialized = serde_json::from_slice(value.value())?;
                Ok(Some(deserialized))
            }
            None => Ok(None),
        }
    }

    pub fn set<T: Serialize>(
        &self,
        table: TableDefinition<&str, &[u8]>,
        key: &str,
        value: &T,
    ) -> anyhow::Result<()> {
        let serialized = serde_json::to_vec(value)?;

        let write_txn = self.db.begin_write()?;
        {
            let mut table = write_txn.open_table(table)?;
            table.insert(key, serialized.as_slice())?;
        }
        write_txn.commit()?;
        Ok(())
    }

    // Atomic increment for budget tracking
    pub fn atomic_increment_f64(
        &self,
        table: TableDefinition<&str, &[u8]>,
        key: &str,
        delta: f64,
    ) -> anyhow::Result<f64> {
        let write_txn = self.db.begin_write()?;
        let result = {
            let mut table_mut = write_txn.open_table(table)?;

            let current: f64 = match table_mut.get(key)? {
                Some(value) => serde_json::from_slice(value.value())?,
                None => 0.0,
            };

            let new_value = current + delta;
            let serialized = serde_json::to_vec(&new_value)?;
            table_mut.insert(key, serialized.as_slice())?;

            new_value
        };
        write_txn.commit()?;
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_redb_storage_creation() {
        let temp_dir = env::temp_dir();
        let db_path = temp_dir.join("test_igris.db");
        let storage = RedbStorage::new(&db_path);
        assert!(storage.is_ok());

        // Cleanup
        std::fs::remove_file(&db_path).ok();
    }
}
