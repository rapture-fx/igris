//! ROS2 Integration for Igris Runtime
//!
//! Provides ROS2 node implementation for publishing/subscribing to prompts and responses.
//! Integrates with nav2 for autonomous navigation planning.
//!
//! # Features
//! - ROS2 node creation and lifecycle management
//! - Publish/subscribe for AI agent prompts and responses
//! - Nav2 integration for path planning
//! - Action client for goal-based navigation
//! - Service calls for robot control
//! - Deterministic containment bridge (see [`containment_bridge`])
//!
//! # Compilation
//! - By default, uses stub implementation (no ROS2 required)
//! - Enable `ros2` feature for real ROS2 integration (requires ROS2 installed)
//!
//! # Example
//! ```no_run
//! use igris_ros2::{Ros2Node, Ros2Config};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let config = Ros2Config {
//!         enabled: true,
//!         node_name: "igris_agent".to_string(),
//!         namespace: "/igris".to_string(),
//!         ..Default::default()
//!     };
//!
//!     let mut node = Ros2Node::new(config).await?;
//!
//!     // Publish a prompt
//!     node.publish_prompt("Navigate to kitchen").await?;
//!
//!     // Subscribe to responses
//!     if let Some(response) = node.receive_response().await? {
//!         println!("Response: {:?}", response);
//!     }
//!
//!     Ok(())
//! }
//! ```

pub mod containment_bridge;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex, Notify, RwLock};
use tracing::{debug, info, warn};
use uuid::Uuid;

#[cfg(feature = "ros2")]
use r2r;

/// ROS2 configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ros2Config {
    /// Enable ROS2 integration
    pub enabled: bool,

    /// Node name for ROS2
    pub node_name: String,

    /// ROS2 namespace
    pub namespace: String,

    /// Domain ID for ROS2 DDS
    pub domain_id: u32,

    /// Enable Nav2 integration
    pub enable_nav2: bool,

    /// Nav2 action server name
    pub nav2_action_server: String,

    /// QoS reliability (0=best_effort, 1=reliable)
    pub qos_reliability: u8,

    /// QoS history depth
    pub qos_depth: usize,
}

impl Default for Ros2Config {
    fn default() -> Self {
        Self {
            enabled: false,
            node_name: "igris_agent".to_string(),
            namespace: "/igris".to_string(),
            domain_id: 0,
            enable_nav2: false,
            nav2_action_server: "/navigate_to_pose".to_string(),
            qos_reliability: 1, // reliable
            qos_depth: 10,
        }
    }
}

/// ROS2 message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptMessage {
    pub timestamp: u64,
    pub prompt: String,
    pub priority: u8,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMessage {
    pub timestamp: u64,
    pub response: String,
    pub status: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationGoal {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub orientation_w: f64,
    pub frame_id: String,
}

/// Navigation state machine phases
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum NavigationState {
    /// Goal has been accepted by the action server
    Accepted,
    /// Path planning is in progress
    Planning,
    /// Robot is executing the planned path
    Executing,
    /// Navigation completed successfully
    Succeeded,
    /// Navigation failed (obstacle, timeout, etc.)
    Failed(String),
    /// Navigation was canceled by the caller
    Canceled,
}

impl NavigationState {
    /// Returns true if the navigation has reached a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Succeeded | Self::Failed(_) | Self::Canceled)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationStatus {
    pub status: String, // navigating, succeeded, failed, canceled
    pub distance_remaining: f64,
    pub estimated_time_remaining: f64,
    /// Structured state machine phase
    pub state: NavigationState,
}

/// Feedback data for an ongoing navigation action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationFeedback {
    /// Current robot pose (x, y, z)
    pub current_pose: (f64, f64, f64),
    /// Remaining distance to the goal in meters
    pub distance_remaining: f64,
    /// Estimated time remaining in seconds
    pub estimated_time_remaining: f64,
}

/// Shared inner state for NavigationHandle
struct NavigationHandleInner {
    /// Unique goal identifier (UUIDv7) for violation record correlation.
    goal_id: String,
    state: NavigationState,
    feedback: NavigationFeedback,
    goal: NavigationGoal,
}

/// Handle to an in-progress navigation action.
///
/// Returned by `navigate_to_pose()`, this handle allows monitoring progress,
/// retrieving feedback, and canceling the navigation goal.
///
/// Cheaply cloneable — all clones share the same underlying goal state.
#[derive(Clone)]
pub struct NavigationHandle {
    inner: Arc<Mutex<NavigationHandleInner>>,
    done_notify: Arc<Notify>,
}

impl NavigationHandle {
    /// Returns the unique identifier assigned to this navigation goal.
    pub async fn goal_id(&self) -> String {
        self.inner.lock().await.goal_id.clone()
    }

    /// Returns the current navigation state
    pub async fn status(&self) -> NavigationState {
        let inner = self.inner.lock().await;
        inner.state.clone()
    }

    /// Returns the latest navigation feedback
    pub async fn feedback(&self) -> NavigationFeedback {
        let inner = self.inner.lock().await;
        inner.feedback.clone()
    }

    /// Cancel the navigation goal.
    ///
    /// Returns an error if the goal is already in a terminal state.
    pub async fn cancel(&self) -> Result<()> {
        let mut inner = self.inner.lock().await;
        if inner.state.is_terminal() {
            return Err(anyhow::anyhow!(
                "Cannot cancel navigation in terminal state {:?}",
                inner.state
            ));
        }
        info!("Canceling navigation goal {} via handle", inner.goal_id);
        inner.state = NavigationState::Canceled;
        inner.feedback.distance_remaining = 0.0;
        inner.feedback.estimated_time_remaining = 0.0;
        drop(inner);
        self.done_notify.notify_waiters();
        Ok(())
    }

    /// Cancel the goal with a hard timeout.
    ///
    /// Returns `Ok(goal_id)` if cancelled within `timeout_ms`, or an error on timeout.
    /// Safe to call even if no active goal exists — returns the current goal_id either way.
    pub async fn cancel_with_timeout(&self, timeout_ms: u64) -> Result<String> {
        let goal_id = self.goal_id().await;
        tokio::time::timeout(Duration::from_millis(timeout_ms), self.cancel())
            .await
            .context("Nav2 cancel timed out")?
            .or_else(|e| {
                // Already terminal — treat as success for safety purposes.
                debug!("Goal {} already terminal during cancel: {}", goal_id, e);
                Ok::<(), anyhow::Error>(())
            })?;
        Ok(goal_id)
    }

    /// Block until the navigation reaches a terminal state (Succeeded, Failed, or Canceled)
    pub async fn wait(&self) -> Result<NavigationState> {
        loop {
            {
                let inner = self.inner.lock().await;
                if inner.state.is_terminal() {
                    return Ok(inner.state.clone());
                }
            }
            self.done_notify.notified().await;
        }
    }
}

/// Spawn a background task that simulates navigation state progression.
///
/// `velocity_tracker` is updated to reflect the simulated robot velocity
/// during execution so the containment bridge can capture it before zeroing.
fn spawn_navigation_task(
    inner: Arc<Mutex<NavigationHandleInner>>,
    done_notify: Arc<Notify>,
    velocity_tracker: Arc<RwLock<[f64; 2]>>,
) {
    tokio::spawn(async move {
        // Accepted -> Planning (short delay)
        tokio::time::sleep(Duration::from_millis(50)).await;
        {
            let mut lock = inner.lock().await;
            if lock.state.is_terminal() {
                return;
            }
            lock.state = NavigationState::Planning;
        }

        // Planning -> Executing (simulate path computation)
        tokio::time::sleep(Duration::from_millis(100)).await;
        {
            let mut lock = inner.lock().await;
            if lock.state.is_terminal() {
                return;
            }
            lock.state = NavigationState::Executing;
        }

        // Simulate execution progress
        let total_distance = {
            let lock = inner.lock().await;
            lock.feedback.distance_remaining
        };

        // Simulated linear velocity during execution (m/s).
        let simulated_linear_x = if total_distance > 0.0 {
            (total_distance / 10.0_f64).clamp(0.1, 1.0)
        } else {
            0.1
        };
        *velocity_tracker.write().await = [simulated_linear_x, 0.0];

        let steps = 10u32;
        let step_duration = Duration::from_millis(50);
        for i in 1..=steps {
            tokio::time::sleep(step_duration).await;
            {
                let mut lock = inner.lock().await;
                if lock.state.is_terminal() {
                    *velocity_tracker.write().await = [0.0, 0.0];
                    return;
                }
                let fraction_remaining = 1.0 - (i as f64 / steps as f64);
                lock.feedback.distance_remaining = total_distance * fraction_remaining;
                lock.feedback.estimated_time_remaining =
                    (steps - i) as f64 * step_duration.as_secs_f64();

                // Update current pose linearly toward goal
                let goal_x = lock.goal.x;
                let goal_y = lock.goal.y;
                let goal_z = lock.goal.z;
                let progress = i as f64 / steps as f64;
                lock.feedback.current_pose =
                    (goal_x * progress, goal_y * progress, goal_z * progress);
            }
            done_notify.notify_waiters();
        }

        // Terminal: Succeeded — zero velocity before notifying.
        *velocity_tracker.write().await = [0.0, 0.0];
        {
            let mut lock = inner.lock().await;
            if !lock.state.is_terminal() {
                lock.state = NavigationState::Succeeded;
                lock.feedback.distance_remaining = 0.0;
                lock.feedback.estimated_time_remaining = 0.0;
                lock.feedback.current_pose = (lock.goal.x, lock.goal.y, lock.goal.z);
            }
        }
        done_notify.notify_waiters();
    });
}

// ============================================================================
// REAL ROS2 IMPLEMENTATION (when "ros2" feature is enabled)
// ============================================================================

#[cfg(feature = "ros2")]
pub struct Ros2Node {
    config: Ros2Config,
    context: Arc<r2r::Context>,
    node: Arc<r2r::Node>,

    // Publishers
    prompt_pub: Arc<RwLock<r2r::Publisher<r2r::std_msgs::msg::String>>>,
    response_pub: Arc<RwLock<r2r::Publisher<r2r::std_msgs::msg::String>>>,
    /// Safety-critical: zero-velocity publisher on `/cmd_vel`.
    cmd_vel_pub: Arc<RwLock<r2r::Publisher<r2r::geometry_msgs::msg::Twist>>>,

    // Subscribers (stored as channels for async access)
    prompt_rx: Arc<RwLock<mpsc::UnboundedReceiver<PromptMessage>>>,
    response_rx: Arc<RwLock<mpsc::UnboundedReceiver<ResponseMessage>>>,

    // Navigation state
    nav_status: Arc<RwLock<Option<NavigationStatus>>>,

    // Node active flag
    active: Arc<RwLock<bool>>,

    // Active navigation handle (set by navigate_to_pose; used by containment bridge).
    active_nav_handle: Arc<RwLock<Option<NavigationHandle>>>,

    // Last known robot velocity [linear_x_m_s, angular_z_rad_s].
    // Updated by the navigation task during execution; read by the bridge before zeroing.
    last_velocity: Arc<RwLock<[f64; 2]>>,
}

#[cfg(feature = "ros2")]
impl Ros2Node {
    /// Create a new ROS2 node with real r2r bindings
    pub async fn new(config: Ros2Config) -> Result<Self> {
        if !config.enabled {
            return Err(anyhow::anyhow!("ROS2 is disabled in config"));
        }

        info!(
            "Initializing real ROS2 node '{}' in namespace '{}' (domain {})",
            config.node_name, config.namespace, config.domain_id
        );

        // Set ROS_DOMAIN_ID environment variable
        std::env::set_var("ROS_DOMAIN_ID", config.domain_id.to_string());

        // Initialize ROS2 context
        let context =
            r2r::Context::create().context("Failed to create ROS2 context. Is ROS2 installed?")?;
        let context = Arc::new(context);

        // Create node with namespace
        let node_name = format!("{}/{}", config.namespace, config.node_name);
        let node = r2r::Node::create(context.clone(), &node_name, "")
            .context("Failed to create ROS2 node")?;
        let node = Arc::new(node);

        // Create QoS profile
        let qos = if config.qos_reliability == 1 {
            r2r::QosProfile::default()
                .reliable()
                .keep_last(config.qos_depth)
        } else {
            r2r::QosProfile::default()
                .best_effort()
                .keep_last(config.qos_depth)
        };

        // Create publishers
        let prompt_topic = format!("{}/prompt", config.namespace);
        let response_topic = format!("{}/response", config.namespace);

        let prompt_pub = node
            .create_publisher::<r2r::std_msgs::msg::String>(&prompt_topic, qos.clone())
            .context("Failed to create prompt publisher")?;
        let prompt_pub = Arc::new(RwLock::new(prompt_pub));

        let response_pub = node
            .create_publisher::<r2r::std_msgs::msg::String>(&response_topic, qos.clone())
            .context("Failed to create response publisher")?;
        let response_pub = Arc::new(RwLock::new(response_pub));

        // Zero-velocity publisher on /cmd_vel — used by the containment bridge for
        // emergency stops. QoS: reliable, depth 1 to ensure delivery.
        let cmd_vel_pub = node
            .create_publisher::<r2r::geometry_msgs::msg::Twist>(
                "/cmd_vel",
                r2r::QosProfile::default().reliable().keep_last(1),
            )
            .context("Failed to create /cmd_vel publisher")?;
        let cmd_vel_pub = Arc::new(RwLock::new(cmd_vel_pub));

        // Create subscribers with channels
        let (prompt_tx, prompt_rx) = mpsc::unbounded_channel();
        let (response_tx, response_rx) = mpsc::unbounded_channel();

        let prompt_sub = node
            .subscribe::<r2r::std_msgs::msg::String>(&prompt_topic, qos.clone())
            .context("Failed to create prompt subscriber")?;
        let response_sub = node
            .subscribe::<r2r::std_msgs::msg::String>(&response_topic, qos.clone())
            .context("Failed to create response subscriber")?;

        // Spawn subscriber tasks
        tokio::spawn(Self::handle_prompt_subscription(prompt_sub, prompt_tx));
        tokio::spawn(Self::handle_response_subscription(
            response_sub,
            response_tx,
        ));

        // Spawn node spinner
        let node_clone = node.clone();
        tokio::spawn(async move {
            loop {
                if let Err(e) = node_clone.spin_once(std::time::Duration::from_millis(100)) {
                    warn!("ROS2 spin error: {}", e);
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
        });

        info!("Real ROS2 node initialized successfully");
        info!("Publishing on: {}, {}", prompt_topic, response_topic);

        Ok(Self {
            config,
            context,
            node,
            prompt_pub,
            response_pub,
            cmd_vel_pub,
            prompt_rx: Arc::new(RwLock::new(prompt_rx)),
            response_rx: Arc::new(RwLock::new(response_rx)),
            nav_status: Arc::new(RwLock::new(None)),
            active: Arc::new(RwLock::new(true)),
            active_nav_handle: Arc::new(RwLock::new(None)),
            last_velocity: Arc::new(RwLock::new([0.0, 0.0])),
        })
    }

    async fn handle_prompt_subscription(
        mut sub: r2r::Subscriber<r2r::std_msgs::msg::String>,
        tx: mpsc::UnboundedSender<PromptMessage>,
    ) {
        while let Some(msg) = sub.next().await {
            let prompt_msg = PromptMessage {
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
                prompt: msg.data,
                priority: 1,
                metadata: HashMap::new(),
            };
            let _ = tx.send(prompt_msg);
        }
    }

    async fn handle_response_subscription(
        mut sub: r2r::Subscriber<r2r::std_msgs::msg::String>,
        tx: mpsc::UnboundedSender<ResponseMessage>,
    ) {
        while let Some(msg) = sub.next().await {
            let response_msg = ResponseMessage {
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
                response: msg.data,
                status: "received".to_string(),
                metadata: HashMap::new(),
            };
            let _ = tx.send(response_msg);
        }
    }

    /// Publish a prompt to ROS2 topic
    pub async fn publish_prompt(&self, prompt: &str) -> Result<()> {
        debug!("Publishing prompt to ROS2: {}", prompt);

        let msg = r2r::std_msgs::msg::String {
            data: prompt.to_string(),
        };

        let mut pub_lock = self.prompt_pub.write().await;
        pub_lock.publish(&msg).context("Failed to publish prompt")?;

        Ok(())
    }

    /// Publish a response to ROS2 topic
    pub async fn publish_response(&self, response: &str, _status: &str) -> Result<()> {
        debug!("Publishing response to ROS2: {}", response);

        let msg = r2r::std_msgs::msg::String {
            data: response.to_string(),
        };

        let mut pub_lock = self.response_pub.write().await;
        pub_lock
            .publish(&msg)
            .context("Failed to publish response")?;

        Ok(())
    }

    /// Receive a prompt from ROS2 topic (non-blocking)
    pub async fn receive_prompt(&self) -> Result<Option<PromptMessage>> {
        let mut rx = self.prompt_rx.write().await;
        Ok(rx.try_recv().ok())
    }

    /// Receive a response from ROS2 topic (non-blocking)
    pub async fn receive_response(&self) -> Result<Option<ResponseMessage>> {
        let mut rx = self.response_rx.write().await;
        Ok(rx.try_recv().ok())
    }

    /// Send navigation goal to Nav2 via the NavigateToPose action server.
    ///
    /// Returns a [`NavigationHandle`] immediately. A background task drives the
    /// action client, updating handle state as feedback arrives and resolving to
    /// Succeeded / Failed / Canceled when the goal reaches a terminal state.
    ///
    /// The WAL records a `NavigateToPose` intent before this call and a
    /// `Committed` entry when the handle transitions to `Succeeded`. If the
    /// runtime crashes mid-navigation, Nav2 keeps moving; on recovery the new
    /// runtime can query the existing Nav2 goal through the action server or
    /// simply re-issue the goal (Nav2 is idempotent for repeated poses).
    pub async fn navigate_to_pose(&self, goal: NavigationGoal) -> Result<NavigationHandle> {
        if !self.config.enable_nav2 {
            return Err(anyhow::anyhow!("Nav2 is disabled in config"));
        }

        let goal_id = Uuid::now_v7().to_string();
        info!(
            "Sending Nav2 goal {} to ({:.3}, {:.3}, {:.3}) frame='{}'",
            goal_id, goal.x, goal.y, goal.z, goal.frame_id
        );

        let distance = (goal.x * goal.x + goal.y * goal.y).sqrt();

        // Create an action client for this goal. Clients are lightweight and
        // can be created per-call; the node spinner is already running.
        let action_client = self
            .node
            .create_action_client::<r2r::nav2_msgs::action::NavigateToPose>(
                &self.config.nav2_action_server,
            )
            .context("Failed to create Nav2 action client")?;

        // Wait up to 5 s for the Nav2 action server to be available.
        let server_ready = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                match action_client.is_ready() {
                    Ok(true) => return Ok(()),
                    Ok(false) => tokio::time::sleep(Duration::from_millis(100)).await,
                    Err(e) => return Err(e),
                }
            }
        })
        .await
        .map_err(|_| {
            anyhow::anyhow!(
                "Nav2 action server '{}' not available after 5s — is nav2 running?",
                self.config.nav2_action_server
            )
        })?;
        server_ready.context("Nav2 readiness check failed")?;

        // Build the Nav2 goal message.
        let nav_goal = r2r::nav2_msgs::action::NavigateToPose::Goal {
            pose: r2r::geometry_msgs::msg::PoseStamped {
                header: r2r::std_msgs::msg::Header {
                    frame_id: goal.frame_id.clone(),
                    stamp: r2r::builtin_interfaces::msg::Time { sec: 0, nanosec: 0 },
                },
                pose: r2r::geometry_msgs::msg::Pose {
                    position: r2r::geometry_msgs::msg::Point {
                        x: goal.x,
                        y: goal.y,
                        z: goal.z,
                    },
                    orientation: r2r::geometry_msgs::msg::Quaternion {
                        x: 0.0,
                        y: 0.0,
                        z: 0.0,
                        w: goal.orientation_w,
                    },
                },
            },
            behavior_tree: String::new(),
        };

        // Send the goal. The action server accepts or rejects it synchronously.
        let mut goal_response = action_client
            .send_goal_request(nav_goal)
            .await
            .context("Failed to send Nav2 goal request")?
            .context("Nav2 goal was rejected by the action server")?;

        let inner = Arc::new(Mutex::new(NavigationHandleInner {
            goal_id: goal_id.clone(),
            state: NavigationState::Accepted,
            feedback: NavigationFeedback {
                current_pose: (0.0, 0.0, 0.0),
                distance_remaining: distance,
                estimated_time_remaining: distance / 0.5_f64.max(0.1), // rough 0.5 m/s estimate
            },
            goal,
        }));
        let done_notify = Arc::new(Notify::new());
        let velocity_tracker = self.last_velocity.clone();

        // Update legacy status
        *self.nav_status.write().await = Some(NavigationStatus {
            status: "navigating".to_string(),
            distance_remaining: distance,
            estimated_time_remaining: 10.0,
            state: NavigationState::Accepted,
        });

        // Background task: drive the action goal to completion.
        let inner_bg = inner.clone();
        let done_bg = done_notify.clone();
        let nav_status_bg = self.nav_status.clone();
        tokio::spawn(async move {
            // Transition to Planning immediately after acceptance.
            {
                let mut lock = inner_bg.lock().await;
                if !lock.state.is_terminal() {
                    lock.state = NavigationState::Planning;
                }
                done_bg.notify_waiters();
            }

            // Await the final result from Nav2.
            match goal_response.get_result().await {
                Ok((_status, result)) => {
                    // result.result contains the outcome; a non-empty error_code
                    // signals failure in Nav2's NavigateToPose action.
                    let terminal = if result.error_code == 0 {
                        NavigationState::Succeeded
                    } else {
                        NavigationState::Failed(format!(
                            "Nav2 error_code={} ({})",
                            result.error_code, result.error_msg
                        ))
                    };

                    *velocity_tracker.write().await = [0.0, 0.0];

                    let mut lock = inner_bg.lock().await;
                    if !lock.state.is_terminal() {
                        lock.state = terminal;
                        lock.feedback.distance_remaining = 0.0;
                        lock.feedback.estimated_time_remaining = 0.0;
                        if let NavigationState::Succeeded = lock.state {
                            lock.feedback.current_pose = (lock.goal.x, lock.goal.y, lock.goal.z);
                        }
                    }

                    let state_str = match &lock.state {
                        NavigationState::Succeeded => "succeeded",
                        NavigationState::Failed(_) => "failed",
                        NavigationState::Canceled => "canceled",
                        _ => "terminal",
                    };
                    *nav_status_bg.write().await = Some(NavigationStatus {
                        status: state_str.to_string(),
                        distance_remaining: lock.feedback.distance_remaining,
                        estimated_time_remaining: lock.feedback.estimated_time_remaining,
                        state: lock.state.clone(),
                    });
                }
                Err(e) => {
                    warn!("Nav2 get_result error: {}", e);
                    *velocity_tracker.write().await = [0.0, 0.0];
                    let mut lock = inner_bg.lock().await;
                    if !lock.state.is_terminal() {
                        lock.state = NavigationState::Failed(format!("action result error: {}", e));
                    }
                }
            }
            done_bg.notify_waiters();
        });

        let handle = NavigationHandle { inner, done_notify };
        *self.active_nav_handle.write().await = Some(handle.clone());
        Ok(handle)
    }

    /// Get current navigation status (legacy API)
    pub async fn get_navigation_status(&self) -> Result<Option<NavigationStatus>> {
        let status = self.nav_status.read().await;
        Ok(status.clone())
    }

    /// Cancel current navigation goal (legacy API - prefer NavigationHandle::cancel())
    pub async fn cancel_navigation(&self) -> Result<()> {
        if !self.config.enable_nav2 {
            return Err(anyhow::anyhow!("Nav2 is disabled"));
        }

        info!("Canceling navigation goal");

        let mut status = self.nav_status.write().await;
        if let Some(nav_status) = status.as_mut() {
            nav_status.status = "canceled".to_string();
            nav_status.state = NavigationState::Canceled;
        }

        Ok(())
    }

    /// Get the current active navigation handle (used by containment bridge).
    pub async fn get_active_handle(&self) -> Option<NavigationHandle> {
        self.active_nav_handle.read().await.clone()
    }

    /// Get the last known robot velocity [linear_x_m_s, angular_z_rad_s].
    pub async fn last_velocity(&self) -> [f64; 2] {
        *self.last_velocity.read().await
    }

    /// Publish a zero-velocity `geometry_msgs/msg/Twist` to `/cmd_vel`.
    ///
    /// The containment bridge calls this in a tight loop (every 100 ms for 3 s) from
    /// a dedicated tokio task to bring the robot to a safe stop. Sends are best-effort
    /// — the containment guarantee does not depend on any single delivery.
    pub async fn publish_zero_velocity(&self) -> Result<()> {
        debug!("Publishing zero velocity to /cmd_vel");
        let zero_twist = r2r::geometry_msgs::msg::Twist {
            linear: r2r::geometry_msgs::msg::Vector3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            angular: r2r::geometry_msgs::msg::Vector3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
        };
        let mut pub_lock = self.cmd_vel_pub.write().await;
        let _ = pub_lock.publish(&zero_twist);
        *self.last_velocity.write().await = [0.0, 0.0];
        Ok(())
    }

    /// Publish a velocity command to `/cmd_vel`.
    ///
    /// Used by robot recovery behaviors (backup, custom maneuvers). Cap linear
    /// velocity at ±2 m/s and angular at ±π rad/s for safety.
    pub async fn publish_velocity(&self, linear_x: f64, angular_z: f64) -> Result<()> {
        debug!(
            "Publishing velocity linear_x={:.3} angular_z={:.3}",
            linear_x, angular_z
        );
        let twist = r2r::geometry_msgs::msg::Twist {
            linear: r2r::geometry_msgs::msg::Vector3 {
                x: linear_x.clamp(-2.0, 2.0),
                y: 0.0,
                z: 0.0,
            },
            angular: r2r::geometry_msgs::msg::Vector3 {
                x: 0.0,
                y: 0.0,
                z: angular_z.clamp(-std::f64::consts::PI, std::f64::consts::PI),
            },
        };
        let mut pub_lock = self.cmd_vel_pub.write().await;
        let _ = pub_lock.publish(&twist);
        *self.last_velocity.write().await = [
            linear_x.clamp(-2.0, 2.0),
            angular_z.clamp(-std::f64::consts::PI, std::f64::consts::PI),
        ];
        Ok(())
    }

    /// Publish a pure spin velocity to `/cmd_vel` (linear=0, angular=angular_z).
    pub async fn publish_spin_velocity(&self, angular_z: f64) -> Result<()> {
        self.publish_velocity(0.0, angular_z).await
    }

    /// Returns the underlying r2r::Node for callers that need to create
    /// additional publishers, subscribers, or service clients (e.g. the
    /// robot recovery module for costmap service calls).
    pub fn ros2_node(&self) -> Arc<r2r::Node> {
        self.node.clone()
    }

    /// Shutdown the ROS2 node
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down real ROS2 node");

        let mut active = self.active.write().await;
        *active = false;

        Ok(())
    }

    /// Check if node is active
    pub async fn is_active(&self) -> bool {
        *self.active.read().await
    }
}

// ============================================================================
// STUB IMPLEMENTATION (when "ros2" feature is NOT enabled)
// ============================================================================

#[cfg(not(feature = "ros2"))]
pub struct Ros2Node {
    config: Ros2Config,

    // Internal channels for pub/sub
    prompt_tx: mpsc::UnboundedSender<PromptMessage>,
    prompt_rx: Arc<RwLock<mpsc::UnboundedReceiver<PromptMessage>>>,

    response_tx: mpsc::UnboundedSender<ResponseMessage>,
    response_rx: Arc<RwLock<mpsc::UnboundedReceiver<ResponseMessage>>>,

    // Navigation state
    nav_status: Arc<RwLock<Option<NavigationStatus>>>,

    // Node active flag
    active: Arc<RwLock<bool>>,

    // Active navigation handle (set by navigate_to_pose; used by containment bridge).
    active_nav_handle: Arc<RwLock<Option<NavigationHandle>>>,

    // Last known robot velocity [linear_x_m_s, angular_z_rad_s].
    last_velocity: Arc<RwLock<[f64; 2]>>,

    // Log of zero-velocity commands for test verification.
    cmd_vel_log: Arc<RwLock<Vec<[f64; 2]>>>,
}

#[cfg(not(feature = "ros2"))]
impl Ros2Node {
    /// Create a new ROS2 node (stub implementation)
    pub async fn new(config: Ros2Config) -> Result<Self> {
        if !config.enabled {
            return Err(anyhow::anyhow!("ROS2 is disabled in config"));
        }

        warn!(
            "ROS2 feature not enabled - using stub implementation. \
             Compile with --features ros2 for real ROS2 integration"
        );

        info!(
            "Initializing ROS2 stub node '{}' in namespace '{}' (domain {})",
            config.node_name, config.namespace, config.domain_id
        );

        let (prompt_tx, prompt_rx) = mpsc::unbounded_channel();
        let (response_tx, response_rx) = mpsc::unbounded_channel();

        info!("ROS2 stub node initialized (no real ROS2 connection)");

        Ok(Self {
            config,
            prompt_tx,
            prompt_rx: Arc::new(RwLock::new(prompt_rx)),
            response_tx,
            response_rx: Arc::new(RwLock::new(response_rx)),
            nav_status: Arc::new(RwLock::new(None)),
            active: Arc::new(RwLock::new(true)),
            active_nav_handle: Arc::new(RwLock::new(None)),
            last_velocity: Arc::new(RwLock::new([0.0, 0.0])),
            cmd_vel_log: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Publish a prompt to ROS2 topic (stub)
    pub async fn publish_prompt(&self, prompt: &str) -> Result<()> {
        let msg = PromptMessage {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_millis() as u64,
            prompt: prompt.to_string(),
            priority: 1,
            metadata: HashMap::new(),
        };

        debug!("Publishing prompt (stub): {}", prompt);

        self.prompt_tx
            .send(msg)
            .context("Failed to send prompt message")?;

        Ok(())
    }

    /// Publish a response to ROS2 topic (stub)
    pub async fn publish_response(&self, response: &str, status: &str) -> Result<()> {
        let msg = ResponseMessage {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_millis() as u64,
            response: response.to_string(),
            status: status.to_string(),
            metadata: HashMap::new(),
        };

        debug!("Publishing response (stub): {}", response);

        self.response_tx
            .send(msg)
            .context("Failed to send response message")?;

        Ok(())
    }

    /// Receive a prompt from ROS2 topic (stub)
    pub async fn receive_prompt(&self) -> Result<Option<PromptMessage>> {
        let mut rx = self.prompt_rx.write().await;
        Ok(rx.try_recv().ok())
    }

    /// Receive a response from ROS2 topic (stub)
    pub async fn receive_response(&self) -> Result<Option<ResponseMessage>> {
        let mut rx = self.response_rx.write().await;
        Ok(rx.try_recv().ok())
    }

    /// Send navigation goal to Nav2 (stub), returning a handle to monitor and control the action
    pub async fn navigate_to_pose(&self, goal: NavigationGoal) -> Result<NavigationHandle> {
        if !self.config.enable_nav2 {
            return Err(anyhow::anyhow!("Nav2 is disabled in config"));
        }

        let goal_id = Uuid::now_v7().to_string();
        info!(
            "Sending navigation goal {} (stub) to ({}, {}, {}) in frame '{}'",
            goal_id, goal.x, goal.y, goal.z, goal.frame_id
        );

        let distance = (goal.x * goal.x + goal.y * goal.y).sqrt();

        let mut status = self.nav_status.write().await;
        *status = Some(NavigationStatus {
            status: "navigating".to_string(),
            distance_remaining: distance,
            estimated_time_remaining: 10.0,
            state: NavigationState::Accepted,
        });

        let inner = Arc::new(Mutex::new(NavigationHandleInner {
            goal_id: goal_id.clone(),
            state: NavigationState::Accepted,
            feedback: NavigationFeedback {
                current_pose: (0.0, 0.0, 0.0),
                distance_remaining: distance,
                estimated_time_remaining: 10.0,
            },
            goal,
        }));

        let done_notify = Arc::new(Notify::new());
        let velocity_tracker = self.last_velocity.clone();
        spawn_navigation_task(inner.clone(), done_notify.clone(), velocity_tracker);

        let handle = NavigationHandle { inner, done_notify };
        *self.active_nav_handle.write().await = Some(handle.clone());
        Ok(handle)
    }

    /// Get current navigation status (legacy API)
    pub async fn get_navigation_status(&self) -> Result<Option<NavigationStatus>> {
        let status = self.nav_status.read().await;
        Ok(status.clone())
    }

    /// Cancel current navigation goal (stub, legacy API - prefer NavigationHandle::cancel())
    pub async fn cancel_navigation(&self) -> Result<()> {
        if !self.config.enable_nav2 {
            return Err(anyhow::anyhow!("Nav2 is disabled"));
        }

        info!("Canceling navigation goal (stub)");

        let mut status = self.nav_status.write().await;
        if let Some(nav_status) = status.as_mut() {
            nav_status.status = "canceled".to_string();
            nav_status.state = NavigationState::Canceled;
        }

        Ok(())
    }

    /// Get the current active navigation handle (used by containment bridge).
    pub async fn get_active_handle(&self) -> Option<NavigationHandle> {
        self.active_nav_handle.read().await.clone()
    }

    /// Get the last known robot velocity [linear_x_m_s, angular_z_rad_s].
    pub async fn last_velocity(&self) -> [f64; 2] {
        *self.last_velocity.read().await
    }

    /// Publish a zero-velocity command (stub — logs for test verification).
    ///
    /// The containment bridge calls this every 100 ms for 3 s from a dedicated task.
    /// This method is intentionally non-blocking.
    pub async fn publish_zero_velocity(&self) -> Result<()> {
        debug!("Publishing zero velocity to /cmd_vel (stub)");
        let mut log = self.cmd_vel_log.write().await;
        log.push([0.0, 0.0]);
        // Cap the log to avoid unbounded growth in long-running tests.
        if log.len() > 100 {
            let excess = log.len() - 100;
            log.drain(..excess);
        }
        *self.last_velocity.write().await = [0.0, 0.0];
        Ok(())
    }

    /// Publish an arbitrary velocity command (stub — logs [linear_x, angular_z]).
    pub async fn publish_velocity(&self, linear_x: f64, angular_z: f64) -> Result<()> {
        debug!(
            "Publishing velocity (stub) linear_x={:.3} angular_z={:.3}",
            linear_x, angular_z
        );
        let mut log = self.cmd_vel_log.write().await;
        log.push([linear_x, angular_z]);
        if log.len() > 100 {
            let excess = log.len() - 100;
            log.drain(..excess);
        }
        *self.last_velocity.write().await = [linear_x, angular_z];
        Ok(())
    }

    /// Publish a pure spin velocity (stub).
    pub async fn publish_spin_velocity(&self, angular_z: f64) -> Result<()> {
        self.publish_velocity(0.0, angular_z).await
    }

    /// Number of zero-velocity commands recorded (test helper).
    pub async fn cmd_vel_command_count(&self) -> usize {
        self.cmd_vel_log.read().await.len()
    }

    /// Shutdown the ROS2 node (stub)
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down ROS2 stub node");

        let mut active = self.active.write().await;
        *active = false;

        Ok(())
    }

    /// Check if node is active
    pub async fn is_active(&self) -> bool {
        *self.active.read().await
    }
}

/// ROS2 integration utilities
pub mod utils {
    use super::*;

    /// Convert AI agent response to navigation goal
    pub fn parse_navigation_command(response: &str) -> Result<Option<NavigationGoal>> {
        // Simple parser for commands like "go to x=1.0 y=2.0"
        if !response.to_lowercase().contains("go to")
            && !response.to_lowercase().contains("navigate")
        {
            return Ok(None);
        }

        // Extract coordinates (simplified parser)
        let x = extract_coordinate(response, "x=")?;
        let y = extract_coordinate(response, "y=")?;
        let z = extract_coordinate(response, "z=").unwrap_or(0.0);

        Ok(Some(NavigationGoal {
            x,
            y,
            z,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        }))
    }

    fn extract_coordinate(text: &str, prefix: &str) -> Result<f64> {
        let start = text
            .find(prefix)
            .ok_or_else(|| anyhow::anyhow!("Coordinate {} not found", prefix))?;
        let value_start = start + prefix.len();
        let value_str = &text[value_start..]
            .split_whitespace()
            .next()
            .ok_or_else(|| anyhow::anyhow!("Invalid coordinate value"))?;

        value_str
            .parse::<f64>()
            .context("Failed to parse coordinate")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ros2_node_creation() {
        let config = Ros2Config {
            enabled: true,
            ..Default::default()
        };

        let node = Ros2Node::new(config).await;
        assert!(node.is_ok());
    }

    #[tokio::test]
    async fn test_publish_subscribe() {
        let config = Ros2Config {
            enabled: true,
            ..Default::default()
        };

        let node = Ros2Node::new(config).await.unwrap();

        // Publish prompt
        node.publish_prompt("Test prompt").await.unwrap();

        // Give some time for async processing
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Receive prompt
        let msg = node.receive_prompt().await.unwrap();
        assert!(msg.is_some());
        assert_eq!(msg.unwrap().prompt, "Test prompt");
    }

    #[tokio::test]
    async fn test_navigation_goal() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };

        let node = Ros2Node::new(config).await.unwrap();

        let goal = NavigationGoal {
            x: 1.0,
            y: 2.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };

        let handle = node.navigate_to_pose(goal).await.unwrap();

        // Legacy API still works
        let status = node.get_navigation_status().await.unwrap();
        assert!(status.is_some());
        assert_eq!(status.unwrap().status, "navigating");

        // Handle starts in Accepted state
        let state = handle.status().await;
        assert!(
            state == NavigationState::Accepted
                || state == NavigationState::Planning
                || state == NavigationState::Executing,
            "Expected non-terminal state, got {:?}",
            state
        );

        // Active handle should be available
        let active = node.get_active_handle().await;
        assert!(active.is_some());
    }

    #[tokio::test]
    async fn test_navigation_goal_id_assigned() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };

        let node = Ros2Node::new(config).await.unwrap();
        let goal = NavigationGoal {
            x: 1.0,
            y: 1.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };
        let handle = node.navigate_to_pose(goal).await.unwrap();
        let goal_id = handle.goal_id().await;
        assert!(!goal_id.is_empty(), "goal_id must be non-empty");
    }

    #[tokio::test]
    async fn test_navigation_handle_wait() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };

        let node = Ros2Node::new(config).await.unwrap();

        let goal = NavigationGoal {
            x: 3.0,
            y: 4.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };

        let handle = node.navigate_to_pose(goal).await.unwrap();
        let final_state = handle.wait().await.unwrap();
        assert_eq!(final_state, NavigationState::Succeeded);

        // Feedback should show we arrived at the goal
        let feedback = handle.feedback().await;
        assert!((feedback.current_pose.0 - 3.0).abs() < 0.01);
        assert!((feedback.current_pose.1 - 4.0).abs() < 0.01);
        assert!(feedback.distance_remaining < 0.01);
    }

    #[tokio::test]
    async fn test_navigation_handle_cancel() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };

        let node = Ros2Node::new(config).await.unwrap();

        let goal = NavigationGoal {
            x: 100.0,
            y: 100.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };

        let handle = node.navigate_to_pose(goal).await.unwrap();

        // Cancel immediately
        handle.cancel().await.unwrap();

        let state = handle.status().await;
        assert_eq!(state, NavigationState::Canceled);

        // wait() should also return Canceled
        let final_state = handle.wait().await.unwrap();
        assert_eq!(final_state, NavigationState::Canceled);
    }

    #[tokio::test]
    async fn test_navigation_handle_cancel_with_timeout() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };
        let node = Ros2Node::new(config).await.unwrap();
        let goal = NavigationGoal {
            x: 50.0,
            y: 50.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };
        let handle = node.navigate_to_pose(goal).await.unwrap();

        let result = handle.cancel_with_timeout(20).await;
        assert!(
            result.is_ok(),
            "cancel_with_timeout must succeed within 20ms"
        );
        let goal_id = result.unwrap();
        assert!(!goal_id.is_empty());
        assert_eq!(handle.status().await, NavigationState::Canceled);
    }

    #[tokio::test]
    async fn test_navigation_handle_clone_shares_state() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };
        let node = Ros2Node::new(config).await.unwrap();
        let goal = NavigationGoal {
            x: 10.0,
            y: 10.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };
        let handle = node.navigate_to_pose(goal).await.unwrap();
        let clone = handle.clone();

        // Cancel via clone; original should see Canceled state.
        clone.cancel().await.unwrap();
        assert_eq!(handle.status().await, NavigationState::Canceled);
    }

    #[tokio::test]
    async fn test_navigation_handle_feedback() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };

        let node = Ros2Node::new(config).await.unwrap();

        let goal = NavigationGoal {
            x: 5.0,
            y: 0.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };

        let handle = node.navigate_to_pose(goal).await.unwrap();

        let feedback = handle.feedback().await;
        assert!(feedback.distance_remaining > 0.0);
        assert!(feedback.estimated_time_remaining > 0.0);

        // Wait for completion
        let _ = handle.wait().await.unwrap();

        let feedback = handle.feedback().await;
        assert!(feedback.distance_remaining < 0.01);
    }

    #[tokio::test]
    async fn test_navigation_state_is_terminal() {
        assert!(!NavigationState::Accepted.is_terminal());
        assert!(!NavigationState::Planning.is_terminal());
        assert!(!NavigationState::Executing.is_terminal());
        assert!(NavigationState::Succeeded.is_terminal());
        assert!(NavigationState::Failed("test".to_string()).is_terminal());
        assert!(NavigationState::Canceled.is_terminal());
    }

    #[tokio::test]
    async fn test_publish_zero_velocity() {
        let config = Ros2Config {
            enabled: true,
            ..Default::default()
        };
        let node = Ros2Node::new(config).await.unwrap();

        assert_eq!(node.cmd_vel_command_count().await, 0);
        node.publish_zero_velocity().await.unwrap();
        node.publish_zero_velocity().await.unwrap();
        assert_eq!(node.cmd_vel_command_count().await, 2);
    }

    #[tokio::test]
    async fn simulation_cancel_path_reaches_terminal_canceled_state() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };
        let node = Ros2Node::new(config).await.unwrap();
        let handle = node
            .navigate_to_pose(NavigationGoal {
                x: 12.0,
                y: 1.0,
                z: 0.0,
                orientation_w: 1.0,
                frame_id: "map".to_string(),
            })
            .await
            .unwrap();

        handle.cancel_with_timeout(50).await.unwrap();
        assert_eq!(handle.wait().await.unwrap(), NavigationState::Canceled);
    }

    #[tokio::test]
    async fn simulation_stop_path_zeroes_last_velocity() {
        let config = Ros2Config {
            enabled: true,
            ..Default::default()
        };
        let node = Ros2Node::new(config).await.unwrap();

        node.publish_velocity(0.8, 0.3).await.unwrap();
        assert_eq!(node.last_velocity().await, [0.8, 0.3]);
        node.publish_zero_velocity().await.unwrap();
        assert_eq!(node.last_velocity().await, [0.0, 0.0]);
    }

    #[tokio::test]
    async fn simulation_timeout_path_is_observable_without_hardware() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: true,
            ..Default::default()
        };
        let node = Ros2Node::new(config).await.unwrap();
        let handle = node
            .navigate_to_pose(NavigationGoal {
                x: 25.0,
                y: 0.0,
                z: 0.0,
                orientation_w: 1.0,
                frame_id: "map".to_string(),
            })
            .await
            .unwrap();

        let result = tokio::time::timeout(Duration::from_millis(1), handle.wait()).await;
        assert!(result.is_err(), "short HIL timeout should be observable");
        handle.cancel().await.unwrap();
    }

    #[tokio::test]
    async fn simulation_failure_path_rejects_navigation_when_nav2_disabled() {
        let config = Ros2Config {
            enabled: true,
            enable_nav2: false,
            ..Default::default()
        };
        let node = Ros2Node::new(config).await.unwrap();
        let result = node
            .navigate_to_pose(NavigationGoal {
                x: 1.0,
                y: 1.0,
                z: 0.0,
                orientation_w: 1.0,
                frame_id: "map".to_string(),
            })
            .await;

        let error = match result {
            Ok(_) => panic!("navigation should fail when Nav2 is disabled"),
            Err(error) => error,
        };
        assert!(error.to_string().contains("Nav2 is disabled"));
    }

    #[tokio::test]
    async fn test_parse_navigation_command() {
        let response = "I will go to x=5.0 y=3.5 z=0.0";
        let goal = utils::parse_navigation_command(response).unwrap();

        assert!(goal.is_some());
        let goal = goal.unwrap();
        assert_eq!(goal.x, 5.0);
        assert_eq!(goal.y, 3.5);
        assert_eq!(goal.z, 0.0);
    }
}
