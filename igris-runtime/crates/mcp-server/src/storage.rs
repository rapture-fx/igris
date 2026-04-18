use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    AeadCore, Aes256Gcm, Nonce,
};
use anyhow::Result;
use redb::{Database, ReadableTable, TableDefinition};
use sha2::{Digest, Sha256};
use std::path::Path;
use tracing::{info, warn};

use crate::context::SharedContext;

const CONTEXT_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("mcp_contexts");
const KEY_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("mcp_keys");
const NONCE_LEN: usize = 12;

/// Encrypted persistent storage for MCP contexts
pub struct EncryptedStorage {
    db: Database,
    cipher: Aes256Gcm,
}

impl EncryptedStorage {
    /// Open or create encrypted storage
    pub fn new(path: impl AsRef<Path>, encryption_key: Option<&[u8]>) -> Result<Self> {
        let db = Database::create(path)?;

        // Generate or retrieve encryption key
        let key = if let Some(provided_key) = encryption_key {
            Self::derive_key(provided_key)
        } else {
            Self::get_or_create_key(&db)?
        };

        let cipher = Aes256Gcm::new(&key.into());

        info!("Encrypted MCP storage initialized");

        Ok(Self { db, cipher })
    }

    /// Derive 256-bit key from any input
    fn derive_key(input: &[u8]) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(input);
        hasher.finalize().into()
    }

    /// Get existing key or create new one
    fn get_or_create_key(db: &Database) -> Result<[u8; 32]> {
        // First, ensure tables exist
        {
            let write_txn = db.begin_write()?;
            let _ = write_txn.open_table(KEY_TABLE);
            let _ = write_txn.open_table(CONTEXT_TABLE);
            write_txn.commit()?;
        }

        // Try to read existing key
        {
            let read_txn = db.begin_read()?;
            if let Ok(table) = read_txn.open_table(KEY_TABLE) {
                if let Some(existing) = table.get("master_key")? {
                    let key_bytes = existing.value();
                    if key_bytes.len() == 32 {
                        let mut key = [0u8; 32];
                        key.copy_from_slice(key_bytes);
                        return Ok(key);
                    }
                }
            }
        }

        // Generate new key
        let key = Aes256Gcm::generate_key(&mut OsRng);
        let key_array: [u8; 32] = key.as_slice().try_into()?;

        // Write new key
        let write_txn = db.begin_write()?;
        {
            let mut table = write_txn.open_table(KEY_TABLE)?;
            table.insert("master_key", key_array.as_slice())?;
        }
        write_txn.commit()?;

        info!("Generated new encryption key");

        Ok(key_array)
    }

    /// Store encrypted context
    pub fn store_context(&self, context: &SharedContext) -> Result<()> {
        let json = serde_json::to_vec(context)?;

        // Encrypt
        // AES-GCM requires a unique nonce per message.
        // For backward compatibility, we store the nonce alongside ciphertext:
        // [12 bytes nonce][ciphertext...]
        let nonce_bytes = Aes256Gcm::generate_nonce(&mut OsRng);
        let nonce = Nonce::from_slice(nonce_bytes.as_slice());
        let ciphertext = self
            .cipher
            .encrypt(nonce, json.as_ref())
            .map_err(|_| anyhow::anyhow!("Encryption failed"))?;
        let mut blob = Vec::with_capacity(NONCE_LEN + ciphertext.len());
        blob.extend_from_slice(nonce.as_slice());
        blob.extend_from_slice(&ciphertext);

        // Store
        let write_txn = self.db.begin_write()?;
        {
            let mut table = write_txn.open_table(CONTEXT_TABLE)?;
            table.insert(context.conversation_id.as_str(), blob.as_slice())?;
        }
        write_txn.commit()?;

        Ok(())
    }

    /// Retrieve and decrypt context
    pub fn get_context(&self, conversation_id: &str) -> Result<Option<SharedContext>> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(CONTEXT_TABLE)?;

        let Some(encrypted) = table.get(conversation_id)? else {
            return Ok(None);
        };

        let ciphertext = encrypted.value();

        // Decrypt
        // Backward compatibility:
        // - New format: [nonce||ciphertext]
        // - Old format: ciphertext only (used a fixed nonce)
        let (nonce, ct) = if ciphertext.len() > NONCE_LEN {
            let (n, ct) = ciphertext.split_at(NONCE_LEN);
            (Nonce::from_slice(n), ct)
        } else {
            // Legacy: fixed nonce (unsafe but preserved for reading old DBs).
            (Nonce::from_slice(b"unique nonce"), ciphertext)
        };
        let plaintext = self
            .cipher
            .decrypt(nonce, ct)
            .map_err(|_| anyhow::anyhow!("Decryption failed"))?;

        let context: SharedContext = serde_json::from_slice(&plaintext)?;

        Ok(Some(context))
    }

    /// List all conversation IDs
    pub fn list_contexts(&self) -> Result<Vec<String>> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(CONTEXT_TABLE)?;

        let mut ids = Vec::new();
        for item in table.iter()? {
            let (key, _) = item?;
            ids.push(key.value().to_string());
        }

        Ok(ids)
    }

    /// Delete context
    pub fn delete_context(&self, conversation_id: &str) -> Result<()> {
        let write_txn = self.db.begin_write()?;
        {
            let mut table = write_txn.open_table(CONTEXT_TABLE)?;
            table.remove(conversation_id)?;
        }
        write_txn.commit()?;

        Ok(())
    }

    /// Get all contexts (for migration/backup)
    pub fn get_all_contexts(&self) -> Result<Vec<SharedContext>> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(CONTEXT_TABLE)?;

        let mut contexts = Vec::new();

        for item in table.iter()? {
            let (_, encrypted) = item?;
            let ciphertext = encrypted.value();

            let (nonce, ct) = if ciphertext.len() > NONCE_LEN {
                let (n, ct) = ciphertext.split_at(NONCE_LEN);
                (Nonce::from_slice(n), ct)
            } else {
                (Nonce::from_slice(b"unique nonce"), ciphertext)
            };
            match self.cipher.decrypt(nonce, ct) {
                Ok(plaintext) => {
                    if let Ok(context) = serde_json::from_slice(&plaintext) {
                        contexts.push(context);
                    }
                }
                Err(e) => {
                    warn!("Failed to decrypt context: {}", e);
                }
            }
        }

        Ok(contexts)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::ContextMessage;
    use tempfile::tempdir;

    #[test]
    fn test_storage_create() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let storage = EncryptedStorage::new(&db_path, None);
        assert!(storage.is_ok());
    }

    #[test]
    fn test_store_and_retrieve() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let storage = EncryptedStorage::new(&db_path, None).unwrap();

        let context = SharedContext {
            conversation_id: "test-123".to_string(),
            messages: vec![ContextMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
                timestamp: 12345,
                peer_id: "peer-1".to_string(),
            }],
            tool_state: serde_json::json!({}),
            last_updated: 12345,
        };

        storage.store_context(&context).unwrap();

        let retrieved = storage.get_context("test-123").unwrap();
        assert!(retrieved.is_some());

        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.conversation_id, "test-123");
        assert_eq!(retrieved.messages.len(), 1);
    }

    #[test]
    fn test_list_contexts() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let storage = EncryptedStorage::new(&db_path, None).unwrap();

        let context1 = SharedContext {
            conversation_id: "test-1".to_string(),
            messages: vec![],
            tool_state: serde_json::json!({}),
            last_updated: 1000,
        };

        let context2 = SharedContext {
            conversation_id: "test-2".to_string(),
            messages: vec![],
            tool_state: serde_json::json!({}),
            last_updated: 2000,
        };

        storage.store_context(&context1).unwrap();
        storage.store_context(&context2).unwrap();

        let ids = storage.list_contexts().unwrap();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"test-1".to_string()));
        assert!(ids.contains(&"test-2".to_string()));
    }
}
