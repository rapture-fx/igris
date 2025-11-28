/*!
 * Cryptographic primitives for EscapeVector Mode
 *
 * - AES-256-GCM encryption
 * - HMAC-SHA256 signature verification
 * - SHA-256 key derivation
 */

use wasm_bindgen::prelude::*;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce, Key,
};
use hmac::{Hmac, Mac};
use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};

type HmacSha256 = Hmac<Sha256>;

/// Inertial TTL - 72 hours in milliseconds
pub const INERTIAL_TTL: u64 = 72 * 60 * 60 * 1000;

/// Max clock skew for tamper detection - 5 minutes in milliseconds
pub const MAX_CLOCK_SKEW: u64 = 5 * 60 * 1000;

/// Encrypted Bayesian state with HMAC signature
#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedState {
    pub ciphertext: Vec<u8>,
    pub iv: Vec<u8>,
    pub hmac: Vec<u8>,
    pub version: u32,
    pub timestamp: u64,
    pub expires_at: u64,
}

/// Bayesian state signer - handles encryption and HMAC
#[wasm_bindgen]
pub struct BayesianSigner {
    key: [u8; 32],
}

#[wasm_bindgen]
impl BayesianSigner {
    /// Create a new signer with 32-byte key
    #[wasm_bindgen(constructor)]
    pub fn new(key_bytes: &[u8]) -> Result<BayesianSigner, JsValue> {
        if key_bytes.len() != 32 {
            return Err(JsValue::from_str("Key must be 32 bytes for AES-256"));
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(key_bytes);

        Ok(BayesianSigner { key })
    }

    /// Derive encryption key from API key using SHA-256
    #[wasm_bindgen(js_name = deriveKey)]
    pub fn derive_key(api_key: &str) -> Vec<u8> {
        let key = if api_key.is_empty() {
            "schlep-default-encryption-key-change-me"
        } else {
            api_key
        };

        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        hasher.finalize().to_vec()
    }

    /// Encrypt and sign Bayesian state JSON
    #[wasm_bindgen(js_name = encryptState)]
    pub fn encrypt_state(&self, state_json: &str, version: u32) -> Result<String, JsValue> {
        // Generate random 12-byte nonce for AES-GCM
        let mut nonce_bytes = [0u8; 12];
        getrandom::getrandom(&mut nonce_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to generate nonce: {}", e)))?;
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Create cipher
        let key = Key::<Aes256Gcm>::from_slice(&self.key);
        let cipher = Aes256Gcm::new(key);

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, state_json.as_bytes())
            .map_err(|e| JsValue::from_str(&format!("Encryption failed: {}", e)))?;

        // Calculate HMAC over (ciphertext || nonce)
        let mut mac = <HmacSha256 as Mac>::new_from_slice(&self.key)
            .map_err(|e| JsValue::from_str(&format!("HMAC init failed: {}", e)))?;
        mac.update(&ciphertext);
        mac.update(&nonce_bytes);
        let hmac = mac.finalize().into_bytes().to_vec();

        // Create encrypted state
        let now = js_sys::Date::now() as u64;
        let encrypted = EncryptedState {
            ciphertext,
            iv: nonce_bytes.to_vec(),
            hmac,
            version,
            timestamp: now,
            expires_at: now + INERTIAL_TTL,
        };

        // Serialize to JSON
        serde_json::to_string(&encrypted)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
    }

    /// Decrypt and verify Bayesian state
    #[wasm_bindgen(js_name = decryptState)]
    pub fn decrypt_state(&self, encrypted_json: &str) -> Result<String, JsValue> {
        // Deserialize encrypted state
        let encrypted: EncryptedState = serde_json::from_str(encrypted_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse encrypted state: {}", e)))?;

        let now = js_sys::Date::now() as u64;

        // Detect clock tampering
        if encrypted.timestamp > now + MAX_CLOCK_SKEW {
            return Err(JsValue::from_str(
                "State timestamp in future - clock may be tampered"
            ));
        }

        // Check expiration (72-hour inertial quorum)
        if now > encrypted.expires_at {
            return Err(JsValue::from_str(&format!(
                "Bayesian state expired at {} (current: {}) - force Gold Code Override",
                encrypted.expires_at, now
            )));
        }

        // Verify HMAC
        let mut mac = <HmacSha256 as Mac>::new_from_slice(&self.key)
            .map_err(|e| JsValue::from_str(&format!("HMAC init failed: {}", e)))?;
        mac.update(&encrypted.ciphertext);
        mac.update(&encrypted.iv);

        mac.verify_slice(&encrypted.hmac)
            .map_err(|_| JsValue::from_str("HMAC verification failed - state may be tampered"))?;

        // Decrypt
        if encrypted.iv.len() != 12 {
            return Err(JsValue::from_str("Invalid nonce length"));
        }

        let nonce = Nonce::from_slice(&encrypted.iv);
        let key = Key::<Aes256Gcm>::from_slice(&self.key);
        let cipher = Aes256Gcm::new(key);

        let plaintext = cipher
            .decrypt(nonce, encrypted.ciphertext.as_ref())
            .map_err(|e| JsValue::from_str(&format!("Decryption failed: {}", e)))?;

        // Convert to string
        String::from_utf8(plaintext)
            .map_err(|e| JsValue::from_str(&format!("Invalid UTF-8 in plaintext: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let key = BayesianSigner::derive_key("test-api-key");
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = BayesianSigner::derive_key("test-api-key");
        let signer = BayesianSigner::new(&key).unwrap();

        let original = r#"{"version":0,"timestamp":1234567890}"#;

        let encrypted = signer.encrypt_state(original, 0).unwrap();
        let decrypted = signer.decrypt_state(&encrypted).unwrap();

        assert_eq!(original, decrypted);
    }

    #[test]
    fn test_hmac_tampering_detection() {
        let key = BayesianSigner::derive_key("test-api-key");
        let signer = BayesianSigner::new(&key).unwrap();

        let original = r#"{"version":0,"timestamp":1234567890}"#;
        let mut encrypted = signer.encrypt_state(original, 0).unwrap();

        // Tamper with ciphertext
        let mut parsed: EncryptedState = serde_json::from_str(&encrypted).unwrap();
        parsed.ciphertext[0] ^= 0xFF;
        encrypted = serde_json::to_string(&parsed).unwrap();

        // Should fail verification
        assert!(signer.decrypt_state(&encrypted).is_err());
    }
}
