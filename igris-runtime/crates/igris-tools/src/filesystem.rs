/// File system operations tool (sandboxed)
use crate::{
    safe_content_output, safe_empty_output, safe_error_message, safe_file_metadata, Tool,
    ToolResult,
};
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
            anyhow::bail!("path_not_allowed");
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

        debug!("Filesystem operation: {}", operation);

        match operation {
            "read" => match fs::read_to_string(path).await {
                Ok(content) => {
                    let execution_time = start.elapsed().as_millis() as u64;
                    let bytes_read = content.as_bytes().len();
                    let content_digest = crate::sha256_hex(content.as_bytes());
                    let output = safe_content_output(
                        "filesystem.read",
                        "read_file",
                        "success",
                        content.as_bytes(),
                        Some("text/plain"),
                        "file content redacted",
                        safe_file_metadata(path, json!({ "read_success": true })),
                    );
                    Ok(
                        ToolResult::success("filesystem".to_string(), output, execution_time)
                            .with_metadata("operation".to_string(), "read".to_string())
                            .with_metadata("content_redacted".to_string(), "true".to_string())
                            .with_metadata("bytes_read".to_string(), bytes_read.to_string())
                            .with_metadata("content_bytes".to_string(), bytes_read.to_string())
                            .with_metadata("content_digest".to_string(), content_digest.clone())
                            .with_metadata("content_digest_sha256".to_string(), content_digest),
                    )
                }
                Err(e) => {
                    let execution_time = start.elapsed().as_millis() as u64;
                    Ok(ToolResult::failure(
                        "filesystem".to_string(),
                        safe_error_message(filesystem_error_code(&e)),
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
                            safe_empty_output(
                                "filesystem.write",
                                "write_file",
                                "success",
                                "file write completed",
                                safe_file_metadata(path, json!({ "bytes_written": content.len() })),
                            ),
                            execution_time,
                        )
                        .with_metadata("operation".to_string(), "write".to_string())
                        .with_metadata("bytes_written".to_string(), content.len().to_string()))
                    }
                    Err(e) => {
                        let execution_time = start.elapsed().as_millis() as u64;
                        Ok(ToolResult::failure(
                            "filesystem".to_string(),
                            safe_error_message(filesystem_error_code(&e)),
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
                        safe_error_message("not_directory"),
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
                            safe_empty_output(
                                "filesystem.list",
                                "list_directory",
                                "success",
                                "directory listing redacted",
                                safe_file_metadata(path, json!({ "entry_count": files.len() })),
                            ),
                            execution_time,
                        )
                        .with_metadata("operation".to_string(), "list".to_string())
                        .with_metadata("file_count".to_string(), files.len().to_string()))
                    }
                    Err(e) => {
                        let execution_time = start.elapsed().as_millis() as u64;
                        Ok(ToolResult::failure(
                            "filesystem".to_string(),
                            safe_error_message(filesystem_error_code(&e)),
                            execution_time,
                        ))
                    }
                }
            }
            _ => {
                let execution_time = start.elapsed().as_millis() as u64;
                Ok(ToolResult::failure(
                    "filesystem".to_string(),
                    safe_error_message("unsupported_operation"),
                    execution_time,
                ))
            }
        }
    }
}

fn filesystem_error_code(error: &std::io::Error) -> &'static str {
    match error.kind() {
        std::io::ErrorKind::NotFound => "not_found",
        std::io::ErrorKind::PermissionDenied => "permission_denied",
        std::io::ErrorKind::InvalidInput => "invalid_input",
        _ => "filesystem_error",
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

    #[tokio::test]
    async fn test_read_emits_safe_result_envelope() {
        let dir = std::env::temp_dir().join(format!("igris-tools-fs-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("input.txt");
        let contents = "igris action task v1 — IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET\n";
        std::fs::write(&file, contents).unwrap();

        let tool = FileSystemTool::new(vec![dir.to_string_lossy().to_string()]);
        let result = tool
            .execute(json!({ "operation": "read", "path": file.to_string_lossy() }))
            .await
            .unwrap();
        assert!(result.success);

        // Safe result envelope: byte count + digest, never the contents.
        assert_eq!(
            result.metadata.get("bytes_read").map(String::as_str),
            Some(contents.as_bytes().len().to_string().as_str())
        );
        assert_eq!(
            result.metadata.get("content_digest").map(String::as_str),
            Some(crate::sha256_hex(contents.as_bytes()).as_str())
        );
        assert!(!result
            .output
            .contains("IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"));
        assert!(!result.output.contains(file.to_string_lossy().as_ref()));
        assert!(result.output.contains("\"content_redacted\":true"));
        assert!(result.output.contains("\"content_digest_sha256\""));
        assert!(result.output.contains("\"redaction_policy_version\""));

        // The metadata must not leak the file contents.
        for value in result.metadata.values() {
            assert!(
                !value.contains("IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"),
                "metadata leaked file contents: {value}"
            );
        }

        let _ = std::fs::remove_dir_all(&dir);
    }
}
