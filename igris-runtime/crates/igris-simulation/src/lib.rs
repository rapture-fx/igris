//! Simulation & Testing Suite for Igris Runtime
//!
//! Provides virtual environments and chaos testing for AI agents.

use anyhow::Result;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationConfig {
    pub enabled: bool,
    pub env_type: EnvironmentType,
    pub chaos_enabled: bool,
    pub failure_rate: f32,
}

impl Default for SimulationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            env_type: EnvironmentType::VirtualSwarm,
            chaos_enabled: false,
            failure_rate: 0.1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnvironmentType {
    VirtualSwarm,
    Gazebo,
    IsaacSim,
}

pub struct SimulationEnvironment {
    config: SimulationConfig,
    agents: Vec<VirtualAgent>,
}

#[derive(Debug, Clone)]
pub struct VirtualAgent {
    pub id: String,
    pub position: (f32, f32, f32),
    pub status: AgentStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AgentStatus {
    Active,
    Failed,
    Recovering,
}

impl SimulationEnvironment {
    pub async fn new(config: SimulationConfig) -> Result<Self> {
        info!("Initializing simulation environment: {:?}", config.env_type);

        Ok(Self {
            config,
            agents: vec![],
        })
    }

    pub async fn spawn_agent(&mut self, id: String) -> Result<()> {
        let agent = VirtualAgent {
            id,
            position: (0.0, 0.0, 0.0),
            status: AgentStatus::Active,
        };

        self.agents.push(agent);
        Ok(())
    }

    pub async fn inject_failure(&mut self, agent_id: &str) -> Result<()> {
        if let Some(agent) = self.agents.iter_mut().find(|a| a.id == agent_id) {
            agent.status = AgentStatus::Failed;
            info!("Injected failure into agent '{}'", agent_id);
        }
        Ok(())
    }

    pub async fn step(&mut self) -> Result<()> {
        // Simulate chaos if enabled
        if self.config.chaos_enabled {
            let mut rng = rand::thread_rng();
            for agent in &mut self.agents {
                if agent.status == AgentStatus::Active
                    && rng.gen::<f32>() < self.config.failure_rate
                {
                    agent.status = AgentStatus::Failed;
                }
            }
        }

        Ok(())
    }

    pub fn get_agent_count(&self) -> usize {
        self.agents.len()
    }

    pub fn get_active_agents(&self) -> usize {
        self.agents
            .iter()
            .filter(|a| a.status == AgentStatus::Active)
            .count()
    }
}

pub struct BenchmarkRunner {
    results: HashMap<String, BenchmarkResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub test_name: String,
    pub duration_ms: u64,
    pub success: bool,
    pub metrics: HashMap<String, f64>,
}

impl BenchmarkRunner {
    pub fn new() -> Self {
        Self {
            results: HashMap::new(),
        }
    }

    pub async fn run_benchmark(&mut self, name: &str) -> Result<BenchmarkResult> {
        let start = std::time::Instant::now();

        // Simulated benchmark
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let duration = start.elapsed().as_millis() as u64;

        let result = BenchmarkResult {
            test_name: name.to_string(),
            duration_ms: duration,
            success: true,
            metrics: HashMap::new(),
        };

        self.results.insert(name.to_string(), result.clone());

        Ok(result)
    }

    pub fn get_results(&self) -> Vec<BenchmarkResult> {
        self.results.values().cloned().collect()
    }
}

impl Default for BenchmarkRunner {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Nav2 Simulation
// ============================================================================

/// Configuration for the Nav2 simulator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavSimConfig {
    /// Probability of navigation succeeding (0.0 - 1.0)
    pub success_rate: f64,
    /// Simulated navigation speed in meters per second
    pub navigation_speed: f64,
    /// List of obstacle positions that can block navigation
    pub obstacles: Vec<(f64, f64)>,
    /// Minimum distance to an obstacle that triggers a failure
    pub obstacle_radius: f64,
}

impl Default for NavSimConfig {
    fn default() -> Self {
        Self {
            success_rate: 0.95,
            navigation_speed: 1.0,
            obstacles: vec![],
            obstacle_radius: 0.5,
        }
    }
}

/// A navigation goal for the simulator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationGoal {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub orientation_w: f64,
    pub frame_id: String,
}

/// Result of a simulated navigation action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationResult {
    pub success: bool,
    pub final_pose: (f64, f64, f64),
    pub distance_traveled: f64,
    pub elapsed_time: Duration,
    pub failure_reason: Option<String>,
}

/// Simulates Nav2 action server behavior for testing
pub struct NavSimulator {
    config: NavSimConfig,
    /// Current simulated robot pose (x, y, z)
    current_pose: (f64, f64, f64),
}

impl NavSimulator {
    /// Create a new NavSimulator with the given configuration
    pub fn new(config: NavSimConfig) -> Self {
        Self {
            config,
            current_pose: (0.0, 0.0, 0.0),
        }
    }

    /// Get the current simulated robot pose
    pub fn current_pose(&self) -> (f64, f64, f64) {
        self.current_pose
    }

    /// Set the current simulated robot pose
    pub fn set_pose(&mut self, pose: (f64, f64, f64)) {
        self.current_pose = pose;
    }

    /// Process a navigation goal, simulating Nav2 behavior
    pub fn process_goal(&mut self, goal: &NavigationGoal) -> NavigationResult {
        let dx = goal.x - self.current_pose.0;
        let dy = goal.y - self.current_pose.1;
        let dz = goal.z - self.current_pose.2;
        let distance = (dx * dx + dy * dy + dz * dz).sqrt();

        // Check for obstacle collisions along the path
        let steps = (distance * 10.0).max(1.0) as usize;
        for step in 1..=steps {
            let t = step as f64 / steps as f64;
            let px = self.current_pose.0 + dx * t;
            let py = self.current_pose.1 + dy * t;

            for &(ox, oy) in &self.config.obstacles {
                let odist = ((px - ox).powi(2) + (py - oy).powi(2)).sqrt();
                if odist < self.config.obstacle_radius {
                    // Blocked by obstacle - stop at the point just before collision
                    let blocked_t = ((step - 1) as f64) / steps as f64;
                    let blocked_pose = (
                        self.current_pose.0 + dx * blocked_t,
                        self.current_pose.1 + dy * blocked_t,
                        self.current_pose.2 + dz * blocked_t,
                    );
                    let traveled = distance * blocked_t;
                    self.current_pose = blocked_pose;

                    return NavigationResult {
                        success: false,
                        final_pose: blocked_pose,
                        distance_traveled: traveled,
                        elapsed_time: Duration::from_secs_f64(
                            traveled / self.config.navigation_speed,
                        ),
                        failure_reason: Some(format!(
                            "Obstacle at ({:.2}, {:.2}) blocked path",
                            ox, oy
                        )),
                    };
                }
            }
        }

        // Random failure based on success rate
        let mut rng = rand::thread_rng();
        if rng.gen::<f64>() > self.config.success_rate {
            // Fail at a random point along the path
            let fail_fraction = rng.gen::<f64>();
            let fail_pose = (
                self.current_pose.0 + dx * fail_fraction,
                self.current_pose.1 + dy * fail_fraction,
                self.current_pose.2 + dz * fail_fraction,
            );
            let traveled = distance * fail_fraction;
            self.current_pose = fail_pose;

            return NavigationResult {
                success: false,
                final_pose: fail_pose,
                distance_traveled: traveled,
                elapsed_time: Duration::from_secs_f64(traveled / self.config.navigation_speed),
                failure_reason: Some("Random navigation failure".to_string()),
            };
        }

        // Success - move to goal
        let elapsed = Duration::from_secs_f64(distance / self.config.navigation_speed);
        self.current_pose = (goal.x, goal.y, goal.z);

        NavigationResult {
            success: true,
            final_pose: (goal.x, goal.y, goal.z),
            distance_traveled: distance,
            elapsed_time: elapsed,
            failure_reason: None,
        }
    }
}

// ============================================================================
// Fault Injection
// ============================================================================

/// Fault injector for simulating network and runtime failures
pub struct FaultInjector {
    network_available: Arc<AtomicBool>,
    latency_mean: Option<Duration>,
    latency_stddev: Option<Duration>,
    crashed: Arc<AtomicBool>,
}

impl FaultInjector {
    /// Create a new FaultInjector with no active faults
    pub fn new() -> Self {
        Self {
            network_available: Arc::new(AtomicBool::new(true)),
            latency_mean: None,
            latency_stddev: None,
            crashed: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Simulate a network disconnection for the given duration.
    /// The network becomes unavailable immediately and is restored after `duration`.
    pub fn inject_network_drop(&self, duration: Duration) {
        info!("Injecting network drop for {:?}", duration);
        self.network_available.store(false, Ordering::SeqCst);

        let network = self.network_available.clone();
        tokio::spawn(async move {
            tokio::time::sleep(duration).await;
            network.store(true, Ordering::SeqCst);
            info!("Network restored after simulated drop");
        });
    }

    /// Add artificial latency to simulated operations.
    /// Latency is sampled from a normal distribution with the given mean and stddev.
    pub fn inject_latency(&mut self, mean: Duration, stddev: Duration) {
        info!("Injecting latency: mean={:?}, stddev={:?}", mean, stddev);
        self.latency_mean = Some(mean);
        self.latency_stddev = Some(stddev);
    }

    /// Simulate a runtime crash. After calling this, `is_crashed()` returns true.
    pub fn inject_crash(&self) {
        warn!("Injecting simulated runtime crash");
        self.crashed.store(true, Ordering::SeqCst);
    }

    /// Check if the simulated network is currently available
    pub fn is_network_available(&self) -> bool {
        self.network_available.load(Ordering::SeqCst)
    }

    /// Check if a simulated crash has been injected
    pub fn is_crashed(&self) -> bool {
        self.crashed.load(Ordering::SeqCst)
    }

    /// Get the current injected latency as a sampled duration, or None if no latency is configured
    pub fn sample_latency(&self) -> Option<Duration> {
        match (self.latency_mean, self.latency_stddev) {
            (Some(mean), Some(stddev)) => {
                let mut rng = rand::thread_rng();
                // Simple Box-Muller approximation: abs(normal) to avoid negative durations
                let u1: f64 = rng.gen::<f64>().max(1e-10);
                let u2: f64 = rng.gen();
                let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
                let sample_secs = mean.as_secs_f64() + stddev.as_secs_f64() * z;
                let clamped = sample_secs.max(0.0);
                Some(Duration::from_secs_f64(clamped))
            }
            _ => None,
        }
    }

    /// Reset all injected faults
    pub fn reset(&mut self) {
        self.network_available.store(true, Ordering::SeqCst);
        self.latency_mean = None;
        self.latency_stddev = None;
        self.crashed.store(false, Ordering::SeqCst);
        info!("All faults reset");
    }
}

impl Default for FaultInjector {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Simulation Harness
// ============================================================================

/// A scenario to run in the simulation harness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimScenario {
    /// Scenario name for reporting
    pub name: String,
    /// Sequence of navigation goals to execute
    pub goals: Vec<NavigationGoal>,
    /// Whether to inject a network drop during execution
    pub inject_network_drop: Option<Duration>,
    /// Whether to inject latency during execution
    pub inject_latency: Option<(Duration, Duration)>,
    /// Whether to inject a crash during execution
    pub inject_crash: bool,
}

/// Result of running a simulation scenario
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioResult {
    /// Scenario name
    pub name: String,
    /// Results for each navigation goal
    pub navigation_results: Vec<NavigationResult>,
    /// Whether the scenario completed without harness-level failure
    pub completed: bool,
    /// Total elapsed time for the scenario
    pub total_time: Duration,
    /// Number of goals that succeeded
    pub goals_succeeded: usize,
    /// Number of goals that failed
    pub goals_failed: usize,
    /// Whether a crash was detected during execution
    pub crash_detected: bool,
    /// Whether a network drop was active during execution
    pub network_drop_detected: bool,
}

/// Combines NavSimulator, FaultInjector, and optional BTreeExecutor reference
/// for integrated simulation testing.
pub struct SimulationHarness {
    nav: NavSimulator,
    faults: FaultInjector,
    /// Optional behavior tree executor name (not a direct dependency to avoid circular deps)
    btree_executor_name: Option<String>,
}

impl SimulationHarness {
    /// Create a new SimulationHarness with a NavSimulator and FaultInjector
    pub fn new(nav: NavSimulator, faults: FaultInjector) -> Self {
        Self {
            nav,
            faults,
            btree_executor_name: None,
        }
    }

    /// Attach a behavior tree executor reference by name.
    /// This records the executor for scenario reporting without creating a hard dependency.
    pub fn with_btree(mut self, executor_name: &str) -> Self {
        self.btree_executor_name = Some(executor_name.to_string());
        self
    }

    /// Get a reference to the NavSimulator
    pub fn nav(&self) -> &NavSimulator {
        &self.nav
    }

    /// Get a mutable reference to the NavSimulator
    pub fn nav_mut(&mut self) -> &mut NavSimulator {
        &mut self.nav
    }

    /// Get a reference to the FaultInjector
    pub fn faults(&self) -> &FaultInjector {
        &self.faults
    }

    /// Get a mutable reference to the FaultInjector
    pub fn faults_mut(&mut self) -> &mut FaultInjector {
        &mut self.faults
    }

    /// Run a simulation scenario, executing goals while applying fault injections
    pub async fn run_scenario(&mut self, scenario: SimScenario) -> ScenarioResult {
        info!("Running scenario: {}", scenario.name);
        let start = std::time::Instant::now();

        let mut nav_results = Vec::new();
        let mut goals_succeeded = 0usize;
        let mut goals_failed = 0usize;
        let mut crash_detected = false;
        let mut network_drop_detected = false;

        // Apply fault injections before running goals
        if let Some(drop_duration) = scenario.inject_network_drop {
            self.faults.inject_network_drop(drop_duration);
        }

        if let Some((mean, stddev)) = scenario.inject_latency {
            self.faults.inject_latency(mean, stddev);
        }

        if scenario.inject_crash {
            self.faults.inject_crash();
        }

        for goal in &scenario.goals {
            // Check for crash
            if self.faults.is_crashed() {
                crash_detected = true;
                warn!(
                    "Crash detected during scenario '{}', aborting remaining goals",
                    scenario.name
                );
                break;
            }

            // Check network
            if !self.faults.is_network_available() {
                network_drop_detected = true;
                warn!(
                    "Network unavailable during scenario '{}', skipping goal",
                    scenario.name
                );
                goals_failed += 1;
                nav_results.push(NavigationResult {
                    success: false,
                    final_pose: self.nav.current_pose(),
                    distance_traveled: 0.0,
                    elapsed_time: Duration::ZERO,
                    failure_reason: Some("Network unavailable".to_string()),
                });
                continue;
            }

            // Apply latency if configured
            if let Some(latency) = self.faults.sample_latency() {
                tokio::time::sleep(latency).await;
            }

            let result = self.nav.process_goal(goal);
            if result.success {
                goals_succeeded += 1;
            } else {
                goals_failed += 1;
            }
            nav_results.push(result);
        }

        let total_time = start.elapsed();

        // Reset faults after scenario
        self.faults.reset();

        ScenarioResult {
            name: scenario.name,
            navigation_results: nav_results,
            completed: !crash_detected,
            total_time,
            goals_succeeded,
            goals_failed,
            crash_detected,
            network_drop_detected,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_simulation_init() {
        let config = SimulationConfig::default();
        let sim = SimulationEnvironment::new(config).await;
        assert!(sim.is_ok());
    }

    #[tokio::test]
    async fn test_spawn_agents() {
        let config = SimulationConfig::default();
        let mut sim = SimulationEnvironment::new(config).await.unwrap();

        sim.spawn_agent("agent-1".to_string()).await.unwrap();
        sim.spawn_agent("agent-2".to_string()).await.unwrap();

        assert_eq!(sim.get_agent_count(), 2);
        assert_eq!(sim.get_active_agents(), 2);
    }

    #[tokio::test]
    async fn test_failure_injection() {
        let config = SimulationConfig::default();
        let mut sim = SimulationEnvironment::new(config).await.unwrap();

        sim.spawn_agent("agent-1".to_string()).await.unwrap();
        assert_eq!(sim.get_active_agents(), 1);

        sim.inject_failure("agent-1").await.unwrap();
        assert_eq!(sim.get_active_agents(), 0);
    }

    #[tokio::test]
    async fn test_benchmark() {
        let mut runner = BenchmarkRunner::new();
        let result = runner.run_benchmark("test").await.unwrap();

        assert_eq!(result.test_name, "test");
        assert!(result.success);
        assert!(result.duration_ms > 0);
    }

    // ========================================================================
    // NavSimulator tests
    // ========================================================================

    #[test]
    fn test_nav_simulator_successful_navigation() {
        let config = NavSimConfig {
            success_rate: 1.0, // always succeed
            navigation_speed: 2.0,
            obstacles: vec![],
            obstacle_radius: 0.5,
        };
        let mut sim = NavSimulator::new(config);

        let goal = NavigationGoal {
            x: 3.0,
            y: 4.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };

        let result = sim.process_goal(&goal);
        assert!(result.success);
        assert!((result.distance_traveled - 5.0).abs() < 0.01); // 3-4-5 triangle
        assert_eq!(result.final_pose, (3.0, 4.0, 0.0));
        assert!(result.failure_reason.is_none());
        assert_eq!(sim.current_pose(), (3.0, 4.0, 0.0));
    }

    #[test]
    fn test_nav_simulator_obstacle_collision() {
        let config = NavSimConfig {
            success_rate: 1.0,
            navigation_speed: 1.0,
            obstacles: vec![(2.5, 0.0)], // obstacle directly on the path
            obstacle_radius: 0.5,
        };
        let mut sim = NavSimulator::new(config);

        let goal = NavigationGoal {
            x: 5.0,
            y: 0.0,
            z: 0.0,
            orientation_w: 1.0,
            frame_id: "map".to_string(),
        };

        let result = sim.process_goal(&goal);
        assert!(!result.success);
        assert!(result.failure_reason.is_some());
        assert!(result.failure_reason.unwrap().contains("Obstacle"));
    }

    #[test]
    fn test_nav_simulator_tracks_pose() {
        let config = NavSimConfig {
            success_rate: 1.0,
            navigation_speed: 1.0,
            obstacles: vec![],
            obstacle_radius: 0.5,
        };
        let mut sim = NavSimulator::new(config);
        assert_eq!(sim.current_pose(), (0.0, 0.0, 0.0));

        sim.set_pose((1.0, 1.0, 0.0));
        assert_eq!(sim.current_pose(), (1.0, 1.0, 0.0));
    }

    // ========================================================================
    // FaultInjector tests
    // ========================================================================

    #[test]
    fn test_fault_injector_initial_state() {
        let fi = FaultInjector::new();
        assert!(fi.is_network_available());
        assert!(!fi.is_crashed());
        assert!(fi.sample_latency().is_none());
    }

    #[test]
    fn test_fault_injector_crash() {
        let fi = FaultInjector::new();
        assert!(!fi.is_crashed());
        fi.inject_crash();
        assert!(fi.is_crashed());
    }

    #[test]
    fn test_fault_injector_latency() {
        let mut fi = FaultInjector::new();
        fi.inject_latency(Duration::from_millis(100), Duration::from_millis(10));
        let latency = fi.sample_latency();
        assert!(latency.is_some());
        // Latency should be roughly in the range (could be far from mean with low probability)
        assert!(latency.unwrap().as_millis() < 1000); // sanity check
    }

    #[tokio::test]
    async fn test_fault_injector_network_drop() {
        let fi = FaultInjector::new();
        assert!(fi.is_network_available());

        fi.inject_network_drop(Duration::from_millis(100));
        assert!(!fi.is_network_available());

        tokio::time::sleep(Duration::from_millis(150)).await;
        assert!(fi.is_network_available());
    }

    #[test]
    fn test_fault_injector_reset() {
        let mut fi = FaultInjector::new();
        fi.inject_crash();
        fi.inject_latency(Duration::from_millis(50), Duration::from_millis(10));
        assert!(fi.is_crashed());
        assert!(fi.sample_latency().is_some());

        fi.reset();
        assert!(!fi.is_crashed());
        assert!(fi.is_network_available());
        assert!(fi.sample_latency().is_none());
    }

    // ========================================================================
    // SimulationHarness tests
    // ========================================================================

    #[tokio::test]
    async fn test_harness_simple_scenario() {
        let nav = NavSimulator::new(NavSimConfig {
            success_rate: 1.0,
            ..Default::default()
        });
        let faults = FaultInjector::new();
        let mut harness = SimulationHarness::new(nav, faults);

        let scenario = SimScenario {
            name: "simple_nav".to_string(),
            goals: vec![
                NavigationGoal {
                    x: 1.0,
                    y: 0.0,
                    z: 0.0,
                    orientation_w: 1.0,
                    frame_id: "map".to_string(),
                },
                NavigationGoal {
                    x: 2.0,
                    y: 1.0,
                    z: 0.0,
                    orientation_w: 1.0,
                    frame_id: "map".to_string(),
                },
            ],
            inject_network_drop: None,
            inject_latency: None,
            inject_crash: false,
        };

        let result = harness.run_scenario(scenario).await;
        assert!(result.completed);
        assert_eq!(result.goals_succeeded, 2);
        assert_eq!(result.goals_failed, 0);
        assert!(!result.crash_detected);
        assert!(!result.network_drop_detected);
    }

    #[tokio::test]
    async fn test_harness_crash_scenario() {
        let nav = NavSimulator::new(NavSimConfig {
            success_rate: 1.0,
            ..Default::default()
        });
        let faults = FaultInjector::new();
        let mut harness = SimulationHarness::new(nav, faults);

        let scenario = SimScenario {
            name: "crash_test".to_string(),
            goals: vec![NavigationGoal {
                x: 1.0,
                y: 0.0,
                z: 0.0,
                orientation_w: 1.0,
                frame_id: "map".to_string(),
            }],
            inject_network_drop: None,
            inject_latency: None,
            inject_crash: true,
        };

        let result = harness.run_scenario(scenario).await;
        assert!(!result.completed);
        assert!(result.crash_detected);
        assert_eq!(result.goals_succeeded, 0);
    }

    #[tokio::test]
    async fn test_harness_with_btree() {
        let nav = NavSimulator::new(NavSimConfig::default());
        let faults = FaultInjector::new();
        let harness = SimulationHarness::new(nav, faults).with_btree("test_executor");

        assert_eq!(
            harness.btree_executor_name,
            Some("test_executor".to_string())
        );
    }

    #[tokio::test]
    async fn test_harness_network_drop_scenario() {
        let nav = NavSimulator::new(NavSimConfig {
            success_rate: 1.0,
            ..Default::default()
        });
        let faults = FaultInjector::new();
        let mut harness = SimulationHarness::new(nav, faults);

        // Use a very long network drop so it stays down during the test
        let scenario = SimScenario {
            name: "network_drop_test".to_string(),
            goals: vec![NavigationGoal {
                x: 1.0,
                y: 0.0,
                z: 0.0,
                orientation_w: 1.0,
                frame_id: "map".to_string(),
            }],
            inject_network_drop: Some(Duration::from_secs(60)),
            inject_latency: None,
            inject_crash: false,
        };

        let result = harness.run_scenario(scenario).await;
        assert!(result.completed);
        assert!(result.network_drop_detected);
        assert_eq!(result.goals_failed, 1);
        assert_eq!(result.goals_succeeded, 0);
    }
}
