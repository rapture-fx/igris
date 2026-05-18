// Action Task V1 file validator.
//
// The wire shape we accept matches what `scripts/action_task_v1_proof_helper.js`
// emits and what the server (routes_tasks.go + the controlled tool gateway in
// scripts/action_task_v1_proof_helper.js) accepts. Validation is
// client-side-only — final authority is still the server. We validate early
// so the operator gets a clear error before any network call.
//
// Supported actions (MVP):
//   read_file  : requires `path` (non-empty string)
//   http_call  : requires `method` (allowed verb) and `url` (non-empty string)
//   db_write   : requires `table` (matches `^action_task_[a-z0-9_]+$`) and `record` (object)
//
// Unsupported actions are rejected with the supported list in the error so
// the operator knows what to use.
//
// We deliberately do NOT validate request/response bodies, headers, or record
// contents — those are user-provided payloads, and inspecting them risks
// surfacing data the operator wanted kept local. Wire-shape correctness is
// the line we hold here.

use anyhow::{anyhow, Result};

const SUPPORTED_ACTIONS: &[&str] = &["read_file", "http_call", "db_write"];
const ALLOWED_HTTP_METHODS: &[&str] = &["GET", "POST", "PUT", "PATCH", "DELETE"];

/// Validate a task file's wire shape against the Action Task V1 contract.
/// Returns Ok(()) when the file is acceptable to send to the server.
pub fn validate(body: &serde_json::Value) -> Result<()> {
    let obj = body
        .as_object()
        .ok_or_else(|| anyhow!("task file must be a JSON object"))?;

    let task_type = obj
        .get("task_type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("task file must set `task_type` (expected \"action_workflow\")"))?;
    if task_type != "action_workflow" {
        return Err(anyhow!(
            "CLI only supports task_type=action_workflow; got `{}`",
            task_type
        ));
    }

    let action = obj
        .get("action_task")
        .and_then(|v| v.as_object())
        .ok_or_else(|| anyhow!("action_workflow task must have an `action_task` object"))?;

    let steps = action
        .get("steps")
        .and_then(|v| v.as_array())
        .ok_or_else(|| anyhow!("action_task must have a `steps` array"))?;
    if steps.is_empty() {
        return Err(anyhow!("action_task.steps must not be empty"));
    }

    for (i, step) in steps.iter().enumerate() {
        validate_step(i, step).map_err(|e| anyhow!("action_task.steps[{}]: {}", i, e))?;
    }

    Ok(())
}

fn validate_step(_index: usize, step: &serde_json::Value) -> Result<()> {
    let obj = step
        .as_object()
        .ok_or_else(|| anyhow!("step must be a JSON object"))?;
    let action = obj
        .get("action")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("step must have a string `action` field"))?;

    match action {
        "read_file" => validate_read_file(obj),
        "http_call" => validate_http_call(obj),
        "db_write" => validate_db_write(obj),
        other => Err(anyhow!(
            "unsupported action `{}` (supported: {})",
            other,
            SUPPORTED_ACTIONS.join(", ")
        )),
    }
}

fn validate_read_file(step: &serde_json::Map<String, serde_json::Value>) -> Result<()> {
    let path = step
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("read_file requires a string `path`"))?;
    if path.trim().is_empty() {
        return Err(anyhow!("read_file `path` must not be empty"));
    }
    Ok(())
}

fn validate_http_call(step: &serde_json::Map<String, serde_json::Value>) -> Result<()> {
    let method = step
        .get("method")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("http_call requires a string `method`"))?;
    let method_upper = method.to_ascii_uppercase();
    if !ALLOWED_HTTP_METHODS
        .iter()
        .any(|m| *m == method_upper.as_str())
    {
        return Err(anyhow!(
            "http_call `method` must be one of {} (got `{}`)",
            ALLOWED_HTTP_METHODS.join(", "),
            method
        ));
    }
    let url = step
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("http_call requires a string `url`"))?;
    if url.trim().is_empty() {
        return Err(anyhow!("http_call `url` must not be empty"));
    }
    // Optional fields: body, headers. We intentionally do not inspect their
    // contents — see module-level comment.
    if let Some(headers) = step.get("headers") {
        if !headers.is_object() {
            return Err(anyhow!(
                "http_call `headers`, when present, must be an object"
            ));
        }
    }
    Ok(())
}

fn validate_db_write(step: &serde_json::Map<String, serde_json::Value>) -> Result<()> {
    let table = step
        .get("table")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("db_write requires a string `table`"))?;
    if !is_allowed_action_table(table) {
        // Server enforces this exact pattern in
        // scripts/action_task_v1_proof_helper.js:62 (`^action_task_[a-z0-9_]+$`)
        // and refuses other tables. Mirroring the rule locally is the difference
        // between a clear CLI error and a generic 403 from the gateway.
        return Err(anyhow!(
            "db_write `table` must match ^action_task_[a-z0-9_]+$ (got `{}`)",
            table
        ));
    }
    let record = step
        .get("record")
        .ok_or_else(|| anyhow!("db_write requires a `record` field"))?;
    if !record.is_object() {
        return Err(anyhow!("db_write `record` must be a JSON object"));
    }
    Ok(())
}

fn is_allowed_action_table(table: &str) -> bool {
    if !table.starts_with("action_task_") {
        return false;
    }
    let suffix = &table["action_task_".len()..];
    if suffix.is_empty() {
        return false;
    }
    suffix
        .bytes()
        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(steps: serde_json::Value) -> serde_json::Value {
        serde_json::json!({
            "task_type": "action_workflow",
            "action_task": { "steps": steps }
        })
    }

    #[test]
    fn accepts_minimal_read_file() {
        validate(&task(serde_json::json!([
            { "action": "read_file", "path": "/tmp/x" }
        ])))
        .unwrap();
    }

    #[test]
    fn accepts_http_call_with_all_optional_fields() {
        validate(&task(serde_json::json!([
            {
                "action": "http_call",
                "method": "POST",
                "url": "http://127.0.0.1:8080/x",
                "body": "{}",
                "headers": { "content-type": "application/json" }
            }
        ])))
        .unwrap();
    }

    #[test]
    fn accepts_db_write_with_allowed_table() {
        validate(&task(serde_json::json!([
            {
                "action": "db_write",
                "table": "action_task_events",
                "record": { "x": 1 }
            }
        ])))
        .unwrap();
    }

    #[test]
    fn accepts_full_proof_demo_shape() {
        let body = serde_json::json!({
            "task_id": "00000000-0000-0000-0000-000000000001",
            "task_type": "action_workflow",
            "action_task": {
                "name": "demo",
                "steps": [
                    { "action": "read_file", "path": "/tmp/in.json" },
                    { "action": "http_call", "method": "POST", "url": "http://127.0.0.1:18091/p" },
                    { "action": "db_write", "table": "action_task_events", "record": { "k": "v" } }
                ]
            },
            "idempotency_key": "x"
        });
        validate(&body).unwrap();
    }

    #[test]
    fn rejects_unsupported_action_with_supported_list_in_error() {
        let err = validate(&task(serde_json::json!([
            { "action": "shell_exec", "cmd": "rm -rf /" }
        ])))
        .unwrap_err();
        let msg = format!("{}", err);
        assert!(msg.contains("unsupported action"));
        assert!(msg.contains("read_file"));
        assert!(msg.contains("http_call"));
        assert!(msg.contains("db_write"));
    }

    #[test]
    fn rejects_read_file_without_path() {
        assert!(validate(&task(serde_json::json!([
            { "action": "read_file" }
        ])))
        .is_err());
    }

    #[test]
    fn rejects_read_file_empty_path() {
        assert!(validate(&task(serde_json::json!([
            { "action": "read_file", "path": "   " }
        ])))
        .is_err());
    }

    #[test]
    fn rejects_http_call_bad_method() {
        let err = validate(&task(serde_json::json!([
            { "action": "http_call", "method": "TRACE", "url": "http://x" }
        ])))
        .unwrap_err();
        assert!(format!("{}", err).contains("method"));
    }

    #[test]
    fn http_call_method_is_case_insensitive() {
        validate(&task(serde_json::json!([
            { "action": "http_call", "method": "post", "url": "http://x" }
        ])))
        .unwrap();
    }

    #[test]
    fn rejects_http_call_without_url() {
        assert!(validate(&task(serde_json::json!([
            { "action": "http_call", "method": "GET" }
        ])))
        .is_err());
    }

    #[test]
    fn rejects_http_call_headers_not_object() {
        assert!(validate(&task(serde_json::json!([
            { "action": "http_call", "method": "GET", "url": "http://x", "headers": "bad" }
        ])))
        .is_err());
    }

    #[test]
    fn rejects_db_write_table_outside_pattern() {
        for bad in &[
            "users",
            "action_task",
            "action_task_",
            "action_task_Foo",
            "Action_task_foo",
            "action_task_foo-bar",
            "action_task_foo;DROP",
        ] {
            let err = validate(&task(serde_json::json!([
                { "action": "db_write", "table": bad, "record": {} }
            ])))
            .unwrap_err();
            assert!(
                format!("{}", err).contains("action_task_"),
                "expected pattern error for table `{}`",
                bad
            );
        }
    }

    #[test]
    fn db_write_table_accepts_pattern() {
        for good in &[
            "action_task_events",
            "action_task_x",
            "action_task_a1b2c3",
            "action_task_a_b_c",
        ] {
            validate(&task(serde_json::json!([
                { "action": "db_write", "table": good, "record": {} }
            ])))
            .unwrap_or_else(|e| panic!("expected `{}` to be accepted, got: {}", good, e));
        }
    }

    #[test]
    fn rejects_db_write_record_not_object() {
        assert!(validate(&task(serde_json::json!([
            { "action": "db_write", "table": "action_task_x", "record": "string" }
        ])))
        .is_err());
    }

    #[test]
    fn rejects_step_without_action_field() {
        assert!(validate(&task(serde_json::json!([{ "path": "/x" }]))).is_err());
    }

    #[test]
    fn rejects_non_object_step() {
        assert!(validate(&task(serde_json::json!(["read_file"]))).is_err());
    }

    #[test]
    fn rejects_empty_steps() {
        assert!(validate(&task(serde_json::json!([]))).is_err());
    }

    #[test]
    fn rejects_wrong_task_type() {
        let body = serde_json::json!({
            "task_type": "single_inference",
            "action_task": { "steps": [{}] }
        });
        assert!(validate(&body).is_err());
    }

    #[test]
    fn rejects_missing_action_task() {
        assert!(validate(&serde_json::json!({ "task_type": "action_workflow" })).is_err());
    }

    #[test]
    fn rejects_non_object_body() {
        assert!(validate(&serde_json::json!([1, 2, 3])).is_err());
    }

    #[test]
    fn examples_action_task_demo_validates() {
        // The example file shipped at examples/action-task-demo.json must stay
        // valid against this validator. If a future schema change breaks it,
        // this test fails and we update both the file and the docs together.
        //
        // CARGO_MANIFEST_DIR is the crate dir, so we climb to the repo root.
        let manifest = env!("CARGO_MANIFEST_DIR");
        let path = std::path::Path::new(manifest)
            .join("../../..")
            .join("examples/action-task-demo.json");
        let bytes = match std::fs::read(&path) {
            Ok(b) => b,
            Err(_) => {
                // When running outside the monorepo (e.g. a published crate),
                // the example file isn't present. That's fine — skip silently
                // rather than fail the build for downstream consumers.
                return;
            }
        };
        let body: serde_json::Value =
            serde_json::from_slice(&bytes).expect("example file must be valid JSON");
        validate(&body).expect("example file must validate against current schema");
    }

    #[test]
    fn error_message_includes_step_index() {
        let err = validate(&task(serde_json::json!([
            { "action": "read_file", "path": "/ok" },
            { "action": "shell_exec" }
        ])))
        .unwrap_err();
        let msg = format!("{}", err);
        assert!(
            msg.contains("steps[1]"),
            "expected step index in error: {}",
            msg
        );
    }
}
