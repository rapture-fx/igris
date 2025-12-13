use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::{Aead, OsRng};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime};

const CACHE_TTL_HOURS: u64 = 72;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BayesianState {
    pub provider_weights: Vec<f64>,
    pub success_counts: Vec<u64>,
    pub failure_counts: Vec<u64>,
    pub last_updated: u64, // Unix timestamp
}

pub struct EscapeVectorCache {
    cache_path: String,
    encryption_key: [u8; 32],
}

impl EscapeVectorCache {
    pub fn new<P: AsRef<Path>>(cache_dir: P, encryption_key: [u8; 32]) -> anyhow::Result<Self> {
        let cache_path = cache_dir.as_ref().join("bayesian_state.enc");

        Ok(Self {
            cache_path: cache_path.to_string_lossy().to_string(),
            encryption_key,
        })
    }

    pub fn save(&self, state: &BayesianState) -> anyhow::Result<()> {
        let serialized = serde_json::to_vec(state)?;

        // Encrypt with AES-256-GCM
        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let nonce = Nonce::from_slice(&[0u8; 12]); // In production, use random nonce

        let encrypted = cipher
            .encrypt(nonce, serialized.as_ref())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Atomic write
        let temp_path = format!("{}.tmp", self.cache_path);
        fs::write(&temp_path, &encrypted)?;
        fs::rename(&temp_path, &self.cache_path)?;

        Ok(())
    }

    pub fn load(&self) -> anyhow::Result<Option<BayesianState>> {
        if !Path::new(&self.cache_path).exists() {
            return Ok(None);
        }

        let encrypted = fs::read(&self.cache_path)?;

        // Decrypt
        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let nonce = Nonce::from_slice(&[0u8; 12]);

        let decrypted = cipher
            .decrypt(nonce, encrypted.as_ref())
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        let state: BayesianState = serde_json::from_slice(&decrypted)?;

        // Check TTL (72 hours)
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs();

        let age = now - state.last_updated;
        if age > CACHE_TTL_HOURS * 3600 {
            return Ok(None); // Expired
        }

        Ok(Some(state))
    }

    pub fn clear(&self) -> anyhow::Result<()> {
        if Path::new(&self.cache_path).exists() {
            fs::remove_file(&self.cache_path)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_save_and_load() {
        let temp_dir = std::env::temp_dir();
        let key = [0u8; 32];
        let cache = EscapeVectorCache::new(&temp_dir, key).unwrap();

        let state = BayesianState {
            provider_weights: vec![0.5, 0.3, 0.2],
            success_counts: vec![10, 5, 3],
            failure_counts: vec![1, 2, 1],
            last_updated: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        cache.save(&state).unwrap();
        let loaded = cache.load().unwrap();

        assert!(loaded.is_some());
        let loaded_state = loaded.unwrap();
        assert_eq!(loaded_state.provider_weights, state.provider_weights);

        cache.clear().unwrap();
    }
}
