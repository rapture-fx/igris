use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgrisConfig {
    pub server: ServerConfig,
    pub storage: Option<StorageConfig>,
    pub providers: Vec<super::providers::ProviderConfig>,
    pub routing: RoutingConfig,
    pub auth: AuthConfig,
    pub local_fallback: Option<LocalFallbackConfig>,
    /// Optional on-device LoRA training configuration (v1.6)
    #[serde(default)]
    pub lora_training: Option<LoRATrainingRuntimeConfig>,
    pub mcp: Option<McpConfig>,
    /// Optional reflection mode configuration (v1.6)
    #[serde(default)]
    pub reflection: Option<ReflectionRuntimeConfig>,
    /// Optional tool execution configuration (v1.6)
    #[serde(default)]
    pub tools: Option<ToolRuntimeConfig>,
    /// Optional planning mode configuration (v1.6)
    #[serde(default)]
    pub planning: Option<PlanningRuntimeConfig>,
    /// Optional swarm mode configuration (v1.6)
    #[serde(default)]
    pub swarm: Option<SwarmRuntimeConfig>,
    /// Optional real-time execution configuration (v1.7 - Phase 1, Dev 1)
    #[serde(default)]
    pub rt: Option<RtRuntimeConfig>,
    /// Optional EscapeVector graceful degradation configuration (v1.9 - Phase 1)
    #[serde(default)]
    pub escapevector: Option<EscapeVectorConfig>,
    /// Optional Fleet Management configuration (v1.8 - Phase 2, Dev 10)
    #[serde(default)]
    pub fleet: Option<FleetRuntimeConfig>,
}

impl Default for IgrisConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            storage: Some(StorageConfig::default()),
            providers: super::providers::get_default_providers(),
            routing: RoutingConfig::default(),
            auth: AuthConfig::default(),
            local_fallback: Some(LocalFallbackConfig::default()),
            lora_training: Some(LoRATrainingRuntimeConfig::default()),
            mcp: Some(McpConfig::default()),
            reflection: Some(ReflectionRuntimeConfig::default()),
            tools: Some(ToolRuntimeConfig::default()),
            planning: Some(PlanningRuntimeConfig::default()),
            swarm: Some(SwarmRuntimeConfig::default()),
            rt: Some(RtRuntimeConfig::default()),
            escapevector: Some(EscapeVectorConfig::default()),
            fleet: None, // Fleet management disabled by default
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 8080,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub path: Option<String>,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            path: Some("igris.db".to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingConfig {
    pub thompson_sampling: ThompsonSamplingConfig,
    pub speculative: SpeculativeConfig,
    pub council: CouncilConfig,
}

impl Default for RoutingConfig {
    fn default() -> Self {
        Self {
            thompson_sampling: ThompsonSamplingConfig::default(),
            speculative: SpeculativeConfig::default(),
            council: CouncilConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThompsonSamplingConfig {
    pub enabled: bool,
    pub exploration_rate: f64,
}

impl Default for ThompsonSamplingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            exploration_rate: 0.1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeculativeConfig {
    pub enabled: bool,
    pub max_providers: usize,
    pub first_token_timeout_ms: u64,
}

impl Default for SpeculativeConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_providers: 3,
            first_token_timeout_ms: 5000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CouncilConfig {
    pub enabled: bool,
    pub chairman: String,
}

impl Default for CouncilConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            chairman: "anthropic-sonnet".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub api_key: String,
    /// Optional JWT HS256 secret (base64 or raw string). If set, `Authorization: Bearer <jwt>` is accepted.
    #[serde(default)]
    pub jwt_hs256_secret: Option<String>,
    /// Enable auth enforcement when `api_key` is set to a non-default value or JWT secret is present.
    #[serde(default)]
    pub enabled: bool,
    /// Requests per minute per identity (API key or JWT subject). 0 disables rate limiting at auth layer.
    #[serde(default)]
    pub rate_limit_per_minute: u32,
    /// Burst capacity for rate limiting (token bucket). Defaults to 0 => uses rate_limit_per_minute.
    #[serde(default)]
    pub rate_limit_burst: u32,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            jwt_hs256_secret: None,
            enabled: true,
            rate_limit_per_minute: 120,
            rate_limit_burst: 20,
        }
    }
}

impl AuthConfig {
    pub fn has_api_key(&self) -> bool {
        !self.api_key.trim().is_empty()
    }

    pub fn has_jwt_secret(&self) -> bool {
        self.jwt_hs256_secret
            .as_ref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
    }

    pub fn has_auth_method(&self) -> bool {
        self.has_api_key() || self.has_jwt_secret()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalFallbackConfig {
    pub enabled: bool,
    pub model_path: String,
    #[serde(default)]
    pub lora_adapter_path: Option<String>,
    /// Number of GPU layers to offload (llama.cpp `-ngl` / `--n-gpu-layers`).
    /// Backward compatible: defaults to 0 (CPU-only).
    #[serde(default)]
    pub n_gpu_layers: u32,
    /// Optional main GPU index (llama.cpp `--main-gpu`).
    #[serde(default)]
    pub main_gpu: Option<u32>,
    /// Optional directory for llama.cpp prompt-cache files (enables context caching between identical prompts).
    #[serde(default)]
    pub prompt_cache_dir: Option<String>,
    /// Optional llama.cpp batch size (`--batch-size`). Higher can improve throughput at the cost of memory.
    /// Backward compatible default: None (llama.cpp default).
    #[serde(default)]
    pub batch_size: Option<u32>,
    #[serde(default = "default_context_size")]
    pub context_size: u32,
    #[serde(default = "default_threads")]
    pub threads: u32,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default)]
    pub cost_per_1k_tokens: f64,
}

/// On-device LoRA training configuration (server-side).
///
/// Backward compatible: if missing or `enabled=false`, runtime behavior is unchanged.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoRATrainingRuntimeConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_lora_trigger_threshold")]
    pub trigger_threshold: usize,
    #[serde(default = "default_lora_max_adapter_size_mb")]
    pub max_adapter_size_mb: usize,
    #[serde(default = "default_lora_rank")]
    pub lora_rank: usize,
    #[serde(default = "default_lora_alpha")]
    pub lora_alpha: f32,
    #[serde(default = "default_lora_epochs")]
    pub epochs: usize,
    #[serde(default = "default_lora_batch_size")]
    pub batch_size: usize,
    #[serde(default = "default_lora_learning_rate")]
    pub learning_rate: f32,
    #[serde(default = "default_lora_adapter_dir")]
    pub adapter_dir: String,
    #[serde(default = "default_lora_encrypt_adapters")]
    pub encrypt_adapters: bool,
    #[serde(default = "default_lora_auto_load_adapter")]
    pub auto_load_adapter: bool,
    #[serde(default = "default_lora_max_training_time_secs")]
    pub max_training_time_secs: u64,
    #[serde(default = "default_lora_training_threads")]
    pub training_threads: usize,
}

fn default_lora_trigger_threshold() -> usize {
    100
}
fn default_lora_max_adapter_size_mb() -> usize {
    64
}
fn default_lora_rank() -> usize {
    8
}
fn default_lora_alpha() -> f32 {
    16.0
}
fn default_lora_epochs() -> usize {
    1
}
fn default_lora_batch_size() -> usize {
    4
}
fn default_lora_learning_rate() -> f32 {
    0.0001
}
fn default_lora_adapter_dir() -> String {
    "lora_adapters".to_string()
}
fn default_lora_encrypt_adapters() -> bool {
    true
}
fn default_lora_auto_load_adapter() -> bool {
    true
}
fn default_lora_max_training_time_secs() -> u64 {
    1800
}
fn default_lora_training_threads() -> usize {
    4
}

impl Default for LoRATrainingRuntimeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            trigger_threshold: default_lora_trigger_threshold(),
            max_adapter_size_mb: default_lora_max_adapter_size_mb(),
            lora_rank: default_lora_rank(),
            lora_alpha: default_lora_alpha(),
            epochs: default_lora_epochs(),
            batch_size: default_lora_batch_size(),
            learning_rate: default_lora_learning_rate(),
            adapter_dir: default_lora_adapter_dir(),
            encrypt_adapters: default_lora_encrypt_adapters(),
            auto_load_adapter: default_lora_auto_load_adapter(),
            max_training_time_secs: default_lora_max_training_time_secs(),
            training_threads: default_lora_training_threads(),
        }
    }
}

/// Reflection mode configuration (server-side) for the `igris-reflection` crate.
///
/// Backward compatible: if missing or `enabled=false`, runtime behavior is unchanged.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflectionRuntimeConfig {
    /// Enable reflection by default (can also be enabled per-request via mode="reflection")
    #[serde(default)]
    pub enabled: bool,
    /// Maximum number of reflection iterations
    #[serde(default = "default_reflection_max_iterations")]
    pub max_iterations: u32,
    /// Minimum quality score to accept (0.0-1.0)
    #[serde(default = "default_reflection_quality_threshold")]
    pub quality_threshold: f32,
    /// Enable verbose logging of reflection process
    #[serde(default)]
    pub verbose: bool,
    /// Temperature for generation (0.0-2.0)
    #[serde(default = "default_reflection_temperature")]
    pub temperature: f32,
    /// Early stopping if improvement is minimal
    #[serde(default = "default_reflection_early_stopping")]
    pub early_stopping: bool,
    /// Minimum improvement delta for early stopping
    #[serde(default = "default_reflection_min_improvement")]
    pub min_improvement_delta: f32,
}

fn default_reflection_max_iterations() -> u32 {
    3
}
fn default_reflection_quality_threshold() -> f32 {
    0.7
}
fn default_reflection_temperature() -> f32 {
    0.7
}
fn default_reflection_early_stopping() -> bool {
    true
}
fn default_reflection_min_improvement() -> f32 {
    0.05
}

impl Default for ReflectionRuntimeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            max_iterations: default_reflection_max_iterations(),
            quality_threshold: default_reflection_quality_threshold(),
            verbose: false,
            temperature: default_reflection_temperature(),
            early_stopping: default_reflection_early_stopping(),
            min_improvement_delta: default_reflection_min_improvement(),
        }
    }
}

/// Tool execution configuration (server-side) for the `igris-tools` crate.
///
/// Backward compatible: if missing or disabled, runtime behavior is unchanged.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolRuntimeConfig {
    #[serde(default)]
    pub enabled: bool,

    #[serde(default)]
    pub enable_http: bool,
    #[serde(default)]
    pub enable_shell: bool,
    #[serde(default)]
    pub enable_filesystem: bool,

    #[serde(default)]
    pub allowed_http_domains: Vec<String>,
    #[serde(default)]
    pub allowed_shell_commands: Vec<String>,
    /// Allowed working directories for shell tool (whitelist). If empty, `working_dir` is rejected.
    #[serde(default)]
    pub allowed_shell_working_dirs: Vec<String>,
    #[serde(default)]
    pub allowed_filesystem_paths: Vec<String>,

    #[serde(default = "default_tool_max_execution_time")]
    pub max_execution_time_ms: u64,
    #[serde(default = "default_tool_max_concurrent")]
    pub max_concurrent_executions: usize,
}

fn default_tool_max_execution_time() -> u64 {
    30_000
}
fn default_tool_max_concurrent() -> usize {
    5
}

impl Default for ToolRuntimeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            enable_http: false,
            enable_shell: false,
            enable_filesystem: false,
            allowed_http_domains: vec![],
            allowed_shell_commands: vec![],
            allowed_shell_working_dirs: vec![],
            allowed_filesystem_paths: vec![],
            max_execution_time_ms: default_tool_max_execution_time(),
            max_concurrent_executions: default_tool_max_concurrent(),
        }
    }
}

impl ToolRuntimeConfig {
    /// Validate tool configuration according to fail-closed security requirements.
    ///
    /// SECURITY: This enforces that tools cannot be enabled without explicit whitelists.
    /// An enabled tool with an empty whitelist is a configuration error that blocks startup.
    pub fn validate(&self) -> Result<(), String> {
        if !self.enabled {
            // Tools subsystem disabled - nothing to validate
            return Ok(());
        }

        // HTTP tool validation
        if self.enable_http && self.allowed_http_domains.is_empty() {
            return Err(
                "SECURITY ERROR: enable_http=true but allowed_http_domains is empty. \
                 You must explicitly whitelist allowed domains or disable the HTTP tool."
                    .to_string(),
            );
        }

        // Shell tool validation
        if self.enable_shell {
            if self.allowed_shell_commands.is_empty() {
                return Err(
                    "SECURITY ERROR: enable_shell=true but allowed_shell_commands is empty. \
                     You must explicitly whitelist allowed commands or disable the shell tool."
                        .to_string(),
                );
            }
            if self.allowed_shell_working_dirs.is_empty() {
                return Err(
                    "SECURITY ERROR: enable_shell=true but allowed_shell_working_dirs is empty. \
                     You must explicitly whitelist allowed working directories or disable the shell tool."
                        .to_string(),
                );
            }
        }

        // Filesystem tool validation
        if self.enable_filesystem && self.allowed_filesystem_paths.is_empty() {
            return Err(
                "SECURITY ERROR: enable_filesystem=true but allowed_filesystem_paths is empty. \
                 You must explicitly whitelist allowed paths or disable the filesystem tool."
                    .to_string(),
            );
        }

        Ok(())
    }

    /// Emit security warnings about enabled tools and their configurations.
    ///
    /// This provides visibility into the tool security posture at startup.
    pub fn emit_security_warnings(&self) {
        use tracing::{info, warn};

        if !self.enabled {
            info!("Tools subsystem: DISABLED (all tool execution blocked)");
            return;
        }

        info!("Tools subsystem: ENABLED");

        if !self.enable_http && !self.enable_shell && !self.enable_filesystem {
            warn!("All individual tools are disabled despite tools.enabled=true");
        }

        if self.enable_http {
            info!(
                "HTTP tool: ENABLED (whitelist: {} domains)",
                self.allowed_http_domains.len()
            );
            for domain in &self.allowed_http_domains {
                info!("  - Allowed HTTP domain: {}", domain);
            }
        } else {
            info!("HTTP tool: DISABLED");
        }

        if self.enable_shell {
            info!(
                "Shell tool: ENABLED (whitelist: {} commands, {} working dirs)",
                self.allowed_shell_commands.len(),
                self.allowed_shell_working_dirs.len()
            );
            for cmd in &self.allowed_shell_commands {
                info!("  - Allowed shell command: {}", cmd);
            }
            for dir in &self.allowed_shell_working_dirs {
                info!("  - Allowed working directory: {}", dir);
            }
        } else {
            info!("Shell tool: DISABLED");
        }

        if self.enable_filesystem {
            info!(
                "Filesystem tool: ENABLED (whitelist: {} paths)",
                self.allowed_filesystem_paths.len()
            );
            for path in &self.allowed_filesystem_paths {
                info!("  - Allowed filesystem path: {}", path);
            }
        } else {
            info!("Filesystem tool: DISABLED");
        }
    }
}

/// Planning mode configuration (server-side) for the `igris-planning` crate.
///
/// Backward compatible: if missing or `enabled=false`, runtime behavior is unchanged.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanningRuntimeConfig {
    /// Enable planning by default (can also be enabled per-request via mode="planning")
    #[serde(default)]
    pub enabled: bool,
    /// Maximum planning steps
    #[serde(default = "default_planning_max_steps")]
    pub max_steps: u32,
    /// Enable reflection after each step
    #[serde(default = "default_planning_enable_reflection")]
    pub enable_reflection: bool,
    /// Enable tool use during planning (requires `tools.enabled=true`)
    #[serde(default)]
    pub enable_tools: bool,
    /// Maximum total tool calls allowed during planning
    #[serde(default = "default_planning_max_tool_calls")]
    pub max_tool_calls: u32,
}

fn default_planning_max_steps() -> u32 {
    10
}
fn default_planning_enable_reflection() -> bool {
    true
}
fn default_planning_max_tool_calls() -> u32 {
    20
}

impl Default for PlanningRuntimeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            max_steps: default_planning_max_steps(),
            enable_reflection: default_planning_enable_reflection(),
            enable_tools: false,
            max_tool_calls: default_planning_max_tool_calls(),
        }
    }
}

/// Swarm mode configuration (server-side).
///
/// Backward compatible: if missing or `enabled=false`, runtime behavior is unchanged.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmRuntimeConfig {
    /// Enable swarm mode by default (can also be enabled per-request via mode="swarm")
    #[serde(default)]
    pub enabled: bool,
    /// Number of agents to spawn (10-50 recommended).
    #[serde(default = "default_swarm_size")]
    pub size: usize,
    /// Maximum concurrent agent executions (protects CPU/RAM).
    #[serde(default = "default_swarm_max_concurrent")]
    pub max_concurrent: usize,
    /// Per-agent timeout in milliseconds.
    #[serde(default = "default_swarm_agent_timeout_ms")]
    pub agent_timeout_ms: u64,

    /// Enable dynamic role assignment (LLM selects roles based on the prompt).
    /// Backward compatible default: false.
    #[serde(default)]
    pub dynamic_roles: bool,

    /// Enable inter-agent communication via a shared message bus.
    /// Backward compatible default: false.
    #[serde(default)]
    pub enable_bus: bool,

    /// Number of consensus candidates to generate before selecting a winner.
    /// Backward compatible default: 1 (single synthesis).
    #[serde(default = "default_swarm_consensus_candidates")]
    pub consensus_candidates: usize,
}

fn default_swarm_size() -> usize {
    10
}
fn default_swarm_max_concurrent() -> usize {
    4
}
fn default_swarm_agent_timeout_ms() -> u64 {
    60_000
}
fn default_swarm_consensus_candidates() -> usize {
    1
}

impl Default for SwarmRuntimeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            size: default_swarm_size(),
            max_concurrent: default_swarm_max_concurrent(),
            agent_timeout_ms: default_swarm_agent_timeout_ms(),
            dynamic_roles: false,
            enable_bus: false,
            consensus_candidates: default_swarm_consensus_candidates(),
        }
    }
}

/// Real-time execution configuration (v1.7 - Phase 1, Dev 1)
/// Provides deterministic execution with bounded latency for critical AI inference tasks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtRuntimeConfig {
    /// Enable real-time mode
    #[serde(default)]
    pub enabled: bool,
    /// Default priority level (0=Low, 1=Normal, 2=High, 3=Critical)
    #[serde(default = "default_rt_priority_level")]
    pub priority_level: u8,
    /// Maximum number of concurrent RT tasks
    #[serde(default = "default_rt_max_concurrent_tasks")]
    pub max_concurrent_tasks: usize,
    /// Enable latency monitoring and metrics
    #[serde(default = "default_true")]
    pub enable_metrics: bool,
    /// Warning threshold in milliseconds
    #[serde(default = "default_rt_warn_threshold_ms")]
    pub warn_threshold_ms: u64,
}

fn default_rt_priority_level() -> u8 {
    1 // Normal priority
}

fn default_rt_max_concurrent_tasks() -> usize {
    4
}

fn default_rt_warn_threshold_ms() -> u64 {
    100
}

impl Default for RtRuntimeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            priority_level: default_rt_priority_level(),
            max_concurrent_tasks: default_rt_max_concurrent_tasks(),
            enable_metrics: true,
            warn_threshold_ms: default_rt_warn_threshold_ms(),
        }
    }
}

/// EscapeVector graceful degradation configuration (v1.9 - Phase 1)
/// Provides 24-hour cached response fallback when all providers fail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscapeVectorConfig {
    /// Enable EscapeVector response caching
    #[serde(default)]
    pub enabled: bool,
    /// Cache directory path
    #[serde(default = "default_escapevector_cache_dir")]
    pub cache_dir: String,
    /// Minimum quality score to cache response (0.0-1.0)
    #[serde(default = "default_escapevector_min_quality")]
    pub min_quality_score: f32,
    /// Enable automatic response caching on successful requests
    #[serde(default = "default_true")]
    pub auto_cache: bool,
    /// Fall back to cache after this many milliseconds of provider failures
    #[serde(default = "default_escapevector_fallback_threshold_ms")]
    pub fallback_threshold_ms: u64,
}

fn default_escapevector_cache_dir() -> String {
    ".escapevector".to_string()
}

fn default_escapevector_min_quality() -> f32 {
    0.7
}

fn default_escapevector_fallback_threshold_ms() -> u64 {
    5000 // 5 seconds
}

impl Default for EscapeVectorConfig {
    fn default() -> Self {
        Self {
            enabled: true, // Enable by default for resilience
            cache_dir: default_escapevector_cache_dir(),
            min_quality_score: default_escapevector_min_quality(),
            auto_cache: true,
            fallback_threshold_ms: default_escapevector_fallback_threshold_ms(),
        }
    }
}

fn default_context_size() -> u32 {
    4096
}

fn default_threads() -> u32 {
    4
}

fn default_max_tokens() -> u32 {
    512
}

fn default_temperature() -> f32 {
    0.7
}

impl Default for LocalFallbackConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            model_path: "models/phi-3-mini-4k-instruct-q4.gguf".to_string(),
            lora_adapter_path: None,
            n_gpu_layers: 0,
            main_gpu: None,
            prompt_cache_dir: None,
            batch_size: None,
            context_size: 4096,
            threads: 4,
            max_tokens: 512,
            temperature: 0.7,
            cost_per_1k_tokens: 0.0, // Free!
        }
    }
}

/// MCP Swarm Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    /// Enable MCP swarm mode
    pub enabled: bool,
    /// Enable mDNS discovery
    #[serde(default = "default_true")]
    pub mdns: bool,
    /// Enable UDP multicast fallback
    #[serde(default = "default_true")]
    pub multicast: bool,
    /// Enable encrypted persistence
    #[serde(default = "default_true")]
    pub persist: bool,
    /// MCP storage path
    #[serde(default = "default_mcp_storage_path")]
    pub storage_path: String,
    /// Peer ID (auto-generated if not specified)
    #[serde(default)]
    pub peer_id: Option<String>,
}

fn default_true() -> bool {
    true
}

fn default_mcp_storage_path() -> String {
    "mcp_contexts.db".to_string()
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mdns: true,
            multicast: true,
            persist: true,
            storage_path: "mcp_contexts.db".to_string(),
            peer_id: None,
        }
    }
}

impl IgrisConfig {
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let expanded = expand_env_vars(&content);
        let config: IgrisConfig = json5::from_str(&expanded)?;
        config.validate()?;
        Ok(config)
    }

    pub fn load_from_file_unvalidated<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let expanded = expand_env_vars(&content);
        let config: IgrisConfig = json5::from_str(&expanded)?;
        Ok(config)
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        if self.providers.is_empty() {
            anyhow::bail!("At least one provider must be configured");
        }

        // Auth sanity checks
        if self.auth.enabled && !self.auth.has_auth_method() {
            anyhow::bail!(
                "auth.enabled=true but no auth method configured (set auth.api_key or auth.jwt_hs256_secret)"
            );
        }

        // Tooling safety checks
        if let Some(tools) = &self.tools {
            if tools.enabled {
                if tools.enable_shell {
                    if tools.allowed_shell_commands.is_empty() {
                        anyhow::bail!("tools.enable_shell=true requires tools.allowed_shell_commands to be non-empty");
                    }
                }
                if tools.enable_filesystem {
                    if tools.allowed_filesystem_paths.is_empty() {
                        anyhow::bail!("tools.enable_filesystem=true requires tools.allowed_filesystem_paths to be non-empty");
                    }
                }
            }
        }
        Ok(())
    }
}

/// Fleet Management configuration (v1.8 - Phase 2, Dev 10)
/// Provides centralized control and monitoring for distributed Runtime instances.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FleetRuntimeConfig {
    /// Enable fleet management
    #[serde(default)]
    pub enabled: bool,
    /// Overture endpoint URL
    #[serde(default = "default_fleet_overture_endpoint")]
    pub overture_endpoint: String,
    /// Agent ID (auto-generated if empty)
    #[serde(default = "default_fleet_agent_id")]
    pub agent_id: String,
    /// API key environment variable name
    #[serde(default = "default_fleet_api_key_env")]
    pub api_key_env: String,
    /// Enable TLS for secure communication
    #[serde(default = "default_true")]
    pub enable_tls: bool,
    /// Config sync interval in seconds
    #[serde(default = "default_fleet_sync_interval_secs")]
    pub sync_interval_secs: u64,
    /// Auto-sync configuration
    #[serde(default = "default_true")]
    pub auto_sync_config: bool,
    /// Enable telemetry upload
    #[serde(default = "default_true")]
    pub enable_telemetry: bool,
    /// Telemetry upload interval in seconds
    #[serde(default = "default_fleet_telemetry_interval_secs")]
    pub telemetry_interval_secs: u64,
}

fn default_fleet_overture_endpoint() -> String {
    "https://overture.igris.dev".to_string()
}

fn default_fleet_agent_id() -> String {
    format!("igris-{}", uuid::Uuid::new_v4())
}

fn default_fleet_api_key_env() -> String {
    "FLEET_API_KEY".to_string()
}

fn default_fleet_sync_interval_secs() -> u64 {
    300 // 5 minutes
}

fn default_fleet_telemetry_interval_secs() -> u64 {
    60 // 1 minute
}

impl Default for FleetRuntimeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            overture_endpoint: default_fleet_overture_endpoint(),
            agent_id: default_fleet_agent_id(),
            api_key_env: default_fleet_api_key_env(),
            enable_tls: true,
            sync_interval_secs: default_fleet_sync_interval_secs(),
            auto_sync_config: true,
            enable_telemetry: true,
            telemetry_interval_secs: default_fleet_telemetry_interval_secs(),
        }
    }
}

fn expand_env_vars(content: &str) -> String {
    let re = regex::Regex::new(r"\$\{([A-Z_][A-Z0-9_]*)\}").unwrap();
    re.replace_all(content, |caps: &regex::Captures| {
        std::env::var(&caps[1]).unwrap_or_default()
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_var_expansion() {
        std::env::set_var("TEST_VAR", "hello");
        let expanded = expand_env_vars("Value: ${TEST_VAR}");
        assert_eq!(expanded, "Value: hello");
    }

    #[test]
    fn test_tool_config_validation_disabled_tools() {
        // Disabled tools don't need validation
        let config = ToolRuntimeConfig {
            enabled: false,
            enable_http: true,            // Even if individual tools enabled
            allowed_http_domains: vec![], // Empty whitelist should be fine when disabled
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_tool_config_validation_http_enabled_no_whitelist() {
        let config = ToolRuntimeConfig {
            enabled: true,
            enable_http: true,
            allowed_http_domains: vec![], // SECURITY ERROR: Empty whitelist
            ..Default::default()
        };
        assert!(config.validate().is_err());
        assert!(config
            .validate()
            .unwrap_err()
            .contains("allowed_http_domains is empty"));
    }

    #[test]
    fn test_tool_config_validation_http_enabled_with_whitelist() {
        let config = ToolRuntimeConfig {
            enabled: true,
            enable_http: true,
            allowed_http_domains: vec!["example.com".to_string()],
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_tool_config_validation_shell_enabled_no_commands() {
        let config = ToolRuntimeConfig {
            enabled: true,
            enable_shell: true,
            allowed_shell_commands: vec![], // SECURITY ERROR: Empty whitelist
            allowed_shell_working_dirs: vec!["/tmp".to_string()],
            ..Default::default()
        };
        assert!(config.validate().is_err());
        assert!(config
            .validate()
            .unwrap_err()
            .contains("allowed_shell_commands is empty"));
    }

    #[test]
    fn test_tool_config_validation_shell_enabled_no_working_dirs() {
        let config = ToolRuntimeConfig {
            enabled: true,
            enable_shell: true,
            allowed_shell_commands: vec!["ls".to_string()],
            allowed_shell_working_dirs: vec![], // SECURITY ERROR: Empty whitelist
            ..Default::default()
        };
        assert!(config.validate().is_err());
        assert!(config
            .validate()
            .unwrap_err()
            .contains("allowed_shell_working_dirs is empty"));
    }

    #[test]
    fn test_tool_config_validation_shell_enabled_with_whitelists() {
        let config = ToolRuntimeConfig {
            enabled: true,
            enable_shell: true,
            allowed_shell_commands: vec!["ls".to_string()],
            allowed_shell_working_dirs: vec!["/tmp".to_string()],
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_tool_config_validation_filesystem_enabled_no_paths() {
        let config = ToolRuntimeConfig {
            enabled: true,
            enable_filesystem: true,
            allowed_filesystem_paths: vec![], // SECURITY ERROR: Empty whitelist
            ..Default::default()
        };
        assert!(config.validate().is_err());
        assert!(config
            .validate()
            .unwrap_err()
            .contains("allowed_filesystem_paths is empty"));
    }

    #[test]
    fn test_tool_config_validation_filesystem_enabled_with_paths() {
        let config = ToolRuntimeConfig {
            enabled: true,
            enable_filesystem: true,
            allowed_filesystem_paths: vec!["/tmp".to_string()],
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_tool_config_validation_all_tools_properly_configured() {
        let config = ToolRuntimeConfig {
            enabled: true,
            enable_http: true,
            enable_shell: true,
            enable_filesystem: true,
            allowed_http_domains: vec!["example.com".to_string()],
            allowed_shell_commands: vec!["ls".to_string()],
            allowed_shell_working_dirs: vec!["/tmp".to_string()],
            allowed_filesystem_paths: vec!["/tmp".to_string()],
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }
}
