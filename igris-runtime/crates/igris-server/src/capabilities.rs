//! Agent capability model (Phase 2).
//!
//! `AgentCapabilities` defines what operations an agent is permitted to
//! perform.  The supervisor validates capabilities before the worker executes
//! any tool.  Violations produce a signed, hash-chained `CapabilityViolation`
//! record appended to the violation log.

#![allow(dead_code)]

use base64::Engine;
use ed25519_dalek::Signer;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// AgentCapabilities
// ─────────────────────────────────────────────────────────────────────────────

/// Per-execution capability grant forwarded with each agent execution request.
///
/// Fields are additive: a capability not granted is denied by default.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentCapabilities {
    /// Agent may make outbound HTTP requests.
    #[serde(default)]
    pub allow_http: bool,
    /// Agent may execute shell commands.
    #[serde(default)]
    pub allow_shell: bool,
    /// Agent may read/write the filesystem.
    #[serde(default)]
    pub allow_filesystem: bool,
    /// Maximum cumulative bytes writable per execution (0 = no extra limit
    /// beyond `allow_filesystem`).
    #[serde(default)]
    pub max_file_write_bytes: u64,
    /// Allowlisted HTTP domains for this agent (overrides tool-level config
    /// when non-empty; empty = delegate to existing `ToolConfig`).
    #[serde(default)]
    pub allowed_http_domains: Vec<String>,
}

impl AgentCapabilities {
    /// Check whether an outbound HTTP request to `url` is permitted.
    pub fn check_http(&self, url: &str) -> Result<(), CapabilityViolationKind> {
        if !self.allow_http {
            return Err(CapabilityViolationKind::HttpNotAllowed);
        }
        if !self.allowed_http_domains.is_empty() {
            let host = extract_url_host(url).unwrap_or_default();
            let ok = self
                .allowed_http_domains
                .iter()
                .any(|d| d == &host || host.ends_with(&format!(".{}", d)));
            if !ok {
                return Err(CapabilityViolationKind::HttpDomainNotAllowed);
            }
        }
        Ok(())
    }

    /// Check whether shell execution is permitted.
    pub fn check_shell(&self) -> Result<(), CapabilityViolationKind> {
        if !self.allow_shell {
            return Err(CapabilityViolationKind::ShellNotAllowed);
        }
        Ok(())
    }

    /// Check whether reading/listing the filesystem is permitted.
    pub fn check_filesystem_read(&self) -> Result<(), CapabilityViolationKind> {
        if !self.allow_filesystem {
            return Err(CapabilityViolationKind::FilesystemNotAllowed);
        }
        Ok(())
    }

    /// Check whether writing `bytes` to the filesystem is permitted.
    ///
    /// The caller is responsible for accumulating total bytes written and
    /// calling this before each write operation.
    pub fn check_filesystem_write(&self, bytes: u64) -> Result<(), CapabilityViolationKind> {
        if !self.allow_filesystem {
            return Err(CapabilityViolationKind::FilesystemNotAllowed);
        }
        if self.max_file_write_bytes > 0 && bytes > self.max_file_write_bytes {
            return Err(CapabilityViolationKind::FilesystemWriteLimitExceeded);
        }
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Violation types
// ─────────────────────────────────────────────────────────────────────────────

/// Discriminant for capability violation records.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityViolationKind {
    HttpNotAllowed,
    ShellNotAllowed,
    FilesystemNotAllowed,
    FilesystemWriteLimitExceeded,
    HttpDomainNotAllowed,
}

impl std::fmt::Display for CapabilityViolationKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::HttpNotAllowed => "HttpNotAllowed",
            Self::ShellNotAllowed => "ShellNotAllowed",
            Self::FilesystemNotAllowed => "FilesystemNotAllowed",
            Self::FilesystemWriteLimitExceeded => "FilesystemWriteLimitExceeded",
            Self::HttpDomainNotAllowed => "HttpDomainNotAllowed",
        };
        write!(f, "{}", s)
    }
}

/// A signed, hash-chained capability violation record.
///
/// Uses the same chaining scheme as `ViolationRecord` in `runtime_execute`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityViolation {
    pub id: String,
    pub agent_id: String,
    pub timestamp: String,
    pub violation_kind: CapabilityViolationKind,
    pub detail: String,
    pub previous_hash: String,
    pub hash: String,
    /// Ed25519 signature (base64) over SHA-256 of canonical BTreeMap JSON.
    pub signature: String,
}

impl CapabilityViolation {
    /// Build and sign a new violation record.
    ///
    /// `previous_hash` should be the `hash` field of the preceding record in
    /// the log, or an empty string for the first entry.
    pub fn new(
        agent_id: &str,
        kind: CapabilityViolationKind,
        detail: &str,
        previous_hash: &str,
        signing_key: Option<&Arc<ed25519_dalek::SigningKey>>,
    ) -> Self {
        let id = Uuid::new_v4().to_string();
        let timestamp = cap_iso8601_now();

        // Canonical JSON: BTreeMap guarantees stable key ordering.
        let mut map = BTreeMap::new();
        map.insert("id", id.clone());
        map.insert("agent_id", agent_id.to_string());
        map.insert("timestamp", timestamp.clone());
        map.insert("violation_kind", kind.to_string());
        map.insert("detail", detail.to_string());
        map.insert("previous_hash", previous_hash.to_string());

        let canonical = serde_json::to_string(&map).unwrap_or_default();
        let digest = Sha256::digest(canonical.as_bytes());
        let hash = format!("{:x}", digest);

        let signature = signing_key
            .map(|sk| {
                let sig = sk.sign(&digest);
                base64::engine::general_purpose::STANDARD.encode(sig.to_bytes())
            })
            .unwrap_or_default();

        Self {
            id,
            agent_id: agent_id.to_string(),
            timestamp,
            violation_kind: kind,
            detail: detail.to_string(),
            previous_hash: previous_hash.to_string(),
            hash,
            signature,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn extract_url_host(url: &str) -> Option<String> {
    let rest = url
        .trim()
        .strip_prefix("https://")
        .or_else(|| url.trim().strip_prefix("http://"))?;
    let authority = rest.split('/').next().unwrap_or("");
    let authority = authority.split('@').last().unwrap_or(authority);
    let host = authority.split(':').next().unwrap_or(authority);
    if host.is_empty() {
        None
    } else {
        Some(host.to_string())
    }
}

/// Minimal RFC3339 UTC timestamp — mirrors `iso8601_now()` in runtime_execute.
fn cap_iso8601_now() -> String {
    use crate::runtime_execute::iso8601_now;
    iso8601_now()
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn default_caps() -> AgentCapabilities {
        AgentCapabilities {
            allow_http: true,
            allow_shell: false,
            allow_filesystem: true,
            max_file_write_bytes: 1_024,
            allowed_http_domains: vec!["example.com".to_string()],
        }
    }

    #[test]
    fn http_allowed_for_permitted_domain() {
        let caps = default_caps();
        assert!(caps.check_http("https://example.com/api").is_ok());
        assert!(caps.check_http("https://sub.example.com/").is_ok());
    }

    #[test]
    fn http_blocked_for_forbidden_domain() {
        let caps = default_caps();
        assert_eq!(
            caps.check_http("https://evil.com/steal"),
            Err(CapabilityViolationKind::HttpDomainNotAllowed)
        );
    }

    #[test]
    fn http_blocked_when_not_allowed() {
        let caps = AgentCapabilities::default();
        assert_eq!(
            caps.check_http("https://example.com"),
            Err(CapabilityViolationKind::HttpNotAllowed)
        );
    }

    #[test]
    fn shell_blocked_when_not_allowed() {
        let caps = default_caps();
        assert_eq!(
            caps.check_shell(),
            Err(CapabilityViolationKind::ShellNotAllowed)
        );
    }

    #[test]
    fn filesystem_write_limit_enforced() {
        let caps = default_caps();
        assert!(caps.check_filesystem_write(500).is_ok());
        assert_eq!(
            caps.check_filesystem_write(2_048),
            Err(CapabilityViolationKind::FilesystemWriteLimitExceeded)
        );
    }

    #[test]
    fn filesystem_blocked_when_not_allowed() {
        let caps = AgentCapabilities::default();
        assert_eq!(
            caps.check_filesystem_write(1),
            Err(CapabilityViolationKind::FilesystemNotAllowed)
        );
    }

    #[test]
    fn capability_violation_hash_chaining() {
        let v1 = CapabilityViolation::new(
            "agent-1",
            CapabilityViolationKind::ShellNotAllowed,
            "attempted shell exec",
            "",
            None,
        );
        let v2 = CapabilityViolation::new(
            "agent-1",
            CapabilityViolationKind::HttpNotAllowed,
            "attempted http",
            &v1.hash,
            None,
        );
        assert_eq!(v2.previous_hash, v1.hash);
        assert!(!v1.hash.is_empty());
        assert!(!v2.hash.is_empty());
        assert_ne!(v1.hash, v2.hash);
    }
}
