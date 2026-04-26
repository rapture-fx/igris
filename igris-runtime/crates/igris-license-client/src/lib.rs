use anyhow::{anyhow, Result};
use base64::Engine as _;
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

const DEFAULT_LICENSE_SERVER: &str = "https://overture.igrisinertial.com";
const DEFAULT_OFFLINE_LICENSE_PATH: &str = ".igris/offline-license.json";
const DEFAULT_DEVICE_ID_PATH: &str = ".igris/device-id";
const VERSION: &str = env!("CARGO_PKG_VERSION");

/// License validation client
#[derive(Clone)]
pub struct LicenseClient {
    base_url: String,
    client: reqwest::Client,
}

/// License features
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseFeatures {
    pub execution_layer: bool,
    pub intelligence_layer: bool,
    pub memory_layer: bool,
    pub proof_layer: bool,
    pub dashboard_access: bool,
    pub fleet_monitoring: bool,
    pub cost_optimization: bool,
    pub performance_heatmaps: bool,
    pub audit_trails: bool,
    pub ota_updates: bool,
    pub on_premise: bool,
    pub custom_sla: bool,
    pub extended_retention: bool,
    pub dedicated_support: bool,
}

/// License validation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResponse {
    pub valid: bool,
    pub tier: Option<String>,
    pub customer_email: Option<String>,
    pub devices_limit: Option<i32>,
    pub devices_active: Option<i32>,
    pub cloud_requests_limit: Option<i32>,
    pub cloud_requests_used: Option<i32>,
    pub features: Option<LicenseFeatures>,
    pub expires_at: Option<String>,
    pub status: Option<String>,
    pub offline_artifact: Option<String>,
    pub offline_artifact_key_id: Option<String>,
    pub offline_artifact_expires_at: Option<String>,
    pub error: Option<String>,
    pub message: Option<String>,
    pub upgrade_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeLicenseMode {
    LicensedOnline,
    LicensedOffline,
}

impl RuntimeLicenseMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::LicensedOnline => "licensed_online",
            Self::LicensedOffline => "licensed_offline",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupLicenseResult {
    pub mode: RuntimeLicenseMode,
    pub device_id: String,
    pub validation: ValidationResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OfflineLicenseArtifactEnvelope {
    algorithm: String,
    key_id: Option<String>,
    payload: String,
    payload_sha256: String,
    signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OfflineLicenseArtifactPayload {
    version: u32,
    license_key: String,
    device_id: String,
    runtime_version: String,
    tier: String,
    customer_email: Option<String>,
    devices_limit: i32,
    devices_active: i32,
    cloud_requests_limit: i32,
    cloud_requests_used: i32,
    features: LicenseFeatures,
    status: String,
    license_expires_at: Option<String>,
    artifact_issued_at: String,
    artifact_expires_at: String,
}

/// Device registration response
#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterResponse {
    pub registered: bool,
    pub device_id: String,
    pub device_count: i32,
    pub error: Option<String>,
    pub message: Option<String>,
}

/// Heartbeat response
#[derive(Debug, Serialize, Deserialize)]
pub struct HeartbeatResponse {
    pub status: String,
    pub last_seen: Option<String>,
    pub error: Option<String>,
}

impl LicenseClient {
    /// Create a new license client
    pub fn new(base_url: Option<&str>) -> Self {
        let base_url = base_url.unwrap_or(DEFAULT_LICENSE_SERVER).to_string();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap();

        Self { base_url, client }
    }

    /// Generate a durable device ID for this installation.
    pub fn generate_device_id() -> String {
        if let Some(device_id) = non_empty_env("IGRIS_DEVICE_ID") {
            return device_id;
        }

        let path = device_id_path();
        if let Some(device_id) = load_persisted_device_id(&path) {
            return device_id;
        }

        let device_id = legacy_host_device_id();
        if let Err(e) = persist_device_id(&path, &device_id) {
            warn!("Failed to persist device ID at {}: {}", path.display(), e);
        }
        device_id
    }

    /// Validate a license key
    pub async fn validate(
        &self,
        license_key: &str,
        device_id: &str,
        runtime_version: &str,
    ) -> Result<ValidationResponse> {
        let url = format!("{}/api/v1/license/validate", self.base_url);

        let payload = serde_json::json!({
            "license_key": license_key,
            "device_id": device_id,
            "runtime_version": runtime_version,
        });

        match self.client.post(&url).json(&payload).send().await {
            Ok(response) => {
                let status = response.status();
                let body = response.json::<ValidationResponse>().await?;

                if status.is_success() && body.valid {
                    Ok(body)
                } else {
                    Err(anyhow!(
                        "License validation failed: {}",
                        body.message.unwrap_or_else(|| "Unknown error".to_string())
                    ))
                }
            }
            Err(e) => {
                error!("Failed to connect to license server: {}", e);
                Err(anyhow!("License server unreachable: {}", e))
            }
        }
    }

    /// Register a device under a license
    pub async fn register_device(
        &self,
        license_key: &str,
        device_id: &str,
    ) -> Result<RegisterResponse> {
        let url = format!("{}/api/v1/license/device/register", self.base_url);

        let hostname = gethostname::gethostname().to_string_lossy().to_string();
        let platform = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);

        let payload = serde_json::json!({
            "license_key": license_key,
            "device_id": device_id,
            "device_info": {
                "hostname": hostname,
                "platform": platform,
                "runtime_version": VERSION,
            }
        });

        let response = self.client.post(&url).json(&payload).send().await?;

        if response.status().is_success() {
            Ok(response.json().await?)
        } else {
            let body = response.json::<RegisterResponse>().await?;
            Err(anyhow!(
                "Device registration failed: {}",
                body.message.unwrap_or_else(|| "Unknown error".to_string())
            ))
        }
    }

    /// Send a heartbeat to keep the device active
    pub async fn heartbeat(&self, license_key: &str, device_id: &str) -> Result<HeartbeatResponse> {
        let url = format!("{}/api/v1/license/device/heartbeat", self.base_url);

        let payload = serde_json::json!({
            "license_key": license_key,
            "device_id": device_id,
        });

        let response = self.client.post(&url).json(&payload).send().await?;

        if response.status().is_success() {
            Ok(response.json().await?)
        } else {
            let body = response.json::<HeartbeatResponse>().await?;
            Err(anyhow!(
                "Heartbeat failed: {}",
                body.error.unwrap_or_else(|| "Unknown error".to_string())
            ))
        }
    }

    /// Deregister a device
    pub async fn deregister_device(&self, license_key: &str, device_id: &str) -> Result<()> {
        let url = format!("{}/api/v1/license/device/deregister", self.base_url);

        let payload = serde_json::json!({
            "license_key": license_key,
            "device_id": device_id,
        });

        self.client.post(&url).json(&payload).send().await?;
        Ok(())
    }
}

fn non_empty_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn license_server_from_env() -> Option<String> {
    non_empty_env("IGRIS_LICENSE_SERVER")
}

fn offline_license_path() -> PathBuf {
    non_empty_env("IGRIS_OFFLINE_LICENSE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(DEFAULT_OFFLINE_LICENSE_PATH))
}

fn device_id_path() -> PathBuf {
    non_empty_env("IGRIS_DEVICE_ID_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(DEFAULT_DEVICE_ID_PATH))
}

fn load_persisted_device_id(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| value.starts_with("dev_") && value.len() == 36)
}

fn persist_device_id(path: &Path, device_id: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, format!("{}\n", device_id))?;
    Ok(())
}

fn legacy_host_device_id() -> String {
    let mac = mac_address::get_mac_address()
        .ok()
        .flatten()
        .map(|addr| addr.to_string())
        .unwrap_or_else(|| "unknown-mac".to_string());

    let hostname = gethostname::gethostname().to_string_lossy().to_string();

    let mut hasher = Sha256::new();
    hasher.update(mac.as_bytes());
    hasher.update(hostname.as_bytes());
    let hash = hasher.finalize();

    format!("dev_{}", hex::encode(&hash[..16]))
}

fn trusted_offline_license_public_key() -> Result<Option<VerifyingKey>> {
    let Some(hex_key) = non_empty_env("IGRIS_LICENSE_OFFLINE_PUBLIC_KEY")
        .or_else(|| non_empty_env("IGRIS_OVERTURE_PUBLIC_KEY"))
    else {
        return Ok(None);
    };

    let decoded = hex::decode(&hex_key)
        .map_err(|e| anyhow!("invalid offline license public key hex: {}", e))?;
    let bytes: [u8; 32] = decoded
        .as_slice()
        .try_into()
        .map_err(|_| anyhow!("offline license public key must be 32 bytes"))?;
    Ok(Some(VerifyingKey::from_bytes(&bytes)?))
}

fn persist_offline_artifact(path: &Path, artifact: &str) -> Result<()> {
    if artifact.trim().is_empty() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, artifact)?;
    Ok(())
}

fn parse_rfc3339(value: &str, field: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|e| anyhow!("invalid {} timestamp: {}", field, e))
}

fn load_offline_artifact(
    path: &Path,
    verifying_key: &VerifyingKey,
    device_id: &str,
    expected_license_key: Option<&str>,
) -> Result<ValidationResponse> {
    let envelope: OfflineLicenseArtifactEnvelope = serde_json::from_slice(&fs::read(path)?)
        .map_err(|e| anyhow!("failed to parse offline license artifact: {}", e))?;

    if envelope.algorithm != "ed25519-sha256" {
        return Err(anyhow!(
            "unsupported offline license algorithm: {}",
            envelope.algorithm
        ));
    }

    let payload_bytes = base64::engine::general_purpose::STANDARD
        .decode(&envelope.payload)
        .map_err(|e| anyhow!("offline artifact payload decode failed: {}", e))?;
    let payload_hash = Sha256::digest(&payload_bytes);
    let payload_hash_hex = hex::encode(payload_hash);
    if payload_hash_hex != envelope.payload_sha256 {
        return Err(anyhow!("offline artifact payload hash mismatch"));
    }

    let signature_bytes = base64::engine::general_purpose::STANDARD
        .decode(&envelope.signature)
        .map_err(|e| anyhow!("offline artifact signature decode failed: {}", e))?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|e| anyhow!("offline artifact signature invalid: {}", e))?;
    verifying_key
        .verify(&payload_hash, &signature)
        .map_err(|e| anyhow!("offline artifact signature verification failed: {}", e))?;

    let payload: OfflineLicenseArtifactPayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| anyhow!("failed to decode offline artifact payload: {}", e))?;

    if payload.device_id != device_id {
        return Err(anyhow!(
            "offline artifact device mismatch: expected {}, got {}",
            device_id,
            payload.device_id
        ));
    }
    if let Some(expected_key) = expected_license_key {
        if payload.license_key != expected_key {
            return Err(anyhow!("offline artifact license key mismatch"));
        }
    }

    let artifact_expires_at = parse_rfc3339(&payload.artifact_expires_at, "artifact_expires_at")?;
    if artifact_expires_at <= Utc::now() {
        return Err(anyhow!(
            "offline artifact expired at {}",
            artifact_expires_at
        ));
    }

    let validation = ValidationResponse {
        valid: true,
        tier: Some(payload.tier),
        customer_email: payload.customer_email,
        devices_limit: Some(payload.devices_limit),
        devices_active: Some(payload.devices_active),
        cloud_requests_limit: Some(payload.cloud_requests_limit),
        cloud_requests_used: Some(payload.cloud_requests_used),
        features: Some(payload.features),
        expires_at: payload.license_expires_at,
        status: Some(payload.status),
        offline_artifact: None,
        offline_artifact_key_id: envelope.key_id,
        offline_artifact_expires_at: Some(payload.artifact_expires_at),
        error: None,
        message: None,
        upgrade_url: None,
    };

    if validation.status.as_deref() != Some("active") {
        return Err(anyhow!("offline artifact license is not active"));
    }

    Ok(validation)
}

/// Perform license validation on startup using either live validation or a
/// signed offline artifact when the license server is unreachable.
pub async fn validate_license_on_startup(
    license_key: Option<&str>,
) -> Result<StartupLicenseResult> {
    info!("Validating license...");

    let device_id = LicenseClient::generate_device_id();
    let offline_path = offline_license_path();
    let trusted_offline_key = trusted_offline_license_public_key()?;

    if let Some(key) = license_key.filter(|value| !value.trim().is_empty()) {
        let server_url = license_server_from_env();
        let client = LicenseClient::new(server_url.as_deref());
        match client.validate(key, &device_id, VERSION).await {
            Ok(validation) => {
                info!(
                    "License valid: {} (Tier: {}, Devices: {}/{})",
                    validation.customer_email.as_deref().unwrap_or("unknown"),
                    validation.tier.as_deref().unwrap_or("unknown"),
                    validation.devices_active.unwrap_or(0),
                    validation.devices_limit.unwrap_or(0)
                );

                if let Some(artifact) = validation.offline_artifact.as_deref() {
                    if let Err(e) = persist_offline_artifact(&offline_path, artifact) {
                        warn!(
                            "Failed to persist offline license artifact at {}: {}",
                            offline_path.display(),
                            e
                        );
                    }
                }

                match client.register_device(key, &device_id).await {
                    Ok(reg) => {
                        info!(
                            "Device registered: {} (Total: {} devices)",
                            device_id, reg.device_count
                        );
                    }
                    Err(e) => {
                        warn!("Device registration failed: {}", e);
                    }
                }

                return Ok(StartupLicenseResult {
                    mode: RuntimeLicenseMode::LicensedOnline,
                    device_id,
                    validation,
                });
            }
            Err(err) => {
                let err_text = err.to_string();
                if !err_text.contains("License server unreachable") {
                    error!("License validation failed");
                    return Err(err);
                }

                warn!(
                    "License server unreachable, attempting offline artifact at {}",
                    offline_path.display()
                );
            }
        }
    } else {
        warn!(
            "IGRIS_LICENSE_KEY not set, attempting offline artifact startup from {}",
            offline_path.display()
        );
    }

    let verifying_key = trusted_offline_key
        .ok_or_else(|| anyhow!("offline license verification key not configured"))?;
    let validation = load_offline_artifact(&offline_path, &verifying_key, &device_id, license_key)?;
    info!(
        "Offline license valid: tier={} expires={}",
        validation.tier.as_deref().unwrap_or("unknown"),
        validation
            .offline_artifact_expires_at
            .as_deref()
            .unwrap_or("unknown")
    );

    Ok(StartupLicenseResult {
        mode: RuntimeLicenseMode::LicensedOffline,
        device_id,
        validation,
    })
}

/// Start a background heartbeat loop (license device heartbeat — every 5 minutes)
pub async fn start_heartbeat_loop(license_key: String, device_id: String) {
    let server_url = license_server_from_env();
    let client = LicenseClient::new(server_url.as_deref());
    let mut interval = tokio::time::interval(Duration::from_secs(300)); // Every 5 minutes

    loop {
        interval.tick().await;

        match client.heartbeat(&license_key, &device_id).await {
            Ok(_) => {
                info!("Heartbeat sent successfully");
            }
            Err(e) => {
                warn!("Heartbeat failed: {}", e);
            }
        }
    }
}

#[cfg(test)]
fn test_env_lock() -> std::sync::MutexGuard<'static, ()> {
    use std::sync::{Mutex, OnceLock};

    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
}

#[cfg(test)]
mod offline_tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn build_offline_artifact(
        signing_key: &SigningKey,
        device_id: &str,
        license_key: &str,
        expires_at: DateTime<Utc>,
    ) -> String {
        let payload = OfflineLicenseArtifactPayload {
            version: 1,
            license_key: license_key.to_string(),
            device_id: device_id.to_string(),
            runtime_version: VERSION.to_string(),
            tier: "seed".to_string(),
            customer_email: Some("user@example.com".to_string()),
            devices_limit: 1,
            devices_active: 1,
            cloud_requests_limit: 50000,
            cloud_requests_used: 10,
            features: LicenseFeatures {
                execution_layer: true,
                intelligence_layer: true,
                memory_layer: true,
                proof_layer: true,
                dashboard_access: false,
                fleet_monitoring: false,
                cost_optimization: false,
                performance_heatmaps: false,
                audit_trails: false,
                ota_updates: false,
                on_premise: false,
                custom_sla: false,
                extended_retention: false,
                dedicated_support: false,
            },
            status: "active".to_string(),
            license_expires_at: Some(expires_at.to_rfc3339()),
            artifact_issued_at: Utc::now().to_rfc3339(),
            artifact_expires_at: expires_at.to_rfc3339(),
        };
        let payload_bytes = serde_json::to_vec(&payload).unwrap();
        let payload_hash = Sha256::digest(&payload_bytes);
        let signature = signing_key.sign(&payload_hash);
        serde_json::to_string(&OfflineLicenseArtifactEnvelope {
            algorithm: "ed25519-sha256".to_string(),
            key_id: Some("test-key".to_string()),
            payload: base64::engine::general_purpose::STANDARD.encode(payload_bytes),
            payload_sha256: hex::encode(payload_hash),
            signature: base64::engine::general_purpose::STANDARD.encode(signature.to_bytes()),
        })
        .unwrap()
    }

    #[test]
    fn load_offline_artifact_accepts_valid_signature() {
        let signing_key = SigningKey::from_bytes(&[7u8; 32]);
        let verifying_key = signing_key.verifying_key();
        let device_id = "dev_test";
        let artifact = build_offline_artifact(
            &signing_key,
            device_id,
            "lic_seed_test",
            Utc::now() + chrono::Duration::hours(2),
        );
        let temp = tempfile::NamedTempFile::new().unwrap();
        fs::write(temp.path(), artifact).unwrap();

        let validation = load_offline_artifact(
            temp.path(),
            &verifying_key,
            device_id,
            Some("lic_seed_test"),
        )
        .unwrap();

        assert_eq!(validation.tier.as_deref(), Some("seed"));
        assert_eq!(validation.status.as_deref(), Some("active"));
        assert!(validation.offline_artifact_expires_at.is_some());
    }

    #[test]
    fn load_offline_artifact_rejects_expired_artifact() {
        let signing_key = SigningKey::from_bytes(&[9u8; 32]);
        let verifying_key = signing_key.verifying_key();
        let artifact = build_offline_artifact(
            &signing_key,
            "dev_test",
            "lic_seed_test",
            Utc::now() - chrono::Duration::hours(1),
        );
        let temp = tempfile::NamedTempFile::new().unwrap();
        fs::write(temp.path(), artifact).unwrap();

        let err = load_offline_artifact(
            temp.path(),
            &verifying_key,
            "dev_test",
            Some("lic_seed_test"),
        )
        .unwrap_err();

        assert!(err.to_string().contains("offline artifact expired"));
    }

    #[tokio::test]
    async fn validate_license_on_startup_uses_offline_artifact_without_network() {
        let _guard = super::test_env_lock();
        let signing_key = SigningKey::from_bytes(&[11u8; 32]);
        let temp_dir = tempfile::tempdir().unwrap();
        let device_id_path = temp_dir.path().join("device-id");
        std::env::set_var("IGRIS_DEVICE_ID_PATH", &device_id_path);
        std::env::remove_var("IGRIS_DEVICE_ID");
        let device_id = LicenseClient::generate_device_id();
        let artifact = build_offline_artifact(
            &signing_key,
            &device_id,
            "lic_seed_test",
            Utc::now() + chrono::Duration::hours(2),
        );
        let temp = tempfile::NamedTempFile::new().unwrap();
        fs::write(temp.path(), artifact).unwrap();

        std::env::set_var("IGRIS_OFFLINE_LICENSE_PATH", temp.path());
        std::env::set_var(
            "IGRIS_LICENSE_OFFLINE_PUBLIC_KEY",
            hex::encode(signing_key.verifying_key().to_bytes()),
        );
        std::env::remove_var("IGRIS_LICENSE_KEY");

        let result = validate_license_on_startup(None).await.unwrap();

        assert_eq!(result.mode, RuntimeLicenseMode::LicensedOffline);
        assert_eq!(result.validation.tier.as_deref(), Some("seed"));

        std::env::remove_var("IGRIS_OFFLINE_LICENSE_PATH");
        std::env::remove_var("IGRIS_DEVICE_ID_PATH");
        std::env::remove_var("IGRIS_LICENSE_OFFLINE_PUBLIC_KEY");
        std::env::remove_var("IGRIS_LICENSE_KEY");
    }
}

// ============================================================================
// Runtime registration client
// ============================================================================

/// Client for registering this runtime instance with the Overture control plane.
/// Uses the tenant API key (IGRIS_API_KEY env var) to authenticate and records
/// the runtime in the fleet registry, subject to the tenant's tier runtime limit.
#[derive(Clone)]
pub struct RuntimeRegistrationClient {
    base_url: String,
    api_key: String,
    machine_id: String,
    hostname: String,
    platform: String,
    public_key_ed25519: String,
    signing_key: Arc<SigningKey>,
    client: reqwest::Client,
}

/// Response from POST /api/v1/runtime/register
#[derive(Debug, Serialize, Deserialize)]
pub struct RuntimeRegisterResponse {
    pub runtime_id: String,
    pub tier: String,
    pub runtime_limit: i32,
    pub registered_at: String,
}

impl RuntimeRegistrationClient {
    /// Create a new registration client.
    ///
    /// `overture_url` defaults to `https://overture.igrisinertial.com` if `None`.
    pub fn new(
        overture_url: Option<&str>,
        api_key: String,
        public_key_ed25519: String,
        signing_key: Arc<SigningKey>,
    ) -> Self {
        let base_url = overture_url
            .unwrap_or("https://overture.igrisinertial.com")
            .to_string();

        let machine_id = LicenseClient::generate_device_id();
        let hostname = gethostname::gethostname().to_string_lossy().to_string();
        let platform = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap();

        Self {
            base_url,
            api_key,
            machine_id,
            hostname,
            platform,
            public_key_ed25519,
            signing_key,
            client,
        }
    }

    /// Register (or re-register) this runtime with Overture.
    /// Returns Ok(response) on success, Err if the tier limit is exceeded or
    /// the API key is invalid.
    pub async fn register(&self, runtime_version: &str) -> Result<RuntimeRegisterResponse> {
        let url = format!("{}/api/v1/runtime/register", self.base_url);
        let timestamp_unix_ms = Utc::now().timestamp_millis();
        let signature = sign_runtime_registration_payload(
            self.signing_key.as_ref(),
            &self.machine_id,
            &self.hostname,
            &self.platform,
            runtime_version,
            &self.public_key_ed25519,
            None,
            timestamp_unix_ms,
        );

        let payload = serde_json::json!({
            "machine_id":       self.machine_id,
            "hostname":         self.hostname,
            "platform":         self.platform,
            "runtime_version":  runtime_version,
            "public_key_ed25519": self.public_key_ed25519,
            "timestamp_unix_ms": timestamp_unix_ms,
            "signature": signature,
        });

        let resp = self
            .client
            .post(&url)
            .header("X-API-Key", &self.api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to reach Overture: {}", e))?;

        let status = resp.status();
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| anyhow!("Invalid response body: {}", e))?;

        if status == 402 {
            let limit = body["limit"].as_i64().unwrap_or(0);
            let tier = body["tier"].as_str().unwrap_or("unknown");
            return Err(anyhow!(
                "Runtime limit reached: your {} subscription allows {} runtime instance(s). \
                 Upgrade at https://igrisinertial.com/pricing",
                tier,
                limit
            ));
        }

        if !status.is_success() {
            let msg = body["message"]
                .as_str()
                .unwrap_or("Registration failed")
                .to_string();
            return Err(anyhow!("Registration error ({}): {}", status, msg));
        }

        let response: RuntimeRegisterResponse = serde_json::from_value(body)
            .map_err(|e| anyhow!("Failed to parse registration response: {}", e))?;

        info!(
            "Runtime registered: id={} tier={} limit={}",
            response.runtime_id, response.tier, response.runtime_limit
        );

        Ok(response)
    }

    /// Send a heartbeat to keep this runtime marked as active.
    pub async fn heartbeat(&self) -> Result<()> {
        let url = format!("{}/api/v1/runtime/heartbeat", self.base_url);
        let timestamp_unix_ms = Utc::now().timestamp_millis();
        let signature = sign_runtime_machine_payload(
            self.signing_key.as_ref(),
            "runtime_heartbeat.v1",
            &self.machine_id,
            timestamp_unix_ms,
            None,
        );

        let payload = serde_json::json!({
            "machine_id": self.machine_id,
            "timestamp_unix_ms": timestamp_unix_ms,
            "signature": signature,
        });

        let resp = self
            .client
            .post(&url)
            .header("X-API-Key", &self.api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| anyhow!("Heartbeat request failed: {}", e))?;

        if !resp.status().is_success() {
            warn!(
                "Runtime heartbeat returned non-success status: {}",
                resp.status()
            );
        }

        Ok(())
    }

    /// Deregister this runtime on clean shutdown.
    pub async fn deregister(&self) -> Result<()> {
        let url = format!("{}/api/v1/runtime/deregister", self.base_url);
        let timestamp_unix_ms = Utc::now().timestamp_millis();
        let signature = sign_runtime_machine_payload(
            self.signing_key.as_ref(),
            "runtime_deregister.v1",
            &self.machine_id,
            timestamp_unix_ms,
            None,
        );

        let payload = serde_json::json!({
            "machine_id": self.machine_id,
            "timestamp_unix_ms": timestamp_unix_ms,
            "signature": signature,
        });

        let _ = self
            .client
            .delete(&url)
            .header("X-API-Key", &self.api_key)
            .json(&payload)
            .send()
            .await;

        Ok(())
    }

    /// Return the machine ID used by this client (for logging).
    pub fn machine_id(&self) -> &str {
        &self.machine_id
    }
}

/// Register with Overture on startup and start a background heartbeat loop (every 30s).
///
/// Call this after license validation if `IGRIS_API_KEY` is set.
/// The returned `RuntimeRegistrationClient` can be used to deregister on shutdown.
pub async fn register_runtime_with_overture(
    api_key: String,
    overture_url: Option<&str>,
    runtime_version: &str,
    public_key_ed25519: String,
    signing_key: Arc<SigningKey>,
) -> Result<RuntimeRegistrationClient> {
    let client =
        RuntimeRegistrationClient::new(overture_url, api_key, public_key_ed25519, signing_key);

    client.register(runtime_version).await?;

    // Start a 30-second heartbeat loop in the background
    let heartbeat_client = client.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            if let Err(e) = heartbeat_client.heartbeat().await {
                warn!("Runtime heartbeat failed: {}", e);
            }
        }
    });

    Ok(client)
}

fn sign_runtime_registration_payload(
    signing_key: &SigningKey,
    machine_id: &str,
    hostname: &str,
    platform: &str,
    runtime_version: &str,
    public_key_ed25519: &str,
    endpoint: Option<&str>,
    timestamp_unix_ms: i64,
) -> String {
    let message = format!(
        "runtime_register.v1:{}:{}:{}:{}:{}:{}:{}",
        machine_id,
        hostname,
        platform,
        runtime_version,
        public_key_ed25519,
        endpoint.unwrap_or(""),
        timestamp_unix_ms
    );
    base64::engine::general_purpose::STANDARD.encode(signing_key.sign(message.as_bytes()).to_bytes())
}

fn sign_runtime_machine_payload(
    signing_key: &SigningKey,
    purpose: &str,
    machine_id: &str,
    timestamp_unix_ms: i64,
    bt_state: Option<&str>,
) -> String {
    let bt_state_hash = bt_state
        .map(|value| hex::encode(Sha256::digest(value.as_bytes())))
        .unwrap_or_default();
    let message = format!(
        "{}:{}:{}:{}",
        purpose, machine_id, timestamp_unix_ms, bt_state_hash
    );
    base64::engine::general_purpose::STANDARD.encode(signing_key.sign(message.as_bytes()).to_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_id_generation() {
        let _guard = super::test_env_lock();
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("device-id");
        std::env::set_var("IGRIS_DEVICE_ID_PATH", &path);
        std::env::remove_var("IGRIS_DEVICE_ID");
        let device_id = LicenseClient::generate_device_id();
        let persisted = LicenseClient::generate_device_id();
        assert!(device_id.starts_with("dev_"));
        assert_eq!(device_id.len(), 36); // "dev_" + 32 hex chars
        assert_eq!(device_id, persisted);
        assert_eq!(fs::read_to_string(path).unwrap().trim(), device_id);
        std::env::remove_var("IGRIS_DEVICE_ID_PATH");
    }

    #[test]
    fn test_device_id_generation_uses_persisted_value() {
        let _guard = super::test_env_lock();
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("device-id");
        fs::write(&path, "dev_0123456789abcdef0123456789abcdef\n").unwrap();
        std::env::set_var("IGRIS_DEVICE_ID_PATH", &path);
        std::env::remove_var("IGRIS_DEVICE_ID");

        let device_id = LicenseClient::generate_device_id();

        assert_eq!(device_id, "dev_0123456789abcdef0123456789abcdef");
        std::env::remove_var("IGRIS_DEVICE_ID_PATH");
    }
}
