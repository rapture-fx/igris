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
#[derive(Clone)]
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

    /// Encrypt bytes in-memory (no disk I/O)
    /// Returns encrypted data with nonce prepended
    pub fn encrypt_bytes(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        // Generate a random nonce (96 bits for GCM)
        let nonce_bytes = rand::random::<[u8; 12]>();
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Create cipher
        let cipher =
            Aes256Gcm::new_from_slice(&self.key).context("Failed to create AES-256-GCM cipher")?;

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Prepend nonce to ciphertext (needed for decryption)
        let mut output = nonce.to_vec();
        output.extend_from_slice(&ciphertext);

        debug!("Encrypted {} bytes in-memory", plaintext.len());
        Ok(output)
    }

    /// Decrypt bytes in-memory (no disk I/O)
    pub fn decrypt_bytes(&self, encrypted_data: &[u8]) -> Result<Vec<u8>> {
        if encrypted_data.len() < 12 {
            anyhow::bail!("Encrypted data is too small (< 12 bytes)");
        }

        // Extract nonce (first 12 bytes) and ciphertext
        let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Create cipher
        let cipher =
            Aes256Gcm::new_from_slice(&self.key).context("Failed to create AES-256-GCM cipher")?;

        // Decrypt
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        debug!("Decrypted {} bytes in-memory", plaintext.len());
        Ok(plaintext)
    }

    /// Encrypt a file and save it to a new location
    pub fn encrypt_file<P: AsRef<Path>, Q: AsRef<Path>>(
        &self,
        input_path: P,
        output_path: Q,
    ) -> Result<()> {
        // Read input file
        let plaintext =
            fs::read(input_path.as_ref()).context("Failed to read input file for encryption")?;

        // Encrypt in-memory
        let encrypted_data = self.encrypt_bytes(&plaintext)?;

        // Write encrypted file
        fs::write(output_path.as_ref(), encrypted_data)
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
        let encrypted_data =
            fs::read(input_path.as_ref()).context("Failed to read encrypted file")?;

        // Decrypt in-memory
        let plaintext = self.decrypt_bytes(&encrypted_data)?;

        // Write decrypted file
        fs::write(output_path.as_ref(), plaintext).context("Failed to write decrypted file")?;

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

    #[test]
    fn test_encrypt_decrypt_bytes_roundtrip() -> Result<()> {
        // Test in-memory encryption/decryption
        let encryption = AdapterEncryption::new("test-passphrase");
        let test_data = b"This is sensitive LoRA adapter data that should never hit disk!";

        // Encrypt in-memory
        let encrypted = encryption.encrypt_bytes(test_data)?;

        // Verify encrypted data is different
        assert_ne!(encrypted.as_slice(), test_data);
        assert!(encrypted.len() > test_data.len()); // Should be larger (nonce + ciphertext)

        // Decrypt in-memory
        let decrypted = encryption.decrypt_bytes(&encrypted)?;

        // Verify decrypted matches original
        assert_eq!(decrypted, test_data);

        Ok(())
    }

    #[test]
    fn test_bytes_encryption_wrong_key_fails() -> Result<()> {
        let encryption1 = AdapterEncryption::new("passphrase1");
        let encryption2 = AdapterEncryption::new("passphrase2");

        let test_data = b"Secret adapter weights";

        // Encrypt with first key
        let encrypted = encryption1.encrypt_bytes(test_data)?;

        // Try to decrypt with second key
        let result = encryption2.decrypt_bytes(&encrypted);

        // Should fail
        assert!(result.is_err());

        Ok(())
    }

    #[test]
    fn test_bytes_encryption_preserves_data() -> Result<()> {
        // Test that large data is preserved correctly
        let encryption = AdapterEncryption::new("test-key");

        // Create large test data (1 MB)
        let large_data: Vec<u8> = (0..1_000_000).map(|i| (i % 256) as u8).collect();

        // Encrypt
        let encrypted = encryption.encrypt_bytes(&large_data)?;

        // Decrypt
        let decrypted = encryption.decrypt_bytes(&encrypted)?;

        // Verify
        assert_eq!(decrypted.len(), large_data.len());
        assert_eq!(decrypted, large_data);

        Ok(())
    }
}
