//! ROS2 + Containment Bridge integration for igris-server.
//!
//! This module provides the startup wiring that connects:
//!
//! - [`igris_safety::ViolationEventBus`] — broadcast channel for violations
//! - [`igris_ros2::Ros2Node`] — ROS2 node for Nav2 and /cmd_vel
//! - [`igris_ros2::containment_bridge::ContainmentBridge`] — deterministic halt bridge
//! - [`igris_ros2::containment_bridge::SafeIdleReceiver`] — BT safe-idle watch signal
//!
//! # Startup sequence
//!
//! ```rust,no_run
//! # async fn example() -> anyhow::Result<()> {
//! use igris_server::ros2_integration::Ros2Manager;
//! use igris_safety::{Bounds, ViolationEventBus};
//! use ed25519_dalek::SigningKey;
//!
//! // 1. Create the violation event bus (shared with ContainmentGuard).
//! let bus = ViolationEventBus::new();
//!
//! // 2. Create ContainmentGuard with the bus (in runtime_execute.rs startup path).
//! // let guard = ContainmentGuard::new_with_bus(bounds, signing_key, log_path, bus.clone());
//!
//! // 3. Start the ROS2 manager (creates Ros2Node + ContainmentBridge).
//! let ros2_config = igris_ros2::Ros2Config {
//!     enabled: true,
//!     enable_nav2: true,
//!     ..Default::default()
//! };
//! let manager = Ros2Manager::start(ros2_config, &bus, signing_key, log_path, String::new()).await?;
//!
//! // 4. Pass manager.idle_rx() into AppState for BT handler gating.
//! // 5. Pass manager.node() into AppState for navigation calls.
//! # Ok(())
//! # }
//! ```
//!
//! # BT safe-idle integration
//!
//! In the `/v1/btree/run` handler, check the idle signal before allowing new
//! behavior tree executions:
//!
//! ```rust,no_run
//! use igris_ros2::containment_bridge::is_safe_idle;
//!
//! # async fn btree_run_handler(
//! #     idle_rx: &igris_ros2::containment_bridge::SafeIdleReceiver,
//! # ) -> Result<String, String> {
//! if is_safe_idle(idle_rx) {
//!     return Err("System in safe-idle after containment violation — no new BTree work".to_string());
//! }
//! // proceed with BTree execution ...
//! # Ok("ok".to_string())
//! # }
//! ```

use ed25519_dalek::SigningKey;
use igris_ros2::{
    containment_bridge::{ContainmentBridge, SafeIdleReceiver},
    Ros2Config, Ros2Node,
};
use igris_safety::ViolationEventBus;
use std::sync::Arc;
use tracing::{info, warn};

/// Manages the ROS2 node and containment bridge lifecycle.
///
/// Created once during server startup and held in [`AppState`](crate::AppState)
/// (or equivalent) for the lifetime of the process.
pub struct Ros2Manager {
    config: Ros2Config,
    node: Arc<Ros2Node>,
    idle_rx: SafeIdleReceiver,
}

impl Ros2Manager {
    /// Start the ROS2 node and containment bridge.
    ///
    /// Spawns the [`ContainmentBridge`] as a background tokio task. Returns
    /// immediately with a handle to the node and the BT idle signal receiver.
    ///
    /// # Parameters
    ///
    /// - `config`: ROS2 node configuration.
    /// - `bus`: Shared [`ViolationEventBus`] (must be the same instance wired
    ///   into [`ContainmentGuard::new_with_bus`]).
    /// - `signing_key`: Ed25519 key for robotics violation records.
    /// - `log_path`: Path to the JSONL violation log (same file as supervisor).
    /// - `last_supervisor_hash`: Hash of the most recent supervisor violation
    ///   record; pass `""` on first startup.
    pub async fn start(
        config: Ros2Config,
        bus: &ViolationEventBus,
        signing_key: SigningKey,
        log_path: String,
        last_supervisor_hash: String,
    ) -> anyhow::Result<Self> {
        info!(
            "Starting Ros2Manager (nav2={}, node={})",
            config.enable_nav2, config.node_name
        );

        let node = Arc::new(Ros2Node::new(config).await?);

        let (bridge, idle_rx) = ContainmentBridge::new(
            bus,
            Arc::clone(&node),
            signing_key,
            log_path,
            last_supervisor_hash,
        );

        tokio::spawn(bridge.run());
        info!("ContainmentBridge spawned — deterministic Nav2 halt active");

        Ok(Self {
            config,
            node,
            idle_rx,
        })
    }

    /// Returns a reference to the shared [`Ros2Node`].
    pub fn node(&self) -> Arc<Ros2Node> {
        Arc::clone(&self.node)
    }

    /// Returns a clone of the BT safe-idle receiver.
    ///
    /// Wire this into `AppState` and check it in the `/v1/btree/run` handler
    /// and any other endpoint that must not issue new planning work during a
    /// containment violation.
    pub fn idle_rx(&self) -> SafeIdleReceiver {
        self.idle_rx.clone()
    }

    /// Returns true if the system is currently in safe-idle mode.
    pub fn is_safe_idle(&self) -> bool {
        igris_ros2::containment_bridge::is_safe_idle(&self.idle_rx)
    }

    /// Returns the configured ROS2 namespace used for prompt/response topics.
    pub fn namespace(&self) -> &str {
        &self.config.namespace
    }

    /// Gracefully shut down the ROS2 node.
    pub async fn shutdown(&self) {
        if let Err(e) = self.node.shutdown().await {
            warn!("ROS2 node shutdown error: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use igris_ros2::containment_bridge::is_safe_idle;
    use igris_safety::{ViolationEventBus, ViolationKind, ViolationRecord};
    use uuid::Uuid;

    fn test_key() -> SigningKey {
        SigningKey::from_bytes(&[99u8; 32])
    }

    fn test_log() -> String {
        std::env::temp_dir()
            .join(format!("igris_ros2_mgr_test_{}.jsonl", Uuid::now_v7()))
            .to_string_lossy()
            .into_owned()
    }

    #[tokio::test]
    async fn manager_starts_and_exposes_node() {
        let bus = ViolationEventBus::new();
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };
        let log = test_log();
        let manager = Ros2Manager::start(config, &bus, test_key(), log.clone(), String::new())
            .await
            .unwrap();

        assert!(manager.node().is_active().await);
        assert!(
            !manager.is_safe_idle(),
            "safe-idle must be false at startup"
        );
        let _ = std::fs::remove_file(&log);
    }

    #[tokio::test]
    async fn manager_idle_signal_activates_on_violation() {
        let bus = ViolationEventBus::new();
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };
        let log = test_log();
        let manager = Ros2Manager::start(config, &bus, test_key(), log.clone(), String::new())
            .await
            .unwrap();
        let idle_rx = manager.idle_rx();

        tokio::time::sleep(std::time::Duration::from_millis(15)).await;
        assert!(!is_safe_idle(&idle_rx));

        let record = ViolationRecord::new(
            ViolationKind::Time,
            serde_json::json!({"tick_ms": 500}),
            String::new(),
            &test_key(),
        );
        bus.emit_violation(record);
        tokio::time::sleep(std::time::Duration::from_millis(60)).await;

        assert!(is_safe_idle(&idle_rx), "idle must be true after violation");
        let _ = std::fs::remove_file(&log);
    }
}
