//! Sensor & Actuator Tooling for Igris Runtime
//!
//! Provides interfaces for interacting with hardware sensors and actuators
//! commonly used in robotics and edge AI applications.
//!
//! # Supported Hardware
//! - **GPIO:** Digital input/output via rppal (Raspberry Pi and compatible SBCs)
//! - **Camera:** Image capture via V4L2 or simulated input
//! - **LIDAR:** Point cloud data via serial or UDP
//! - **Actuators:** Motor control with safety whitelisting
//!
//! # Safety
//! All actuator operations are subject to whitelisting and permission checks
//! to prevent unintended hardware damage or safety violations.
//!
//! # Example
//! ```no_run
//! use igris_sensors::{SensorManager, SensorConfig};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let config = SensorConfig::default();
//!     let manager = SensorManager::new(config).await?;
//!
//!     // Read camera frame
//!     let frame = manager.read_camera().await?;
//!     println!("Captured frame: {} bytes", frame.data.len());
//!
//!     Ok(())
//! }
//! ```

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Sensor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorConfig {
    /// Enable GPIO support
    pub enable_gpio: bool,

    /// Enable camera support
    pub enable_camera: bool,

    /// Enable LIDAR support
    pub enable_lidar: bool,

    /// Camera device path (e.g., /dev/video0)
    pub camera_device: String,

    /// Camera resolution (width x height)
    pub camera_width: u32,
    pub camera_height: u32,

    /// LIDAR connection type (serial, udp, tcp)
    pub lidar_connection: String,

    /// LIDAR device/address (e.g., /dev/ttyUSB0 or 192.168.1.100:8080)
    pub lidar_address: String,

    /// Whitelisted GPIO pins for output
    pub gpio_output_whitelist: Vec<u8>,

    /// Whitelisted actuator actions
    pub actuator_whitelist: HashSet<String>,

    /// Safety mode (if true, actuators require confirmation)
    pub safety_mode: bool,
}

impl Default for SensorConfig {
    fn default() -> Self {
        Self {
            enable_gpio: false,
            enable_camera: false,
            enable_lidar: false,
            camera_device: "/dev/video0".to_string(),
            camera_width: 640,
            camera_height: 480,
            lidar_connection: "serial".to_string(),
            lidar_address: "/dev/ttyUSB0".to_string(),
            gpio_output_whitelist: vec![],
            actuator_whitelist: HashSet::new(),
            safety_mode: true,
        }
    }
}

/// Camera frame data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraFrame {
    pub timestamp: u64,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub data: Vec<u8>,
}

impl CameraFrame {
    /// Encode frame as base64 for transmission
    pub fn to_base64(&self) -> String {
        use base64::Engine;
        base64::prelude::BASE64_STANDARD.encode(&self.data)
    }
}

/// LIDAR point cloud data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LidarScan {
    pub timestamp: u64,
    pub points: Vec<LidarPoint>,
    pub scan_rate_hz: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LidarPoint {
    pub angle_deg: f32,
    pub distance_m: f32,
    pub intensity: u8,
}

/// GPIO pin state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PinState {
    Low = 0,
    High = 1,
}

/// Sensor Manager
pub struct SensorManager {
    config: SensorConfig,

    // GPIO state (pin number -> state)
    gpio_state: Arc<RwLock<std::collections::HashMap<u8, PinState>>>,

    // Camera state
    camera_active: Arc<RwLock<bool>>,

    // LIDAR state
    lidar_active: Arc<RwLock<bool>>,
}

impl SensorManager {
    /// Create a new sensor manager
    pub async fn new(config: SensorConfig) -> Result<Self> {
        info!("Initializing sensor manager");

        let manager = Self {
            config: config.clone(),
            gpio_state: Arc::new(RwLock::new(std::collections::HashMap::new())),
            camera_active: Arc::new(RwLock::new(false)),
            lidar_active: Arc::new(RwLock::new(false)),
        };

        // Initialize GPIO if enabled
        if config.enable_gpio {
            manager.init_gpio().await?;
        }

        // Initialize camera if enabled
        if config.enable_camera {
            manager.init_camera().await?;
        }

        // Initialize LIDAR if enabled
        if config.enable_lidar {
            manager.init_lidar().await?;
        }

        info!("Sensor manager initialized");
        Ok(manager)
    }

    /// Initialize GPIO subsystem
    async fn init_gpio(&self) -> Result<()> {
        info!("Initializing GPIO");

        #[cfg(feature = "gpio")]
        {
            // In production with rppal:
            // let gpio = Gpio::new()?;
            // Store gpio handle
            debug!("GPIO initialized with rppal");
        }

        #[cfg(not(feature = "gpio"))]
        {
            debug!("GPIO stub initialization (rppal feature disabled)");
        }

        Ok(())
    }

    /// Initialize camera subsystem
    async fn init_camera(&self) -> Result<()> {
        info!("Initializing camera: {}", self.config.camera_device);

        // In production, this would:
        // 1. Open V4L2 device
        // 2. Set format and resolution
        // 3. Start streaming

        let mut active = self.camera_active.write().await;
        *active = true;

        Ok(())
    }

    /// Initialize LIDAR subsystem
    async fn init_lidar(&self) -> Result<()> {
        info!(
            "Initializing LIDAR via {} at {}",
            self.config.lidar_connection, self.config.lidar_address
        );

        // In production, this would:
        // 1. Open serial/UDP/TCP connection
        // 2. Send initialization commands
        // 3. Start scan loop

        let mut active = self.lidar_active.write().await;
        *active = true;

        Ok(())
    }

    /// Read GPIO pin state
    pub async fn read_gpio(&self, pin: u8) -> Result<PinState> {
        if !self.config.enable_gpio {
            return Err(anyhow::anyhow!("GPIO is disabled"));
        }

        debug!("Reading GPIO pin {}", pin);

        #[cfg(feature = "gpio")]
        {
            // In production: read actual pin state via rppal
            // let pin = gpio.get(pin)?.into_input();
            // Ok(if pin.is_high() { PinState::High } else { PinState::Low })
        }

        // For now, return cached state or default
        let state = self.gpio_state.read().await;
        Ok(state.get(&pin).copied().unwrap_or(PinState::Low))
    }

    /// Write GPIO pin state
    pub async fn write_gpio(&self, pin: u8, state: PinState) -> Result<()> {
        if !self.config.enable_gpio {
            return Err(anyhow::anyhow!("GPIO is disabled"));
        }

        // Check whitelist
        if !self.config.gpio_output_whitelist.contains(&pin) {
            return Err(anyhow::anyhow!("GPIO pin {} not in whitelist", pin));
        }

        info!("Writing GPIO pin {} to {:?}", pin, state);

        #[cfg(feature = "gpio")]
        {
            // In production: write actual pin state via rppal
            // let mut pin = gpio.get(pin)?.into_output();
            // if state == PinState::High {
            //     pin.set_high();
            // } else {
            //     pin.set_low();
            // }
        }

        // Update cached state
        let mut gpio_state = self.gpio_state.write().await;
        gpio_state.insert(pin, state);

        Ok(())
    }

    /// Read camera frame
    pub async fn read_camera(&self) -> Result<CameraFrame> {
        if !self.config.enable_camera {
            return Err(anyhow::anyhow!("Camera is disabled"));
        }

        let active = self.camera_active.read().await;
        if !*active {
            return Err(anyhow::anyhow!("Camera is not active"));
        }

        debug!("Capturing camera frame");

        // In production, this would:
        // 1. Grab frame from V4L2 buffer
        // 2. Convert to RGB/JPEG
        // 3. Return frame data

        // For now, generate a test pattern
        let width = self.config.camera_width;
        let height = self.config.camera_height;
        let data = Self::generate_test_pattern(width, height);

        Ok(CameraFrame {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_millis() as u64,
            width,
            height,
            format: "RGB8".to_string(),
            data,
        })
    }

    /// Generate test pattern for camera simulation
    fn generate_test_pattern(width: u32, height: u32) -> Vec<u8> {
        let mut data = Vec::with_capacity((width * height * 3) as usize);

        for y in 0..height {
            for x in 0..width {
                // Simple gradient pattern
                let r = ((x as f32 / width as f32) * 255.0) as u8;
                let g = ((y as f32 / height as f32) * 255.0) as u8;
                let b = 128;
                data.extend_from_slice(&[r, g, b]);
            }
        }

        data
    }

    /// Read LIDAR scan
    pub async fn read_lidar(&self) -> Result<LidarScan> {
        if !self.config.enable_lidar {
            return Err(anyhow::anyhow!("LIDAR is disabled"));
        }

        let active = self.lidar_active.read().await;
        if !*active {
            return Err(anyhow::anyhow!("LIDAR is not active"));
        }

        debug!("Reading LIDAR scan");

        // In production, this would:
        // 1. Read raw data from serial/UDP
        // 2. Parse LIDAR protocol (e.g., RPLIDAR, YDLIDAR)
        // 3. Return point cloud

        // For now, generate simulated scan
        let points = Self::generate_test_lidar_scan();

        Ok(LidarScan {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_millis() as u64,
            points,
            scan_rate_hz: 10.0,
        })
    }

    /// Generate test LIDAR scan
    fn generate_test_lidar_scan() -> Vec<LidarPoint> {
        let mut points = Vec::new();

        for i in 0..360 {
            let angle_deg = i as f32;
            let distance_m = 2.0 + (angle_deg.to_radians().sin() * 0.5);
            let intensity = ((angle_deg / 360.0) * 255.0) as u8;

            points.push(LidarPoint {
                angle_deg,
                distance_m,
                intensity,
            });
        }

        points
    }

    /// Execute actuator action (with safety checks)
    pub async fn execute_actuator(&self, action: &str, params: serde_json::Value) -> Result<()> {
        // Check whitelist
        if !self.config.actuator_whitelist.contains(action) {
            return Err(anyhow::anyhow!(
                "Actuator action '{}' not in whitelist",
                action
            ));
        }

        if self.config.safety_mode {
            warn!(
                "Actuator action '{}' requires confirmation (safety mode enabled)",
                action
            );
            // In production, this would request human confirmation
            return Err(anyhow::anyhow!("Actuator action blocked by safety mode"));
        }

        info!(
            "Executing actuator action: {} with params: {}",
            action, params
        );

        // In production, this would:
        // 1. Validate action and parameters
        // 2. Send commands to motor controllers
        // 3. Monitor execution

        Ok(())
    }

    /// Shutdown sensor manager
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down sensor manager");

        if self.config.enable_camera {
            let mut active = self.camera_active.write().await;
            *active = false;
        }

        if self.config.enable_lidar {
            let mut active = self.lidar_active.write().await;
            *active = false;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_sensor_manager_init() {
        let config = SensorConfig::default();
        let manager = SensorManager::new(config).await;
        assert!(manager.is_ok());
    }

    #[tokio::test]
    async fn test_camera_capture() {
        let mut config = SensorConfig::default();
        config.enable_camera = true;

        let manager = SensorManager::new(config).await.unwrap();
        let frame = manager.read_camera().await.unwrap();

        assert_eq!(frame.width, 640);
        assert_eq!(frame.height, 480);
        assert_eq!(frame.data.len(), 640 * 480 * 3);
    }

    #[tokio::test]
    async fn test_lidar_scan() {
        let mut config = SensorConfig::default();
        config.enable_lidar = true;

        let manager = SensorManager::new(config).await.unwrap();
        let scan = manager.read_lidar().await.unwrap();

        assert_eq!(scan.points.len(), 360);
        assert!(scan.scan_rate_hz > 0.0);
    }

    #[tokio::test]
    async fn test_gpio_whitelist() {
        let mut config = SensorConfig::default();
        config.enable_gpio = true;
        config.gpio_output_whitelist = vec![17, 27];

        let manager = SensorManager::new(config).await.unwrap();

        // Allowed pin
        let result = manager.write_gpio(17, PinState::High).await;
        assert!(result.is_ok());

        // Blocked pin
        let result = manager.write_gpio(99, PinState::High).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_actuator_safety() {
        let mut config = SensorConfig::default();
        config.safety_mode = true;
        config.actuator_whitelist.insert("move_forward".to_string());

        let manager = SensorManager::new(config).await.unwrap();

        // Should be blocked by safety mode
        let result = manager
            .execute_actuator("move_forward", serde_json::json!({"speed": 0.5}))
            .await;
        assert!(result.is_err());
    }
}
