use anyhow::{anyhow, Context, Result};
use std::fs;

use super::api::Client;
use super::task_console_url;

/// `igris actions run <name> [--input <json-or-file>] [--idempotency-key <key>]`
pub async fn run_action(
    api_url: &str,
    console_url: &str,
    action_name: &str,
    input: Option<&str>,
    idempotency_key: Option<&str>,
) -> Result<()> {
    let client = Client::new(api_url)?;
    let payload = build_run_payload(input, idempotency_key)?;
    let body = client
        .call_action(None, Some(action_name), &payload)
        .await
        .with_context(|| format!("run action `{action_name}`"))?;
    print_action_run_summary(&body);
    if let Some(run_id) = body
        .get("run_id")
        .or_else(|| body.get("task_id"))
        .and_then(|v| v.as_str())
    {
        if let Some(link) = task_console_url(console_url, run_id) {
            println!("Console: {link}");
        }
    }
    if body.get("error").and_then(|v| v.as_str()) == Some("action_failed") {
        return Err(anyhow!(
            "action run failed: {}",
            body.get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown error")
        ));
    }
    Ok(())
}

/// `igris runs inspect <run_id>`
pub async fn inspect_run(api_url: &str, console_url: &str, run_id: &str) -> Result<()> {
    let client = Client::new(api_url)?;
    let body = client
        .get_action_run(run_id)
        .await
        .with_context(|| format!("inspect run `{run_id}`"))?;
    print_action_run_summary(&body);
    if let Some(link) = task_console_url(console_url, run_id) {
        println!("Console: {link}");
    }
    Ok(())
}

fn build_run_payload(input: Option<&str>, idempotency_key: Option<&str>) -> Result<serde_json::Value> {
    let mut payload = serde_json::json!({ "input": {} });
    if let Some(raw) = input.map(str::trim).filter(|s| !s.is_empty()) {
        let parsed = parse_input_value(raw)?;
        payload["input"] = parsed;
    }
    if let Some(key) = idempotency_key.map(str::trim).filter(|s| !s.is_empty()) {
        payload["idempotency_key"] = key.into();
    }
    Ok(payload)
}

fn parse_input_value(raw: &str) -> Result<serde_json::Value> {
    if raw.starts_with('{') || raw.starts_with('[') {
        return serde_json::from_str(raw).context("input JSON is invalid");
    }
    let bytes = fs::read(raw).with_context(|| format!("could not read input file: {raw}"))?;
    serde_json::from_slice(&bytes).with_context(|| format!("input file is not valid JSON: {raw}"))
}

fn print_action_run_summary(body: &serde_json::Value) {
    let run_id = body
        .get("run_id")
        .or_else(|| body.get("task_id"))
        .and_then(|v| v.as_str())
        .unwrap_or("-");
    let status = body.get("status").and_then(|v| v.as_str()).unwrap_or("-");
    let proof = body
        .get("proof_status")
        .and_then(|v| v.as_str())
        .unwrap_or("-");
    let action_name = body
        .get("action_name")
        .and_then(|v| v.as_str())
        .unwrap_or("-");
    println!("run_id: {run_id}");
    println!("action: {action_name}");
    println!("status: {status}");
    println!("proof_status: {proof}");
    if let Some(err) = body.get("error").and_then(|v| v.as_str()) {
        println!("error: {err}");
    }
    if let Some(msg) = body.get("message").and_then(|v| v.as_str()) {
        println!("message: {msg}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_run_payload_accepts_inline_json() {
        let payload = build_run_payload(Some(r#"{"message":"hi"}"#), Some("key-1")).unwrap();
        assert_eq!(payload["input"]["message"], "hi");
        assert_eq!(payload["idempotency_key"], "key-1");
    }
}