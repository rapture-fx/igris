use crate::{
    bounds::Bounds, event_bus::ViolationEventBus, supervisor::Supervisor, violation::ViolationKind,
};
use ed25519_dalek::SigningKey;

/// High-level guard that enforces CPU and time bounds via a supervised worker process.
///
/// All user code execution occurs in an isolated child process. The guard:
/// - Spawns a worker on first `execute` call
/// - Forwards JSON jobs to the worker over stdin
/// - Enforces a hard timeout; SIGKILLs on violation
/// - Writes signed, hash-chained violation records to a JSONL log
/// - Respawns a fresh worker after each violation
///
/// To integrate with downstream safety subsystems (e.g., the ROS2 containment bridge),
/// use [`ContainmentGuard::new_with_bus`] and pass the [`ViolationEventBus`] to any
/// subscriber before violations can occur.
pub struct ContainmentGuard {
    supervisor: Supervisor,
}

impl ContainmentGuard {
    /// Create a guard without a violation event bus.
    pub fn new(bounds: Bounds, signing_key: SigningKey, log_path: String) -> Self {
        Self {
            supervisor: Supervisor::new(bounds, signing_key, log_path),
        }
    }

    /// Create a guard that broadcasts violation events to `bus`.
    ///
    /// Events are emitted *after* the violation record is committed to the JSONL log.
    pub fn new_with_bus(
        bounds: Bounds,
        signing_key: SigningKey,
        log_path: String,
        event_bus: ViolationEventBus,
    ) -> Self {
        Self {
            supervisor: Supervisor::new_with_bus(bounds, signing_key, log_path, event_bus),
        }
    }

    /// Execute a job inside the containment envelope.
    ///
    /// `context` is forwarded as the job payload to the worker process. Returns the
    /// worker's JSON response on success, or `Err(ViolationKind)` on timeout or
    /// infrastructure failure.
    pub async fn execute(
        &mut self,
        context: serde_json::Value,
    ) -> Result<serde_json::Value, ViolationKind> {
        self.supervisor.execute(context).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::violation::{ViolationKind, ViolationRecord};

    /// Verify that ContainmentGuard can be constructed without panicking.
    #[test]
    fn test_guard_construction() {
        let bounds = Bounds::new(50, 100);
        let secret: [u8; 32] = [1u8; 32];
        let signing_key = SigningKey::from_bytes(&secret);
        let _guard = ContainmentGuard::new(bounds, signing_key, "/tmp/test.jsonl".to_string());
    }

    #[test]
    fn test_guard_construction_with_bus() {
        let bounds = Bounds::new(50, 100);
        let signing_key = SigningKey::from_bytes(&[2u8; 32]);
        let bus = ViolationEventBus::new();
        let _guard =
            ContainmentGuard::new_with_bus(bounds, signing_key, "/tmp/test.jsonl".to_string(), bus);
    }

    /// Verify that a ViolationRecord is correctly written and signed (no worker needed).
    #[test]
    fn test_violation_record_written_and_signed() {
        use rand::RngCore;
        let mut secret = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut secret);
        let signing_key = SigningKey::from_bytes(&secret);

        let log_path = std::env::temp_dir()
            .join("igris_guard_violation_test.jsonl")
            .to_string_lossy()
            .into_owned();
        let _ = std::fs::remove_file(&log_path);

        let record = ViolationRecord::new(
            ViolationKind::Time,
            serde_json::json!({"test": "guard"}),
            String::new(),
            &signing_key,
        );
        record
            .append_to_log(&log_path)
            .expect("log write must succeed");

        let content = std::fs::read_to_string(&log_path).expect("log must be readable");
        let parsed: ViolationRecord =
            serde_json::from_str(content.lines().next().unwrap()).expect("valid JSON");
        assert!(matches!(parsed.violation_kind, ViolationKind::Time));
        assert!(!parsed.hash.is_empty());
        assert!(!parsed.signature.is_empty());

        let _ = std::fs::remove_file(&log_path);
    }

    /// Full guard execute test — requires the host binary to handle `--worker`.
    /// Run via integration test harness; skipped in unit tests.
    #[tokio::test]
    #[ignore]
    async fn test_execute_success() {
        let bounds = Bounds::new(80, 500);
        let secret: [u8; 32] = [2u8; 32];
        let signing_key = SigningKey::from_bytes(&secret);
        let mut guard =
            ContainmentGuard::new(bounds, signing_key, "/tmp/igris_guard_ok.jsonl".to_string());
        let result = guard.execute(serde_json::json!({"ping": 1})).await;
        assert!(result.is_ok(), "expected Ok from worker, got {:?}", result);
    }

    /// Timeout violation via guard — requires a real worker binary; skipped in unit tests.
    #[tokio::test]
    #[ignore]
    async fn test_execute_timeout_creates_violation_log() {
        let bounds = Bounds::new(80, 50);
        let secret: [u8; 32] = [3u8; 32];
        let signing_key = SigningKey::from_bytes(&secret);
        let log_path = "/tmp/igris_guard_timeout.jsonl".to_string();
        let _ = std::fs::remove_file(&log_path);
        let mut guard = ContainmentGuard::new(bounds, signing_key, log_path.clone());
        let result = guard.execute(serde_json::json!({"slow": true})).await;
        assert!(matches!(result, Err(ViolationKind::Time)));
        assert!(
            std::fs::metadata(&log_path).is_ok(),
            "violation log must exist"
        );
        let _ = std::fs::remove_file(&log_path);
    }
}
