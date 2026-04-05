use crate::speculative::Provider;
use async_stream::try_stream;
use futures::{Stream, StreamExt};
use igris_core::ProviderConfig;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use tracing::debug;

fn extract_stream_delta(v: &serde_json::Value) -> Option<String> {
    // OpenAI-style: choices[0].delta.content
    v.get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c0| {
            c0.get("delta")
                .and_then(|d| d.get("content"))
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .or_else(|| {
                    // Some providers use "text" streaming
                    c0.get("text")
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string())
                })
        })
}

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

    pub fn average_cost_per_1k(&self) -> f64 {
        (self.config.cost_per_1k_input + self.config.cost_per_1k_output) / 2.0
    }

    pub fn has_capability(&self, capability: &str) -> bool {
        self.config.capabilities.iter().any(|value| value == capability)
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

    async fn call_api_stream(
        &self,
        prompt: &str,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        let provider_id = self.config.id.clone();
        let api_key = self
            .config
            .api_key_env
            .as_ref()
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
            stream: true,
        };

        let response = self
            .client
            .post(format!("{}/chat/completions", self.config.endpoint))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept", "text/event-stream")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("API request failed: {} - {}", status, body);
        }

        let mut bytes = response.bytes_stream();

        // Parse SSE "data:" lines. We only emit actual delta content chunks.
        let s = try_stream! {
            let mut buf: Vec<u8> = Vec::with_capacity(16 * 1024);
            let mut done = false;

            while let Some(next) = bytes.next().await {
                let chunk = next?;
                buf.extend_from_slice(&chunk);

                while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                    // Split at '\n'
                    let mut line = buf.drain(..=pos).collect::<Vec<u8>>();
                    // Trim trailing '\n' and optional '\r'
                    if line.last() == Some(&b'\n') {
                        line.pop();
                    }
                    if line.last() == Some(&b'\r') {
                        line.pop();
                    }

                    if line.is_empty() {
                        continue;
                    }

                    // SSE lines look like: "data: {...}"
                    let line = String::from_utf8_lossy(&line);
                    let line = line.trim();
                    if !line.starts_with("data:") {
                        continue;
                    }

                    let data = line.trim_start_matches("data:").trim();
                    if data == "[DONE]" {
                        done = true;
                        break;
                    }

                    let v: serde_json::Value = serde_json::from_str(data)?;

                    if let Some(err) = v.get("error") {
                        let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown error");
                        Err(anyhow::anyhow!("Provider {} streaming error: {}", provider_id, msg))?;
                    }

                    if let Some(text) = extract_stream_delta(&v) {
                        if !text.is_empty() {
                            yield text;
                        }
                    }
                }

                if done {
                    break;
                }
            }
        };

        Ok(Box::pin(s))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_openai_delta_content() {
        let v = serde_json::json!({
            "choices": [
                { "delta": { "content": "hello" } }
            ]
        });
        assert_eq!(extract_stream_delta(&v), Some("hello".to_string()));
    }

    #[test]
    fn extracts_text_fallback() {
        let v = serde_json::json!({
            "choices": [
                { "text": "world" }
            ]
        });
        assert_eq!(extract_stream_delta(&v), Some("world".to_string()));
    }

    #[test]
    fn ignores_non_content_delta() {
        let v = serde_json::json!({
            "choices": [
                { "delta": { "role": "assistant" } }
            ]
        });
        assert_eq!(extract_stream_delta(&v), None);
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
        debug!("Cloud provider {} streaming request (SSE)", self.id());
        self.call_api_stream(prompt).await
    }
}
