//! Cryptographic operations for fleet hybrid contract
//!
//! Implements Ed25519 signing for Runtime registration and heartbeats to establish
//! a cryptographic trust model with Overture.

use anyhow::{Context, Result};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// Ed25519 keypair for signing fleet communications
pub struct FleetKeypair {
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
    key_path: PathBuf,
}

impl FleetKeypair {
    /// Load or generate a keypair from the specified path
    ///
    /// If the private key file exists, it will be loaded. Otherwise, a new keypair
    /// will be generated and saved to the file.
    pub fn load_or_generate<P: AsRef<Path>>(key_path: P) -> Result<Self> {
        let key_path = key_path.as_ref().to_path_buf();

        if key_path.exists() {
            debug!("Loading existing fleet keypair from {:?}", key_path);
            Self::load(&key_path)
        } else {
            info!("Generating new fleet keypair at {:?}", key_path);
            Self::generate(&key_path)
        }
    }

    /// Generate a new keypair and save it to the specified path
    fn generate(key_path: &Path) -> Result<Self> {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        // Generate new keypair
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();

        debug!("Generated new Ed25519 keypair");

        // Create parent directory if it doesn't exist
        if let Some(parent) = key_path.parent() {
            fs::create_dir_all(parent)
                .context("Failed to create key directory")?;
        }

        // Save private key to file (32 bytes)
        let key_bytes = signing_key.to_bytes();
        fs::write(key_path, &key_bytes)
            .context("Failed to write private key to file")?;

        // Set restrictive permissions (Unix only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(key_path)?.permissions();
            perms.set_mode(0o600); // Owner read/write only
            fs::set_permissions(key_path, perms)?;
        }

        info!("Saved fleet private key to {:?}", key_path);

        Ok(Self {
            signing_key,
            verifying_key,
            key_path: key_path.to_path_buf(),
        })
    }

    /// Load an existing keypair from the specified path
    fn load(key_path: &Path) -> Result<Self> {
        // Read private key from file (32 bytes)
        let key_bytes = fs::read(key_path)
            .context("Failed to read private key from file")?;

        if key_bytes.len() != 32 {
            return Err(anyhow::anyhow!(
                "Invalid private key length: expected 32 bytes, got {}",
                key_bytes.len()
            ));
        }

        let mut key_array = [0u8; 32];
        key_array.copy_from_slice(&key_bytes);

        let signing_key = SigningKey::from_bytes(&key_array);
        let verifying_key = signing_key.verifying_key();

        debug!("Loaded fleet keypair from {:?}", key_path);

        Ok(Self {
            signing_key,
            verifying_key,
            key_path: key_path.to_path_buf(),
        })
    }

    /// Sign a message with the private key
    ///
    /// Returns the base64-encoded signature
    pub fn sign(&self, message: &[u8]) -> String {
        use base64::Engine;
        let signature: Signature = self.signing_key.sign(message);
        base64::engine::general_purpose::STANDARD.encode(signature.to_bytes())
    }

    /// Get the base64-encoded public key
    pub fn public_key_base64(&self) -> String {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(self.verifying_key.to_bytes())
    }

    /// Get the verifying key
    pub fn verifying_key(&self) -> &VerifyingKey {
        &self.verifying_key
    }
}

/// Sign a JSON-serializable payload
pub fn sign_payload<T: Serialize>(keypair: &FleetKeypair, payload: &T) -> Result<String> {
    let json = serde_json::to_vec(payload)
        .context("Failed to serialize payload for signing")?;
    Ok(keypair.sign(&json))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_keypair_generation() {
        let temp_dir = TempDir::new().unwrap();
        let key_path = temp_dir.path().join("test_key");

        let keypair = FleetKeypair::generate(&key_path).unwrap();

        // Verify file exists
        assert!(key_path.exists());

        // Verify key material is valid
        let public_key = keypair.public_key_base64();
        assert!(!public_key.is_empty());
    }

    #[test]
    fn test_keypair_load_or_generate_creates_new() {
        let temp_dir = TempDir::new().unwrap();
        let key_path = temp_dir.path().join("test_key");

        let keypair = FleetKeypair::load_or_generate(&key_path).unwrap();
        assert!(key_path.exists());

        let public_key = keypair.public_key_base64();
        assert!(!public_key.is_empty());
    }

    #[test]
    fn test_keypair_load_or_generate_loads_existing() {
        let temp_dir = TempDir::new().unwrap();
        let key_path = temp_dir.path().join("test_key");

        // Generate first keypair
        let keypair1 = FleetKeypair::load_or_generate(&key_path).unwrap();
        let public_key1 = keypair1.public_key_base64();

        // Load it again
        let keypair2 = FleetKeypair::load_or_generate(&key_path).unwrap();
        let public_key2 = keypair2.public_key_base64();

        // Should be the same key
        assert_eq!(public_key1, public_key2);
    }

    #[test]
    fn test_sign_message() {
        let temp_dir = TempDir::new().unwrap();
        let key_path = temp_dir.path().join("test_key");

        let keypair = FleetKeypair::generate(&key_path).unwrap();

        let message = b"Hello, Fleet!";
        let signature = keypair.sign(message);

        // Verify signature is base64
        assert!(base64::decode(&signature).is_ok());

        // Verify signature length (Ed25519 signatures are 64 bytes)
        let sig_bytes = base64::decode(&signature).unwrap();
        assert_eq!(sig_bytes.len(), 64);
    }

    #[test]
    fn test_sign_payload() {
        let temp_dir = TempDir::new().unwrap();
        let key_path = temp_dir.path().join("test_key");

        let keypair = FleetKeypair::generate(&key_path).unwrap();

        #[derive(Serialize)]
        struct TestPayload {
            agent_id: String,
            timestamp: u64,
        }

        let payload = TestPayload {
            agent_id: "test-agent".to_string(),
            timestamp: 1234567890,
        };

        let signature = sign_payload(&keypair, &payload).unwrap();
        assert!(!signature.is_empty());

        // Verify signature is consistent for same payload
        let signature2 = sign_payload(&keypair, &payload).unwrap();
        assert_eq!(signature, signature2);
    }

    #[test]
    fn test_different_messages_different_signatures() {
        let temp_dir = TempDir::new().unwrap();
        let key_path = temp_dir.path().join("test_key");

        let keypair = FleetKeypair::generate(&key_path).unwrap();

        let message1 = b"Message 1";
        let message2 = b"Message 2";

        let sig1 = keypair.sign(message1);
        let sig2 = keypair.sign(message2);

        assert_ne!(sig1, sig2);
    }
}
