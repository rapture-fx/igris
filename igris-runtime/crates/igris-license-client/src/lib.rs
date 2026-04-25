use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tracing::{error, info, warn};

const DEFAULT_LICENSE_SERVER: &str = "https://overture.igrisinertial.com";
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
    pub error: Option<String>,
    pub message: Option<String>,
    pub upgrade_url: Option<String>,
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

    /// Generate a unique device ID based on MAC address and hostname
    pub fn generate_device_id() -> String {
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

/// Perform license validation on startup
pub async fn validate_license_on_startup(license_key: &str) -> Result<ValidationResponse> {
    info!("Validating license...");

    let client = LicenseClient::new(None);
    let device_id = LicenseClient::generate_device_id();

    // Validate license
    let validation = client.validate(license_key, &device_id, VERSION).await?;

    if !validation.valid {
        error!("License validation failed");
        return Err(anyhow!("Invalid license"));
    }

    info!(
        "License valid: {} (Tier: {}, Devices: {}/{})",
        validation.customer_email.as_deref().unwrap_or("unknown"),
        validation.tier.as_deref().unwrap_or("unknown"),
        validation.devices_active.unwrap_or(0),
        validation.devices_limit.unwrap_or(0)
    );

    // Register device
    match client.register_device(license_key, &device_id).await {
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

    Ok(validation)
}

/// Start a background heartbeat loop (license device heartbeat — every 5 minutes)
pub async fn start_heartbeat_loop(license_key: String, device_id: String) {
    let client = LicenseClient::new(None);
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
    pub fn new(overture_url: Option<&str>, api_key: String, public_key_ed25519: String) -> Self {
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
            client,
        }
    }

    /// Register (or re-register) this runtime with Overture.
    /// Returns Ok(response) on success, Err if the tier limit is exceeded or
    /// the API key is invalid.
    pub async fn register(&self, runtime_version: &str) -> Result<RuntimeRegisterResponse> {
        let url = format!("{}/api/v1/runtime/register", self.base_url);

        let payload = serde_json::json!({
            "machine_id":       self.machine_id,
            "hostname":         self.hostname,
            "platform":         self.platform,
            "runtime_version":  runtime_version,
            "public_key_ed25519": self.public_key_ed25519,
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

        let payload = serde_json::json!({ "machine_id": self.machine_id });

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

        let payload = serde_json::json!({ "machine_id": self.machine_id });

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
) -> Result<RuntimeRegistrationClient> {
    let client = RuntimeRegistrationClient::new(overture_url, api_key, public_key_ed25519);

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_id_generation() {
        let device_id = LicenseClient::generate_device_id();
        assert!(device_id.starts_with("dev_"));
        assert_eq!(device_id.len(), 36); // "dev_" + 32 hex chars
    }
}
