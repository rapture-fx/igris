// Igris MCP server — exposes the task/proof API to MCP-compatible agent
// clients (e.g. Claude Desktop) over stdio.
//
// Scope is deliberately narrow: this is NOT a generic filesystem / HTTP /
// database connector. The only tools exposed are wrappers over Overture's
// existing task/proof endpoints, and every response goes through the same
// "safe summary" path the CLI uses — no raw file contents, HTTP bodies,
// headers, or DB payloads are ever returned.
//
// Transport: line-delimited JSON-RPC 2.0 on stdin/stdout. Stderr is for logs.
// We pick stdio because it's the MCP spec default and avoids exposing a
// network port by accident. HTTP/SSE transport can be added later behind an
// explicit flag if the product needs it.
//
// Authentication: same as the CLI — IGRIS_API_KEY env var with an `igris_`
// prefix. The MCP process inherits it from the parent; we never log it and
// the redact() in cli::api strips it from any error message that surfaces.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

use super::api::Client;

pub const PROTOCOL_VERSION: &str = "2024-11-05";
pub const SERVER_NAME: &str = "igris-agent-mcp";
pub const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

// ── JSON-RPC framing ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: &'static str,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

impl JsonRpcResponse {
    fn ok(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: Some(result),
            error: None,
        }
    }
    fn err(id: Value, code: i64, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.into(),
            }),
        }
    }
}

// JSON-RPC reserved codes per spec.
const ERR_PARSE: i64 = -32700;
const ERR_INVALID_REQUEST: i64 = -32600;
const ERR_METHOD_NOT_FOUND: i64 = -32601;
const ERR_INVALID_PARAMS: i64 = -32602;
const ERR_INTERNAL: i64 = -32603;

// ── Tool registry ───────────────────────────────────────────────────────────

/// Returns the list of tools the MCP server exposes, in MCP `tools/list`
/// response shape. Pure function — same output every time, no I/O.
pub fn tool_list() -> Value {
    json!({
        "tools": [
            {
                "name": "igris_submit_task",
                "description": "Submit a recoverable Igris task. Accepts an Action Task V1 body. Raw file contents, HTTP bodies/headers, and DB payloads are never returned.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "task_definition": {
                            "type": "object",
                            "description": "Action Task V1 body. Must set task_type='action_workflow' and action_task.steps."
                        }
                    },
                    "required": ["task_definition"]
                }
            },
            {
                "name": "igris_get_task_status",
                "description": "Get a task's high-level status and progress counters. Returns only safe summary fields — no raw payloads.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string", "description": "UUID of the task." }
                    },
                    "required": ["task_id"]
                }
            },
            {
                "name": "igris_get_action_evidence",
                "description": "Return the safe action_evidence array for a task. Each entry includes action_type, status, target_summary, result_digest, and a small whitelisted result_summary. Raw payloads are excluded.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string" }
                    },
                    "required": ["task_id"]
                }
            },
            {
                "name": "igris_verify_task",
                "description": "Run fresh cryptographic + chain verification on a task's signed receipt. Returns verified, hash_valid, signature_matches, runtime_key_found, chain_link_valid, and verification_reason.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string" }
                    },
                    "required": ["task_id"]
                }
            },
            {
                "name": "igris_export_evidence",
                "description": "Export a task's safe evidence as JSON or Markdown. Raw payloads are never included. Suitable for audit or operator review.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string" },
                        "format": {
                            "type": "string",
                            "enum": ["json", "markdown"],
                            "default": "json"
                        }
                    },
                    "required": ["task_id"]
                }
            }
        ]
    })
}

// ── Tool dispatch ───────────────────────────────────────────────────────────

/// Execute a single MCP `tools/call` invocation. Returns the MCP-format
/// `{ content: [...], isError: bool }` payload.
async fn call_tool(client: &Client, name: &str, args: &Value) -> Result<Value> {
    match name {
        "igris_submit_task" => tool_submit(client, args).await,
        "igris_get_task_status" => tool_status(client, args).await,
        "igris_get_action_evidence" => tool_evidence(client, args).await,
        "igris_verify_task" => tool_verify(client, args).await,
        "igris_export_evidence" => tool_export(client, args).await,
        other => Err(anyhow!("unknown tool: {}", other)),
    }
}

fn arg_str(args: &Value, key: &str) -> Result<String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(String::from)
        .ok_or_else(|| anyhow!("missing required argument `{}`", key))
}

async fn tool_submit(client: &Client, args: &Value) -> Result<Value> {
    let body = args
        .get("task_definition")
        .ok_or_else(|| anyhow!("missing required argument `task_definition`"))?
        .clone();

    // Phase 3 validator runs here too — same rules as the CLI submit path.
    // Catches malformed action bodies before any network call.
    super::action_task::validate(&body)?;

    let resp = client.submit_task(&body).await?;
    Ok(text_content(json!({
        "task_id": resp.task_id,
        "status": resp.status,
        "summary": format!("Task accepted: {}", resp.task_id)
    })))
}

async fn tool_status(client: &Client, args: &Value) -> Result<Value> {
    let task_id = arg_str(args, "task_id")?;
    let task = client.get_task(&task_id).await?;

    // Project to a small whitelist. Specifically we DO NOT pass through
    // raw envelopes, receipts, or task_definition — only the operator-safe
    // fields the CLI already prints.
    let mut completed = 0usize;
    let mut total = 0usize;
    if let Some(arr) = task.get("action_evidence").and_then(|v| v.as_array()) {
        total = arr.len();
        for entry in arr {
            if entry.get("status").and_then(|v| v.as_str()) == Some("committed") {
                completed += 1;
            }
        }
    }
    let proof_status = task
        .get("proof")
        .and_then(|v| v.get("status"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(text_content(json!({
        "task_id": task.get("task_id").and_then(|v| v.as_str()).unwrap_or(""),
        "status": task.get("status").and_then(|v| v.as_str()).unwrap_or(""),
        "task_type": task.get("task_type").and_then(|v| v.as_str()).unwrap_or(""),
        "runtime_id": task.get("runtime_id").and_then(|v| v.as_str()).unwrap_or(""),
        "action_count": total,
        "completed_actions": completed,
        "proof_status": proof_status,
    })))
}

async fn tool_evidence(client: &Client, args: &Value) -> Result<Value> {
    let task_id = arg_str(args, "task_id")?;
    let task = client.get_task(&task_id).await?;
    let evidence = task
        .get("action_evidence")
        .cloned()
        .unwrap_or_else(|| json!([]));
    // The server already constrains action_evidence entries to the safe
    // summary fields; we pass the array through unchanged. We do NOT enrich
    // or re-derive anything client-side — see audit principle.
    Ok(text_content(json!({
        "task_id": task_id,
        "action_evidence": evidence,
    })))
}

async fn tool_verify(client: &Client, args: &Value) -> Result<Value> {
    let task_id = arg_str(args, "task_id")?;
    let raw = client.verify_task(&task_id).await?;

    // Project the verify response to the documented fields. Same shape the
    // CLI's `tasks verify` prints, normalized so MCP clients don't have to
    // know about the top-level-vs-proof.* nesting.
    let proof = raw.get("proof").cloned().unwrap_or_else(|| json!({}));
    let pick_bool = |key: &str| -> Option<bool> {
        raw.get(key)
            .and_then(|v| v.as_bool())
            .or_else(|| proof.get(key).and_then(|v| v.as_bool()))
    };
    let pick_str = |key: &str| -> Option<String> {
        raw.get(key)
            .and_then(|v| v.as_str())
            .map(String::from)
            .or_else(|| proof.get(key).and_then(|v| v.as_str()).map(String::from))
    };

    Ok(text_content(json!({
        "task_id": task_id,
        "verified": pick_bool("verified").unwrap_or(false),
        "hash_valid": pick_bool("hash_valid"),
        "signature_matches": pick_bool("signature_matches").or(pick_bool("signature_valid")),
        "runtime_key_found": pick_bool("runtime_key_found"),
        "chain_link_valid": pick_bool("chain_link_valid").or(pick_bool("chain_valid")),
        "verification_reason": pick_str("verification_reason").unwrap_or_default(),
    })))
}

async fn tool_export(client: &Client, args: &Value) -> Result<Value> {
    let task_id = arg_str(args, "task_id")?;
    let format = args
        .get("format")
        .and_then(|v| v.as_str())
        .unwrap_or("json");
    let task = client.get_task(&task_id).await?;
    let safe = build_export_payload(&task);
    match format {
        "json" => Ok(text_content(safe)),
        "markdown" => Ok(text_content_raw(render_markdown(&safe))),
        other => Err(anyhow!(
            "unsupported export format `{}` (allowed: json, markdown)",
            other
        )),
    }
}

/// Whitelist-based projection from a full task response into the export shape.
/// Anything not explicitly listed here is dropped — this is the same defense
/// the CLI relies on.
pub fn build_export_payload(task: &Value) -> Value {
    let mut evidence_items = vec![];
    if let Some(arr) = task.get("action_evidence").and_then(|v| v.as_array()) {
        for entry in arr {
            let mut row = serde_json::Map::new();
            for key in &[
                "step_index",
                "action_type",
                "status",
                "target_summary",
                "result_digest",
                "runtime_id",
                "recorded_at",
            ] {
                if let Some(v) = entry.get(*key) {
                    row.insert((*key).to_string(), v.clone());
                }
            }
            if let Some(rs) = entry.get("result_summary").and_then(|v| v.as_object()) {
                let mut safe_rs = serde_json::Map::new();
                for key in &[
                    "bytes_read",
                    "content_digest",
                    "status_code",
                    "response_digest",
                    "table",
                    "row_id",
                ] {
                    if let Some(v) = rs.get(*key) {
                        safe_rs.insert((*key).to_string(), v.clone());
                    }
                }
                row.insert("result_summary".into(), Value::Object(safe_rs));
            }
            evidence_items.push(Value::Object(row));
        }
    }
    let proof = task
        .get("proof")
        .and_then(|v| v.as_object())
        .map(|p| {
            let mut out = serde_json::Map::new();
            for key in &[
                "status",
                "execution_id",
                "verified",
                "hash_valid",
                "signature_matches",
                "runtime_key_found",
                "chain_link_valid",
                "verification_reason",
            ] {
                if let Some(v) = p.get(*key) {
                    out.insert((*key).to_string(), v.clone());
                }
            }
            Value::Object(out)
        })
        .unwrap_or_else(|| json!({}));

    json!({
        "task_id": task.get("task_id").and_then(|v| v.as_str()).unwrap_or(""),
        "status": task.get("status").and_then(|v| v.as_str()).unwrap_or(""),
        "task_type": task.get("task_type").and_then(|v| v.as_str()).unwrap_or(""),
        "runtime_id": task.get("runtime_id").and_then(|v| v.as_str()).unwrap_or(""),
        "action_evidence": evidence_items,
        "proof": proof,
    })
}

fn render_markdown(safe: &Value) -> String {
    let mut out = String::new();
    let task_id = safe.get("task_id").and_then(|v| v.as_str()).unwrap_or("?");
    let status = safe.get("status").and_then(|v| v.as_str()).unwrap_or("?");
    out.push_str(&format!("# Task {}\n\n", task_id));
    out.push_str(&format!("- Status: `{}`\n", status));
    if let Some(rt) = safe.get("runtime_id").and_then(|v| v.as_str()) {
        if !rt.is_empty() {
            out.push_str(&format!("- Runtime: `{}`\n", rt));
        }
    }
    if let Some(proof) = safe.get("proof").and_then(|v| v.as_object()) {
        if let Some(verified) = proof.get("verified").and_then(|v| v.as_bool()) {
            out.push_str(&format!("- Verified: `{}`\n", verified));
        }
        if let Some(chain) = proof.get("chain_link_valid").and_then(|v| v.as_bool()) {
            out.push_str(&format!("- Chain valid: `{}`\n", chain));
        }
    }
    out.push_str("\n## Action evidence\n\n");
    if let Some(arr) = safe.get("action_evidence").and_then(|v| v.as_array()) {
        for (i, entry) in arr.iter().enumerate() {
            let kind = entry
                .get("action_type")
                .and_then(|v| v.as_str())
                .unwrap_or("?");
            let st = entry.get("status").and_then(|v| v.as_str()).unwrap_or("?");
            let target = entry
                .get("target_summary")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            out.push_str(&format!(
                "{}. **{}** — `{}` → `{}`\n",
                i + 1,
                kind,
                st,
                target
            ));
        }
    }
    out
}

// ── MCP response envelope helpers ──────────────────────────────────────────

fn text_content(payload: Value) -> Value {
    json!({
        "content": [{
            "type": "text",
            "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
        }],
        "isError": false
    })
}

fn text_content_raw(text: String) -> Value {
    json!({
        "content": [{ "type": "text", "text": text }],
        "isError": false
    })
}

fn error_content(message: &str) -> Value {
    json!({
        "content": [{ "type": "text", "text": message }],
        "isError": true
    })
}

// ── Top-level method dispatch ──────────────────────────────────────────────

/// Handle one parsed JSON-RPC request and produce a response. Pure async
/// dispatch — no I/O on stdio. Notifications (no id) return None.
async fn handle_request(client: &Client, req: JsonRpcRequest) -> Option<JsonRpcResponse> {
    let id = req.id.clone();
    match req.method.as_str() {
        "initialize" => Some(JsonRpcResponse::ok(
            id.unwrap_or(Value::Null),
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": { "tools": {} },
                "serverInfo": { "name": SERVER_NAME, "version": SERVER_VERSION }
            }),
        )),
        "initialized" | "notifications/initialized" => {
            // Notification — no response.
            None
        }
        "tools/list" => Some(JsonRpcResponse::ok(id.unwrap_or(Value::Null), tool_list())),
        "tools/call" => {
            let name = match req.params.get("name").and_then(|v| v.as_str()) {
                Some(n) => n.to_string(),
                None => {
                    return Some(JsonRpcResponse::err(
                        id.unwrap_or(Value::Null),
                        ERR_INVALID_PARAMS,
                        "tools/call requires `name`",
                    ));
                }
            };
            let args = req.params.get("arguments").cloned().unwrap_or(json!({}));
            match call_tool(client, &name, &args).await {
                Ok(result) => Some(JsonRpcResponse::ok(id.unwrap_or(Value::Null), result)),
                Err(e) => {
                    // MCP convention: tool errors return a normal result with
                    // isError=true so the calling agent can see and reason
                    // about the failure (vs. JSON-RPC transport errors).
                    Some(JsonRpcResponse::ok(
                        id.unwrap_or(Value::Null),
                        error_content(&format!("{}", e)),
                    ))
                }
            }
        }
        "ping" => Some(JsonRpcResponse::ok(id.unwrap_or(Value::Null), json!({}))),
        other => {
            if id.is_none() {
                // Unknown notification — ignore per JSON-RPC spec.
                return None;
            }
            Some(JsonRpcResponse::err(
                id.unwrap_or(Value::Null),
                ERR_METHOD_NOT_FOUND,
                format!("unknown method: {}", other),
            ))
        }
    }
}

// ── stdio loop ─────────────────────────────────────────────────────────────

/// Run the MCP server on stdio. Reads line-delimited JSON-RPC from stdin and
/// writes responses to stdout. Returns Ok(()) on clean EOF.
pub async fn run_stdio(api_url: &str) -> Result<()> {
    // Construct the client eagerly so a missing API key fails fast with the
    // same actionable message the CLI uses.
    let client = Client::new(api_url)?;

    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin).lines();
    let mut stdout = tokio::io::stdout();

    eprintln!(
        "[{}] MCP server listening on stdio (api: {})",
        SERVER_NAME,
        client.base()
    );

    while let Some(line) = reader.next_line().await? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let resp = match serde_json::from_str::<JsonRpcRequest>(trimmed) {
            Ok(req) => handle_request(&client, req).await,
            Err(e) => Some(JsonRpcResponse::err(
                Value::Null,
                ERR_PARSE,
                format!("parse error: {}", e),
            )),
        };
        if let Some(r) = resp {
            let mut out = serde_json::to_vec(&r).unwrap_or_else(|_| b"{}".to_vec());
            out.push(b'\n');
            stdout.write_all(&out).await?;
            stdout.flush().await?;
        }
    }
    Ok(())
}

// Suppress dead-code warnings for the JSON-RPC error codes that aren't used
// from this module yet but document the spec's reserved range.
#[allow(dead_code)]
const _UNUSED_CODES: (i64, i64, i64) = (ERR_INVALID_REQUEST, ERR_INTERNAL, 0);

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_list_contains_all_five_tools() {
        let list = tool_list();
        let tools = list.get("tools").and_then(|v| v.as_array()).unwrap();
        let names: Vec<&str> = tools
            .iter()
            .map(|t| t.get("name").and_then(|v| v.as_str()).unwrap())
            .collect();
        assert_eq!(
            names,
            vec![
                "igris_submit_task",
                "igris_get_task_status",
                "igris_get_action_evidence",
                "igris_verify_task",
                "igris_export_evidence",
            ]
        );
    }

    #[test]
    fn every_tool_has_name_description_and_input_schema() {
        let list = tool_list();
        let tools = list.get("tools").and_then(|v| v.as_array()).unwrap();
        for t in tools {
            assert!(t.get("name").and_then(|v| v.as_str()).is_some());
            assert!(t.get("description").and_then(|v| v.as_str()).is_some());
            let schema = t.get("inputSchema").and_then(|v| v.as_object()).unwrap();
            assert_eq!(schema.get("type").and_then(|v| v.as_str()), Some("object"));
        }
    }

    #[test]
    fn tool_descriptions_have_no_stray_indentation() {
        // rustfmt's multi-line string handling once silently injected leading
        // whitespace into descriptions. Lock against regressions: no
        // description should contain a run of 2+ spaces, since the source
        // uses single-line strings now.
        let list = tool_list();
        let tools = list.get("tools").and_then(|v| v.as_array()).unwrap();
        for t in tools {
            let desc = t.get("description").and_then(|v| v.as_str()).unwrap();
            assert!(
                !desc.contains("  "),
                "description has stray indentation: `{}`",
                desc
            );
        }
    }

    #[test]
    fn tool_descriptions_state_no_raw_payloads() {
        // Documented contract: tool descriptions must tell clients that raw
        // payloads are not returned. The wording isn't fixed, but the phrase
        // "raw" or "payload" should appear in tools that read evidence so an
        // agent reading the tool list understands the safety model.
        let list = tool_list();
        let tools = list.get("tools").and_then(|v| v.as_array()).unwrap();
        for name in &[
            "igris_submit_task",
            "igris_get_action_evidence",
            "igris_export_evidence",
        ] {
            let t = tools
                .iter()
                .find(|t| t.get("name").and_then(|v| v.as_str()) == Some(*name))
                .unwrap();
            let desc = t.get("description").and_then(|v| v.as_str()).unwrap();
            assert!(
                desc.contains("raw") || desc.contains("payload"),
                "tool `{}` description must reference raw/payload safety",
                name
            );
        }
    }

    #[test]
    fn build_export_payload_drops_unknown_fields() {
        // Even if the server response sprouts a new top-level field, the
        // exporter must NOT pass it through.
        let task = json!({
            "task_id": "t1",
            "status": "completed",
            "task_type": "action_workflow",
            "execution_envelope": { "should_not_leak": true },
            "execution_receipt": { "should_not_leak": true },
            "task_definition": { "should_not_leak": true },
            "action_evidence": [],
        });
        let safe = build_export_payload(&task);
        assert!(safe.get("execution_envelope").is_none());
        assert!(safe.get("execution_receipt").is_none());
        assert!(safe.get("task_definition").is_none());
        assert_eq!(safe.get("task_id").and_then(|v| v.as_str()), Some("t1"));
    }

    #[test]
    fn build_export_payload_drops_unknown_result_summary_keys() {
        let task = json!({
            "task_id": "t1",
            "status": "completed",
            "action_evidence": [{
                "step_index": 0,
                "action_type": "db_write",
                "status": "committed",
                "result_summary": {
                    "table": "action_task_x",
                    "row_id": "r1",
                    "secret_payload": "must-not-leak"
                }
            }],
        });
        let safe = build_export_payload(&task);
        let entry = &safe.get("action_evidence").unwrap().as_array().unwrap()[0];
        let rs = entry
            .get("result_summary")
            .and_then(|v| v.as_object())
            .unwrap();
        assert!(rs.contains_key("table"));
        assert!(rs.contains_key("row_id"));
        assert!(
            !rs.contains_key("secret_payload"),
            "exporter must drop unknown result_summary keys"
        );
    }

    #[test]
    fn render_markdown_uses_only_whitelisted_fields() {
        let safe = json!({
            "task_id": "t1",
            "status": "completed",
            "runtime_id": "rt-x",
            "proof": { "verified": true, "chain_link_valid": true },
            "action_evidence": [
                { "action_type": "read_file", "status": "committed", "target_summary": "/x" }
            ]
        });
        let md = render_markdown(&safe);
        assert!(md.contains("# Task t1"));
        assert!(md.contains("Verified: `true`"));
        assert!(md.contains("Chain valid: `true`"));
        assert!(md.contains("read_file"));
    }

    fn req(method: &str, params: Value, id: i64) -> JsonRpcRequest {
        JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(json!(id)),
            method: method.to_string(),
            params,
        }
    }

    #[tokio::test]
    async fn initialize_returns_protocol_and_server_info() {
        // We can call handle_request with a placeholder Client — but Client::new
        // requires IGRIS_API_KEY. For methods that don't actually call out to
        // the API (initialize, tools/list, ping), we'd still need a Client.
        // The cleanest test path: assert directly on the JSON shape of the
        // response handler logic where we don't actually use the client.
        // Since handle_request takes &Client, we instead test tool_list and
        // the request parser independently here.
        //
        // For initialize, the response is constructed inline without using
        // the client; we cover that via the protocol-version constant.
        assert_eq!(PROTOCOL_VERSION, "2024-11-05");
        assert_eq!(SERVER_NAME, "igris-agent-mcp");
    }

    #[test]
    fn jsonrpc_request_parses_with_optional_id_and_params() {
        // Notification (no id).
        let r: JsonRpcRequest =
            serde_json::from_str(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#)
                .unwrap();
        assert!(r.id.is_none());
        assert_eq!(r.method, "notifications/initialized");

        // Standard request.
        let r: JsonRpcRequest =
            serde_json::from_str(r#"{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}"#)
                .unwrap();
        assert_eq!(r.id, Some(json!(1)));
    }

    #[test]
    fn jsonrpc_response_serializes_without_null_fields() {
        let ok = JsonRpcResponse::ok(json!(1), json!({"x": 1}));
        let s = serde_json::to_string(&ok).unwrap();
        assert!(!s.contains("error"));
        assert!(s.contains("\"result\""));

        let err = JsonRpcResponse::err(json!(2), ERR_METHOD_NOT_FOUND, "nope");
        let s = serde_json::to_string(&err).unwrap();
        assert!(!s.contains("result"));
        assert!(s.contains("\"error\""));
        assert!(s.contains("nope"));
    }

    #[test]
    fn arg_str_extracts_or_errors() {
        let args = json!({ "task_id": "abc" });
        assert_eq!(arg_str(&args, "task_id").unwrap(), "abc");
        assert!(arg_str(&args, "missing").is_err());
    }

    // Ensure the small bookkeeping constant compiles and is not silently
    // dropped by a future cleanup.
    #[test]
    fn unused_codes_table_exists() {
        let (_a, _b, _c) = _UNUSED_CODES;
    }
}
