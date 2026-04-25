use anyhow::{anyhow, Context, Result};
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub(crate) struct RuntimeIdentity {
    pub(crate) public_key_hex: String,
    pub(crate) signing_key: SigningKey,
}

pub(crate) fn load_or_create_runtime_identity() -> Result<RuntimeIdentity> {
    let path = std::env::var("IGRIS_RUNTIME_SIGNING_KEY_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(".igris/runtime-signing-key.ed25519"));
    load_or_create_runtime_identity_at(&path)
}

fn load_or_create_runtime_identity_at(path: &Path) -> Result<RuntimeIdentity> {
    if path.exists() {
        let encoded = fs::read_to_string(path)
            .with_context(|| format!("failed to read runtime signing key {}", path.display()))?;
        let secret = decode_signing_key(encoded.trim(), path)?;
        return Ok(runtime_identity_from_secret(secret));
    }

    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).with_context(|| {
                format!(
                    "failed to create runtime identity directory {}",
                    parent.display()
                )
            })?;
        }
    }

    let signing_key = SigningKey::generate(&mut OsRng);
    let secret = signing_key.to_bytes();
    let encoded = encode_hex(&secret);

    fs::write(path, format!("{encoded}\n"))
        .with_context(|| format!("failed to persist runtime signing key {}", path.display()))?;
    set_owner_only_permissions(path)?;

    Ok(RuntimeIdentity {
        public_key_hex: encode_hex(signing_key.verifying_key().as_bytes()),
        signing_key,
    })
}

fn decode_signing_key(encoded: &str, path: &Path) -> Result<[u8; 32]> {
    let bytes = decode_hex(encoded)
        .with_context(|| format!("runtime signing key {} is not valid hex", path.display()))?;
    let secret: [u8; 32] = bytes.try_into().map_err(|_| {
        anyhow!(
            "runtime signing key {} must be 32 bytes / 64 hex chars",
            path.display()
        )
    })?;
    Ok(secret)
}

fn runtime_identity_from_secret(secret: [u8; 32]) -> RuntimeIdentity {
    let signing_key = SigningKey::from_bytes(&secret);
    RuntimeIdentity {
        public_key_hex: encode_hex(signing_key.verifying_key().as_bytes()),
        signing_key,
    }
}

fn encode_hex(bytes: &[u8]) -> String {
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push_str(&format!("{:02x}", byte));
    }
    encoded
}

fn decode_hex(encoded: &str) -> Result<Vec<u8>> {
    if encoded.len() % 2 != 0 {
        anyhow::bail!("hex string has odd length");
    }

    (0..encoded.len())
        .step_by(2)
        .map(|idx| u8::from_str_radix(&encoded[idx..idx + 2], 16).map_err(anyhow::Error::from))
        .collect()
}

#[cfg(unix)]
fn set_owner_only_permissions(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, permissions).with_context(|| {
        format!(
            "failed to set restrictive permissions on runtime signing key {}",
            path.display()
        )
    })?;
    Ok(())
}

#[cfg(not(unix))]
fn set_owner_only_permissions(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_or_create_runtime_identity_reuses_existing_key() {
        let temp_dir =
            std::env::temp_dir().join(format!("igris-runtime-identity-{}", uuid::Uuid::new_v4()));
        let key_path = temp_dir.join("runtime.key");

        let first = load_or_create_runtime_identity_at(&key_path).unwrap();
        let second = load_or_create_runtime_identity_at(&key_path).unwrap();

        assert_eq!(first.public_key_hex, second.public_key_hex);
        assert_eq!(first.signing_key.to_bytes(), second.signing_key.to_bytes());
    }

    #[test]
    fn load_or_create_runtime_identity_rejects_invalid_key_material() {
        let temp_dir = std::env::temp_dir().join(format!(
            "igris-runtime-identity-invalid-{}",
            uuid::Uuid::new_v4()
        ));
        let key_path = temp_dir.join("runtime.key");
        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(&key_path, "not-hex\n").unwrap();

        let err = load_or_create_runtime_identity_at(&key_path).unwrap_err();
        assert!(err.to_string().contains("not valid hex"));
    }
}
