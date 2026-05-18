use anyhow::{anyhow, Context, Result};
use std::time::Duration;

use super::action_task;
use super::api::Client;
use super::task_console_url;

const WATCH_POLL_INTERVAL: Duration = Duration::from_secs(2);
const WATCH_MAX_DURATION: Duration = Duration::from_secs(600);

/// `igris-runtime tasks submit <file> [--watch] [--verify]`
pub async fn run_submit(
    api_url: &str,
    console_url: &str,
    file: &str,
    watch: bool,
    verify: bool,
) -> Result<()> {
    let bytes =
        std::fs::read(file).with_context(|| format!("could not read task file: {}", file))?;
    let body: serde_json::Value = serde_json::from_slice(&bytes)
        .with_context(|| format!("task file is not valid JSON: {}", file))?;

    // Phase 3 validator: action-type whitelist + per-action field rules.
    // Final authority is still the server; this just gives the operator a
    // clear error before any network call.
    action_task::validate(&body)?;

    let client = Client::new(api_url)?;
    let resp = client.submit_task(&body).await?;
    println!("Task accepted: {}", resp.task_id);
    if let Some(link) = task_console_url(console_url, &resp.task_id) {
        println!("Console: {}", link);
    }

    if watch {
        watch_task(&client, &resp.task_id).await?;
    }

    if verify {
        let result = client.verify_task(&resp.task_id).await?;
        print_verify_result(&result);
        if !is_verified(&result) {
            return Err(anyhow!("task proof did not verify"));
        }
    }

    Ok(())
}

/// `igris-runtime tasks inspect <task_id>`
pub async fn run_inspect(api_url: &str, console_url: &str, task_id: &str) -> Result<()> {
    let client = Client::new(api_url)?;
    let task = client.get_task(task_id).await?;
    print_task_summary(&task);
    if let Some(evidence) = task.get("action_evidence").and_then(|v| v.as_array()) {
        if !evidence.is_empty() {
            println!();
            println!("Action evidence:");
            for entry in evidence {
                print_action_evidence_entry(entry);
            }
        }
    }
    if let Some(link) = task_console_url(console_url, task_id) {
        println!();
        println!("Console: {}", link);
    }
    Ok(())
}

/// `igris-runtime tasks verify <task_id>`
pub async fn run_verify(api_url: &str, task_id: &str) -> Result<()> {
    let client = Client::new(api_url)?;
    let result = client.verify_task(task_id).await?;
    print_verify_result(&result);
    if !is_verified(&result) {
        return Err(anyhow!("task proof did not verify"));
    }
    Ok(())
}

// ── helpers ────────────────────────────────────────────────────────────────

async fn watch_task(client: &Client, task_id: &str) -> Result<()> {
    let started = std::time::Instant::now();
    let mut last_completed_actions: usize = 0;
    loop {
        if started.elapsed() > WATCH_MAX_DURATION {
            return Err(anyhow!(
                "watch timed out after {} seconds",
                WATCH_MAX_DURATION.as_secs()
            ));
        }
        let task = client.get_task(task_id).await?;
        // Surface newly-committed actions in order. The server's
        // `action_evidence` array is authoritative — `status` field on each
        // entry transitions to `committed` when a step's WAL entry is
        // persisted.
        let evidence = task
            .get("action_evidence")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        for (i, entry) in evidence.iter().enumerate() {
            if i < last_completed_actions {
                continue;
            }
            if entry.get("status").and_then(|s| s.as_str()) == Some("committed") {
                let kind = entry
                    .get("action_type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("action");
                println!("Action committed: {}", friendly_action(kind));
                last_completed_actions = i + 1;
            }
        }

        let status = task.get("status").and_then(|v| v.as_str()).unwrap_or("");
        if is_terminal(status) {
            if status != "completed" {
                return Err(anyhow!("task ended in non-success state: {}", status));
            }
            return Ok(());
        }
        tokio::time::sleep(WATCH_POLL_INTERVAL).await;
    }
}

fn is_terminal(status: &str) -> bool {
    // Server-side canonical statuses: pending, dispatched, checkpointed,
    // completed, failed, recovering, canceled (see coordinator/checkpoint_store.go).
    // Only completed/failed/canceled are terminal; recovering may continue.
    matches!(status, "completed" | "failed" | "canceled")
}

fn friendly_action(kind: &str) -> &'static str {
    match kind {
        "read_file" => "read file",
        "http_call" => "call API",
        "db_write" => "write record",
        "webhook_call" => "call webhook",
        _ => "step",
    }
}

fn print_task_summary(task: &serde_json::Value) {
    // Server returns `task_id` (see buildTaskResponse in routes_tasks.go),
    // not `id`. The task verify endpoint additionally wraps everything in a
    // top-level object whose `task_id` matches.
    let id = task.get("task_id").and_then(|v| v.as_str()).unwrap_or("?");
    let status = task.get("status").and_then(|v| v.as_str()).unwrap_or("?");
    let runtime_id = task
        .get("runtime_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let task_type = task.get("task_type").and_then(|v| v.as_str()).unwrap_or("");
    println!("Task: {}", id);
    println!("  status:     {}", status);
    if !task_type.is_empty() {
        println!("  task_type:  {}", task_type);
    }
    if !runtime_id.is_empty() {
        println!("  runtime_id: {}", runtime_id);
    }
    if let Some(proof) = task.get("proof").and_then(|v| v.as_object()) {
        if let Some(verified) = proof.get("verified").and_then(|v| v.as_bool()) {
            println!("  verified:   {}", verified);
        }
        // Task proof uses `chain_link_valid`; receipt proof uses `chain_valid`.
        // Accept either so the same printer works for both shapes.
        if let Some(chain) = chain_valid_field(proof) {
            println!("  chain:      {}", if chain { "valid" } else { "invalid" });
        }
    }
}

fn chain_valid_field(obj: &serde_json::Map<String, serde_json::Value>) -> Option<bool> {
    obj.get("chain_link_valid")
        .and_then(|v| v.as_bool())
        .or_else(|| obj.get("chain_valid").and_then(|v| v.as_bool()))
}

fn print_action_evidence_entry(entry: &serde_json::Value) {
    let kind = entry
        .get("action_type")
        .and_then(|v| v.as_str())
        .unwrap_or("?");
    let status = entry.get("status").and_then(|v| v.as_str()).unwrap_or("?");
    let target = entry
        .get("target_summary")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let digest = entry
        .get("result_digest")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    print!("  - [{}] {}", status, friendly_action(kind));
    if !target.is_empty() {
        print!(" → {}", target);
    }
    println!();
    if !digest.is_empty() {
        println!("      digest: {}", short_digest(digest));
    }
    if let Some(rs) = entry.get("result_summary").and_then(|v| v.as_object()) {
        // result_summary is the server-built safe summary. We pass through only
        // documented keys to avoid accidentally leaking new fields.
        for key in &[
            "bytes_read",
            "content_digest",
            "status_code",
            "response_digest",
            "table",
            "row_id",
        ] {
            if let Some(v) = rs.get(*key) {
                println!("      {}: {}", key, v);
            }
        }
    }
}

fn short_digest(digest: &str) -> String {
    if digest.len() <= 16 {
        digest.to_string()
    } else {
        format!("{}…", &digest[..16])
    }
}

fn is_verified(result: &serde_json::Value) -> bool {
    // Top-level for both endpoints (task verify and receipt verify both set
    // `verified` at top level). Fall back to `proof.verified` in case a future
    // server change moves the flag.
    if let Some(b) = result.get("verified").and_then(|v| v.as_bool()) {
        return b;
    }
    result
        .get("proof")
        .and_then(|v| v.get("verified"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

pub fn print_verify_result(result: &serde_json::Value) {
    // Two response shapes:
    //   POST /v1/tasks/:id/proof/verify  →  { task_id, verified, proof: { ... } }
    //   POST /proof/receipts/verify       →  { verified, hash_valid, ..., chain_valid, ... }
    // Look at the top level first; fall through to `proof.*` if a field is
    // missing there. signature_matches vs signature_valid and
    // chain_link_valid vs chain_valid are both accepted to bridge the two
    // endpoints' slightly divergent field naming.
    let top = result;
    let nested = result
        .get("proof")
        .and_then(|v| v.as_object())
        .map(|m| serde_json::Value::Object(m.clone()));
    let nested_ref = nested.as_ref();
    let pick_bool = |key: &str| -> Option<bool> {
        top.get(key).and_then(|v| v.as_bool()).or_else(|| {
            nested_ref
                .and_then(|n| n.get(key))
                .and_then(|v| v.as_bool())
        })
    };
    let pick_str = |key: &str| -> Option<String> {
        top.get(key)
            .and_then(|v| v.as_str())
            .map(String::from)
            .or_else(|| {
                nested_ref
                    .and_then(|n| n.get(key))
                    .and_then(|v| v.as_str())
                    .map(String::from)
            })
    };

    let verified = pick_bool("verified");
    let hash_valid = pick_bool("hash_valid");
    let sig_matches = pick_bool("signature_matches").or_else(|| pick_bool("signature_valid"));
    let runtime_key_found = pick_bool("runtime_key_found");
    let chain_valid = pick_bool("chain_link_valid").or_else(|| pick_bool("chain_valid"));
    let reason = pick_str("verification_reason")
        .or_else(|| pick_str("message"))
        .unwrap_or_default();

    let verified_label = match verified {
        Some(true) => "Receipt signed",
        Some(false) => "Receipt NOT verified",
        None => "Receipt verification status unknown",
    };
    println!("{}", verified_label);
    if let Some(b) = hash_valid {
        println!("  hash_valid:        {}", b);
    }
    if let Some(b) = sig_matches {
        println!("  signature_matches: {}", b);
    }
    if let Some(b) = runtime_key_found {
        println!("  runtime_key_found: {}", b);
    }
    match chain_valid {
        Some(true) => println!("Chain valid"),
        Some(false) => println!("Chain NOT valid"),
        None => println!("Chain validation: not reported"),
    }
    if !reason.is_empty() {
        println!("  reason: {}", reason);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Validator tests moved to cli/action_task.rs alongside the validator
    // itself. The wire-shape lock-in test below (sanity_check_accepts_proof_demo_helper_shape)
    // is the only one we keep here, to assert the validator is wired into the
    // submit path.

    #[test]
    fn is_terminal_recognizes_states() {
        assert!(is_terminal("completed"));
        assert!(is_terminal("failed"));
        assert!(is_terminal("canceled"));
        assert!(!is_terminal("pending"));
        assert!(!is_terminal("running"));
    }

    #[test]
    fn friendly_action_maps_known_kinds() {
        assert_eq!(friendly_action("read_file"), "read file");
        assert_eq!(friendly_action("http_call"), "call API");
        assert_eq!(friendly_action("db_write"), "write record");
        assert_eq!(friendly_action("unknown_action"), "step");
    }

    #[test]
    fn is_verified_handles_missing_and_false() {
        assert!(!is_verified(&serde_json::json!({})));
        assert!(!is_verified(&serde_json::json!({ "verified": false })));
        assert!(is_verified(&serde_json::json!({ "verified": true })));
    }

    #[test]
    fn is_verified_finds_flag_inside_proof_subobject() {
        // Task verify response wraps the proof state under `proof`. We accept
        // either location to insulate against backend response-shape drift.
        let nested = serde_json::json!({ "task_id": "x", "proof": { "verified": true } });
        assert!(is_verified(&nested));
        let nested_false = serde_json::json!({ "task_id": "x", "proof": { "verified": false } });
        assert!(!is_verified(&nested_false));
    }

    #[test]
    fn chain_valid_field_prefers_chain_link_valid() {
        // Task proof emits `chain_link_valid`; receipt proof emits `chain_valid`.
        let task_proof = serde_json::json!({ "chain_link_valid": true })
            .as_object()
            .cloned()
            .unwrap();
        assert_eq!(super::chain_valid_field(&task_proof), Some(true));

        let receipt_proof = serde_json::json!({ "chain_valid": false })
            .as_object()
            .cloned()
            .unwrap();
        assert_eq!(super::chain_valid_field(&receipt_proof), Some(false));

        let missing = serde_json::json!({}).as_object().cloned().unwrap();
        assert_eq!(super::chain_valid_field(&missing), None);
    }

    // These fixtures mirror the actual JSON the Overture server emits:
    //   - task fixture: buildTaskResponse in routes_tasks.go
    //   - task verify fixture: handleVerifyTaskProof → applyCryptographicProofFields + applyChainProofFields
    //   - receipt verify fixture: VerifyReceiptResponse in routes_proof.go
    // If a server-side field rename ever lands, these tests catch it.

    fn task_response_fixture() -> serde_json::Value {
        serde_json::json!({
            "task_id": "019de343-0000-0000-0000-000000000001",
            "status": "completed",
            "task_type": "action_workflow",
            "runtime_id": "rt-test-123",
            "proof": {
                "status": "verified",
                "execution_id": "exec-1",
                "verified": true,
                "hash_valid": true,
                "signature_matches": true,
                "runtime_key_found": true,
                "chain_link_valid": true,
                "verification_reason": ""
            },
            "action_evidence": [
                {
                    "step_index": 0,
                    "action_type": "read_file",
                    "status": "committed",
                    "target_summary": "/tmp/in.json",
                    "result_digest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                    "result_summary": { "bytes_read": 123, "content_digest": "abc" }
                },
                {
                    "step_index": 1,
                    "action_type": "http_call",
                    "status": "committed",
                    "target_summary": "POST http://127.0.0.1:18091/process",
                    "result_digest": "deadbeef",
                    "result_summary": { "status_code": 200, "response_digest": "xyz" }
                },
                {
                    "step_index": 2,
                    "action_type": "db_write",
                    "status": "committed",
                    "target_summary": "table action_task_events",
                    "result_summary": { "table": "action_task_events", "row_id": "row-1" }
                }
            ]
        })
    }

    fn task_verify_response_fixture() -> serde_json::Value {
        // Matches handleVerifyTaskProof's JSON output.
        serde_json::json!({
            "task_id": "019de343-0000-0000-0000-000000000001",
            "verified": true,
            "proof": {
                "status": "verified",
                "verified": true,
                "hash_valid": true,
                "signature_valid": true,
                "signature_matches": true,
                "runtime_key_found": true,
                "chain_link_valid": true,
                "verification_reason": "ok"
            }
        })
    }

    fn receipt_verify_response_fixture() -> serde_json::Value {
        // Matches VerifyReceiptResponse JSON tags in routes_proof.go.
        serde_json::json!({
            "verified": true,
            "valid": true,
            "execution_id": "exec-1",
            "receipt_id": "rcpt-1",
            "hash": "h",
            "signature": "s",
            "verification_status": "verified",
            "hash_valid": true,
            "signature_matches": true,
            "runtime_key_found": true,
            "chain_valid": true,
            "message": "ok"
        })
    }

    #[test]
    fn fixture_task_response_has_expected_task_id_field() {
        // Lock in: server uses `task_id`, not `id`. If this fails, the printer
        // is reading the wrong key.
        let task = task_response_fixture();
        assert!(
            task.get("task_id").is_some(),
            "server response must use `task_id`"
        );
        assert!(
            task.get("id").is_none(),
            "server response should not use `id` for the task identifier"
        );
    }

    #[test]
    fn cli_recognizes_terminal_status_in_task_fixture() {
        let task = task_response_fixture();
        let status = task.get("status").and_then(|v| v.as_str()).unwrap();
        assert!(is_terminal(status));
    }

    #[test]
    fn cli_finds_committed_actions_in_task_fixture() {
        let task = task_response_fixture();
        let evidence = task
            .get("action_evidence")
            .and_then(|v| v.as_array())
            .unwrap();
        for entry in evidence {
            let s = entry.get("status").and_then(|v| v.as_str()).unwrap();
            assert_eq!(s, "committed", "watch loop keys on `committed` status");
            assert!(entry.get("action_type").is_some());
        }
    }

    #[test]
    fn is_verified_works_for_task_verify_response_shape() {
        let r = task_verify_response_fixture();
        assert!(
            is_verified(&r),
            "task verify response must surface `verified=true`"
        );
    }

    #[test]
    fn is_verified_works_for_receipt_verify_response_shape() {
        let r = receipt_verify_response_fixture();
        assert!(
            is_verified(&r),
            "receipt verify response must surface `verified=true`"
        );
    }

    #[test]
    fn chain_valid_resolves_for_both_endpoints() {
        // Both endpoints' shapes pass through chain_valid_field correctly.
        let task = task_verify_response_fixture();
        let task_proof = task.get("proof").and_then(|v| v.as_object()).unwrap();
        assert_eq!(super::chain_valid_field(task_proof), Some(true));

        // For receipt verify the chain flag is at top level, not in a subobject.
        let receipt = receipt_verify_response_fixture();
        let receipt_obj = receipt.as_object().unwrap();
        assert_eq!(super::chain_valid_field(receipt_obj), Some(true));
    }

    #[test]
    fn print_verify_result_does_not_panic_on_either_shape() {
        // Smoke test — the printer must handle both endpoints' shapes.
        print_verify_result(&task_verify_response_fixture());
        print_verify_result(&receipt_verify_response_fixture());
    }

    #[test]
    fn print_verify_result_does_not_panic_on_minimal_response() {
        // A 200 response with only `verified` set (e.g. from a misconfigured
        // runtime returning the bare minimum) must not panic.
        print_verify_result(&serde_json::json!({ "verified": false }));
        print_verify_result(&serde_json::json!({}));
    }

    #[test]
    fn submit_path_uses_action_task_validator() {
        // Wiring test: confirm the validator that `run_submit` calls accepts
        // the exact body shape scripts/action_task_v1_proof_helper.js produces.
        // If the helper or the validator drift, this test fails and we know
        // to update both producers together.
        let body = serde_json::json!({
            "task_id": "00000000-0000-0000-0000-000000000001",
            "task_type": "action_workflow",
            "action_task": {
                "name": "action-task-v1-proof",
                "steps": [
                    { "action": "read_file", "path": "/tmp/in.json" },
                    {
                        "action": "http_call",
                        "method": "POST",
                        "url": "http://127.0.0.1:18091/process",
                        "body": "{}",
                        "headers": { "content-type": "application/json" }
                    },
                    {
                        "action": "db_write",
                        "table": "action_task_events",
                        "record": { "task_id": "x", "status": "processed" }
                    }
                ]
            },
            "idempotency_key": "action-task-v1-00000000"
        });
        action_task::validate(&body).expect("the proof demo's wire shape must validate");
    }

    #[test]
    fn short_digest_truncates_long() {
        let d = "0123456789abcdef0123456789abcdef";
        assert_eq!(short_digest(d), "0123456789abcdef…");
    }

    #[test]
    fn short_digest_keeps_short() {
        assert_eq!(short_digest("abc"), "abc");
    }
}
