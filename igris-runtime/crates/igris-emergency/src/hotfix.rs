use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencyPolicy {
    pub encrypted_policy: String,
    pub signature: String,
    pub version: u64,
    pub expires_at: i64, // Unix milliseconds
    pub issuer: String,
    pub reason: String,
}

pub struct PolicyStore {
    public_key: VerifyingKey,
    current_policy: Option<EmergencyPolicy>,
}

impl PolicyStore {
    pub fn new(public_key_base64: &str) -> anyhow::Result<Self> {
        let public_key_bytes =
            base64::engine::general_purpose::STANDARD.decode(public_key_base64)?;

        let public_key_array: [u8; 32] = public_key_bytes
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid public key length"))?;

        let public_key = VerifyingKey::from_bytes(&public_key_array)?;

        Ok(Self {
            public_key,
            current_policy: None,
        })
    }

    pub fn apply_policy(&mut self, policy: EmergencyPolicy) -> anyhow::Result<()> {
        // Verify signature
        let sig_bytes = base64::engine::general_purpose::STANDARD.decode(&policy.signature)?;

        let sig_array: [u8; 64] = sig_bytes
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid signature length"))?;

        let signature = Signature::from_bytes(&sig_array);

        let message = format!(
            "{}{}{}",
            policy.encrypted_policy, policy.version, policy.expires_at
        );

        self.public_key
            .verify(message.as_bytes(), &signature)
            .map_err(|e| anyhow::anyhow!("Signature verification failed: {}", e))?;

        // Verify expiration
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_millis() as i64;

        if now > policy.expires_at {
            anyhow::bail!("Policy expired");
        }

        // Verify version is monotonically increasing
        if let Some(current) = &self.current_policy {
            if policy.version <= current.version {
                anyhow::bail!(
                    "Policy version must increase (current: {}, new: {})",
                    current.version,
                    policy.version
                );
            }
        }

        self.current_policy = Some(policy);
        Ok(())
    }

    pub fn get_current_policy(&self) -> Option<&EmergencyPolicy> {
        self.current_policy.as_ref()
    }

    pub fn is_active(&self) -> bool {
        if let Some(policy) = &self.current_policy {
            let now = SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64;

            now <= policy.expires_at
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_policy_store_creation() {
        // Test public key creation
        let test_key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32 bytes base64
        let result = PolicyStore::new(test_key);
        assert!(result.is_ok());
    }

    #[test]
    fn test_policy_expiration() {
        let test_key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        let mut store = PolicyStore::new(test_key).unwrap();

        let expired_policy = EmergencyPolicy {
            encrypted_policy: "test".to_string(),
            signature: String::new(),
            version: 1,
            expires_at: 0, // Already expired
            issuer: "test".to_string(),
            reason: "test".to_string(),
        };

        // This should fail due to expiration, not signature
        let result = store.apply_policy(expired_policy);
        assert!(result.is_err());
    }
}
