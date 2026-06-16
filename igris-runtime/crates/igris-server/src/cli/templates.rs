use anyhow::{anyhow, Context, Result};
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use super::api::Client;
use super::packs;
use super::resolve_api_url;

/// Built-in agent template names.
pub const BUILTIN_TEMPLATE_NAMES: &[&str] = &["claude-code", "codex", "cursor", "custom-agent"];

const STARTER_PACK: &str = "starter";
const STARTER_ACTIONS: &[&str] = &["demo.echo", "demo.fail_once", "demo.needs_approval"];

fn recommended_agent_name(template_name: &str) -> String {
    template_name.replace('-', "_") + "_agent"
}

fn recommended_agent_type(template_name: &str) -> &'static str {
    match template_name {
        "claude-code" => "claude_code",
        "codex" => "codex",
        "cursor" => "cursor",
        _ => "custom",
    }
}

const FORBIDDEN_SUBSTRINGS: &[&str] = &[
    "tenant_id",
    "task_definition",
    "runtime_endpoint",
    "runtime_id",
    "ciphertext",
    "nonce",
    "key_material",
    "secret_ref",
    "sk-live",
    "sk-test",
    "password=",
    "-----begin",
];

/// Minimal Agent Template model — local configuration helpers only.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentTemplate {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub agent_type: String,
    pub recommended_pack: String,
    pub generated_files: Vec<GeneratedFile>,
    pub setup_commands: Vec<String>,
    pub verification_commands: Vec<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GeneratedFile {
    pub relative_path: String,
    pub content: String,
}

/// Default install directory: `.igris/templates/<name>`.
pub fn default_output_dir(template_name: &str) -> Result<PathBuf> {
    validate_template_name(template_name)?;
    let base = std::env::current_dir().context("could not resolve current directory")?;
    Ok(base.join(".igris").join("templates").join(template_name))
}

pub fn validate_template_name(name: &str) -> Result<()> {
    let trimmed = name.trim();
    if !BUILTIN_TEMPLATE_NAMES.contains(&trimmed) {
        return Err(anyhow!(
            "unknown template {trimmed:?}; built-in templates are: {}",
            BUILTIN_TEMPLATE_NAMES.join(", ")
        ));
    }
    Ok(())
}

/// Reject path traversal and paths outside the output root.
pub fn validate_output_dir(output: &Path) -> Result<PathBuf> {
    for component in output.components() {
        if matches!(component, Component::ParentDir) {
            return Err(anyhow!(
                "output path must not contain parent directory segments"
            ));
        }
    }

    let target = if output.is_absolute() {
        output.to_path_buf()
    } else {
        let cwd = std::env::current_dir().context("could not resolve current directory")?;
        cwd.join(output)
    };
    fs::create_dir_all(&target)
        .with_context(|| format!("could not create output directory: {}", target.display()))?;
    let canonical = target
        .canonicalize()
        .with_context(|| format!("invalid output directory: {}", output.display()))?;
    Ok(canonical)
}

pub fn validate_relative_output_path(relative: &str) -> Result<()> {
    let trimmed = relative.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("generated file path is required"));
    }
    if trimmed.contains('\\') {
        return Err(anyhow!("generated file path must use forward slashes"));
    }
    if trimmed.starts_with('/') || trimmed.starts_with("..") || trimmed.contains("/../") {
        return Err(anyhow!("generated file path must stay inside the output directory"));
    }
    let path = Path::new(trimmed);
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(anyhow!("generated file path must not traverse upward"));
    }
    Ok(())
}

pub fn validate_template_content(content: &str) -> Result<()> {
    let lower = content.to_lowercase();
    for marker in FORBIDDEN_SUBSTRINGS {
        if lower.contains(marker) {
            return Err(anyhow!(
                "template content must not include forbidden execution field or secret marker: {marker}"
            ));
        }
    }
    if lower.contains("igris_") && !lower.contains("igris_api") {
        return Err(anyhow!(
            "template content must not include API key values (igris_ prefix)"
        ));
    }
    Ok(())
}

pub fn builtin_templates() -> Vec<AgentTemplate> {
    vec![
        claude_code_template(),
        codex_template(),
        cursor_template(),
        custom_agent_template(),
    ]
}

pub fn get_template(name: &str) -> Result<AgentTemplate> {
    validate_template_name(name)?;
    builtin_templates()
        .into_iter()
        .find(|t| t.name == name)
        .ok_or_else(|| anyhow!("template {name} is not available"))
}

fn claude_code_template() -> AgentTemplate {
    let mcp_config = serde_json::json!({
        "mcpServers": {
            "igris": {
                "command": "igris",
                "args": ["mcp", "serve"],
                "env": {
                    "IGRIS_API_URL": "",
                    "IGRIS_API_KEY": ""
                }
            }
        }
    });
    AgentTemplate {
        name: "claude-code".to_string(),
        display_name: "Claude Code".to_string(),
        description: "Generate Claude Code MCP server configuration for Igris registered actions.".to_string(),
        agent_type: "mcp".to_string(),
        recommended_pack: STARTER_PACK.to_string(),
        generated_files: vec![
            GeneratedFile {
                relative_path: "mcp-config.json".to_string(),
                content: serde_json::to_string_pretty(&mcp_config).unwrap_or_default(),
            },
            GeneratedFile {
                relative_path: "SETUP.md".to_string(),
                content: claude_setup_markdown(),
            },
        ],
        setup_commands: vec![
            "export IGRIS_API_URL=\"https://overture.igrisinertial.com\"".to_string(),
            "export IGRIS_API_KEY=\"<your-igris-api-key>\"".to_string(),
            "igris agents register --name claude_code_agent --agent-type claude_code --template-name claude-code".to_string(),
            "igris packs install starter".to_string(),
            "Merge mcp-config.json into your Claude Code MCP settings (or set IGRIS_MCP_CONFIG to this file).".to_string(),
        ],
        verification_commands: vec![
            "igris agents list".to_string(),
            "igris packs list".to_string(),
            "igris actions run demo.echo --input '{\"message\":\"hello\"}' --idempotency-key starter-echo-claude-001".to_string(),
            "Ask Claude Code to call MCP tools/list and confirm list_actions, call_action, get_run, get_run_evidence".to_string(),
        ],
        notes: vec![
            "Set IGRIS_API_URL and IGRIS_API_KEY in your shell; do not commit secret values.".to_string(),
            format!("Starter actions after pack install: {}", STARTER_ACTIONS.join(", ")),
            "Use call_action with demo.echo, demo.needs_approval, or demo.fail_once for first-run checks.".to_string(),
        ],
    }
}

fn codex_template() -> AgentTemplate {
    AgentTemplate {
        name: "codex".to_string(),
        display_name: "Codex / Terminal Agent".to_string(),
        description: "CLI-first instructions for terminal-based coding agents.".to_string(),
        agent_type: "cli".to_string(),
        recommended_pack: STARTER_PACK.to_string(),
        generated_files: vec![GeneratedFile {
            relative_path: "AGENT.md".to_string(),
            content: codex_agent_markdown(),
        }],
        setup_commands: vec![
            "export IGRIS_API_URL and IGRIS_API_KEY locally".to_string(),
            "igris agents register --name codex_agent --agent-type codex --template-name codex".to_string(),
            "igris packs install starter".to_string(),
        ],
        verification_commands: vec![
            "igris agents list".to_string(),
            "igris packs list".to_string(),
            "igris actions run demo.echo --input '{\"message\":\"hello\"}' --idempotency-key starter-echo-codex-001".to_string(),
            "igris runs inspect <run_id>".to_string(),
        ],
        notes: vec![
            "Route external actions through Igris (CLI, REST, or MCP) instead of calling provider APIs directly.".to_string(),
            "Always pass an idempotency key for mutating runs.".to_string(),
        ],
    }
}

fn cursor_template() -> AgentTemplate {
    let mcp_config = serde_json::json!({
        "mcpServers": {
            "igris": {
                "command": "igris",
                "args": ["mcp", "serve"],
                "env": {
                    "IGRIS_API_URL": "",
                    "IGRIS_API_KEY": ""
                }
            }
        }
    });
    AgentTemplate {
        name: "cursor".to_string(),
        display_name: "Cursor".to_string(),
        description: "MCP and CLI setup for Cursor agents.".to_string(),
        agent_type: "mcp-or-cli".to_string(),
        recommended_pack: STARTER_PACK.to_string(),
        generated_files: vec![
            GeneratedFile {
                relative_path: ".cursor/mcp.json".to_string(),
                content: serde_json::to_string_pretty(&mcp_config).unwrap_or_default(),
            },
            GeneratedFile {
                relative_path: "SETUP.md".to_string(),
                content: cursor_setup_markdown(),
            },
        ],
        setup_commands: vec![
            "export IGRIS_API_URL and IGRIS_API_KEY".to_string(),
            "igris agents register --name cursor_agent --agent-type cursor --template-name cursor".to_string(),
            "Copy .cursor/mcp.json into your project root if Cursor MCP is enabled".to_string(),
            "igris packs install starter".to_string(),
        ],
        verification_commands: vec![
            "igris agents list".to_string(),
            "igris packs list".to_string(),
            "igris actions run demo.echo --input '{\"message\":\"hello\"}' --idempotency-key starter-echo-cursor-001".to_string(),
            "In Cursor MCP tools, call list_actions then call_action for demo.echo".to_string(),
        ],
        notes: vec![
            "If MCP config location differs in your Cursor version, use the CLI fallback in SETUP.md.".to_string(),
            format!("Starter actions: {}", STARTER_ACTIONS.join(", ")),
        ],
    }
}

fn custom_agent_template() -> AgentTemplate {
    AgentTemplate {
        name: "custom-agent".to_string(),
        display_name: "Custom Agent".to_string(),
        description: "Minimal REST and MCP instructions for any custom agent integration.".to_string(),
        agent_type: "http-or-mcp".to_string(),
        recommended_pack: STARTER_PACK.to_string(),
        generated_files: vec![GeneratedFile {
            relative_path: "INTEGRATION.md".to_string(),
            content: custom_agent_markdown(),
        }],
        setup_commands: vec![
            "export IGRIS_API_URL and IGRIS_API_KEY".to_string(),
            "igris agents register --name custom_agent --agent-type custom --template-name custom-agent".to_string(),
            "igris packs install starter".to_string(),
        ],
        verification_commands: vec![
            "igris agents list".to_string(),
            "curl -sS \"$IGRIS_API_URL/v1/actions\" -H \"Authorization: Bearer $IGRIS_API_KEY\"".to_string(),
            "igris actions run demo.echo --input '{\"message\":\"hello\"}' --idempotency-key starter-echo-custom-001".to_string(),
            "igris runs inspect <run_id>".to_string(),
        ],
        notes: vec![
            "Use POST /v1/actions/:name/run with Idempotency-Key header or body idempotency_key.".to_string(),
            "MCP alternative: igris mcp serve then call_action with the same input shape.".to_string(),
        ],
    }
}

fn claude_setup_markdown() -> String {
    r#"# Claude Code + Igris

1. Export `IGRIS_API_URL` and `IGRIS_API_KEY` in your shell (never commit values).
2. Install the starter pack: `igris packs install starter`
3. Merge `mcp-config.json` into Claude Code MCP settings.

The MCP server runs `igris mcp serve` on stdio. Claude should use:
- `list_actions`
- `call_action` (for example `demo.echo` with `{"message":"..."}` and an idempotency key)
- `get_run` / `get_run_evidence`

Suggested starter actions: demo.echo, demo.needs_approval, demo.fail_once.
"#
    .to_string()
}

fn codex_agent_markdown() -> String {
    r#"# Codex / Terminal Agent + Igris

Use Igris for external actions instead of calling provider APIs directly.

## Setup

```bash
export IGRIS_API_URL="https://overture.igrisinertial.com"
export IGRIS_API_KEY="<your-key>"
igris packs install starter
```

## Run a starter action

```bash
igris actions run demo.echo \
  --input '{"message":"hello"}' \
  --idempotency-key starter-echo-codex-001
```

## Inspect

```bash
igris runs inspect <run_id>
```

Always pass an idempotency key. Retry with the same key should return the same logical run.
"#
    .to_string()
}

fn cursor_setup_markdown() -> String {
    r#"# Cursor + Igris

## MCP path (preferred)

Place `.cursor/mcp.json` in your project root. Export `IGRIS_API_URL` and `IGRIS_API_KEY` before opening Cursor.

## CLI fallback

```bash
export IGRIS_API_URL="https://overture.igrisinertial.com"
export IGRIS_API_KEY="<your-key>"
igris packs install starter
igris actions run demo.echo --input '{"message":"hello"}' --idempotency-key starter-echo-cursor-001
igris runs inspect <run_id>
```

Verify MCP tools: `list_actions`, `call_action`, `get_run`, `get_run_evidence`.
"#
    .to_string()
}

fn custom_agent_markdown() -> String {
    r#"# Custom Agent + Igris

## REST: run a registered action

```bash
curl -sS -X POST "$IGRIS_API_URL/v1/actions/demo.echo/run" \
  -H "Authorization: Bearer $IGRIS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: starter-echo-custom-001" \
  -d '{"input":{"message":"hello"},"idempotency_key":"starter-echo-custom-001"}'
```

## Inspect a run

```bash
curl -sS "$IGRIS_API_URL/v1/actions/runs/<run_id>" \
  -H "Authorization: Bearer $IGRIS_API_KEY"
```

Or: `igris runs inspect <run_id>`

## MCP alternative

Run `igris mcp serve` and use `call_action` with the same `action_name`, `input`, and `idempotency_key`.

Use a fresh idempotency key per logical side effect. Do not send raw task definitions or runtime routing fields.
"#
    .to_string()
}

/// `igris templates list`
pub fn run_list() -> Result<()> {
    for template in builtin_templates() {
        println!(
            "{} ({}) — {}",
            template.display_name, template.name, template.description
        );
        println!("  agent_type: {}  recommended_pack: {}", template.agent_type, template.recommended_pack);
    }
    Ok(())
}

/// `igris templates show <name>`
pub fn run_show(name: &str) -> Result<()> {
    let template = get_template(name)?;
    println!("{} ({})", template.display_name, template.name);
    println!("Description: {}", template.description);
    println!("Agent type: {}", template.agent_type);
    println!("Recommended pack: {}", template.recommended_pack);
    println!();
    println!("Generated files:");
    for file in &template.generated_files {
        println!("  - {}", file.relative_path);
    }
    println!();
    println!("Setup:");
    for cmd in &template.setup_commands {
        println!("  {cmd}");
    }
    println!();
    println!("Verification:");
    for cmd in &template.verification_commands {
        println!("  {cmd}");
    }
    if !template.notes.is_empty() {
        println!();
        println!("Notes:");
        for note in &template.notes {
            println!("  - {note}");
        }
    }
    Ok(())
}

pub struct InstallOptions<'a> {
    pub name: &'a str,
    pub output: Option<&'a Path>,
    pub print: bool,
    pub dry_run: bool,
    pub install_pack: bool,
    pub api_url: Option<String>,
}

/// `igris templates install <name>`
pub async fn run_install(opts: InstallOptions<'_>) -> Result<()> {
    let template = get_template(opts.name)?;
    for file in &template.generated_files {
        validate_relative_output_path(&file.relative_path)?;
        validate_template_content(&file.content)?;
    }

    if opts.print {
        for file in &template.generated_files {
            println!("--- {} ---", file.relative_path);
            println!("{}", file.content);
            if !file.content.ends_with('\n') {
                println!();
            }
        }
        if opts.dry_run {
            println!("(dry-run: no files written)");
        }
        return Ok(());
    }

    let output_dir = match opts.output {
        Some(path) => validate_output_dir(path)?,
        None => {
            let dir = default_output_dir(opts.name)?;
            fs::create_dir_all(&dir)?;
            dir.canonicalize().context("could not canonicalize output dir")?
        }
    };

    if opts.dry_run {
        for file in &template.generated_files {
            let dest = output_dir.join(&file.relative_path);
            println!("would write: {}", dest.display());
        }
        return Ok(());
    }

    for file in &template.generated_files {
        let dest = output_dir.join(&file.relative_path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&dest, &file.content)
            .with_context(|| format!("could not write {}", dest.display()))?;
        println!("Wrote {}", dest.display());
    }

    if opts.install_pack {
        let api = resolve_api_url(&opts.api_url);
        match Client::new(&api) {
            Ok(client) => {
                let _ = client.list_action_packs().await;
                packs::run_install(&api, STARTER_PACK).await?;
            }
            Err(err) => {
                println!(
                    "Skipped starter pack install: {err}. Run `igris packs install starter` after exporting IGRIS_API_KEY."
                );
            }
        }
    } else {
        println!(
            "Next: export IGRIS_API_URL and IGRIS_API_KEY, then run `igris packs install starter` if needed."
        );
    }

    Ok(())
}

/// `igris templates verify <name>`
pub async fn run_verify(name: &str, api_url: Option<String>) -> Result<()> {
    let template = get_template(name)?;
    let api = resolve_api_url(&api_url);

    println!("Verifying template: {} ({})", template.display_name, template.name);
    println!("Recommended pack: {}", template.recommended_pack);
    println!();

    let key_present = std::env::var("IGRIS_API_KEY")
        .ok()
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    let url_present = std::env::var("IGRIS_API_URL")
        .ok()
        .map(|v| !v.trim().is_empty())
        .unwrap_or(true);

    if !key_present {
        println!("IGRIS_API_KEY is not set. Skipping live API checks.");
        println!();
        println!("Next steps:");
        for cmd in &template.setup_commands {
            println!("  {cmd}");
        }
        println!();
        println!("Then run:");
        for cmd in &template.verification_commands {
            println!("  {cmd}");
        }
        return Ok(());
    }

    let client = match Client::new(&api) {
        Ok(c) => c,
        Err(err) => {
            println!("Could not build API client: {err}");
            println!("Fix credentials and re-run `igris templates verify {name}`.");
            return Ok(());
        }
    };

    if let Err(err) = client.ping_authenticated().await {
        println!("API key check failed: {err}");
        println!("Set IGRIS_API_URL and a valid IGRIS_API_KEY, then retry.");
        return Ok(());
    }
    println!("API credentials accepted.");

    let packs_body = client.list_action_packs().await?;
    let pack_names: HashSet<String> = packs_body
        .get("packs")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|p| p.get("name").and_then(|n| n.as_str()))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    if pack_names.contains(STARTER_PACK) {
        println!("Starter Action Pack is available on the API.");
    } else {
        println!("Starter Action Pack not listed; run `igris packs install starter`.");
    }

    let actions_body = client.list_actions().await?;
    let action_names: HashSet<String> = actions_body
        .get("actions")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();

    let mut missing = Vec::new();
    for action in STARTER_ACTIONS {
        if !action_names.contains(*action) {
            missing.push(*action);
        }
    }
    if missing.is_empty() {
        println!("All starter actions are registered: {}", STARTER_ACTIONS.join(", "));
    } else {
        println!(
            "Missing starter actions: {}. Run `igris packs install starter`.",
            missing.join(", ")
        );
    }

    let expected_agent = recommended_agent_name(name);
    let agents_body = client.list_agents(false).await?;
    let agent_names: HashSet<String> = agents_body
        .get("agents")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    if agent_names.contains(&expected_agent) {
        println!("Registered agent found: {expected_agent}");
    } else {
        println!(
            "Registered agent {expected_agent} not found. Run `igris agents register --name {expected_agent} --agent-type {} --template-name {name}`.",
            recommended_agent_type(name)
        );
    }

    if !url_present {
        println!("Tip: export IGRIS_API_URL for consistent CLI and MCP configuration.");
    }

    println!();
    println!("Manual verification commands:");
    for cmd in &template.verification_commands {
        println!("  {cmd}");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_builtin_templates_validate() {
        for template in builtin_templates() {
            validate_template_name(&template.name).unwrap();
            for file in &template.generated_files {
                validate_relative_output_path(&file.relative_path).unwrap();
                validate_template_content(&file.content).unwrap();
            }
        }
    }

    #[test]
    fn rejects_unknown_template_name() {
        assert!(validate_template_name("evil-template").is_err());
    }

    #[test]
    fn rejects_path_traversal_in_relative_paths() {
        assert!(validate_relative_output_path("../escape.json").is_err());
        assert!(validate_relative_output_path("ok/nested.json").is_ok());
    }

    #[test]
    fn claude_code_mcp_config_uses_igris_command() {
        let template = get_template("claude-code").unwrap();
        let mcp = template
            .generated_files
            .iter()
            .find(|f| f.relative_path == "mcp-config.json")
            .unwrap();
        assert!(mcp.content.contains(r#""command": "igris""#));
        assert!(mcp.content.contains(r#""mcp""#));
        assert!(mcp.content.contains(r#""serve""#));
        assert!(mcp.content.contains("IGRIS_API_URL"));
        assert!(mcp.content.contains("IGRIS_API_KEY"));
        assert!(!mcp.content.contains("igris_"));
    }

    #[test]
    fn generated_content_rejects_forbidden_fields() {
        assert!(validate_template_content("tenant_id: abc").is_err());
        assert!(validate_template_content("normal safe content").is_ok());
    }

    #[test]
    fn codex_template_references_starter_pack_commands() {
        let template = get_template("codex").unwrap();
        let joined = template.generated_files[0].content.to_lowercase();
        assert!(joined.contains("igris packs install starter"));
        assert!(joined.contains("demo.echo"));
        assert!(joined.contains("idempotency"));
    }

    #[test]
    fn custom_agent_documents_rest_and_mcp() {
        let template = get_template("custom-agent").unwrap();
        let content = &template.generated_files[0].content;
        assert!(content.contains("/v1/actions/demo.echo/run"));
        assert!(content.contains("Idempotency-Key"));
        assert!(content.contains("call_action"));
    }
}