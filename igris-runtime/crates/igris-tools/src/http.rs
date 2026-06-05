/// HTTP tool provider for making web requests
use crate::{allowlisted_http_headers, safe_content_output, safe_error_message, Tool, ToolResult};
use anyhow::Result;
use serde_json::json;
use std::time::Instant;
use tracing::{debug, info};

/// HTTP request tool
pub struct HttpTool {
    allowed_domains: Vec<String>,
}

impl HttpTool {
    /// Create a new HTTP tool with domain whitelist
    pub fn new(allowed_domains: Vec<String>) -> Self {
        Self { allowed_domains }
    }

    /// Check if domain is allowed
    fn is_domain_allowed(&self, url: &str) -> bool {
        if self.allowed_domains.is_empty() {
            return false; // SECURITY: Deny by default if no whitelist configured
        }

        let host = match extract_url_host(url) {
            Some(h) => h,
            None => return false,
        };

        self.allowed_domains.iter().any(|allowed| {
            if allowed == &host {
                return true;
            }
            host.ends_with(&format!(".{}", allowed))
        })
    }
}

fn extract_url_host(url: &str) -> Option<String> {
    let u = url.trim();
    let rest = u
        .strip_prefix("https://")
        .or_else(|| u.strip_prefix("http://"))?;
    let authority = rest.split('/').next().unwrap_or("");
    let authority = authority.split('@').last().unwrap_or(authority); // drop userinfo
    if authority.starts_with('[') {
        let end = authority.find(']')?;
        return Some(authority[1..end].to_string());
    }
    let host = authority.split(':').next().unwrap_or(authority);
    if host.is_empty() {
        None
    } else {
        Some(host.to_string())
    }
}

#[async_trait::async_trait]
impl Tool for HttpTool {
    fn name(&self) -> &str {
        "http_request"
    }

    fn description(&self) -> &str {
        "Make HTTP GET/POST requests to external APIs"
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "method": {
                    "type": "string",
                    "enum": ["GET", "POST", "PUT", "DELETE"],
                    "description": "HTTP method"
                },
                "url": {
                    "type": "string",
                    "description": "Target URL"
                },
                "headers": {
                    "type": "object",
                    "description": "HTTP headers (optional)",
                    "additionalProperties": {"type": "string"}
                },
                "body": {
                    "type": "string",
                    "description": "Request body for POST/PUT (optional)"
                }
            },
            "required": ["method", "url"]
        })
    }

    async fn validate_args(&self, args: &serde_json::Value) -> Result<()> {
        let url = args["url"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'url' field"))?;

        if !self.is_domain_allowed(url) {
            anyhow::bail!(
                "Domain not allowed. Allowed domains: {:?}",
                self.allowed_domains
            );
        }

        Ok(())
    }

    async fn execute(&self, args: serde_json::Value) -> Result<ToolResult> {
        let start = Instant::now();

        self.validate_args(&args).await?;

        let method = args["method"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'method' field"))?;
        let url = args["url"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'url' field"))?;

        debug!(
            "HTTP request: method={} host={}",
            method,
            extract_url_host(url).unwrap_or_default()
        );

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        let mut request = match method {
            "GET" => client.get(url),
            "POST" => client.post(url),
            "PUT" => client.put(url),
            "DELETE" => client.delete(url),
            _ => anyhow::bail!("Unsupported HTTP method: {}", method),
        };

        // Add headers if provided
        if let Some(headers) = args["headers"].as_object() {
            for (key, value) in headers {
                if let Some(val_str) = value.as_str() {
                    request = request.header(key, val_str);
                }
            }
        }

        // Add body for POST/PUT
        if let Some(body) = args["body"].as_str() {
            request = request.body(body.to_string());
        }

        // Execute request
        match request.send().await {
            Ok(response) => {
                let status = response.status();
                let content_type = response
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|value| value.to_str().ok())
                    .map(|value| value.to_string());
                let safe_headers = allowlisted_http_headers(response.headers());
                let body = response.text().await.unwrap_or_default();

                info!(
                    "HTTP response: host={} status={}",
                    extract_url_host(url).unwrap_or_default(),
                    status
                );

                let execution_time = start.elapsed().as_millis() as u64;
                let response_digest = crate::sha256_hex(body.as_bytes());
                let content_bytes = body.len();
                let output = safe_content_output(
                    "http.request",
                    "http_request",
                    "success",
                    body.as_bytes(),
                    content_type.as_deref(),
                    "HTTP response body redacted",
                    json!({
                        "status_code": status.as_u16(),
                        "url_host": extract_url_host(url).unwrap_or_default(),
                        "response_headers": safe_headers,
                    }),
                );

                Ok(
                    ToolResult::success("http_request".to_string(), output, execution_time)
                        .with_metadata("status_code".to_string(), status.as_u16().to_string())
                        .with_metadata("content_redacted".to_string(), "true".to_string())
                        .with_metadata("content_bytes".to_string(), content_bytes.to_string())
                        .with_metadata("response_digest".to_string(), response_digest.clone())
                        .with_metadata("content_digest_sha256".to_string(), response_digest),
                )
            }
            Err(e) => {
                let execution_time = start.elapsed().as_millis() as u64;
                Ok(ToolResult::failure(
                    "http_request".to_string(),
                    safe_error_message(http_error_code(&e)),
                    execution_time,
                ))
            }
        }
    }
}

fn http_error_code(error: &reqwest::Error) -> &'static str {
    if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect_error"
    } else if error.is_status() {
        "http_status_error"
    } else {
        "http_error"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_domain_whitelist() {
        let tool = HttpTool::new(vec![
            "example.com".to_string(),
            "api.github.com".to_string(),
        ]);

        assert!(tool.is_domain_allowed("https://example.com/api"));
        assert!(tool.is_domain_allowed("https://api.github.com/repos"));
        assert!(tool.is_domain_allowed("https://sub.example.com/thing"));
        assert!(!tool.is_domain_allowed("https://evil-example.com/"));
        assert!(!tool.is_domain_allowed("https://malicious.com"));
        assert!(!tool.is_domain_allowed("not-a-url"));
    }

    #[test]
    fn test_empty_whitelist_denies_all() {
        let tool = HttpTool::new(vec![]);
        assert!(!tool.is_domain_allowed("https://any-domain.com"));
        assert!(!tool.is_domain_allowed("https://example.com"));
        assert!(!tool.is_domain_allowed("http://169.254.169.254")); // Cloud metadata
        assert!(!tool.is_domain_allowed("http://localhost:8080")); // Local services
    }

    #[tokio::test]
    async fn test_validate_args() {
        let tool = HttpTool::new(vec!["example.com".to_string()]);

        let valid_args = json!({
            "method": "GET",
            "url": "https://example.com/api"
        });

        assert!(tool.validate_args(&valid_args).await.is_ok());

        let invalid_args = json!({
            "method": "GET",
            "url": "https://blocked.com"
        });

        assert!(tool.validate_args(&invalid_args).await.is_err());
    }

    #[test]
    fn http_safe_envelope_does_not_persist_raw_body_or_sensitive_headers() {
        let marker = "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET";
        let body = format!("private response body {marker}");
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(reqwest::header::CONTENT_TYPE, "text/plain".parse().unwrap());
        headers.insert("set-cookie", format!("session={marker}").parse().unwrap());
        headers.insert("x-request-id", "req-123".parse().unwrap());
        let output = crate::safe_content_output(
            "http.request",
            "http_request",
            "success",
            body.as_bytes(),
            Some("text/plain"),
            "HTTP response body redacted",
            json!({
                "status_code": 200,
                "url_host": "127.0.0.1",
                "response_headers": crate::allowlisted_http_headers(&headers),
            }),
        );
        let serialized = output;
        assert!(!serialized.contains(marker));
        assert!(!serialized.to_lowercase().contains("authorization"));
        assert!(!serialized.to_lowercase().contains("set-cookie"));
        assert!(serialized.contains("\"content_redacted\":true"));
        assert!(serialized.contains("\"content_digest_sha256\""));
        assert!(serialized.contains("\"content_bytes\""));
        assert!(serialized.contains("\"status_code\":200"));
        assert!(serialized.contains("\"x-request-id\""));
    }
}
