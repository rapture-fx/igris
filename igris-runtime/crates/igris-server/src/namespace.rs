//! Per-agent filesystem namespace isolation (Phase 1).
//!
//! Provisions an isolated root directory for each agent at
//!   `/var/lib/igris/agents/{agent_id}/`
//! with permissions 0700 (owner-only).
//!
//! On Linux the supervisor optionally calls `unshare(CLONE_NEWNS)` to enter a
//! fresh mount namespace before the worker process starts, so bind-mounts can
//! be used to restrict the worker's view of the filesystem.  This step is
//! silently skipped on macOS / other platforms (graceful degradation).

#![allow(dead_code)]

use anyhow::Result;
use std::path::PathBuf;
use tracing::info;

/// Isolation context provisioned for one agent instance.
#[derive(Debug, Clone)]
pub struct AgentNamespace {
    /// Logical agent identifier.
    pub agent_id: String,
    /// Isolated root directory on the host filesystem.
    pub root_dir: PathBuf,
    /// Whether a Linux mount namespace was successfully entered for this agent.
    pub namespace_active: bool,
}

impl AgentNamespace {
    /// Provision an isolated directory for `agent_id` and, on Linux, attempt to
    /// enter a new mount namespace via `unshare(CLONE_NEWNS)`.
    ///
    /// Fails only on I/O errors; namespace entry failure is non-fatal.
    pub async fn create(agent_id: &str) -> Result<Self> {
        let root_dir = PathBuf::from(format!("/var/lib/igris/agents/{}", agent_id));
        tokio::fs::create_dir_all(&root_dir).await?;

        // Restrict directory to owner only (0700).
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            tokio::fs::set_permissions(&root_dir, std::fs::Permissions::from_mode(0o700)).await?;
        }

        let namespace_active = Self::try_enter_namespace();

        info!(
            "[Namespace] agent={} root={} mount_ns={}",
            agent_id,
            root_dir.display(),
            namespace_active
        );

        Ok(Self {
            agent_id: agent_id.to_string(),
            root_dir,
            namespace_active,
        })
    }

    /// Return the list of filesystem paths this agent is allowed to access.
    /// Tools operating on behalf of this agent must restrict all operations to
    /// paths within this set.
    pub fn allowed_paths(&self) -> Vec<String> {
        vec![self.root_dir.to_string_lossy().to_string()]
    }

    // ── Linux: mount namespace via unshare(CLONE_NEWNS) ─────────────────────

    #[cfg(target_os = "linux")]
    fn try_enter_namespace() -> bool {
        // CLONE_NEWNS = 0x00020000 — create an isolated mount namespace.
        const CLONE_NEWNS: libc::c_int = 0x0002_0000;
        let ret = unsafe { libc::unshare(CLONE_NEWNS) };
        if ret == 0 {
            true
        } else {
            tracing::warn!(
                "[Namespace] unshare(CLONE_NEWNS) failed (errno {}); \
                 degrading to path-only filesystem isolation",
                std::io::Error::last_os_error().raw_os_error().unwrap_or(-1)
            );
            false
        }
    }

    /// macOS / other platforms: namespace isolation is not supported; skip.
    #[cfg(not(target_os = "linux"))]
    fn try_enter_namespace() -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowed_paths_contains_agent_root() {
        let ns = AgentNamespace {
            agent_id: "agent-xyz".to_string(),
            root_dir: PathBuf::from("/var/lib/igris/agents/agent-xyz"),
            namespace_active: false,
        };
        let paths = ns.allowed_paths();
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0], "/var/lib/igris/agents/agent-xyz");
    }

    #[test]
    fn root_dir_derived_from_agent_id() {
        let id = "unit-test-001";
        let ns = AgentNamespace {
            agent_id: id.to_string(),
            root_dir: PathBuf::from(format!("/var/lib/igris/agents/{}", id)),
            namespace_active: false,
        };
        assert!(ns.root_dir.to_str().unwrap().ends_with(id));
    }

    #[test]
    #[cfg(not(target_os = "linux"))]
    fn namespace_active_false_on_non_linux() {
        assert!(!AgentNamespace::try_enter_namespace());
    }
}
