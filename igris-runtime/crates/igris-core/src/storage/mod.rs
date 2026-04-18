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
pub const BTREE_STORE: TableDefinition<&str, &[u8]> = TableDefinition::new("btree_store");
pub const WAL_ENTRIES: TableDefinition<&str, &[u8]> = TableDefinition::new("wal_entries");
pub const TASK_SUBMISSIONS: TableDefinition<&str, &[u8]> = TableDefinition::new("task_submissions");
pub const TASK_SUBMISSION_STATUS_BY_TASK_ID: TableDefinition<&str, &[u8]> =
    TableDefinition::new("task_submission_status_by_task_id");

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
            write_txn.open_table(BTREE_STORE)?;
            write_txn.open_table(WAL_ENTRIES)?;
            write_txn.open_table(TASK_SUBMISSIONS)?;
            write_txn.open_table(TASK_SUBMISSION_STATUS_BY_TASK_ID)?;
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

    /// List all keys and values from a table.
    pub fn list_all<T: for<'de> Deserialize<'de>>(
        &self,
        table: TableDefinition<&str, &[u8]>,
    ) -> anyhow::Result<Vec<(String, T)>> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(table)?;
        let mut results = Vec::new();
        for entry in table.iter()? {
            let (key, value) = entry?;
            let deserialized: T = serde_json::from_slice(value.value())?;
            results.push((key.value().to_string(), deserialized));
        }
        Ok(results)
    }

    /// List all entries whose key begins with `prefix` (O(matching entries),
    /// not O(all entries)).  Uses redb's lexicographic range scan.
    ///
    /// Key format convention: `"{prefix}:{suffix}"`.  The end bound is
    /// constructed by replacing the trailing `:` with `;` (ASCII 59 = `:` + 1)
    /// so every key of the form `"{prefix}:*"` falls inside the range.
    pub fn list_by_prefix<T: for<'de> Deserialize<'de>>(
        &self,
        table: TableDefinition<&str, &[u8]>,
        prefix: &str,
    ) -> anyhow::Result<Vec<(String, T)>> {
        let read_txn = self.db.begin_read()?;
        let tbl = read_txn.open_table(table)?;

        // Build the exclusive upper bound: increment the last byte of prefix.
        // prefix is always "{uuid}:" so the last char ':' (0x3a) → ';' (0x3b).
        let end = {
            let mut b = prefix.as_bytes().to_vec();
            match b.last_mut() {
                Some(last) => *last += 1,
                None => return Ok(Vec::new()),
            }
            String::from_utf8(b).unwrap_or_default()
        };

        let mut results = Vec::new();
        for entry in tbl.range(prefix..end.as_str())? {
            let (key, value) = entry?;
            let deserialized: T = serde_json::from_slice(value.value())?;
            results.push((key.value().to_string(), deserialized));
        }
        Ok(results)
    }

    /// Delete a key from a table.
    pub fn delete(&self, table: TableDefinition<&str, &[u8]>, key: &str) -> anyhow::Result<bool> {
        let write_txn = self.db.begin_write()?;
        let removed = {
            let mut tbl = write_txn.open_table(table)?;
            let result = tbl.remove(key)?;
            let was_present = result.is_some();
            drop(result);
            was_present
        };
        write_txn.commit()?;
        Ok(removed)
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
