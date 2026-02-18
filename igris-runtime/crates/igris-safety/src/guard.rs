use crate::{
    bounds::Bounds,
    cgroup::CGroup,
    violation::{ViolationKind, ViolationRecord},
    watchdog::run_with_timeout,
};
use ed25519_dalek::SigningKey;

/// High-level guard that enforces CPU and time bounds on an async task.
///
/// On timeout a signed `ViolationRecord` is appended to the JSONL log.
pub struct ContainmentGuard {
    bounds: Bounds,
    signing_key: SigningKey,
    log_path: String,
}

impl ContainmentGuard {
    pub fn new(bounds: Bounds, signing_key: SigningKey, log_path: String) -> Self {
        Self { bounds, signing_key, log_path }
    }

    /// Execute `f` inside the containment envelope.
    ///
    /// Returns `Err(ViolationKind::Cpu)` if the cgroup cannot be applied.
    /// Returns `Err(ViolationKind::Time)` if `f` exceeds `bounds.max_tick_ms`.
    /// A signed `ViolationRecord` is written to the log on any violation.
    pub async fn execute<F, T>(
        &self,
        context: serde_json::Value,
        f: F,
    ) -> Result<T, ViolationKind>
    where
        F: std::future::Future<Output = T>,
    {
        let cg = CGroup::new(&self.bounds).map_err(|_| ViolationKind::Cpu)?;
        cg.apply().map_err(|_| ViolationKind::Cpu)?;

        let result = run_with_timeout(self.bounds.max_tick_ms, f).await;

        match result {
            Err(()) => {
                let record = ViolationRecord::new(
                    ViolationKind::Time,
                    context,
                    String::new(),
                    &self.signing_key,
                );
                let _ = record.append_to_log(&self.log_path);
                let _ = cg.destroy();
                Err(ViolationKind::Time)
            }
            Ok(val) => {
                let _ = cg.destroy();
                Ok(val)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn test_timeout_violation_creates_log_entry() {
        let bounds = Bounds::new(50, 50); // 50 ms deadline
        let secret: [u8; 32] = rand::random();
        let signing_key = SigningKey::from_bytes(&secret);

        let log_path = std::env::temp_dir()
            .join("igris_safety_test.jsonl")
            .to_string_lossy()
            .into_owned();

        // Remove stale log from a prior run.
        let _ = std::fs::remove_file(&log_path);

        let guard = ContainmentGuard::new(bounds, signing_key, log_path.clone());

        let result = guard
            .execute(
                serde_json::json!({"test": "timeout_violation"}),
                async {
                    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                    42u32
                },
            )
            .await;

        assert!(
            matches!(result, Err(ViolationKind::Time)),
            "expected Time violation, got {:?}",
            result
        );

        assert!(
            std::fs::metadata(&log_path).is_ok(),
            "violation log file must exist at {log_path}"
        );

        let content = std::fs::read_to_string(&log_path).unwrap();
        assert!(!content.trim().is_empty(), "log must not be empty");

        // Each line must be valid JSON containing the expected violation kind.
        let record: ViolationRecord =
            serde_json::from_str(content.lines().next().unwrap()).unwrap();
        assert!(
            matches!(record.violation_kind, ViolationKind::Time),
            "logged violation_kind must be Time"
        );
        assert!(!record.hash.is_empty(), "hash must be present");
        assert!(!record.signature.is_empty(), "signature must be present");

        // Cleanup.
        let _ = std::fs::remove_file(&log_path);
    }

    #[tokio::test]
    async fn test_success_path_no_log_entry() {
        let bounds = Bounds::new(80, 500); // generous 500 ms deadline
        let secret: [u8; 32] = rand::random();
        let signing_key = SigningKey::from_bytes(&secret);

        let log_path = std::env::temp_dir()
            .join("igris_safety_success_test.jsonl")
            .to_string_lossy()
            .into_owned();

        let _ = std::fs::remove_file(&log_path);

        let guard = ContainmentGuard::new(bounds, signing_key, log_path.clone());

        let result = guard
            .execute(serde_json::json!({}), async { 99u32 })
            .await;

        assert_eq!(result.ok(), Some(99u32));
        // No violation => log file should not exist.
        assert!(
            std::fs::metadata(&log_path).is_err(),
            "no violation means no log file"
        );
    }
}
