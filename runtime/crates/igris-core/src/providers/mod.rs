use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub model: String,
    pub api_key_env: Option<String>,
    pub cost_per_1k_input: f64,
    pub cost_per_1k_output: f64,
    pub capabilities: Vec<String>,
}

pub fn get_default_providers() -> Vec<ProviderConfig> {
    vec![
        // Tier 1: High performance
        ProviderConfig {
            id: "openai-gpt4".to_string(),
            name: "OpenAI GPT-4 Turbo".to_string(),
            endpoint: "https://api.openai.com/v1".to_string(),
            model: "gpt-4-turbo-preview".to_string(),
            api_key_env: Some("OPENAI_API_KEY".to_string()),
            cost_per_1k_input: 0.01,
            cost_per_1k_output: 0.03,
            capabilities: vec!["reasoning".into(), "coding".into()],
        },
        ProviderConfig {
            id: "anthropic-sonnet".to_string(),
            name: "Claude 3.5 Sonnet".to_string(),
            endpoint: "https://api.anthropic.com/v1".to_string(),
            model: "claude-3-5-sonnet-20241022".to_string(),
            api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
            cost_per_1k_input: 0.003,
            cost_per_1k_output: 0.015,
            capabilities: vec!["reasoning".into(), "coding".into(), "long_context".into()],
        },
        ProviderConfig {
            id: "anthropic-opus".to_string(),
            name: "Claude 3 Opus".to_string(),
            endpoint: "https://api.anthropic.com/v1".to_string(),
            model: "claude-3-opus-20240229".to_string(),
            api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
            cost_per_1k_input: 0.015,
            cost_per_1k_output: 0.075,
            capabilities: vec!["reasoning".into(), "coding".into()],
        },
        // Tier 2: Cost-effective
        ProviderConfig {
            id: "anthropic-haiku".to_string(),
            name: "Claude 3 Haiku".to_string(),
            endpoint: "https://api.anthropic.com/v1".to_string(),
            model: "claude-3-haiku-20240307".to_string(),
            api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
            cost_per_1k_input: 0.00025,
            cost_per_1k_output: 0.00125,
            capabilities: vec!["fast".into(), "cost_effective".into()],
        },
        ProviderConfig {
            id: "groq-llama70b".to_string(),
            name: "Groq Llama 3 70B".to_string(),
            endpoint: "https://api.groq.com/openai/v1".to_string(),
            model: "llama3-70b-8192".to_string(),
            api_key_env: Some("GROQ_API_KEY".to_string()),
            cost_per_1k_input: 0.0007,
            cost_per_1k_output: 0.0008,
            capabilities: vec!["fast".into(), "coding".into()],
        },
        ProviderConfig {
            id: "groq-mixtral".to_string(),
            name: "Groq Mixtral 8x7B".to_string(),
            endpoint: "https://api.groq.com/openai/v1".to_string(),
            model: "mixtral-8x7b-32768".to_string(),
            api_key_env: Some("GROQ_API_KEY".to_string()),
            cost_per_1k_input: 0.0006,
            cost_per_1k_output: 0.0006,
            capabilities: vec!["fast".into()],
        },
        // Tier 3: Specialized
        ProviderConfig {
            id: "xai-grok".to_string(),
            name: "xAI Grok-2".to_string(),
            endpoint: "https://api.x.ai/v1".to_string(),
            model: "grok-2-latest".to_string(),
            api_key_env: Some("XAI_API_KEY".to_string()),
            cost_per_1k_input: 0.002,
            cost_per_1k_output: 0.01,
            capabilities: vec!["reasoning".into()],
        },
        ProviderConfig {
            id: "deepseek-v3".to_string(),
            name: "Deepseek V3".to_string(),
            endpoint: "https://api.deepseek.com/v1".to_string(),
            model: "deepseek-chat".to_string(),
            api_key_env: Some("DEEPSEEK_API_KEY".to_string()),
            cost_per_1k_input: 0.0014,
            cost_per_1k_output: 0.0028,
            capabilities: vec!["coding".into(), "cost_effective".into()],
        },
        // ... More providers would be added here to reach 30 total
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_providers() {
        let providers = get_default_providers();
        assert!(!providers.is_empty());
        assert!(providers.iter().any(|p| p.id == "openai-gpt4"));
        assert!(providers.iter().any(|p| p.id == "anthropic-sonnet"));
    }
}
