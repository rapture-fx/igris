use crate::speculative::Provider;
use async_stream::try_stream;
use futures::{Stream, StreamExt};
use igris_core::ProviderConfig;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::pin::Pin;
use tracing::debug;

const ANTHROPIC_VERSION: &str = "2023-06-01";

fn extract_stream_delta(v: &serde_json::Value) -> Option<String> {
    // OpenAI-style: choices[0].delta.content
    v.get("choices").and_then(|c| c.get(0)).and_then(|c0| {
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

fn extract_anthropic_text(v: &serde_json::Value) -> Option<String> {
    v.get("content")
        .and_then(|content| content.as_array())
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|block| {
                    if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                        block
                            .get("text")
                            .and_then(|text| text.as_str())
                            .map(str::to_string)
                    } else {
                        None
                    }
                })
                .collect::<String>()
        })
        .filter(|text| !text.is_empty())
}

fn extract_anthropic_stream_delta(v: &serde_json::Value) -> Option<String> {
    if v.get("type").and_then(|t| t.as_str()) != Some("content_block_delta") {
        return None;
    }

    v.get("delta").and_then(|delta| {
        if delta.get("type").and_then(|t| t.as_str()) == Some("text_delta") {
            delta
                .get("text")
                .and_then(|text| text.as_str())
                .map(str::to_string)
        } else {
            None
        }
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
        self.config
            .capabilities
            .iter()
            .any(|value| value == capability)
    }

    fn api_format(&self) -> String {
        Self::api_format_for_config(&self.config)
    }

    fn api_format_for_config(config: &ProviderConfig) -> String {
        let configured = config
            .api_format
            .as_deref()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase()
            .replace('-', "_");
        if configured == "openai" || configured == "openai_compatible" {
            return "openai_compatible".to_string();
        }
        if configured == "anthropic" {
            return "anthropic".to_string();
        }

        let endpoint = config.endpoint.to_ascii_lowercase();
        let model = config.model.to_ascii_lowercase();
        let id = config.id.to_ascii_lowercase();
        if endpoint.contains("anthropic.com")
            || model.starts_with("claude-")
            || id.contains("anthropic")
        {
            "anthropic".to_string()
        } else {
            "openai_compatible".to_string()
        }
    }

    fn endpoint_url(&self, path: &str) -> String {
        format!(
            "{}/{}",
            self.config.endpoint.trim_end_matches('/'),
            path.trim_start_matches('/')
        )
    }

    async fn call_api(&self, prompt: &str) -> anyhow::Result<String> {
        match self.api_format().as_str() {
            "anthropic" => self.call_anthropic_api(prompt).await,
            "openai_compatible" => self.call_openai_compatible_api(prompt).await,
            other => anyhow::bail!(
                "unsupported provider api_format for {}: {}",
                self.config.id,
                other
            ),
        }
    }

    async fn call_openai_compatible_api(&self, prompt: &str) -> anyhow::Result<String> {
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
            stream: false,
        };

        let response = self
            .client
            .post(self.endpoint_url("chat/completions"))
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

    async fn call_anthropic_api(&self, prompt: &str) -> anyhow::Result<String> {
        let api_key = self
            .config
            .api_key_env
            .as_ref()
            .and_then(|env_var| std::env::var(env_var).ok())
            .ok_or_else(|| anyhow::anyhow!("API key not found for {}", self.config.id))?;

        let request = json!({
            "model": self.config.model.clone(),
            "messages": [{ "role": "user", "content": prompt }],
            "max_tokens": 512,
            "temperature": 0.7,
            "stream": false
        });

        let response = self
            .client
            .post(self.endpoint_url("messages"))
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("API request failed: {} - {}", status, body);
        }

        let response_body: serde_json::Value = response.json().await?;
        extract_anthropic_text(&response_body)
            .ok_or_else(|| anyhow::anyhow!("No text response from Anthropic provider"))
    }

    async fn call_api_stream(
        &self,
        prompt: &str,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        match self.api_format().as_str() {
            "anthropic" => self.call_anthropic_api_stream(prompt).await,
            "openai_compatible" => self.call_openai_compatible_api_stream(prompt).await,
            other => anyhow::bail!(
                "unsupported provider api_format for {}: {}",
                self.config.id,
                other
            ),
        }
    }

    async fn call_openai_compatible_api_stream(
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
            .post(self.endpoint_url("chat/completions"))
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

    async fn call_anthropic_api_stream(
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

        let request = json!({
            "model": self.config.model.clone(),
            "messages": [{ "role": "user", "content": prompt }],
            "max_tokens": 512,
            "temperature": 0.7,
            "stream": true
        });

        let response = self
            .client
            .post(self.endpoint_url("messages"))
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
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

        let s = try_stream! {
            let mut buf: Vec<u8> = Vec::with_capacity(16 * 1024);

            while let Some(next) = bytes.next().await {
                let chunk = next?;
                buf.extend_from_slice(&chunk);

                while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                    let mut line = buf.drain(..=pos).collect::<Vec<u8>>();
                    if line.last() == Some(&b'\n') {
                        line.pop();
                    }
                    if line.last() == Some(&b'\r') {
                        line.pop();
                    }

                    if line.is_empty() {
                        continue;
                    }

                    let line = String::from_utf8_lossy(&line);
                    let line = line.trim();
                    if !line.starts_with("data:") {
                        continue;
                    }

                    let data = line.trim_start_matches("data:").trim();
                    let v: serde_json::Value = serde_json::from_str(data)?;

                    if v.get("type").and_then(|t| t.as_str()) == Some("error") {
                        let msg = v
                            .get("error")
                            .and_then(|err| err.get("message"))
                            .and_then(|message| message.as_str())
                            .unwrap_or("unknown error");
                        Err(anyhow::anyhow!("Provider {} streaming error: {}", provider_id, msg))?;
                    }

                    if let Some(text) = extract_anthropic_stream_delta(&v) {
                        if !text.is_empty() {
                            yield text;
                        }
                    }
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

    #[test]
    fn extracts_anthropic_text_blocks() {
        let v = serde_json::json!({
            "content": [
                { "type": "text", "text": "hello" },
                { "type": "text", "text": " world" }
            ]
        });
        assert_eq!(extract_anthropic_text(&v), Some("hello world".to_string()));
    }

    #[test]
    fn extracts_anthropic_stream_delta() {
        let v = serde_json::json!({
            "type": "content_block_delta",
            "delta": { "type": "text_delta", "text": "hello" }
        });
        assert_eq!(
            extract_anthropic_stream_delta(&v),
            Some("hello".to_string())
        );
    }

    #[test]
    fn infers_anthropic_api_format_from_model() {
        let config = ProviderConfig {
            id: "claude".to_string(),
            name: "Claude".to_string(),
            endpoint: "https://api.anthropic.com/v1".to_string(),
            model: "claude-3-5-haiku-latest".to_string(),
            api_format: None,
            api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
            cost_per_1k_input: 0.0,
            cost_per_1k_output: 0.0,
            capabilities: vec![],
        };

        assert_eq!(CloudProvider::api_format_for_config(&config), "anthropic");
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
