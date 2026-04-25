use ed25519_dalek::SigningKey;
use igris_safety::{Bounds, Supervisor, ViolationKind, ViolationRecord};

fn test_signing_key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

#[tokio::test]
async fn supervisor_executes_runtime_worker_job() {
    let worker_bin = env!("CARGO_BIN_EXE_igris-runtime");
    let log_path = std::env::temp_dir()
        .join(format!(
            "igris-containment-ok-{}.jsonl",
            uuid::Uuid::new_v4()
        ))
        .to_string_lossy()
        .into_owned();

    let mut supervisor = Supervisor::new(Bounds::new(80, 5_000), test_signing_key(7), log_path)
        .with_worker_binary(worker_bin.to_string());

    let result = supervisor
        .execute(serde_json::json!({
            "kind": "test_response",
            "test_response_content": "pong",
            "test_response_provider": "contained-worker"
        }))
        .await
        .expect("worker execution should succeed");

    assert_eq!(result["status"], "ok");
    assert_eq!(result["result"]["content"], "pong");
    assert_eq!(result["result"]["provider"], "contained-worker");
}

#[tokio::test]
async fn supervisor_times_out_worker_and_writes_signed_violation() {
    let worker_bin = env!("CARGO_BIN_EXE_igris-runtime");
    let log_path = std::env::temp_dir()
        .join(format!(
            "igris-containment-timeout-{}.jsonl",
            uuid::Uuid::new_v4()
        ))
        .to_string_lossy()
        .into_owned();
    let _ = std::fs::remove_file(&log_path);

    let mut supervisor =
        Supervisor::new(Bounds::new(80, 25), test_signing_key(9), log_path.clone())
            .with_worker_binary(worker_bin.to_string());

    let result = supervisor
        .execute(serde_json::json!({
            "kind": "test_response",
            "test_delay_ms": 200,
            "test_response_content": "slow"
        }))
        .await;

    assert!(matches!(result, Err(ViolationKind::Time)));

    let contents = std::fs::read_to_string(&log_path).expect("violation log should exist");
    let first_line = contents
        .lines()
        .next()
        .expect("violation log should have a record");
    let record: ViolationRecord =
        serde_json::from_str(first_line).expect("violation log entry should be valid JSON");

    assert!(matches!(record.violation_kind, ViolationKind::Time));
    assert!(!record.signature.is_empty());

    let _ = std::fs::remove_file(&log_path);
}
