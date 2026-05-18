use anyhow::{anyhow, Result};
use std::process::Command;

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
