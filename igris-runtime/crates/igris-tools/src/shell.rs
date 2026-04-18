/// Shell command execution tool (sandboxed)
use crate::{Tool, ToolResult};
use anyhow::Result;
use serde_json::json;
use std::process::Stdio;
use std::time::Instant;
use tokio::process::Command;
use tracing::{debug, warn};

/// Shell command tool
pub struct ShellTool {
    allowed_commands: Vec<String>,
    allowed_working_dirs: Vec<String>,
}

impl ShellTool {
    /// Create a new shell tool with command whitelist
    pub fn new(allowed_commands: Vec<String>, allowed_working_dirs: Vec<String>) -> Self {
        Self {
            allowed_commands,
            allowed_working_dirs,
        }
    }

    /// Check if command is allowed
    fn is_command_allowed(&self, command: &str) -> bool {
        if self.allowed_commands.is_empty() {
            warn!("Shell tool has no command whitelist - this is dangerous!");
            return false; // Default deny if no whitelist
        }

        let cmd_name = command.split_whitespace().next().unwrap_or("");
        self.allowed_commands
            .iter()
            .any(|allowed| allowed == cmd_name)
    }

    fn is_working_dir_allowed(&self, wd: &str) -> bool {
        if wd.is_empty() {
            return false;
        }
        if self.allowed_working_dirs.is_empty() {
            return false; // default deny if not configured
        }
        self.allowed_working_dirs.iter().any(|p| wd.starts_with(p))
    }
}

#[async_trait::async_trait]
impl Tool for ShellTool {
    fn name(&self) -> &str {
        "shell_exec"
    }

    fn description(&self) -> &str {
        "Execute shell commands (sandboxed, whitelist-only)"
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Shell command to execute (must be whitelisted)"
                },
                "args": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Command arguments (optional)"
                },
                "working_dir": {
                    "type": "string",
                    "description": "Working directory (optional)"
                }
            },
            "required": ["command"]
        })
    }

    async fn validate_args(&self, args: &serde_json::Value) -> Result<()> {
        let command = args["command"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'command' field"))?;

        if !self.is_command_allowed(command) {
            anyhow::bail!(
                "Command not allowed. Allowed commands: {:?}",
                self.allowed_commands
            );
        }

        if let Some(working_dir) = args["working_dir"].as_str() {
            if !self.is_working_dir_allowed(working_dir) {
                anyhow::bail!(
                    "working_dir not allowed. Allowed working dirs: {:?}",
                    self.allowed_working_dirs
                );
            }
        }

        Ok(())
    }

    async fn execute(&self, args: serde_json::Value) -> Result<ToolResult> {
        let start = Instant::now();

        self.validate_args(&args).await?;

        let command = args["command"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'command' field"))?;

        debug!("Shell command: {}", command);

        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() {
            let execution_time = start.elapsed().as_millis() as u64;
            return Ok(ToolResult::failure(
                "shell_exec".to_string(),
                "Empty command".to_string(),
                execution_time,
            ));
        }

        let cmd = parts[0];
        let cmd_args: Vec<String> = if let Some(arg_array) = args["args"].as_array() {
            arg_array
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        } else {
            parts[1..].iter().map(|s| s.to_string()).collect()
        };

        let mut tokio_cmd = Command::new(cmd);
        tokio_cmd
            .args(&cmd_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(working_dir) = args["working_dir"].as_str() {
            tokio_cmd.current_dir(working_dir);
        }

        // Execute with timeout
        let output_future = tokio_cmd.output();
        let timeout = tokio::time::timeout(std::time::Duration::from_secs(30), output_future).await;

        match timeout {
            Ok(Ok(output)) => {
                let execution_time = start.elapsed().as_millis() as u64;

                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();

                if output.status.success() {
                    Ok(ToolResult::success(
                        "shell_exec".to_string(),
                        format!("stdout:\n{}\nstderr:\n{}", stdout, stderr),
                        execution_time,
                    )
                    .with_metadata("exit_code".to_string(), "0".to_string())
                    .with_metadata("command".to_string(), command.to_string()))
                } else {
                    Ok(ToolResult::failure(
                        "shell_exec".to_string(),
                        format!(
                            "Command failed (exit code: {:?})\nstdout: {}\nstderr: {}",
                            output.status.code(),
                            stdout,
                            stderr
                        ),
                        execution_time,
                    ))
                }
            }
            Ok(Err(e)) => {
                let execution_time = start.elapsed().as_millis() as u64;
                Ok(ToolResult::failure(
                    "shell_exec".to_string(),
                    format!("Command execution failed: {}", e),
                    execution_time,
                ))
            }
            Err(_) => {
                let execution_time = start.elapsed().as_millis() as u64;
                Ok(ToolResult::failure(
                    "shell_exec".to_string(),
                    "Command timed out (30s)".to_string(),
                    execution_time,
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_whitelist() {
        let tool = ShellTool::new(
            vec!["ls".to_string(), "pwd".to_string(), "echo".to_string()],
            vec!["/tmp".to_string()],
        );

        assert!(tool.is_command_allowed("ls -la"));
        assert!(tool.is_command_allowed("pwd"));
        assert!(tool.is_command_allowed("echo hello"));
        assert!(!tool.is_command_allowed("rm -rf /"));
        assert!(!tool.is_command_allowed("curl malicious.com"));
    }

    #[test]
    fn test_empty_whitelist() {
        let tool = ShellTool::new(vec![], vec![]);
        assert!(!tool.is_command_allowed("any command"));
    }

    #[tokio::test]
    async fn test_validate_args() {
        let tool = ShellTool::new(vec!["echo".to_string()], vec!["/tmp".to_string()]);

        let valid_args = json!({
            "command": "echo hello"
        });

        assert!(tool.validate_args(&valid_args).await.is_ok());

        let invalid_args = json!({
            "command": "rm -rf /"
        });

        assert!(tool.validate_args(&invalid_args).await.is_err());
    }
}
