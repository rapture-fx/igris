/// File system operations tool (sandboxed)
use crate::{Tool, ToolResult};
use anyhow::Result;
use serde_json::json;
use std::path::{Component, Path};
use std::time::Instant;
use tokio::fs;
use tracing::debug;

/// File system tool
pub struct FileSystemTool {
    allowed_paths: Vec<String>,
}

impl FileSystemTool {
    /// Create a new filesystem tool with path whitelist
    pub fn new(allowed_paths: Vec<String>) -> Self {
        Self { allowed_paths }
    }

    /// Check if path is allowed
    fn is_path_allowed(&self, path: &str) -> bool {
        if self.allowed_paths.is_empty() {
            return false; // Default deny
        }

        let p = match normalize_no_parent(path) {
            Some(p) => p,
            None => return false,
        };

        self.allowed_paths.iter().any(|allowed| {
            // Also ensure allowed entries don't include traversal.
            if normalize_no_parent(allowed).is_none() {
                return false;
            }
            p.starts_with(allowed)
        })
    }
}

fn normalize_no_parent(p: &str) -> Option<&str> {
    let path = Path::new(p);
    for c in path.components() {
        match c {
            Component::ParentDir => return None,
            Component::Prefix(_) => {}
            _ => {}
        }
    }
    Some(p)
}

#[async_trait::async_trait]
impl Tool for FileSystemTool {
    fn name(&self) -> &str {
        "filesystem"
    }

    fn description(&self) -> &str {
        "Read, write, and list files (sandboxed to allowed paths)"
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["read", "write", "list"],
                    "description": "Filesystem operation"
                },
                "path": {
                    "type": "string",
                    "description": "File or directory path"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write (for write operation)"
                }
            },
            "required": ["operation", "path"]
        })
    }

    async fn validate_args(&self, args: &serde_json::Value) -> Result<()> {
        let path = args["path"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'path' field"))?;

        if !self.is_path_allowed(path) {
            anyhow::bail!("Path not allowed. Allowed paths: {:?}", self.allowed_paths);
        }

        Ok(())
    }

    async fn execute(&self, args: serde_json::Value) -> Result<ToolResult> {
        let start = Instant::now();

        self.validate_args(&args).await?;

        let operation = args["operation"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'operation' field"))?;
        let path = args["path"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'path' field"))?;

        debug!("Filesystem operation: {} on {}", operation, path);

        match operation {
            "read" => match fs::read_to_string(path).await {
                Ok(content) => {
                    let execution_time = start.elapsed().as_millis() as u64;
                    Ok(
                        ToolResult::success("filesystem".to_string(), content, execution_time)
                            .with_metadata("operation".to_string(), "read".to_string())
                            .with_metadata("path".to_string(), path.to_string()),
                    )
                }
                Err(e) => {
                    let execution_time = start.elapsed().as_millis() as u64;
                    Ok(ToolResult::failure(
                        "filesystem".to_string(),
                        format!("Failed to read file: {}", e),
                        execution_time,
                    ))
                }
            },
            "write" => {
                let content = args["content"]
                    .as_str()
                    .ok_or_else(|| anyhow::anyhow!("Missing 'content' field for write"))?;

                match fs::write(path, content).await {
                    Ok(_) => {
                        let execution_time = start.elapsed().as_millis() as u64;
                        Ok(ToolResult::success(
                            "filesystem".to_string(),
                            format!("Successfully wrote {} bytes", content.len()),
                            execution_time,
                        )
                        .with_metadata("operation".to_string(), "write".to_string())
                        .with_metadata("path".to_string(), path.to_string())
                        .with_metadata("bytes_written".to_string(), content.len().to_string()))
                    }
                    Err(e) => {
                        let execution_time = start.elapsed().as_millis() as u64;
                        Ok(ToolResult::failure(
                            "filesystem".to_string(),
                            format!("Failed to write file: {}", e),
                            execution_time,
                        ))
                    }
                }
            }
            "list" => {
                let path_obj = Path::new(path);
                if !path_obj.is_dir() {
                    let execution_time = start.elapsed().as_millis() as u64;
                    return Ok(ToolResult::failure(
                        "filesystem".to_string(),
                        "Path is not a directory".to_string(),
                        execution_time,
                    ));
                }

                match fs::read_dir(path).await {
                    Ok(mut entries) => {
                        let mut files = Vec::new();
                        while let Ok(Some(entry)) = entries.next_entry().await {
                            if let Ok(file_name) = entry.file_name().into_string() {
                                files.push(file_name);
                            }
                        }

                        let execution_time = start.elapsed().as_millis() as u64;
                        Ok(ToolResult::success(
                            "filesystem".to_string(),
                            files.join("\n"),
                            execution_time,
                        )
                        .with_metadata("operation".to_string(), "list".to_string())
                        .with_metadata("path".to_string(), path.to_string())
                        .with_metadata("file_count".to_string(), files.len().to_string()))
                    }
                    Err(e) => {
                        let execution_time = start.elapsed().as_millis() as u64;
                        Ok(ToolResult::failure(
                            "filesystem".to_string(),
                            format!("Failed to list directory: {}", e),
                            execution_time,
                        ))
                    }
                }
            }
            _ => {
                let execution_time = start.elapsed().as_millis() as u64;
                Ok(ToolResult::failure(
                    "filesystem".to_string(),
                    format!("Unsupported operation: {}", operation),
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
    fn test_path_whitelist() {
        let tool = FileSystemTool::new(vec![
            "/tmp/safe".to_string(),
            "/home/user/documents".to_string(),
        ]);

        assert!(tool.is_path_allowed("/tmp/safe/file.txt"));
        assert!(tool.is_path_allowed("/home/user/documents/test.md"));
        assert!(!tool.is_path_allowed("/etc/passwd"));
        assert!(!tool.is_path_allowed("/root/secret"));
    }

    #[test]
    fn test_empty_whitelist() {
        let tool = FileSystemTool::new(vec![]);
        assert!(!tool.is_path_allowed("/any/path"));
    }
}
