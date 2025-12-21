//! Safety & Certification Hooks for Igris Runtime
//!
//! Provides safety mechanisms and compliance features for mission-critical
//! robotics and edge AI applications.
//!
//! # Features
//! - **Watchdog Timer:** Detects and recovers from system hangs
//! - **Fail-Safe States:** Automatic safe state transitions on error
//! - **Audit Logging:** Immutable audit trail for all actions
//! - **ISO 26262 Hooks:** Safety compliance for automotive/industrial use
//! - **License Binding:** Machine-bound licensing for deployment control
//!
//! # Example
//! ```no_run
//! use igris_safety::{SafetyManager, SafetyConfig, SafetyMode};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let config = SafetyConfig {
//!         mode: SafetyMode::FailSafe,
//!         watchdog_timeout_secs: 30,
//!         enable_audit_log: true,
//!         ..Default::default()
//!     };
//!
//!     let mut manager = SafetyManager::new(config).await?;
//!
//!     // Start watchdog
//!     manager.start_watchdog().await?;
//!
//!     // Pet watchdog during operations
//!     manager.pet_watchdog().await?;
//!
//!     Ok(())
//! }
//! ```

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::{mpsc, RwLock};
use tokio::time;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Safety mode configuration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SafetyMode {
    /// Normal operation (no safety restrictions)
    Normal,
    /// Fail-safe mode (restrictive, safe operations only)
    FailSafe,
    /// Emergency stop (all operations halted)
    EmergencyStop,
}

/// Safety configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyConfig {
    /// Safety mode
    pub mode: SafetyMode,

    /// Enable watchdog timer
    pub enable_watchdog: bool,

    /// Watchdog timeout in seconds
    pub watchdog_timeout_secs: u64,

    /// Auto-transition to fail-safe on timeout
    pub auto_failsafe: bool,

    /// Enable audit logging
    pub enable_audit_log: bool,

    /// Audit log file path
    pub audit_log_path: String,

    /// Maximum audit log entries in memory
    pub audit_log_max_entries: usize,

    /// Enable ISO 26262 compliance hooks
    pub iso26262_compliance: bool,

    /// Machine binding ID (for licensing)
    pub machine_binding_id: Option<String>,
}

impl Default for SafetyConfig {
    fn default() -> Self {
        Self {
            mode: SafetyMode::Normal,
            enable_watchdog: false,
            watchdog_timeout_secs: 30,
            auto_failsafe: true,
            enable_audit_log: false,
            audit_log_path: "audit.log".to_string(),
            audit_log_max_entries: 10000,
            iso26262_compliance: false,
            machine_binding_id: None,
        }
    }
}

/// Audit log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: u64,
    pub event_type: String,
    pub actor: String,
    pub action: String,
    pub result: String,
    pub metadata: serde_json::Value,
    pub hash: String, // SHA-256 hash of entry for integrity
}

impl AuditEntry {
    /// Create new audit entry
    pub fn new(
        event_type: String,
        actor: String,
        action: String,
        result: String,
        metadata: serde_json::Value,
    ) -> Self {
        let id = Uuid::new_v4().to_string();
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let mut entry = Self {
            id: id.clone(),
            timestamp,
            event_type,
            actor,
            action,
            result,
            metadata,
            hash: String::new(),
        };

        entry.hash = entry.compute_hash();
        entry
    }

    /// Compute SHA-256 hash of entry
    fn compute_hash(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.id.as_bytes());
        hasher.update(self.timestamp.to_le_bytes());
        hasher.update(self.event_type.as_bytes());
        hasher.update(self.actor.as_bytes());
        hasher.update(self.action.as_bytes());
        hasher.update(self.result.as_bytes());
        hasher.update(self.metadata.to_string().as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Verify entry integrity
    pub fn verify_integrity(&self) -> bool {
        let mut temp = self.clone();
        let original_hash = temp.hash.clone();
        temp.hash = String::new();
        temp.compute_hash() == original_hash
    }
}

/// Safety Manager
pub struct SafetyManager {
    config: SafetyConfig,

    // Current safety mode
    current_mode: Arc<RwLock<SafetyMode>>,

    // Watchdog state
    watchdog_active: Arc<RwLock<bool>>,
    watchdog_last_pet: Arc<RwLock<SystemTime>>,
    watchdog_shutdown_tx: Option<mpsc::UnboundedSender<()>>,

    // Audit log
    audit_log: Arc<RwLock<VecDeque<AuditEntry>>>,

    // License binding
    license_valid: Arc<RwLock<bool>>,
}

impl SafetyManager {
    /// Create a new safety manager
    pub async fn new(config: SafetyConfig) -> Result<Self> {
        info!("Initializing safety manager in mode: {:?}", config.mode);

        // Verify license if machine binding is configured
        let license_valid = if let Some(ref binding_id) = config.machine_binding_id {
            Self::verify_license_binding(binding_id)?
        } else {
            true
        };

        let manager = Self {
            config: config.clone(),
            current_mode: Arc::new(RwLock::new(config.mode)),
            watchdog_active: Arc::new(RwLock::new(false)),
            watchdog_last_pet: Arc::new(RwLock::new(SystemTime::now())),
            watchdog_shutdown_tx: None,
            audit_log: Arc::new(RwLock::new(VecDeque::new())),
            license_valid: Arc::new(RwLock::new(license_valid)),
        };

        // Log initialization
        if config.enable_audit_log {
            manager
                .log_audit(
                    "system".to_string(),
                    "safety_manager".to_string(),
                    "initialize".to_string(),
                    "success".to_string(),
                    serde_json::json!({"mode": config.mode}),
                )
                .await?;
        }

        Ok(manager)
    }

    /// Verify license binding to machine
    fn verify_license_binding(binding_id: &str) -> Result<bool> {
        // In production, this would:
        // 1. Get machine ID (MAC address, CPU ID, etc.)
        // 2. Verify cryptographic signature
        // 3. Check expiration date

        debug!("Verifying license binding: {}", binding_id);

        // For now, accept any non-empty binding ID
        Ok(!binding_id.is_empty())
    }

    /// Start watchdog timer
    pub async fn start_watchdog(&mut self) -> Result<()> {
        if !self.config.enable_watchdog {
            return Err(anyhow::anyhow!("Watchdog is disabled in config"));
        }

        let mut active = self.watchdog_active.write().await;
        if *active {
            return Err(anyhow::anyhow!("Watchdog is already running"));
        }

        info!("Starting watchdog with {}s timeout", self.config.watchdog_timeout_secs);

        let (shutdown_tx, mut shutdown_rx) = mpsc::unbounded_channel();
        self.watchdog_shutdown_tx = Some(shutdown_tx);

        let timeout = Duration::from_secs(self.config.watchdog_timeout_secs);
        let last_pet = self.watchdog_last_pet.clone();
        let current_mode = self.current_mode.clone();
        let auto_failsafe = self.config.auto_failsafe;

        // Reset last pet time
        {
            let mut last = last_pet.write().await;
            *last = SystemTime::now();
        }

        // Spawn watchdog task
        tokio::spawn(async move {
            let mut interval = time::interval(Duration::from_secs(1));

            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        let last = last_pet.read().await;
                        let elapsed = SystemTime::now().duration_since(*last).unwrap_or_default();

                        if elapsed > timeout {
                            error!("WATCHDOG TIMEOUT: No activity for {:?}", elapsed);

                            if auto_failsafe {
                                warn!("Transitioning to fail-safe mode");
                                let mut mode = current_mode.write().await;
                                *mode = SafetyMode::FailSafe;
                            }

                            // In production, this might trigger hardware reset
                            break;
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        debug!("Watchdog shutdown requested");
                        break;
                    }
                }
            }
        });

        *active = true;

        // Log watchdog start
        self.log_audit(
            "system".to_string(),
            "watchdog".to_string(),
            "start".to_string(),
            "success".to_string(),
            serde_json::json!({"timeout_secs": self.config.watchdog_timeout_secs}),
        )
        .await?;

        Ok(())
    }

    /// Pet the watchdog (reset timeout)
    pub async fn pet_watchdog(&self) -> Result<()> {
        let active = self.watchdog_active.read().await;
        if !*active {
            return Err(anyhow::anyhow!("Watchdog is not running"));
        }

        let mut last = self.watchdog_last_pet.write().await;
        *last = SystemTime::now();

        debug!("Watchdog petted");
        Ok(())
    }

    /// Stop watchdog
    pub async fn stop_watchdog(&mut self) -> Result<()> {
        if let Some(tx) = self.watchdog_shutdown_tx.take() {
            let _ = tx.send(());
        }

        let mut active = self.watchdog_active.write().await;
        *active = false;

        info!("Watchdog stopped");
        Ok(())
    }

    /// Set safety mode
    pub async fn set_mode(&self, mode: SafetyMode) -> Result<()> {
        let old_mode = {
            let mut current = self.current_mode.write().await;
            let old = *current;
            *current = mode;
            old
        };

        warn!("Safety mode transition: {:?} -> {:?}", old_mode, mode);

        // Log mode change
        self.log_audit(
            "system".to_string(),
            "safety_manager".to_string(),
            "set_mode".to_string(),
            "success".to_string(),
            serde_json::json!({
                "old_mode": old_mode,
                "new_mode": mode
            }),
        )
        .await?;

        Ok(())
    }

    /// Get current safety mode
    pub async fn get_mode(&self) -> SafetyMode {
        *self.current_mode.read().await
    }

    /// Check if operation is allowed in current safety mode
    pub async fn is_operation_allowed(&self, operation: &str) -> bool {
        let mode = self.get_mode().await;

        match mode {
            SafetyMode::Normal => true,
            SafetyMode::FailSafe => {
                // Only allow safe read operations in fail-safe mode
                operation.starts_with("read_") || operation.starts_with("get_")
            }
            SafetyMode::EmergencyStop => false,
        }
    }

    /// Log audit entry
    pub async fn log_audit(
        &self,
        event_type: String,
        actor: String,
        action: String,
        result: String,
        metadata: serde_json::Value,
    ) -> Result<()> {
        if !self.config.enable_audit_log {
            return Ok(());
        }

        let entry = AuditEntry::new(event_type, actor, action, result, metadata);

        let mut log = self.audit_log.write().await;

        // Limit log size
        if log.len() >= self.config.audit_log_max_entries {
            log.pop_front();
        }

        log.push_back(entry.clone());

        // In production, write to disk
        debug!("Audit: {} - {}", entry.event_type, entry.action);

        Ok(())
    }

    /// Get audit log entries
    pub async fn get_audit_log(&self) -> Vec<AuditEntry> {
        self.audit_log.read().await.iter().cloned().collect()
    }

    /// Verify audit log integrity
    pub async fn verify_audit_log(&self) -> Result<bool> {
        let log = self.audit_log.read().await;

        for entry in log.iter() {
            if !entry.verify_integrity() {
                error!("Audit log integrity violation: {}", entry.id);
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Check if license is valid
    pub async fn is_license_valid(&self) -> bool {
        *self.license_valid.read().await
    }

    /// Emergency stop
    pub async fn emergency_stop(&self) -> Result<()> {
        error!("EMERGENCY STOP ACTIVATED");

        self.set_mode(SafetyMode::EmergencyStop).await?;

        // Log emergency stop
        self.log_audit(
            "emergency".to_string(),
            "system".to_string(),
            "emergency_stop".to_string(),
            "activated".to_string(),
            serde_json::json!({}),
        )
        .await?;

        Ok(())
    }

    /// Shutdown safety manager
    pub async fn shutdown(&mut self) -> Result<()> {
        info!("Shutting down safety manager");

        if self.config.enable_watchdog {
            self.stop_watchdog().await?;
        }

        // Final audit log
        self.log_audit(
            "system".to_string(),
            "safety_manager".to_string(),
            "shutdown".to_string(),
            "success".to_string(),
            serde_json::json!({}),
        )
        .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_safety_manager_init() {
        let config = SafetyConfig::default();
        let manager = SafetyManager::new(config).await;
        assert!(manager.is_ok());
    }

    #[tokio::test]
    async fn test_safety_mode_transitions() {
        let config = SafetyConfig::default();
        let manager = SafetyManager::new(config).await.unwrap();

        assert_eq!(manager.get_mode().await, SafetyMode::Normal);

        manager.set_mode(SafetyMode::FailSafe).await.unwrap();
        assert_eq!(manager.get_mode().await, SafetyMode::FailSafe);

        manager.emergency_stop().await.unwrap();
        assert_eq!(manager.get_mode().await, SafetyMode::EmergencyStop);
    }

    #[tokio::test]
    async fn test_operation_permissions() {
        let config = SafetyConfig {
            mode: SafetyMode::Normal,
            ..Default::default()
        };
        let manager = SafetyManager::new(config).await.unwrap();

        // Normal mode allows all
        assert!(manager.is_operation_allowed("read_sensor").await);
        assert!(manager.is_operation_allowed("write_actuator").await);

        // Fail-safe mode restricts
        manager.set_mode(SafetyMode::FailSafe).await.unwrap();
        assert!(manager.is_operation_allowed("read_sensor").await);
        assert!(!manager.is_operation_allowed("write_actuator").await);

        // Emergency stop blocks all
        manager.emergency_stop().await.unwrap();
        assert!(!manager.is_operation_allowed("read_sensor").await);
    }

    #[tokio::test]
    async fn test_audit_logging() {
        let config = SafetyConfig {
            enable_audit_log: true,
            ..Default::default()
        };
        let manager = SafetyManager::new(config).await.unwrap();

        manager
            .log_audit(
                "test".to_string(),
                "user".to_string(),
                "test_action".to_string(),
                "success".to_string(),
                serde_json::json!({"key": "value"}),
            )
            .await
            .unwrap();

        let log = manager.get_audit_log().await;
        assert!(log.len() >= 1);

        // Verify integrity
        let integrity_ok = manager.verify_audit_log().await.unwrap();
        assert!(integrity_ok);
    }

    #[tokio::test]
    async fn test_watchdog() {
        let mut config = SafetyConfig::default();
        config.enable_watchdog = true;
        config.watchdog_timeout_secs = 2;

        let mut manager = SafetyManager::new(config).await.unwrap();
        manager.start_watchdog().await.unwrap();

        // Pet watchdog
        tokio::time::sleep(Duration::from_millis(500)).await;
        manager.pet_watchdog().await.unwrap();

        // Stop watchdog
        manager.stop_watchdog().await.unwrap();
    }

    #[tokio::test]
    async fn test_license_binding() {
        let config = SafetyConfig {
            machine_binding_id: Some("test-machine-id".to_string()),
            ..Default::default()
        };

        let manager = SafetyManager::new(config).await.unwrap();
        assert!(manager.is_license_valid().await);
    }
}
