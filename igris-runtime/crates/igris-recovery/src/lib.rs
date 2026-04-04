//! Igris Error Recovery & Retry Logic
//!
//! Provides intelligent error classification, retry strategies, backtracking,
//! and robot-specific Nav2 recovery behaviors (spin, backup, clear costmap).

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::time::Duration;
use tracing::{debug, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorClass {
    Retryable,
    Fatal,
    RateLimited,
}

pub fn classify_error(error: &anyhow::Error) -> ErrorClass {
    let msg = error.to_string().to_lowercase();

    if msg.contains("rate limit") || msg.contains("too many requests") {
        ErrorClass::RateLimited
    } else if msg.contains("timeout") || msg.contains("connection") || msg.contains("temporary") {
        ErrorClass::Retryable
    } else {
        ErrorClass::Fatal
    }
}

pub async fn retry_with_backoff<F, Fut, T>(
    mut operation: F,
    max_retries: usize,
) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut attempts = 0;

    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempts += 1;
                let error_class = classify_error(&e);

                if error_class == ErrorClass::Fatal || attempts >= max_retries {
                    return Err(e);
                }

                let delay = match error_class {
                    ErrorClass::RateLimited => Duration::from_secs(60),
                    ErrorClass::Retryable => Duration::from_millis(100 * 2u64.pow(attempts as u32)),
                    ErrorClass::Fatal => return Err(e),
                };

                warn!("Retry attempt {}/{}, waiting {:?}", attempts, max_retries, delay);
                tokio::time::sleep(delay).await;
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryConfig {
    pub max_retries: usize,
    pub enable_backtracking: bool,
}

impl Default for RecoveryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            enable_backtracking: true,
        }
    }
}

// ── Robot recovery behaviors ──────────────────────────────────────────────────

/// Outcome of a robot recovery attempt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecoveryOutcome {
    /// Recovery completed; navigation may be retried.
    Succeeded,
    /// Recovery was skipped because the robot is in a terminal / safe state.
    Skipped,
    /// Recovery itself failed (e.g. ROS2 not available, timeout).
    Failed(String),
}

/// Nav2 recovery behaviors.
///
/// These are the standard Nav2 recovery actions — spin, backup, and costmap
/// clear — that are invoked when navigation planning or execution fails.
/// They mirror Nav2's built-in recovery behavior tree but can be triggered
/// directly by Igris's durable task engine so that recovery attempts are
/// WAL-logged and crash-recoverable themselves.
///
/// Requires the `ros2` feature and a live ROS2 node.
#[cfg(feature = "ros2")]
pub mod robot {
    use super::RecoveryOutcome;
    use anyhow::Result;
    use igris_ros2::Ros2Node;
    use std::sync::Arc;
    use std::time::Duration;
    use tracing::{info, warn};

    /// Publish a constant angular velocity on `/cmd_vel` for `duration_ms` ms
    /// to rotate the robot in place (spin recovery).
    ///
    /// Used when the robot is stuck and costmap obstacles may have cleared.
    pub async fn spin(
        node: Arc<Ros2Node>,
        angular_z_rad_s: f64,
        duration_ms: u64,
    ) -> Result<RecoveryOutcome> {
        use igris_ros2::r2r;

        info!("Robot recovery: spin at {:.2} rad/s for {}ms", angular_z_rad_s, duration_ms);

        // Create a /cmd_vel publisher for the spin command.
        // This is separate from the zero-velocity publisher so we can send a
        // non-zero angular velocity without touching the safety publisher.
        // We reuse the node's existing cmd_vel publisher via an action publisher
        // approach — since Ros2Node doesn't expose a generic publish, we use
        // the ROS2 service call approach through Nav2's Spin recovery action.
        let action_client = node
            .ros2_node()
            .create_action_client::<r2r::nav2_msgs::action::Spin>("/spin")
            .map_err(|e| anyhow::anyhow!("Failed to create spin action client: {}", e))?;

        let goal = r2r::nav2_msgs::action::Spin::Goal {
            target_yaw: angular_z_rad_s * (duration_ms as f64 / 1000.0),
            time_allowance: r2r::builtin_interfaces::msg::Duration {
                sec: (duration_ms / 1000) as i32 + 2,
                nanosec: 0,
            },
        };

        let ready = tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                match action_client.is_ready() {
                    Ok(true) => return Ok(()),
                    Ok(false) => tokio::time::sleep(Duration::from_millis(100)).await,
                    Err(e) => return Err(e),
                }
            }
        })
        .await;

        match ready {
            Ok(Ok(())) => {}
            _ => {
                warn!("Spin recovery: Nav2 spin server not available — falling back to direct cmd_vel");
                // Fallback: publish angular velocity directly for duration_ms.
                let steps = (duration_ms / 50).max(1);
                for _ in 0..steps {
                    node.publish_spin_velocity(angular_z_rad_s).await?;
                    tokio::time::sleep(Duration::from_millis(50)).await;
                }
                node.publish_zero_velocity().await?;
                return Ok(RecoveryOutcome::Succeeded);
            }
        }

        match action_client.send_goal_request(goal).await {
            Ok(Ok(mut response)) => match response.get_result().await {
                Ok(_) => {
                    info!("Spin recovery succeeded");
                    Ok(RecoveryOutcome::Succeeded)
                }
                Err(e) => Ok(RecoveryOutcome::Failed(format!("spin result error: {}", e))),
            },
            Ok(Err(_)) | Err(_) => Ok(RecoveryOutcome::Failed("spin goal rejected".to_string())),
        }
    }

    /// Drive the robot backward for `duration_ms` at `speed_m_s` m/s (backup recovery).
    ///
    /// Used when the robot is stuck against an obstacle and needs to create
    /// clearance before replanning.
    pub async fn backup(
        node: Arc<Ros2Node>,
        speed_m_s: f64,
        duration_ms: u64,
    ) -> Result<RecoveryOutcome> {
        use igris_ros2::r2r;

        let speed = speed_m_s.abs().min(0.3); // cap at 0.3 m/s for safety
        info!("Robot recovery: backup at -{:.2} m/s for {}ms", speed, duration_ms);

        let action_client = node
            .ros2_node()
            .create_action_client::<r2r::nav2_msgs::action::BackUp>("/backup")
            .map_err(|e| anyhow::anyhow!("Failed to create backup action client: {}", e))?;

        let backup_distance = speed * (duration_ms as f64 / 1000.0);
        let goal = r2r::nav2_msgs::action::BackUp::Goal {
            target: r2r::geometry_msgs::msg::Point {
                x: backup_distance,
                y: 0.0,
                z: 0.0,
            },
            speed,
            time_allowance: r2r::builtin_interfaces::msg::Duration {
                sec: (duration_ms / 1000) as i32 + 2,
                nanosec: 0,
            },
        };

        let ready = tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                match action_client.is_ready() {
                    Ok(true) => return Ok(()),
                    Ok(false) => tokio::time::sleep(Duration::from_millis(100)).await,
                    Err(e) => return Err(e),
                }
            }
        })
        .await;

        if ready.is_err() || ready.unwrap().is_err() {
            warn!("Backup recovery: Nav2 backup server not available — falling back to direct cmd_vel");
            let steps = (duration_ms / 50).max(1);
            for _ in 0..steps {
                node.publish_velocity(-speed, 0.0).await?;
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
            node.publish_zero_velocity().await?;
            return Ok(RecoveryOutcome::Succeeded);
        }

        match action_client.send_goal_request(goal).await {
            Ok(Ok(mut response)) => match response.get_result().await {
                Ok(_) => {
                    info!("Backup recovery succeeded");
                    Ok(RecoveryOutcome::Succeeded)
                }
                Err(e) => Ok(RecoveryOutcome::Failed(format!("backup result error: {}", e))),
            },
            Ok(Err(_)) | Err(_) => Ok(RecoveryOutcome::Failed("backup goal rejected".to_string())),
        }
    }

    /// Call the Nav2 clear costmap service on both local and global costmaps.
    ///
    /// Used when sensor noise has filled the costmap with spurious obstacles
    /// that are blocking planning. Clearing gives the planner a clean slate.
    pub async fn clear_costmap(node: Arc<Ros2Node>) -> Result<RecoveryOutcome> {
        use igris_ros2::r2r;

        info!("Robot recovery: clearing Nav2 costmaps");

        let ros_node = node.ros2_node();

        // Clear local costmap
        let local_client = ros_node
            .create_client::<r2r::nav2_msgs::srv::ClearEntireCostmap>(
                "/local_costmap/clear_entirely_local_costmap",
            )
            .map_err(|e| anyhow::anyhow!("Failed to create local costmap clear client: {}", e))?;

        // Clear global costmap
        let global_client = ros_node
            .create_client::<r2r::nav2_msgs::srv::ClearEntireCostmap>(
                "/global_costmap/clear_entirely_global_costmap",
            )
            .map_err(|e| anyhow::anyhow!("Failed to create global costmap clear client: {}", e))?;

        let empty_req = r2r::nav2_msgs::srv::ClearEntireCostmap::Request {};

        let local_result = tokio::time::timeout(
            Duration::from_secs(5),
            local_client.call(&empty_req),
        )
        .await;

        let global_result = tokio::time::timeout(
            Duration::from_secs(5),
            global_client.call(&empty_req),
        )
        .await;

        let local_ok = matches!(local_result, Ok(Ok(_)));
        let global_ok = matches!(global_result, Ok(Ok(_)));

        if local_ok || global_ok {
            info!(local = local_ok, global = global_ok, "Costmap clear result");
            Ok(RecoveryOutcome::Succeeded)
        } else {
            Ok(RecoveryOutcome::Failed(
                "both costmap clear calls failed or timed out".to_string(),
            ))
        }
    }

    /// Run the standard Nav2 recovery sequence: clear costmap → backup → spin.
    ///
    /// This mirrors what Nav2's default recovery behavior tree does. Returns
    /// `Succeeded` if at least one recovery action completed without error.
    pub async fn run_standard_sequence(node: Arc<Ros2Node>) -> Result<RecoveryOutcome> {
        info!("Running standard Nav2 recovery sequence: clear → backup → spin");

        // 1. Clear costmaps first — gives the planner fresh data.
        let clear = clear_costmap(node.clone()).await?;
        if clear == RecoveryOutcome::Failed("".to_string()) {
            warn!("Costmap clear failed; continuing with backup");
        }

        // 2. Backup 0.3 m at 0.15 m/s.
        let bk = backup(node.clone(), 0.15, 2000).await?;
        if let RecoveryOutcome::Failed(ref reason) = bk {
            warn!("Backup failed: {}", reason);
        }

        // 3. Spin 180° at 0.5 rad/s.
        let sp = spin(node.clone(), 0.5, 6280).await?; // π / 0.5 ≈ 6.28 s → 6280 ms

        match sp {
            RecoveryOutcome::Succeeded | RecoveryOutcome::Skipped => Ok(RecoveryOutcome::Succeeded),
            RecoveryOutcome::Failed(reason) => {
                // If both backup and spin failed, report failure.
                if let RecoveryOutcome::Failed(_) = bk {
                    Ok(RecoveryOutcome::Failed(format!("backup and spin both failed: {}", reason)))
                } else {
                    // Backup succeeded; partial recovery is still useful.
                    Ok(RecoveryOutcome::Succeeded)
                }
            }
        }
    }
}

// ── No-op stubs when ros2 feature is disabled ─────────────────────────────────

#[cfg(not(feature = "ros2"))]
pub mod robot {
    use super::RecoveryOutcome;
    use anyhow::Result;

    pub async fn spin(_angular_z_rad_s: f64, _duration_ms: u64) -> Result<RecoveryOutcome> {
        Ok(RecoveryOutcome::Skipped)
    }

    pub async fn backup(_speed_m_s: f64, _duration_ms: u64) -> Result<RecoveryOutcome> {
        Ok(RecoveryOutcome::Skipped)
    }

    pub async fn clear_costmap() -> Result<RecoveryOutcome> {
        Ok(RecoveryOutcome::Skipped)
    }

    pub async fn run_standard_sequence() -> Result<RecoveryOutcome> {
        Ok(RecoveryOutcome::Skipped)
    }
}
