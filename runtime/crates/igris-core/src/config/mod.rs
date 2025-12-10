use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgrisConfig {
    pub server: ServerConfig,
    pub storage: StorageConfig,
    pub providers: Vec<super::providers::ProviderConfig>,
    pub routing: RoutingConfig,
    pub auth: AuthConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingConfig {
    pub thompson_sampling: ThompsonSamplingConfig,
    pub speculative: SpeculativeConfig,
    pub council: CouncilConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThompsonSamplingConfig {
    pub enabled: bool,
    pub exploration_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeculativeConfig {
    pub enabled: bool,
    pub max_providers: usize,
    pub first_token_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CouncilConfig {
    pub enabled: bool,
    pub chairman: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub api_key: String,
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
