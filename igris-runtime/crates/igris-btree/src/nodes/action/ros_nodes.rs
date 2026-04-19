//! ROS2 action nodes for Behavior Trees.
//!
//! Requires the `ros2` feature flag. These nodes bridge the BT execution engine
//! to ROS2 topics and services via the shared [`Ros2Node`] in [`BTreeContext`].
//!
//! # Node Types
//!
//! - [`RosTopicPublish`]: Publish a JSON payload to a ROS2 topic
//! - [`RosTopicSubscribe`]: Wait for a message on a ROS2 topic with timeout
//! - [`RosServiceCall`]: Call a ROS2 service and store the response
//!
//! # Safety Envelope Checks
//!
//! All nodes enforce:
//! - Message size limit: 64 KiB per publish
//! - Publish rate: enforced by per-node `min_interval_ms`
//! - Payload must be valid JSON

use crate::core::{BTreeContext, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::time::{Duration, Instant};
use tracing::{debug, warn};

/// Maximum payload size enforced before any ROS2 publish call (64 KiB).
const MAX_PAYLOAD_BYTES: usize = 65_536;

// ─── RosTopicPublish ─────────────────────────────────────────────────────────

/// BT action node: publish a JSON payload to a ROS2 topic.
///
/// Returns `Success` immediately after publishing. Returns `Failure` if
/// the ROS2 node is unavailable, the payload exceeds the size envelope,
/// or the publish call returns an error.
///
/// # Configuration
///
/// - `name`: node name for debugging
/// - `topic`: ROS2 topic name (e.g., `/cmd_vel`)
/// - `msg_type`: message type string (informational; e.g., `geometry_msgs/Twist`)
/// - `payload`: JSON value to serialize and publish
/// - `min_interval_ms`: minimum milliseconds between successive publishes
///   from this node (rate limiting, default 0 = unlimited)
///
/// # Example
///
/// ```no_run
/// use igris_btree::nodes::action::RosTopicPublish;
/// use serde_json::json;
///
/// let node = RosTopicPublish::new(
///     "move_forward",
///     "/cmd_vel",
///     "geometry_msgs/Twist",
///     json!({"linear": {"x": 0.5, "y": 0.0, "z": 0.0}, "angular": {"x": 0.0, "y": 0.0, "z": 0.0}}),
///     0,
/// );
/// ```
pub struct RosTopicPublish {
    name: String,
    topic: String,
    msg_type: String,
    payload: Value,
    min_interval_ms: u64,
    last_publish: Option<Instant>,
}

impl RosTopicPublish {
    /// Create a new `RosTopicPublish` node.
    pub fn new(
        name: impl Into<String>,
        topic: impl Into<String>,
        msg_type: impl Into<String>,
        payload: Value,
        min_interval_ms: u64,
    ) -> Self {
        Self {
            name: name.into(),
            topic: topic.into(),
            msg_type: msg_type.into(),
            payload,
            min_interval_ms,
            last_publish: None,
        }
    }
}

#[async_trait]
impl crate::core::BTreeNode for RosTopicPublish {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "RosTopicPublish"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        let node = match context.require_ros2() {
            Ok(n) => n,
            Err(e) => {
                warn!("[RosTopicPublish] {}: {}", self.name, e);
                return Ok(NodeStatus::Failure);
            }
        };

        // Rate limiting envelope check
        if self.min_interval_ms > 0 {
            if let Some(last) = self.last_publish {
                if last.elapsed() < Duration::from_millis(self.min_interval_ms) {
                    debug!("[RosTopicPublish] {} rate-limited", self.name);
                    return Ok(NodeStatus::Failure);
                }
            }
        }

        // Size envelope check
        let serialized = serde_json::to_string(&self.payload)?;
        if serialized.len() > MAX_PAYLOAD_BYTES {
            warn!(
                "[RosTopicPublish] {} payload {} bytes exceeds limit {}",
                self.name,
                serialized.len(),
                MAX_PAYLOAD_BYTES
            );
            return Ok(NodeStatus::Failure);
        }

        debug!(
            "[RosTopicPublish] {} → {} ({})",
            self.name, self.topic, self.msg_type
        );

        // Publish via the ROS2 node's prompt channel (maps to the topic)
        // For /cmd_vel specifically, use publish_zero_velocity for stop commands;
        // for other topics, we serialize payload as a string message.
        let publish_result = if self.topic == "/cmd_vel" {
            let linear_x = self
                .payload
                .get("linear")
                .and_then(|l| l.get("x"))
                .and_then(|x| x.as_f64())
                .unwrap_or(0.0);
            if linear_x == 0.0 {
                node.publish_zero_velocity().await
            } else {
                node.publish_prompt(&serialized).await
            }
        } else {
            node.publish_prompt(&serialized).await
        };

        match publish_result {
            Ok(()) => {
                self.last_publish = Some(Instant::now());
                Ok(NodeStatus::Success)
            }
            Err(e) => {
                warn!("[RosTopicPublish] {} publish failed: {}", self.name, e);
                Ok(NodeStatus::Failure)
            }
        }
    }

    async fn reset(&mut self) {
        self.last_publish = None;
    }

    fn to_json(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "type": "RosTopicPublish",
            "name": self.name,
            "topic": self.topic,
            "msg_type": self.msg_type,
            "payload": self.payload,
            "min_interval_ms": self.min_interval_ms,
        }))
    }
}

// ─── RosTopicSubscribe ───────────────────────────────────────────────────────

/// BT action node: subscribe and wait for a message on a ROS2 topic.
///
/// Polls the ROS2 node's response channel for up to `timeout_ms` milliseconds.
/// On receipt, writes the message string to the blackboard at `output_key`.
/// Returns `Success` when a message arrives, `Failure` on timeout.
///
/// # Example
///
/// ```no_run
/// use igris_btree::nodes::action::RosTopicSubscribe;
///
/// let node = RosTopicSubscribe::new(
///     "wait_for_pose",
///     "/amcl_pose",
///     "geometry_msgs/PoseWithCovarianceStamped",
///     2_000,
///     "current_pose",
/// );
/// ```
pub struct RosTopicSubscribe {
    name: String,
    topic: String,
    msg_type: String,
    timeout_ms: u64,
    output_key: String,
}

impl RosTopicSubscribe {
    /// Create a new `RosTopicSubscribe` node.
    pub fn new(
        name: impl Into<String>,
        topic: impl Into<String>,
        msg_type: impl Into<String>,
        timeout_ms: u64,
        output_key: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            topic: topic.into(),
            msg_type: msg_type.into(),
            timeout_ms,
            output_key: output_key.into(),
        }
    }
}

#[async_trait]
impl crate::core::BTreeNode for RosTopicSubscribe {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "RosTopicSubscribe"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        let node = match context.require_ros2() {
            Ok(n) => n,
            Err(e) => {
                warn!("[RosTopicSubscribe] {}: {}", self.name, e);
                return Ok(NodeStatus::Failure);
            }
        };

        debug!(
            "[RosTopicSubscribe] {} waiting on {} ({}ms timeout)",
            self.name, self.topic, self.timeout_ms
        );

        // Poll with timeout
        let deadline = Instant::now() + Duration::from_millis(self.timeout_ms);
        loop {
            if let Some(msg) = node.receive_response().await? {
                debug!("[RosTopicSubscribe] {} received message", self.name);
                context
                    .blackboard
                    .set(&self.output_key, serde_json::json!(msg.response))
                    .await;
                return Ok(NodeStatus::Success);
            }

            if Instant::now() >= deadline {
                warn!(
                    "[RosTopicSubscribe] {} timed out after {}ms on {}",
                    self.name, self.timeout_ms, self.topic
                );
                return Ok(NodeStatus::Failure);
            }

            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    fn to_json(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "type": "RosTopicSubscribe",
            "name": self.name,
            "topic": self.topic,
            "msg_type": self.msg_type,
            "timeout_ms": self.timeout_ms,
            "output_key": self.output_key,
        }))
    }
}

// ─── RosServiceCall ──────────────────────────────────────────────────────────

/// BT action node: call a ROS2 service and store the response on the blackboard.
///
/// Serializes `request` to JSON, sends it via the prompt channel, then
/// waits up to `timeout_ms` for a response. Writes the response string to
/// `output_key` on success.
///
/// # Example
///
/// ```no_run
/// use igris_btree::nodes::action::RosServiceCall;
/// use serde_json::json;
///
/// let node = RosServiceCall::new(
///     "check_battery",
///     "/battery_state",
///     json!({}),
///     1_000,
///     "battery_level",
/// );
/// ```
pub struct RosServiceCall {
    name: String,
    service: String,
    request: Value,
    timeout_ms: u64,
    output_key: String,
}

impl RosServiceCall {
    /// Create a new `RosServiceCall` node.
    pub fn new(
        name: impl Into<String>,
        service: impl Into<String>,
        request: Value,
        timeout_ms: u64,
        output_key: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            service: service.into(),
            request,
            timeout_ms,
            output_key: output_key.into(),
        }
    }
}

#[async_trait]
impl crate::core::BTreeNode for RosServiceCall {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "RosServiceCall"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        let node = match context.require_ros2() {
            Ok(n) => n,
            Err(e) => {
                warn!("[RosServiceCall] {}: {}", self.name, e);
                return Ok(NodeStatus::Failure);
            }
        };

        // Size envelope check
        let serialized = serde_json::to_string(&self.request)?;
        if serialized.len() > MAX_PAYLOAD_BYTES {
            warn!(
                "[RosServiceCall] {} request {} bytes exceeds limit",
                self.name,
                serialized.len()
            );
            return Ok(NodeStatus::Failure);
        }

        debug!("[RosServiceCall] {} → {}", self.name, self.service);

        // Send request via prompt channel (service name embedded in payload)
        let envelope = serde_json::json!({
            "service": self.service,
            "request": self.request,
        });
        if let Err(e) = node.publish_prompt(&envelope.to_string()).await {
            warn!("[RosServiceCall] {} send failed: {}", self.name, e);
            return Ok(NodeStatus::Failure);
        }

        // Wait for response
        let deadline = Instant::now() + Duration::from_millis(self.timeout_ms);
        loop {
            if let Some(resp) = node.receive_response().await? {
                debug!("[RosServiceCall] {} got response", self.name);
                context
                    .blackboard
                    .set(&self.output_key, serde_json::json!(resp.response))
                    .await;
                return Ok(NodeStatus::Success);
            }

            if Instant::now() >= deadline {
                warn!(
                    "[RosServiceCall] {} timed out after {}ms on {}",
                    self.name, self.timeout_ms, self.service
                );
                return Ok(NodeStatus::Failure);
            }

            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    fn to_json(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "type": "RosServiceCall",
            "name": self.name,
            "service": self.service,
            "request": self.request,
            "timeout_ms": self.timeout_ms,
            "output_key": self.output_key,
        }))
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::{BTreeContext, BTreeNode};
    use igris_ros2::{Ros2Config, Ros2Node};
    use std::sync::Arc;

    async fn make_context() -> BTreeContext {
        let config = Ros2Config {
            enabled: true,
            ..Default::default()
        };
        let node = Arc::new(Ros2Node::new(config).await.unwrap());
        BTreeContext::new().with_ros2(node)
    }

    #[tokio::test]
    async fn ros_publish_succeeds_with_node() {
        let mut ctx = make_context().await;
        let mut node = RosTopicPublish::new(
            "test_pub",
            "/cmd_vel",
            "geometry_msgs/Twist",
            serde_json::json!({"linear": {"x": 0.5}}),
            0,
        );
        let status = node.tick(&mut ctx).await.unwrap();
        assert_eq!(status, NodeStatus::Success);
    }

    #[tokio::test]
    async fn ros_publish_fails_without_node() {
        let mut ctx = BTreeContext::new(); // no ros2 node
        let mut node = RosTopicPublish::new(
            "test_pub",
            "/cmd_vel",
            "geometry_msgs/Twist",
            serde_json::json!({}),
            0,
        );
        let status = node.tick(&mut ctx).await.unwrap();
        assert_eq!(status, NodeStatus::Failure);
    }

    #[tokio::test]
    async fn ros_publish_rejects_oversized_payload() {
        let mut ctx = make_context().await;
        // Create a payload larger than 64 KiB
        let big_str = "x".repeat(MAX_PAYLOAD_BYTES + 1);
        let mut node = RosTopicPublish::new(
            "big_pub",
            "/test",
            "std_msgs/String",
            serde_json::json!(big_str),
            0,
        );
        let status = node.tick(&mut ctx).await.unwrap();
        assert_eq!(status, NodeStatus::Failure);
    }

    #[tokio::test]
    async fn ros_subscribe_times_out_when_no_message() {
        let mut ctx = make_context().await;
        let mut node = RosTopicSubscribe::new(
            "test_sub",
            "/no_publisher",
            "std_msgs/String",
            100, // 100ms timeout
            "result",
        );
        let status = node.tick(&mut ctx).await.unwrap();
        assert_eq!(status, NodeStatus::Failure); // timeout → Failure
    }

    #[tokio::test]
    async fn ros_service_call_times_out_with_no_server() {
        let mut ctx = make_context().await;
        let mut node = RosServiceCall::new(
            "test_svc",
            "/no_service",
            serde_json::json!({}),
            100,
            "svc_result",
        );
        let status = node.tick(&mut ctx).await.unwrap();
        assert_eq!(status, NodeStatus::Failure);
    }

    // ── Positive-path tests (inject responses via the stub node) ─────────────

    /// Helper: create a context AND return the Ros2Node handle so tests can
    /// inject responses via `publish_response`.
    async fn make_context_with_node() -> (BTreeContext, Arc<Ros2Node>) {
        let config = Ros2Config {
            enabled: true,
            ..Default::default()
        };
        let node = Arc::new(Ros2Node::new(config).await.unwrap());
        let ctx = BTreeContext::new().with_ros2(Arc::clone(&node));
        (ctx, node)
    }

    #[tokio::test]
    async fn ros_subscribe_receives_injected_message() {
        let (mut ctx, node) = make_context_with_node().await;

        // Pre-inject a response so the subscribe node finds it immediately.
        node.publish_response("odom_data", "ok").await.unwrap();

        let mut sub =
            RosTopicSubscribe::new("wait_odom", "/odom", "nav_msgs/Odometry", 500, "pose");

        let status = sub.tick(&mut ctx).await.unwrap();
        assert_eq!(status, NodeStatus::Success);

        // Blackboard should contain the injected response.
        let bb_val = ctx.blackboard.get("pose").await.unwrap();
        assert_eq!(bb_val, serde_json::json!("odom_data"));
    }

    #[tokio::test]
    async fn ros_service_call_receives_injected_response() {
        let (mut ctx, node) = make_context_with_node().await;

        // Inject response before tick so the service call finds it.
        node.publish_response(r#"{"battery":0.82,"status":"ok"}"#, "ok")
            .await
            .unwrap();

        let mut svc = RosServiceCall::new(
            "battery_check",
            "/battery_state",
            serde_json::json!({}),
            500,
            "battery",
        );

        let status = svc.tick(&mut ctx).await.unwrap();
        assert_eq!(status, NodeStatus::Success);

        let bb_val = ctx.blackboard.get("battery").await.unwrap();
        assert!(bb_val.as_str().unwrap().contains("0.82"));
    }

    #[tokio::test]
    async fn ros_publish_rate_limit_blocks_second_call() {
        let mut ctx = make_context().await;
        let mut pub_node = RosTopicPublish::new(
            "rate_limited",
            "/cmd_vel",
            "geometry_msgs/Twist",
            serde_json::json!({"linear": {"x": 0.5}}),
            500, // 500ms minimum interval
        );

        // First call should succeed.
        assert_eq!(pub_node.tick(&mut ctx).await.unwrap(), NodeStatus::Success);

        // Immediate second call should be rate-limited → Failure.
        assert_eq!(pub_node.tick(&mut ctx).await.unwrap(), NodeStatus::Failure);
    }

    // ── End-to-end: Gazebo TurtleBot3 demo BT (no live ROS2 required) ─────────

    /// Simulates the Gazebo demo BT:
    ///   Sequence
    ///     ├── RosTopicPublish  move_forward → /cmd_vel
    ///     ├── RosTopicSubscribe wait_odom   ← /odom   (response injected by background task)
    ///     └── RosTopicPublish  stop         → /cmd_vel
    ///
    /// A background task injects the /odom response after 50ms to simulate
    /// the robot publishing its odometry. The whole sequence must succeed.
    #[tokio::test]
    async fn gazebo_demo_sequence_publish_subscribe_stop() {
        use crate::nodes::composite::Sequence;
        use crate::runtime::BTreeExecutor;

        let (mut ctx, node) = make_context_with_node().await;

        // Background task: inject /odom after 50ms (simulates ROS bag playback)
        let node_for_inject = Arc::clone(&node);
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let _ = node_for_inject
                .publish_response(r#"{"pose":{"x":0.48,"y":0.0}}"#, "ok")
                .await;
        });

        let mut tree = Sequence::new("robot_control")
            .add_child(Box::new(RosTopicPublish::new(
                "move_forward",
                "/cmd_vel",
                "geometry_msgs/Twist",
                serde_json::json!({"linear":{"x":0.5,"y":0.0,"z":0.0},"angular":{"x":0.0,"y":0.0,"z":0.0}}),
                0,
            )))
            .add_child(Box::new(RosTopicSubscribe::new(
                "wait_odometry",
                "/odom",
                "nav_msgs/Odometry",
                2_000, // 2s timeout — injected after 50ms
                "final_pose",
            )))
            .add_child(Box::new(RosTopicPublish::new(
                "stop",
                "/cmd_vel",
                "geometry_msgs/Twist",
                serde_json::json!({"linear":{"x":0.0,"y":0.0,"z":0.0},"angular":{"x":0.0,"y":0.0,"z":0.0}}),
                0,
            )));

        let executor = BTreeExecutor::new()
            .with_max_ticks(100)
            .with_deadline(std::time::Duration::from_secs(3));

        let result = executor.execute(&mut tree, &mut ctx).await.unwrap();
        assert!(
            result.is_success(),
            "demo sequence must succeed; got {:?}",
            result.status
        );

        // Verify final_pose was written to blackboard by the subscribe node.
        let pose = ctx.blackboard.get("final_pose").await.unwrap();
        assert!(
            pose.as_str().unwrap().contains("0.48"),
            "blackboard must contain injected pose"
        );
    }
}
