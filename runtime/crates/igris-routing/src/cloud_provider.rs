use crate::speculative::Provider;
use async_stream::stream;
use futures::Stream;
use igris_core::ProviderConfig;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use tracing::{debug, warn};

/// Cloud provider that implements Provider trait
#[derive(Clone)]
pub struct CloudProvider {
    config: ProviderConfig,
    client: Client,
}

#[derive(Debug, Serialize)]
struct CloudRequest {
    model: String,
    messages: Vec<CloudMessage>,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct CloudMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct CloudResponse {
    choices: Vec<CloudChoice>,
}

#[derive(Debug, Deserialize)]
struct CloudChoice {
    message: CloudMessage,
}

impl CloudProvider {
    pub fn new(config: ProviderConfig) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap();

        Self { config, client }
    }

    async fn call_api(&self, prompt: &str) -> anyhow::Result<String> {
        let api_key = self.config.api_key_env.as_ref()
            .and_then(|env_var| std::env::var(env_var).ok())
            .ok_or_else(|| anyhow::anyhow!("API key not found for {}", self.config.id))?;

        let request = CloudRequest {
            model: self.config.model.clone(),
            messages: vec![CloudMessage {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            max_tokens: Some(512),
            temperature: Some(0.7),
            stream: false,
        };

        let response = self.client
            .post(format!("{}/chat/completions", self.config.endpoint))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("API request failed: {} - {}", status, body);
        }

        let cloud_response: CloudResponse = response.json().await?;

        cloud_response
            .choices
            .first()
            .map(|choice| choice.message.content.clone())
            .ok_or_else(|| anyhow::anyhow!("No response from cloud provider"))
    }
}

impl Provider for CloudProvider {
    fn id(&self) -> &str {
        &self.config.id
    }

    fn name(&self) -> &str {
        &self.config.name
    }

    async fn complete(&self, prompt: &str) -> anyhow::Result<String> {
        debug!("Cloud provider {} completing request", self.id());
        self.call_api(prompt).await
    }

    async fn stream(
        &self,
        prompt: &str,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        // For now, just return the full response as a stream
        // Real streaming would require SSE support
        debug!("Cloud provider {} streaming request", self.id());

        let result = self.call_api(prompt).await;

        let s = stream! {
            match result {
                Ok(response) => {
                    // Split by words for simple streaming effect
                    for word in response.split_whitespace() {
                        yield Ok(format!("{} ", word));
                    }
                }
                Err(e) => {
                    warn!("Cloud provider stream error: {}", e);
                    yield Err(e);
                }
            }
        };

        Ok(Box::pin(s))
    }
}
