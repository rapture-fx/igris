use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

const CACHE_TTL_HOURS: u64 = 72;
const RESPONSE_CACHE_TTL_HOURS: u64 = 24; // Response cache expires sooner

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BayesianState {
    pub provider_weights: Vec<f64>,
    pub success_counts: Vec<u64>,
    pub failure_counts: Vec<u64>,
    pub last_updated: u64, // Unix timestamp
}

/// Cached response entry with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedResponse {
    pub prompt_hash: String,
    pub response_text: String,
    pub model: String,
    pub cached_at: u64,
    pub hit_count: u32,
    pub quality_score: f32, // 0.0-1.0, indicates response quality/confidence
}

/// EscapeVector response cache for graceful degradation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseCache {
    pub entries: HashMap<String, CachedResponse>,
    pub last_cleanup: u64,
}

pub struct EscapeVectorCache {
    bayesian_cache_path: String,
    response_cache_path: String,
    encryption_key: [u8; 32],
}

impl EscapeVectorCache {
    pub fn new<P: AsRef<Path>>(cache_dir: P, encryption_key: [u8; 32]) -> anyhow::Result<Self> {
        let cache_dir = cache_dir.as_ref();

        // Ensure cache directory exists
        if !cache_dir.exists() {
            fs::create_dir_all(cache_dir)?;
        }

        let bayesian_cache_path = cache_dir.join("bayesian_state.enc");
        let response_cache_path = cache_dir.join("response_cache.enc");

        Ok(Self {
            bayesian_cache_path: bayesian_cache_path.to_string_lossy().to_string(),
            response_cache_path: response_cache_path.to_string_lossy().to_string(),
            encryption_key,
        })
    }

    /// Generate SHA-256 hash of prompt for cache key
    fn hash_prompt(prompt: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(prompt.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub fn save_bayesian(&self, state: &BayesianState) -> anyhow::Result<()> {
        let serialized = serde_json::to_vec(state)?;

        // Encrypt with AES-256-GCM using random nonce
        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
        let nonce = Nonce::from_slice(&nonce_bytes);

        let encrypted = cipher
            .encrypt(nonce, serialized.as_ref())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Prepend nonce to ciphertext: [nonce(12)][ciphertext]
        let mut output = Vec::with_capacity(12 + encrypted.len());
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&encrypted);

        // Atomic write
        let temp_path = format!("{}.tmp", self.bayesian_cache_path);
        fs::write(&temp_path, &output)?;
        fs::rename(&temp_path, &self.bayesian_cache_path)?;

        Ok(())
    }

    // Backward compatibility alias
    pub fn save(&self, state: &BayesianState) -> anyhow::Result<()> {
        self.save_bayesian(state)
    }

    pub fn load_bayesian(&self) -> anyhow::Result<Option<BayesianState>> {
        if !Path::new(&self.bayesian_cache_path).exists() {
            return Ok(None);
        }

        let data = fs::read(&self.bayesian_cache_path)?;

        // Extract nonce from first 12 bytes
        if data.len() < 12 {
            return Err(anyhow::anyhow!("Corrupted cache file: too short"));
        }
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Decrypt
        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let decrypted = cipher
            .decrypt(nonce, ciphertext)
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

    // Backward compatibility alias
    pub fn load(&self) -> anyhow::Result<Option<BayesianState>> {
        self.load_bayesian()
    }

    /// Save a cached response
    pub fn save_response(
        &self,
        prompt: &str,
        response: &str,
        model: &str,
        quality_score: f32,
    ) -> anyhow::Result<()> {
        let prompt_hash = Self::hash_prompt(prompt);
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs();

        // Load existing cache or create new
        let mut cache = self
            .load_response_cache()
            .unwrap_or_else(|_| ResponseCache {
                entries: HashMap::new(),
                last_cleanup: now,
            });

        // Create or update entry
        if let Some(entry) = cache.entries.get_mut(&prompt_hash) {
            entry.hit_count += 1;
            entry.response_text = response.to_string();
            entry.quality_score = quality_score;
        } else {
            cache.entries.insert(
                prompt_hash.clone(),
                CachedResponse {
                    prompt_hash,
                    response_text: response.to_string(),
                    model: model.to_string(),
                    cached_at: now,
                    hit_count: 1,
                    quality_score,
                },
            );
        }

        // Cleanup old entries if needed (every 24 hours)
        if now - cache.last_cleanup > 24 * 3600 {
            cache.entries.retain(|_, entry| {
                let age = now - entry.cached_at;
                age <= RESPONSE_CACHE_TTL_HOURS * 3600
            });
            cache.last_cleanup = now;
        }

        // Save encrypted cache with random nonce
        let serialized = serde_json::to_vec(&cache)?;
        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
        let nonce = Nonce::from_slice(&nonce_bytes);

        let encrypted = cipher
            .encrypt(nonce, serialized.as_ref())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Prepend nonce to ciphertext: [nonce(12)][ciphertext]
        let mut output = Vec::with_capacity(12 + encrypted.len());
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&encrypted);

        let temp_path = format!("{}.tmp", self.response_cache_path);
        fs::write(&temp_path, &output)?;
        fs::rename(&temp_path, &self.response_cache_path)?;

        Ok(())
    }

    /// Load a cached response for a given prompt
    pub fn load_response(&self, prompt: &str) -> anyhow::Result<Option<CachedResponse>> {
        let prompt_hash = Self::hash_prompt(prompt);
        let cache = self.load_response_cache()?;

        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs();

        if let Some(entry) = cache.entries.get(&prompt_hash) {
            let age = now - entry.cached_at;
            if age <= RESPONSE_CACHE_TTL_HOURS * 3600 {
                return Ok(Some(entry.clone()));
            }
        }

        Ok(None)
    }

    /// Load the entire response cache
    fn load_response_cache(&self) -> anyhow::Result<ResponseCache> {
        if !Path::new(&self.response_cache_path).exists() {
            return Ok(ResponseCache {
                entries: HashMap::new(),
                last_cleanup: SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)?
                    .as_secs(),
            });
        }

        let data = fs::read(&self.response_cache_path)?;

        // Extract nonce from first 12 bytes
        if data.len() < 12 {
            return Err(anyhow::anyhow!("Corrupted cache file: too short"));
        }
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let decrypted = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        let cache: ResponseCache = serde_json::from_slice(&decrypted)?;
        Ok(cache)
    }

    pub fn clear(&self) -> anyhow::Result<()> {
        if Path::new(&self.bayesian_cache_path).exists() {
            fs::remove_file(&self.bayesian_cache_path)?;
        }
        if Path::new(&self.response_cache_path).exists() {
            fs::remove_file(&self.response_cache_path)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bayesian_cache_save_and_load() {
        let temp_dir = std::env::temp_dir().join("igris_test_bayesian");
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

        cache.save_bayesian(&state).unwrap();
        let loaded = cache.load_bayesian().unwrap();

        assert!(loaded.is_some());
        let loaded_state = loaded.unwrap();
        assert_eq!(loaded_state.provider_weights, state.provider_weights);

        cache.clear().unwrap();
    }

    #[test]
    fn test_response_cache_save_and_load() {
        let temp_dir = std::env::temp_dir().join("igris_test_response");
        let key = [1u8; 32];
        let cache = EscapeVectorCache::new(&temp_dir, key).unwrap();

        let prompt = "What is the capital of France?";
        let response = "The capital of France is Paris.";
        let model = "gpt-4";
        let quality_score = 0.95;

        // Save response
        cache
            .save_response(prompt, response, model, quality_score)
            .unwrap();

        // Load response
        let loaded = cache.load_response(prompt).unwrap();
        assert!(loaded.is_some());

        let cached = loaded.unwrap();
        assert_eq!(cached.response_text, response);
        assert_eq!(cached.model, model);
        assert_eq!(cached.quality_score, quality_score);
        assert_eq!(cached.hit_count, 1);

        // Save again (should increment hit count)
        cache
            .save_response(prompt, response, model, quality_score)
            .unwrap();
        let loaded2 = cache.load_response(prompt).unwrap();
        assert_eq!(loaded2.unwrap().hit_count, 2);

        cache.clear().unwrap();
    }

    #[test]
    fn test_response_cache_different_prompts() {
        let temp_dir = std::env::temp_dir().join("igris_test_multi");
        let key = [2u8; 32];
        let cache = EscapeVectorCache::new(&temp_dir, key).unwrap();

        // Save multiple responses
        cache
            .save_response("prompt1", "response1", "model1", 0.9)
            .unwrap();
        cache
            .save_response("prompt2", "response2", "model2", 0.8)
            .unwrap();

        // Load both
        let r1 = cache.load_response("prompt1").unwrap();
        let r2 = cache.load_response("prompt2").unwrap();

        assert!(r1.is_some());
        assert!(r2.is_some());
        assert_eq!(r1.unwrap().response_text, "response1");
        assert_eq!(r2.unwrap().response_text, "response2");

        // Non-existent prompt
        let r3 = cache.load_response("prompt3").unwrap();
        assert!(r3.is_none());

        cache.clear().unwrap();
    }

    #[test]
    fn test_prompt_hashing_consistency() {
        let hash1 = EscapeVectorCache::hash_prompt("test prompt");
        let hash2 = EscapeVectorCache::hash_prompt("test prompt");
        let hash3 = EscapeVectorCache::hash_prompt("different prompt");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }
}
