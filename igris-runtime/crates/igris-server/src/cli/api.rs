// Thin reqwest-based client for the subset of Overture endpoints the CLI
// uses. Authentication is `Authorization: Bearer <key>` where the key starts
// with `igris_`. The middleware accepts both `Authorization: Bearer` and
// `X-API-Key`; we standardize on Bearer because it's already the install
// script's convention.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::time::Duration;

const HTTP_TIMEOUT_SECS: u64 = 30;

/// Read the API key from the environment. Returns an error with actionable
/// guidance when unset.
pub fn require_api_key() -> Result<String> {
    let key = std::env::var("IGRIS_API_KEY")
        .map_err(|_| anyhow!("IGRIS_API_KEY is not set. Run `igris-runtime auth login` for setup help, or export an `igris_` API key from console settings."))?;
    if !key.starts_with("igris_") {
        return Err(anyhow!(
            "IGRIS_API_KEY does not look like an Igris key (expected `igris_` prefix)"
        ));
    }
    Ok(key)
}

/// Build the HTTP client with the API key attached as a default Bearer header.
fn build_client(api_key: &str) -> Result<reqwest::Client> {
    let mut headers = reqwest::header::HeaderMap::new();
    let value =
        reqwest::header::HeaderValue::from_str(&format!("Bearer {}", api_key)).map_err(|e| {
            anyhow!(
                "API key contains characters that cannot be used in a header: {}",
                e
            )
        })?;
    headers.insert(reqwest::header::AUTHORIZATION, value);
    reqwest::Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| anyhow!("failed to build HTTP client: {}", e))
}

fn normalize_base(base: &str) -> String {
    base.trim().trim_end_matches('/').to_string()
}

#[derive(Clone)]
pub struct Client {
    inner: reqwest::Client,
    base: String,
}

impl Client {
    pub fn new(api_base: &str) -> Result<Self> {
        let api_key = require_api_key()?;
        Ok(Self {
            inner: build_client(&api_key)?,
            base: normalize_base(api_base),
        })
    }

    pub fn base(&self) -> &str {
        &self.base
    }

    pub async fn ping_authenticated(&self) -> Result<()> {
        // GET /v1/tasks is a cheap authenticated endpoint that returns 200
        // even for tenants with no tasks. We use it as a "is my key valid?"
        // smoke check. If the endpoint requires auth, an invalid key returns
        // 401 — which surfaces clearly here.
        let url = format!("{}/v1/tasks", self.base);
        let resp = self
            .inner
            .get(&url)
            .send()
            .await
            .with_context(|| format!("GET {}", url))?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(anyhow!("API rejected the key (401 Unauthorized)"));
        }
        if !resp.status().is_success() {
            return Err(anyhow!("unexpected status from {}: {}", url, resp.status()));
        }
        Ok(())
    }

    pub async fn submit_task(&self, body: &serde_json::Value) -> Result<TaskSubmitResponse> {
        let url = format!("{}/v1/tasks/submit", self.base);
        let resp = self
            .inner
            .post(&url)
            .json(body)
            .send()
            .await
            .with_context(|| format!("POST {}", url))?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!("task submit failed: {} {}", status, redact(&text)));
        }
        let parsed: TaskSubmitResponse = serde_json::from_str(&text)
            .with_context(|| format!("could not parse task submit response: {}", redact(&text)))?;
        Ok(parsed)
    }

    pub async fn get_task(&self, task_id: &str) -> Result<serde_json::Value> {
        let url = format!("{}/v1/tasks/{}", self.base, task_id);
        let resp = self
            .inner
            .get(&url)
            .send()
            .await
            .with_context(|| format!("GET {}", url))?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!("get task failed: {} {}", status, redact(&text)));
        }
        serde_json::from_str::<serde_json::Value>(&text)
            .with_context(|| "could not parse task response".to_string())
    }

    pub async fn verify_task(&self, task_id: &str) -> Result<serde_json::Value> {
        let url = format!("{}/v1/tasks/{}/proof/verify", self.base, task_id);
        let resp = self
            .inner
            .post(&url)
            .json(&serde_json::json!({}))
            .send()
            .await
            .with_context(|| format!("POST {}", url))?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!("task verify failed: {} {}", status, redact(&text)));
        }
        serde_json::from_str::<serde_json::Value>(&text)
            .with_context(|| "could not parse task verify response".to_string())
    }

    pub async fn verify_receipt(&self, execution_id: &str) -> Result<serde_json::Value> {
        let url = format!("{}/proof/receipts/verify", self.base);
        let body = serde_json::json!({ "execution_id": execution_id });
        let resp = self
            .inner
            .post(&url)
            .json(&body)
            .send()
            .await
            .with_context(|| format!("POST {}", url))?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!(
                "receipt verify failed: {} {}",
                status,
                redact(&text)
            ));
        }
        serde_json::from_str::<serde_json::Value>(&text)
            .with_context(|| "could not parse receipt verify response".to_string())
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TaskSubmitResponse {
    pub task_id: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// Strip anything that looks like a key or token from a string before logging.
/// This is best-effort defense in depth — the API isn't expected to echo keys
/// back, but a 5xx body or a future error field could.
fn redact(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for token in text.split_whitespace() {
        if token.starts_with("igris_") && token.len() > 8 {
            out.push_str("igris_[redacted]");
        } else {
            out.push_str(token);
        }
        out.push(' ');
    }
    out.trim_end().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redact_strips_igris_keys_at_token_boundary() {
        // The realistic case: a server echoes back the bearer token as a
        // standalone word (e.g. "unauthorized key igris_abcd... rejected").
        // Embedded-in-other-token cases (e.g. "Bearer=igris_...") are not
        // handled — this is defense in depth, not a guarantee.
        let got = redact("unauthorized igris_abcdefghijklmnop rejected");
        assert!(!got.contains("igris_abcdefghijklmnop"));
        assert!(got.contains("igris_[redacted]"));
    }

    #[test]
    fn redact_preserves_non_key_text() {
        let got = redact("plain error message");
        assert_eq!(got, "plain error message");
    }

    #[test]
    fn normalize_base_trims_slashes() {
        assert_eq!(normalize_base("https://x.example/"), "https://x.example");
        assert_eq!(normalize_base("  https://x.example  "), "https://x.example");
        assert_eq!(normalize_base("https://x.example///"), "https://x.example");
    }

    #[test]
    fn require_api_key_errors_when_unset() {
        let _guard = EnvGuard::unset("IGRIS_API_KEY");
        let result = require_api_key();
        assert!(result.is_err());
        // The error message must NOT include the env var's value (defense in
        // depth — we just unset it, but the redaction path matters).
        let msg = format!("{}", result.unwrap_err());
        assert!(msg.contains("IGRIS_API_KEY"));
    }

    #[test]
    fn require_api_key_rejects_non_prefixed() {
        let _guard = EnvGuard::set("IGRIS_API_KEY", "not_an_igris_key");
        let result = require_api_key();
        assert!(result.is_err());
        let msg = format!("{}", result.unwrap_err());
        // Error message must not echo the bad key value back.
        assert!(!msg.contains("not_an_igris_key"));
    }

    // Test helper: env vars are process-global, so guard with restore-on-drop.
    // Tests that touch IGRIS_API_KEY must be run serially (cargo test does so by
    // default within a single test binary, but parallel-feature usage would
    // break this — keep them in this module only).
    struct EnvGuard {
        key: &'static str,
        prev: Option<String>,
    }
    impl EnvGuard {
        fn set(key: &'static str, value: &str) -> Self {
            let prev = std::env::var(key).ok();
            std::env::set_var(key, value);
            Self { key, prev }
        }
        fn unset(key: &'static str) -> Self {
            let prev = std::env::var(key).ok();
            std::env::remove_var(key);
            Self { key, prev }
        }
    }
    impl Drop for EnvGuard {
        fn drop(&mut self) {
            match &self.prev {
                Some(v) => std::env::set_var(self.key, v),
                None => std::env::remove_var(self.key),
            }
        }
    }
}
