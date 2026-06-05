//! Controlled local database-write tool (sandboxed).
//!
//! This tool exists for the **Action Task V1** capability: it lets a durable
//! task perform a single, narrowly-scoped row insert against a clearly-named
//! test/proof table. It is deliberately *not* a general database connector —
//! it is fail-closed in every dimension:
//!
//! * The destination table must match one of the configured allowed prefixes
//!   (and may only contain `[a-z0-9_]`). Anything else is rejected before any
//!   network call is made.
//! * The write is forwarded to a configured **local** database-write gateway
//!   (`http://127.0.0.1:...` / `http://localhost:...`). The tool never holds
//!   database credentials and never executes arbitrary SQL — the gateway owns
//!   the connection and applies the same table allow-list.
//!
//! Args: `{ "table": "<table>", "record": { ...flat record... } }`.
//! On success the output is a small JSON summary: `{ table, inserted, row_id }`.

use crate::{Tool, ToolResult};
use anyhow::Result;
use serde_json::json;
use std::time::Instant;
use tracing::{debug, info};

/// Sandboxed single-row database insert tool. Construct one only when an
/// explicit gateway URL is configured — otherwise the runtime should not
/// register it at all.
pub struct DatabaseWriteTool {
    gateway_url: String,
    allowed_table_prefixes: Vec<String>,
}

impl DatabaseWriteTool {
    pub fn new(gateway_url: String, allowed_table_prefixes: Vec<String>) -> Self {
        Self {
            gateway_url: gateway_url.trim().to_string(),
            allowed_table_prefixes: allowed_table_prefixes
                .into_iter()
                .map(|p| p.trim().to_ascii_lowercase())
                .filter(|p| !p.is_empty())
                .collect(),
        }
    }

    fn gateway_host(&self) -> Option<String> {
        let rest = self
            .gateway_url
            .strip_prefix("http://")
            .or_else(|| self.gateway_url.strip_prefix("https://"))?;
        let authority = rest.split('/').next().unwrap_or("");
        let authority = authority.split('@').last().unwrap_or(authority);
        if let Some(stripped) = authority.strip_prefix('[') {
            let end = stripped.find(']')?;
            return Some(stripped[..end].to_string());
        }
        let host = authority.split(':').next().unwrap_or(authority);
        if host.is_empty() {
            None
        } else {
            Some(host.to_string())
        }
    }

    fn gateway_is_local(&self) -> bool {
        match self.gateway_host() {
            Some(host) => host == "127.0.0.1" || host == "localhost" || host == "::1",
            None => false,
        }
    }

    fn table_allowed(&self, table: &str) -> bool {
        if table.is_empty() || self.allowed_table_prefixes.is_empty() {
            return false;
        }
        if !table
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
        {
            return false;
        }
        self.allowed_table_prefixes
            .iter()
            .any(|prefix| table.starts_with(prefix.as_str()))
    }
}

#[async_trait::async_trait]
impl Tool for DatabaseWriteTool {
    fn name(&self) -> &str {
        "database_write"
    }

    fn description(&self) -> &str {
        "Insert one row into a controlled test/proof database table via a local gateway (sandboxed)"
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "Destination table (must match a configured allowed prefix; lowercase/digits/underscore only)"
                },
                "record": {
                    "type": "object",
                    "description": "Record to insert (flat JSON object)"
                }
            },
            "required": ["table", "record"]
        })
    }

    async fn validate_args(&self, args: &serde_json::Value) -> Result<()> {
        if self.gateway_url.is_empty() || !self.gateway_is_local() {
            anyhow::bail!("database write gateway must be a configured localhost URL");
        }
        let table = args["table"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'table' field"))?;
        if !self.table_allowed(table) {
            anyhow::bail!(
                "table {:?} is not allowed; allowed prefixes: {:?}",
                table,
                self.allowed_table_prefixes
            );
        }
        if !args["record"].is_object() {
            anyhow::bail!("'record' must be a JSON object");
        }
        Ok(())
    }

    async fn execute(&self, args: serde_json::Value) -> Result<ToolResult> {
        let start = Instant::now();
        self.validate_args(&args).await?;

        let table = args["table"].as_str().unwrap_or_default().to_string();
        let record = args.get("record").cloned().unwrap_or_else(|| json!({}));
        debug!("database_write: table={}", table);

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()?;
        let response = client
            .post(&self.gateway_url)
            .json(&json!({ "table": table, "record": record }))
            .send()
            .await;
        let elapsed = start.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => {
                let status = resp.status();
                let body_text = resp.text().await.unwrap_or_default();
                if !status.is_success() {
                    return Ok(ToolResult::failure(
                        "database_write".to_string(),
                        format!("database write gateway returned {}: {}", status, body_text),
                        elapsed,
                    ));
                }
                let parsed: serde_json::Value = serde_json::from_str(&body_text)
                    .unwrap_or_else(|_| json!({ "raw": body_text }));
                let row_id = parsed
                    .get("row_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                if row_id.is_empty() {
                    return Ok(ToolResult::failure(
                        "database_write".to_string(),
                        format!(
                            "database write gateway did not return a row_id: {}",
                            body_text
                        ),
                        elapsed,
                    ));
                }
                let summary = json!({ "table": table, "inserted": true, "row_id": row_id });
                info!("database_write: inserted into {} row_id={}", table, row_id);
                Ok(
                    ToolResult::success("database_write".to_string(), summary.to_string(), elapsed)
                        .with_metadata("table".to_string(), table)
                        .with_metadata("row_id".to_string(), row_id),
                )
            }
            Err(e) => Ok(ToolResult::failure(
                "database_write".to_string(),
                format!("database write gateway request failed: {}", e),
                elapsed,
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_remote_gateway() {
        let tool = DatabaseWriteTool::new(
            "https://example.com/db".to_string(),
            vec!["action_task_".to_string()],
        );
        assert!(!tool.gateway_is_local());
    }

    #[test]
    fn accepts_localhost_gateway() {
        let tool = DatabaseWriteTool::new(
            "http://127.0.0.1:18099/db-write".to_string(),
            vec!["action_task_".to_string()],
        );
        assert!(tool.gateway_is_local());
        assert_eq!(tool.gateway_host().as_deref(), Some("127.0.0.1"));
    }

    #[test]
    fn table_allowlist_is_fail_closed() {
        let tool = DatabaseWriteTool::new(
            "http://localhost:18099/db-write".to_string(),
            vec!["action_task_".to_string()],
        );
        assert!(tool.table_allowed("action_task_events"));
        assert!(tool.table_allowed("action_task_proof_rows"));
        assert!(!tool.table_allowed("users"));
        assert!(!tool.table_allowed("action_task_events; DROP TABLE users"));
        assert!(!tool.table_allowed("ACTION_TASK_EVENTS"));

        let no_prefixes = DatabaseWriteTool::new("http://127.0.0.1:1/x".to_string(), vec![]);
        assert!(!no_prefixes.table_allowed("action_task_events"));
    }

    #[tokio::test]
    async fn validate_args_rejects_bad_input() {
        let tool = DatabaseWriteTool::new(
            "http://127.0.0.1:18099/db-write".to_string(),
            vec!["action_task_".to_string()],
        );
        assert!(tool
            .validate_args(&json!({ "table": "users", "record": {} }))
            .await
            .is_err());
        assert!(tool
            .validate_args(&json!({ "table": "action_task_events", "record": "nope" }))
            .await
            .is_err());
        assert!(tool
            .validate_args(
                &json!({ "table": "action_task_events", "record": { "status": "processed" } })
            )
            .await
            .is_ok());
    }
}
