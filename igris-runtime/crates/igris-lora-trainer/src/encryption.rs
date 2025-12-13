use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use tracing::{debug, info};

/// Adapter encryption using AES-256-GCM
pub struct AdapterEncryption {
    key: [u8; 32],
}

impl AdapterEncryption {
    /// Create a new encryption handler with a key derived from a passphrase
    /// For production, the passphrase should be device-specific (e.g., hardware ID)
    pub fn new(passphrase: &str) -> Self {
        // Derive 256-bit key from passphrase using SHA-256
        let mut hasher = Sha256::new();
        hasher.update(passphrase.as_bytes());
        let key: [u8; 32] = hasher.finalize().into();

        Self { key }
    }

    /// Create with default device-specific key
    pub fn with_device_key() -> Self {
        // In production, this should use actual device-specific data
        // For now, use a combination of hostname and a fixed secret
        let hostname = hostname::get()
            .ok()
            .and_then(|h| h.into_string().ok())
            .unwrap_or_else(|| "igris-device".to_string());

        let passphrase = format!("igris-lora-{}", hostname);
        Self::new(&passphrase)
    }

    /// Encrypt a file and save it to a new location
    pub fn encrypt_file<P: AsRef<Path>, Q: AsRef<Path>>(
        &self,
        input_path: P,
        output_path: Q,
    ) -> Result<()> {
        // Read input file
        let plaintext = fs::read(input_path.as_ref())
            .context("Failed to read input file for encryption")?;

        // Generate a random nonce (96 bits for GCM)
        let nonce_bytes = rand::random::<[u8; 12]>();
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Create cipher
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .context("Failed to create AES-256-GCM cipher")?;

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_ref())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Prepend nonce to ciphertext (needed for decryption)
        let mut output = nonce.to_vec();
        output.extend_from_slice(&ciphertext);

        // Write encrypted file
        fs::write(output_path.as_ref(), output)
            .context("Failed to write encrypted file")?;

        info!(
            "Encrypted adapter: {} -> {}",
            input_path.as_ref().display(),
            output_path.as_ref().display()
        );

        Ok(())
    }

    /// Decrypt a file and save it to a new location
    pub fn decrypt_file<P: AsRef<Path>, Q: AsRef<Path>>(
        &self,
        input_path: P,
        output_path: Q,
    ) -> Result<()> {
        // Read encrypted file
        let data = fs::read(input_path.as_ref())
            .context("Failed to read encrypted file")?;

        if data.len() < 12 {
            anyhow::bail!("Encrypted file is too small (< 12 bytes)");
        }

        // Extract nonce (first 12 bytes) and ciphertext
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Create cipher
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .context("Failed to create AES-256-GCM cipher")?;

        // Decrypt
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        // Write decrypted file
        fs::write(output_path.as_ref(), plaintext)
            .context("Failed to write decrypted file")?;

        debug!(
            "Decrypted adapter: {} -> {}",
            input_path.as_ref().display(),
            output_path.as_ref().display()
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_encrypt_decrypt_roundtrip() -> Result<()> {
        let dir = tempdir()?;
        let original = dir.path().join("original.bin");
        let encrypted = dir.path().join("encrypted.bin");
        let decrypted = dir.path().join("decrypted.bin");

        // Create test data
        let test_data = b"This is sensitive LoRA adapter data!";
        fs::write(&original, test_data)?;

        // Encrypt
        let encryption = AdapterEncryption::new("test-passphrase");
        encryption.encrypt_file(&original, &encrypted)?;

        // Verify encrypted file is different
        let encrypted_data = fs::read(&encrypted)?;
        assert_ne!(encrypted_data, test_data);

        // Decrypt
        encryption.decrypt_file(&encrypted, &decrypted)?;

        // Verify decrypted matches original
        let decrypted_data = fs::read(&decrypted)?;
        assert_eq!(decrypted_data, test_data);

        Ok(())
    }

    #[test]
    fn test_wrong_passphrase_fails() -> Result<()> {
        let dir = tempdir()?;
        let original = dir.path().join("original.bin");
        let encrypted = dir.path().join("encrypted.bin");
        let decrypted = dir.path().join("decrypted.bin");

        // Create test data
        let test_data = b"Secret data";
        fs::write(&original, test_data)?;

        // Encrypt with one passphrase
        let encryption1 = AdapterEncryption::new("passphrase1");
        encryption1.encrypt_file(&original, &encrypted)?;

        // Try to decrypt with different passphrase
        let encryption2 = AdapterEncryption::new("passphrase2");
        let result = encryption2.decrypt_file(&encrypted, &decrypted);

        // Should fail
        assert!(result.is_err());

        Ok(())
    }
}
