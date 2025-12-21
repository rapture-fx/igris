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
//!         println!("Response: {}", response);
//!     }
//!
//!     Ok(())
//! }
//! ```

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, info};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationStatus {
    pub status: String, // navigating, succeeded, failed, canceled
    pub distance_remaining: f64,
    pub estimated_time_remaining: f64,
}

/// ROS2 Node implementation
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
}

impl Ros2Node {
    /// Create a new ROS2 node
    pub async fn new(config: Ros2Config) -> Result<Self> {
        if !config.enabled {
            return Err(anyhow::anyhow!("ROS2 is disabled in config"));
        }

        info!(
            "Initializing ROS2 node '{}' in namespace '{}' (domain {})",
            config.node_name, config.namespace, config.domain_id
        );

        let (prompt_tx, prompt_rx) = mpsc::unbounded_channel();
        let (response_tx, response_rx) = mpsc::unbounded_channel();

        let node = Self {
            config: config.clone(),
            prompt_tx,
            prompt_rx: Arc::new(RwLock::new(prompt_rx)),
            response_tx,
            response_rx: Arc::new(RwLock::new(response_rx)),
            nav_status: Arc::new(RwLock::new(None)),
            active: Arc::new(RwLock::new(true)),
        };

        // Initialize ROS2 context (stub - real impl would call rclrs::init)
        Self::init_ros2_context(&config).await?;

        info!("ROS2 node initialized successfully");
        Ok(node)
    }

    /// Initialize ROS2 context (stub for production rclrs integration)
    async fn init_ros2_context(config: &Ros2Config) -> Result<()> {
        debug!("Initializing ROS2 context with domain ID {}", config.domain_id);

        // In production, this would:
        // 1. Call rclrs::init()
        // 2. Create node with rclrs::create_node()
        // 3. Set up QoS profiles
        // 4. Create publishers/subscribers

        // For now, log initialization
        info!("ROS2 context initialized (stub implementation)");
        Ok(())
    }

    /// Publish a prompt to ROS2 topic
    pub async fn publish_prompt(&self, prompt: &str) -> Result<()> {
        let msg = PromptMessage {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_millis() as u64,
            prompt: prompt.to_string(),
            priority: 1,
            metadata: HashMap::new(),
        };

        debug!("Publishing prompt: {}", prompt);

        // In production, this would call publisher.publish()
        // For now, send to internal channel for testing
        self.prompt_tx.send(msg)
            .context("Failed to send prompt message")?;

        Ok(())
    }

    /// Publish a response to ROS2 topic
    pub async fn publish_response(&self, response: &str, status: &str) -> Result<()> {
        let msg = ResponseMessage {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_millis() as u64,
            response: response.to_string(),
            status: status.to_string(),
            metadata: HashMap::new(),
        };

        debug!("Publishing response: {}", response);

        self.response_tx.send(msg)
            .context("Failed to send response message")?;

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

    /// Send navigation goal to Nav2
    pub async fn navigate_to_pose(&self, goal: NavigationGoal) -> Result<()> {
        if !self.config.enable_nav2 {
            return Err(anyhow::anyhow!("Nav2 is disabled in config"));
        }

        info!(
            "Sending navigation goal to ({}, {}, {}) in frame '{}'",
            goal.x, goal.y, goal.z, goal.frame_id
        );

        // In production, this would:
        // 1. Create Nav2 action client
        // 2. Send NavigateToPose goal
        // 3. Wait for acceptance
        // 4. Monitor feedback

        // For now, simulate navigation start
        let mut status = self.nav_status.write().await;
        *status = Some(NavigationStatus {
            status: "navigating".to_string(),
            distance_remaining: ((goal.x * goal.x + goal.y * goal.y).sqrt()),
            estimated_time_remaining: 10.0,
        });

        Ok(())
    }

    /// Get current navigation status
    pub async fn get_navigation_status(&self) -> Result<Option<NavigationStatus>> {
        let status = self.nav_status.read().await;
        Ok(status.clone())
    }

    /// Cancel current navigation goal
    pub async fn cancel_navigation(&self) -> Result<()> {
        if !self.config.enable_nav2 {
            return Err(anyhow::anyhow!("Nav2 is disabled"));
        }

        info!("Canceling navigation goal");

        let mut status = self.nav_status.write().await;
        if let Some(nav_status) = status.as_mut() {
            nav_status.status = "canceled".to_string();
        }

        Ok(())
    }

    /// Call a ROS2 service
    pub async fn call_service<T, R>(&self, service_name: &str, _request: T) -> Result<R>
    where
        T: Serialize,
        R: for<'de> Deserialize<'de>,
    {
        debug!("Calling service: {}", service_name);

        // In production, this would:
        // 1. Create service client
        // 2. Wait for service availability
        // 3. Send request and wait for response

        // For now, return error as stub
        Err(anyhow::anyhow!("Service call not implemented (stub)"))
    }

    /// Shutdown the ROS2 node
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down ROS2 node");

        let mut active = self.active.write().await;
        *active = false;

        // In production, call rclrs::shutdown()

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
        if !response.to_lowercase().contains("go to") && !response.to_lowercase().contains("navigate") {
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
        let start = text.find(prefix)
            .ok_or_else(|| anyhow::anyhow!("Coordinate {} not found", prefix))?;
        let value_start = start + prefix.len();
        let value_str = &text[value_start..]
            .split_whitespace()
            .next()
            .ok_or_else(|| anyhow::anyhow!("Invalid coordinate value"))?;

        value_str.parse::<f64>()
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

        node.navigate_to_pose(goal).await.unwrap();

        let status = node.get_navigation_status().await.unwrap();
        assert!(status.is_some());
        assert_eq!(status.unwrap().status, "navigating");
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
