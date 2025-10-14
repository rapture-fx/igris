//! JSON Output Writer Utility
//!
//! Handles persistent storage of proposal JSON files with proper directory
//! management, naming conventions, and cleanup capabilities.
//!
//! # Features
//! - Atomic file writing with temporary files
//! - Automatic directory creation
//! - File naming with unique IDs and timestamps
//! - Configurable retention policies

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

/// JSON file writer for proposal persistence
pub struct JsonWriter {
    output_dir: PathBuf,
}

impl JsonWriter {
    /// Create a new JSON writer with specified output directory
    pub fn new(output_dir: &str) -> Result<Self, String> {
        let output_path = PathBuf::from(output_dir);
        
        // Ensure output directory exists
        if let Err(e) = fs::create_dir_all(&output_path) {
            return Err(format!("Failed to create output directory {}: {}", output_dir, e));
        }

        Ok(JsonWriter {
            output_dir: output_path,
        })
    }

    /// Write any serializable object to a JSON file
    pub fn write_json_file<T>(&self, file_name: &str, data: &T) -> Result<(), String>
    where
        T: Serialize,
    {
        let json_content = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

        let file_path = self.output_dir.join(file_name);
        self.write_json_string(&file_path, &json_content)
    }

    /// Write JSON string content to file with atomic write
    fn write_json_string(&self, file_path: &Path, content: &str) -> Result<(), String> {
        // Create temporary file path
        let temp_path = file_path.with_extension("tmp");
        
        // Write to temporary file
        {
            let mut file = fs::File::create(&temp_path)
                .map_err(|e| format!("Failed to create temp file {:?}: {}", temp_path, e))?;
            
            file.write_all(content.as_bytes())
                .map_err(|e| format!("Failed to write to temp file {:?}: {}", temp_path, e))?;
        }

        // Atomically move temporary file to final location
        fs::rename(&temp_path, file_path)
            .map_err(|e| format!("Failed to rename temp file to final location: {}", e))?;

        Ok(())
    }

    /// Write proposal with automatic timestamped filename
    pub fn write_proposal<T>(&self, proposal: &T) -> Result<String, String>
    where
        T: Serialize,
    {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let file_name = format!("proposal_{}.json", timestamp);
        let file_path = self.output_dir.join(&file_name);
        
        self.write_json_file(&file_name, proposal)?;
        
        Ok(file_path.into_os_string().into_string().unwrap_or_default())
    }

    /// Write multiple proposals to a single file
    pub fn write_proposal_batch<T>(&self, proposals: &[T], batch_name: &str) -> Result<String, String>
    where
        T: Serialize,
    {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let file_name = format!("batch_{}_{}.json", batch_name, timestamp);
        let file_path = self.output_dir.join(&file_name);
        
        self.write_json_file(&file_path, proposals)?;
        
        Ok(file_path.into_os_string().into_string().unwrap_or_default())
    }

    /// Read JSON from file
    pub fn read_json_file<T>(&self, file_name: &str) -> Result<T, String>
    where
        T: for<'de> Deserialize<'de>,
    {
        let file_path = self.output_dir.join(file_name);
        
        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file {:?}: {}", file_path, e))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse JSON from {:?}: {}", file_path, e))
    }

    /// List all JSON files in the output directory
    pub fn list_json_files(&self) -> Result<Vec<String>, String> {
        let mut json_files = Vec::new();

        if !self.output_dir.exists() {
            return Ok(json_files);
        }

        for entry in fs::read_dir(&self.output_dir)
            .map_err(|e| format!("Failed to read directory {:?}: {}", self.output_dir, e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    json_files.push(file_name.to_string());
                }
            }
        }

        json_files.sort();
        Ok(json_files)
    }

    /// Clean up old files based on retention time
    pub fn cleanup_old_files(&self, retention_hours: u64) -> Result<usize, String> {
        let cutoff_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64 - (retention_hours * 3600 * 1000);

        let mut removed_count = 0;

        if !self.output_dir.exists() {
            return Ok(0);
        }

        for entry in fs::read_dir(&self.output_dir)
            .map_err(|e| format!("Failed to read directory {:?}: {}", self.output_dir, e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }

            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    let modified_ms = modified.duration_since(UNIX_EPOCH)
                        .unwrap_or(std::time::Duration::ZERO)
                        .as_millis() as u64;

                    if modified_ms < cutoff_ms {
                        if let Err(e) = fs::remove_file(&path) {
                            eprintln!("Failed to remove old file {:?}: {}", path, e);
                        } else {
                            removed_count += 1;
                        }
                    }
                }
            }
        }

        Ok(removed_count)
    }

    /// Get total size of all JSON files in bytes
    pub fn get_total_size(&self) -> Result<u64, String> {
        if !self.output_dir.exists() {
            return Ok(0);
        }

        let mut total_size = 0;

        for entry in fs::read_dir(&self.output_dir)
            .map_err(|e| format!("Failed to read directory {:?}: {}", self.output_dir, e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(metadata) = fs::metadata(&path) {
                    total_size += metadata.len();
                }
            }
        }

        Ok(total_size)
    }

    /// Get file count
    pub fn get_file_count(&self) -> Result<usize, String> {
        let files = self.list_json_files()?;
        Ok(files.len())
    }

    /// Get output directory path
    pub fn output_dir(&self) -> &Path {
        &self.output_dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;

    #[test]
    fn test_json_writer_creation() {
        let temp_dir = "/tmp/test_json_writer";
        let writer = JsonWriter::new(temp_dir).unwrap();
        assert!(writer.output_dir().exists());
        
        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_write_and_read_json() {
        let temp_dir = "/tmp/test_json_write";
        let writer = JsonWriter::new(temp_dir).unwrap();

        let test_data = json!({
            "name": "test_proposal",
            "confidence": 0.95,
            "action": "increase_batch_size"
        });

        let file_name = "test_proposal.json";
        writer.write_json_file(file_name, &test_data).unwrap();

        // Read it back
        let read_data: serde_json::Value = writer.read_json_file(file_name).unwrap();
        assert_eq!(read_data["name"], "test_proposal");
        assert_eq!(read_data["confidence"], 0.95);

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_proposal_writing() {
        let temp_dir = "/tmp/test_proposal_write";
        let writer = JsonWriter::new(temp_dir).unwrap();

        let proposal = json!({
            "proposal": "test",
            "timestamp": 1234567890
        });

        let file_path = writer.write_proposal(&proposal).unwrap();
        assert!(file_path.contains("proposal_"));
        assert!(file_path.ends_with(".json"));

        // Should list the new file
        let files = writer.list_json_files().unwrap();
        assert!(files.iter().any(|f| f.starts_with("proposal_")));

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_batch_proposal_writing() {
        let temp_dir = "/tmp/test_batch_write";
        let writer = JsonWriter::new(temp_dir).unwrap();

        let proposals = vec![
            json!({"id": 1, "name": "first"}),
            json!({"id": 2, "name": "second"})
        ];

        let file_path = writer.write_proposal_batch(&proposals, "batch_test").unwrap();
        assert!(file_path.contains("batch_batch_test_"));

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_file_operations() {
        let temp_dir = "/tmp/test_file_ops";
        let writer = JsonWriter::new(temp_dir).unwrap();

        // Write some test files
        for i in 0..5 {
            let data = json!({
                "id": i,
                "content": format!("file_{}", i)
            });
            let file_name = format!("test_{}.json", i);
            writer.write_json_file(&file_name, &data).unwrap();
        }

        // Test file count
        let count = writer.get_file_count().unwrap();
        assert_eq!(count, 5);

        // Test file listing
        let files = writer.list_json_files().unwrap();
        assert_eq!(files.len(), 5);
        assert!(files.iter().any(|f| f == "test_0.json"));

        // Test cleanup (0 retention - remove all)
        let removed = writer.cleanup_old_files(0).unwrap();
        assert_eq!(removed, 5);

        // Verify files are removed
        let count_after_cleanup = writer.get_file_count().unwrap();
        assert_eq!(count_after_cleanup, 0);

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_size_calculation() {
        let temp_dir = "/tmp/test_size_calc";
        let writer = JsonWriter::new(temp_dir).unwrap();

        // Write a test file
        let data = json!({
            "content": "This is test content for size calculation"
        });
        writer.write_json_file("size_test.json", &data).unwrap();

        let total_size = writer.get_total_size().unwrap();
        assert!(total_size > 0);

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }
}
