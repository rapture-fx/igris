use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgrisConfig {
    pub server: ServerConfig,
    pub storage: Option<StorageConfig>,
    pub providers: Vec<super::providers::ProviderConfig>,
    pub routing: RoutingConfig,
    pub auth: AuthConfig,
}

impl Default for IgrisConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            storage: Some(StorageConfig::default()),
            providers: super::providers::get_default_providers(),
            routing: RoutingConfig::default(),
            auth: AuthConfig::default(),
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
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            api_key: "default-api-key".to_string(),
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

    fn validate(&self) -> anyhow::Result<()> {
        if self.providers.is_empty() {
            anyhow::bail!("At least one provider must be configured");
        }
        Ok(())
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
}
