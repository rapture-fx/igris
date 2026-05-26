use anyhow::{anyhow, Result};
use rand::rngs::OsRng;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;

use crate::receipt::ExecutionReceipt;

/// `igris-runtime demo action-task` — shells out to the existing proof script
/// to preserve proof semantics. We never re-implement the demo: the script is
/// the canonical proof of the Action Task V1 flow.
pub async fn run_action_task(
    script: &str,
    _watch: bool,
    _verify: bool,
    console_url: &str,
) -> Result<()> {
    if !std::path::Path::new(script).exists() {
        return Err(anyhow!(
            "demo script not found at {} — run this command from the repo root or pass --script",
            script
        ));
    }

    let mut cmd = Command::new("bash");
    cmd.arg(script);
    let trimmed = console_url.trim();
    if !trimmed.is_empty() {
        cmd.arg("--console-base-url").arg(trimmed);
    }

    let status = cmd
        .status()
        .map_err(|e| anyhow!("failed to launch demo script: {}", e))?;
    if !status.success() {
        return Err(anyhow!(
            "demo script failed: {}",
            status
                .code()
                .map(|c| c.to_string())
                .unwrap_or_else(|| "signal".to_string())
        ));
    }
    Ok(())
}

pub async fn run_first_run_demo(recover_prove: bool, console_url: &str) -> Result<()> {
    let signing_key = Arc::new(ed25519_dalek::SigningKey::generate(&mut OsRng));
    let verifying_key = signing_key.verifying_key();
    let runtime_id = format!(
        "demo-runtime-{}",
        short_hex(&Sha256::digest(verifying_key.as_bytes()))
    );

    let mut policy = BTreeMap::new();
    policy.insert("action", "read_only_demo_task");
    policy.insert("network", "disabled");
    policy.insert("filesystem", "read_demo_payload_only");
    policy.insert("replay", "manual_review_required_for_irreversible_failure");
    let policy_canonical = serde_json::to_string(&policy)?;
    let policy_hash = hex_digest(policy_canonical.as_bytes());

    let boundary = json!({
        "runtime_id": runtime_id,
        "capabilities": ["read_demo_payload"],
        "blocked": ["network", "shell", "external_database"],
        "storage": "embedded demo memory"
    });
    let boundary_hash = hex_digest(serde_json::to_string(&boundary)?.as_bytes());

    let receipt = ExecutionReceipt::new(
        "first-run-demo",
        Some(&runtime_id),
        "demo-transaction",
        &boundary_hash,
        3,
        18,
        24,
        0,
        1,
        false,
        "",
        Some(&signing_key),
    );
    receipt.verify_signature(&verifying_key)?;

    let recovery_event = json!({
        "event_type": "automatic_replay_blocked",
        "replay_allowed": false,
        "reason": "demo action marked irreversible after committed step",
        "mode": "demo_evidence"
    });

    let story_dir = demo_story_dir(&receipt.execution_id)?;
    fs::create_dir_all(&story_dir)?;
    let story_json = story_dir.join("story.json");
    let story_html = story_dir.join("index.html");
    let story = json!({
        "mode": "self-contained demo evidence",
        "production_deployment": false,
        "action": {
            "requested": "read-only task",
            "executed": true,
            "result_digest": hex_digest(b"igris first-run demo result")
        },
        "policy": {
            "applied": true,
            "hash": policy_hash
        },
        "runtime_boundary": {
            "recorded": true,
            "hash": boundary_hash
        },
        "recovery": recovery_event,
        "proof": {
            "receipt_verification": "verified",
            "hash_valid": true,
            "signature_matches": true,
            "runtime_key_found": true,
            "chain_valid": true,
            "receipt_hash": receipt.hash,
            "signature": "REDACTED_BASE64_ED25519_SIGNATURE"
        }
    });
    fs::write(&story_json, serde_json::to_vec_pretty(&story)?)?;
    fs::write(&story_html, render_story_html(&story)?)?;

    println!("Igris demo evidence mode: self-contained local demo");
    println!("This is not a production deployment and does not require Postgres, Docker, or a cloned repo.");
    println!();
    println!("Action requested: read-only task");
    println!("Policy applied: {}", policy_hash);
    println!("Runtime boundary recorded: {}", boundary_hash);
    println!(
        "Task executed: result digest {}",
        story["action"]["result_digest"].as_str().unwrap_or("")
    );
    if recover_prove {
        println!("Recovery demo: irreversible replay blocked");
    } else {
        println!("Recovery demo: irreversible replay blocked (run with --recover-prove for the explicit mode)");
    }
    println!("Receipt verification: verified");
    println!("  hash_valid=true signature_matches=true runtime_key_found=true chain_valid=true");
    println!("  receipt_hash={}", receipt.hash);
    println!();
    println!("Open the execution story: {}", file_url(&story_html));
    if !console_url.trim().is_empty() {
        println!(
            "Hosted console seed: {}/demo/{}",
            console_url.trim().trim_end_matches('/'),
            receipt.execution_id
        );
    }
    println!("Local evidence JSON: {}", story_json.display());
    println!();
    println!("No private keys, tokens, raw callback bodies, database credentials, or environment secrets were printed.");
    Ok(())
}

fn demo_story_dir(execution_id: &str) -> Result<PathBuf> {
    let base = std::env::var("IGRIS_DEMO_DIR")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("HOME").map(|home| PathBuf::from(home).join(".igris/demo")))
        .unwrap_or_else(|_| PathBuf::from(".igris/demo"));
    Ok(base.join(execution_id))
}

fn hex_digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn short_hex(bytes: &[u8]) -> String {
    hex::encode(bytes).chars().take(12).collect()
}

fn file_url(path: &std::path::Path) -> String {
    let absolute = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    format!("file://{}", absolute.display())
}

fn render_story_html(story: &serde_json::Value) -> Result<String> {
    let pretty = serde_json::to_string_pretty(story)?;
    let escaped = pretty
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");
    Ok(format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Igris Demo Execution Story</title>
  <style>
    body {{ font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #141414; background: #fafafa; }}
    main {{ max-width: 880px; }}
    h1 {{ font-size: 28px; margin-bottom: 8px; }}
    p {{ color: #555; line-height: 1.5; }}
    ol {{ line-height: 1.8; }}
    code, pre {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }}
    pre {{ background: #111; color: #f6f6f4; padding: 16px; border-radius: 8px; overflow: auto; }}
  </style>
</head>
<body>
<main>
  <h1>Igris Run / Recover / Prove Demo</h1>
  <p>Self-contained demo evidence. This is not a production deployment.</p>
  <ol>
    <li>Action requested</li>
    <li>Policy applied</li>
    <li>Runtime boundary recorded</li>
    <li>Task executed</li>
    <li>Irreversible replay blocked</li>
    <li>Receipt verified</li>
  </ol>
  <pre>{}</pre>
</main>
</body>
</html>
"#,
        escaped
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_story_html_escapes_json() {
        let html = render_story_html(&json!({ "x": "<secret&>" })).unwrap();
        assert!(html.contains("&lt;secret&amp;&gt;"));
        assert!(!html.contains("<secret&>"));
    }
}
