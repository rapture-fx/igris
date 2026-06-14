// Igris CLI — subcommands for the developer-facing task/proof flow.
//
// All commands talk to Overture's existing HTTP API and never to runtime
// internals directly. Authentication is an `igris_`-prefixed API key in
// the IGRIS_API_KEY env var; the same key the install script uses.
//
// Output is human-readable by default. Each command exits non-zero on
// failure modes the operator cares about: submit failure, task failure,
// proof verification failure, missing API key.

pub mod action_task;
pub mod actions_run;
pub mod api;
pub mod auth;
pub mod demo;
pub mod mcp;
pub mod packs;
pub mod receipts;
pub mod tasks;
pub mod templates;

use clap::Subcommand;

/// Default Overture base URL when --api-url is not passed and IGRIS_API_URL is unset.
pub const DEFAULT_API_BASE: &str = "https://api.igrisinertial.com";

/// Resolve the API base URL from (in order): explicit flag, IGRIS_API_URL env, default.
pub fn resolve_api_url(flag: &Option<String>) -> String {
    if let Some(v) = flag.as_ref().and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    }) {
        return v;
    }
    std::env::var("IGRIS_API_URL")
        .ok()
        .and_then(|v| {
            let t = v.trim().to_string();
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        })
        .unwrap_or_else(|| DEFAULT_API_BASE.to_string())
}

/// Resolve the console base URL the same way, but the default is empty so the
/// CLI prints no console link unless explicitly configured.
pub fn resolve_console_url(flag: &Option<String>) -> String {
    if let Some(v) = flag.as_ref().and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    }) {
        return v;
    }
    std::env::var("IGRIS_CONSOLE_URL").unwrap_or_default()
}

#[derive(Debug, Subcommand)]
pub enum AuthSub {
    /// Validate the configured API key against the Overture API.
    Login {
        #[arg(long)]
        api_url: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum TasksSub {
    /// Submit an Action Task V1 JSON file.
    Submit {
        /// Path to the task definition JSON file.
        file: String,
        /// Poll the task until it reaches a terminal state, printing progress.
        #[arg(long)]
        watch: bool,
        /// After completion, run proof verification and print the result.
        #[arg(long)]
        verify: bool,
        #[arg(long)]
        api_url: Option<String>,
        #[arg(long)]
        console_url: Option<String>,
    },
    /// Inspect a task — status, action evidence, runtime info, proof summary.
    Inspect {
        task_id: String,
        #[arg(long)]
        api_url: Option<String>,
        #[arg(long)]
        console_url: Option<String>,
    },
    /// Verify a task's signed receipt and chain link.
    Verify {
        task_id: String,
        #[arg(long)]
        api_url: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum ReceiptsSub {
    /// Verify a receipt by execution_id.
    Verify {
        execution_id: String,
        #[arg(long)]
        api_url: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum McpSub {
    /// Start the MCP server on stdio. Reads line-delimited JSON-RPC from
    /// stdin and writes responses to stdout. Stderr is for logs.
    Serve {
        #[arg(long)]
        api_url: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum RuntimeSub {
    /// Start the local runtime HTTP server.
    Start,
}

#[derive(Debug, Subcommand)]
pub enum ActionsSub {
    /// Validate and register an action manifest for this project.
    Register {
        /// Path to igris.actions.json.
        file: String,
    },
    /// List actions from a local manifest.
    List {
        /// Path to igris.actions.json.
        #[arg(default_value = "igris.actions.json")]
        file: String,
    },
    /// Run a registered action through the action gateway.
    Run {
        /// Registered action name (for example demo.echo).
        name: String,
        /// Inline JSON object or path to a JSON file used as action input.
        #[arg(long)]
        input: Option<String>,
        /// Idempotency key for the run.
        #[arg(long)]
        idempotency_key: Option<String>,
        #[arg(long)]
        api_url: Option<String>,
        #[arg(long)]
        console_url: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum TemplatesSub {
    /// List built-in agent templates.
    List,
    /// Show one template (files, setup, verification).
    Show {
        /// Template name (claude-code, codex, cursor, custom-agent).
        name: String,
    },
    /// Write or print template configuration files.
    Install {
        /// Template name.
        name: String,
        /// Output directory (default: .igris/templates/<name>).
        #[arg(long)]
        output: Option<String>,
        /// Print generated files to stdout instead of writing.
        #[arg(long)]
        print: bool,
        /// Show what would be written without creating files.
        #[arg(long)]
        dry_run: bool,
        /// Also run `igris packs install starter` when API credentials are set.
        #[arg(long)]
        install_pack: bool,
        #[arg(long)]
        api_url: Option<String>,
    },
    /// Verify starter pack/actions availability for a template.
    Verify {
        /// Template name.
        name: String,
        #[arg(long)]
        api_url: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum PacksSub {
    /// List built-in Action Packs.
    List {
        #[arg(long)]
        api_url: Option<String>,
    },
    /// Install a built-in Action Pack into the authenticated tenant.
    Install {
        /// Pack name (for example starter).
        name: String,
        #[arg(long)]
        api_url: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum RunsSub {
    /// Inspect a registered-action run by run_id/task_id.
    Inspect {
        run_id: String,
        #[arg(long)]
        api_url: Option<String>,
        #[arg(long)]
        console_url: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum SecretsSub {
    /// Placeholder for hosted/runtime secret storage.
    Set {
        /// Secret name, for example GITHUB_TOKEN.
        name: String,
    },
}

#[derive(Debug, Subcommand)]
pub enum DemoSub {
    /// Run the Action Task V1 proof demo end-to-end.
    ActionTask {
        /// Override path to the proof script. Defaults to repo location.
        #[arg(long, default_value = "scripts/action_task_v1_proof_demo.sh")]
        script: String,
        /// Watch mode is implicit in the demo script; flag is accepted for
        /// command-line parity with `tasks submit --watch`.
        #[arg(long)]
        watch: bool,
        /// Verify mode is implicit in the demo script; flag is accepted for
        /// command-line parity with `tasks submit --verify`.
        #[arg(long)]
        verify: bool,
        #[arg(long)]
        console_url: Option<String>,
    },
}

/// Default install directory used by the public installer.
pub fn default_install_dir() -> String {
    std::env::var("IGRIS_INSTALL_DIR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            std::env::var("HOME")
                .map(|home| format!("{}/.igris/bin", home.trim_end_matches('/')))
                .unwrap_or_else(|_| "~/.igris/bin".to_string())
        })
}

/// Build a console URL for a task, or None if no base is configured.
pub fn task_console_url(base: &str, task_id: &str) -> Option<String> {
    let trimmed = base.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }
    Some(format!("{}/execution/tasks/{}", trimmed, task_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_console_url_with_base() {
        assert_eq!(
            task_console_url("https://console.igrisinertial.com/", "task_abc"),
            Some("https://console.igrisinertial.com/execution/tasks/task_abc".to_string())
        );
    }

    #[test]
    fn task_console_url_strips_all_trailing_slashes() {
        assert_eq!(
            task_console_url("https://x.example///", "id").unwrap(),
            "https://x.example/execution/tasks/id".to_string()
        );
    }

    #[test]
    fn task_console_url_empty_returns_none() {
        assert!(task_console_url("", "id").is_none());
        assert!(task_console_url("   ", "id").is_none());
    }

    #[test]
    fn resolve_api_url_prefers_flag() {
        let got = resolve_api_url(&Some("https://flag.example".to_string()));
        assert_eq!(got, "https://flag.example");
    }

    #[test]
    fn resolve_api_url_falls_back_to_default() {
        // Note: IGRIS_API_URL might be set in the test env; this test only
        // asserts the function returns a non-empty URL when given None flag,
        // not the exact default value.
        let got = resolve_api_url(&None);
        assert!(!got.is_empty());
    }
}
