#[cfg(test)]
mod tests {
    use super::super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        response::sse::{Event, KeepAlive, Sse},
        routing::post,
        Json, Router,
    };
    #[cfg(feature = "ros2")]
    use base64::Engine;
    #[cfg(feature = "ros2")]
    use ed25519_dalek::Signer;
    use ed25519_dalek::SigningKey;
    use igris_core::storage::{TASK_SUBMISSIONS, TASK_SUBMISSION_STATUS_BY_TASK_ID};
    use igris_routing::thompson::ThompsonSamplingRouter;
    use igris_wal::{StepType, WalLog};
    use serde::Serialize;
    use sha2::{Digest, Sha256};
    #[cfg(feature = "ros2")]
    use std::collections::BTreeMap;
    use std::{convert::Infallible, net::SocketAddr, sync::Arc};
    use tokio::net::TcpListener;
    use tower::ServiceExt;

    #[derive(Serialize)]
    struct StoredTaskSubmission {
        request_hash: String,
        response: task_executor::TaskSubmitResponse,
    }

    async fn mock_openai_chat(Json(req): Json<serde_json::Value>) -> axum::response::Response {
        let stream = req.get("stream").and_then(|v| v.as_bool()).unwrap_or(false);
        if !stream {
            let payload = serde_json::json!({
                "choices": [
                    { "message": { "role": "assistant", "content": "ok" } }
                ]
            });
            return (StatusCode::OK, Json(payload)).into_response();
        }

        let s = futures::stream::iter(vec![
            Ok::<Event, Infallible>(
                Event::default().data(
                    serde_json::json!({
                        "choices": [{ "delta": { "content": "hel" } }]
                    })
                    .to_string(),
                ),
            ),
            Ok::<Event, Infallible>(
                Event::default().data(
                    serde_json::json!({
                        "choices": [{ "delta": { "content": "lo" } }]
                    })
                    .to_string(),
                ),
            ),
            Ok::<Event, Infallible>(Event::default().data("[DONE]")),
        ]);

        Sse::new(s).keep_alive(KeepAlive::default()).into_response()
    }

    async fn spawn_mock_openai() -> SocketAddr {
        let app = Router::new().route("/chat/completions", post(mock_openai_chat));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        addr
    }

    fn build_test_state(endpoint: String) -> AppState {
        let mut cfg = IgrisConfig::default();
        cfg.providers = vec![igris_core::providers::ProviderConfig {
            id: "mock".to_string(),
            name: "Mock".to_string(),
            endpoint,
            model: "mock-model".to_string(),
            api_key_env: Some("TEST_API_KEY".to_string()),
            cost_per_1k_input: 0.0,
            cost_per_1k_output: 0.0,
            capabilities: vec![],
        }];
        cfg.auth.enabled = false;

        let cloud_providers = cfg
            .providers
            .iter()
            .map(|p| CloudProvider::new(p.clone()))
            .collect();
        let db_path = std::env::temp_dir().join(format!("igris-test-{}.db", uuid::Uuid::new_v4()));
        AppState {
            config: Arc::new(cfg),
            storage: Arc::new(RedbStorage::new(db_path).unwrap()),
            speculative_router: Arc::new(SpeculativeRouter::new(
                3,
                std::time::Duration::from_secs(2),
            )),
            thompson_router: Arc::new(ThompsonSamplingRouter::new(vec!["mock".to_string()], 0.1)),
            council_router: Arc::new(CouncilRouter::new("mock".to_string())),
            cloud_providers: Arc::new(cloud_providers),
            local_provider: None,
            mcp_context_store: None,
            reflection_config: None,
            tool_registry: None,
            tool_max_steps: 1,
            tool_timeout_ms: 1000,
            tool_max_concurrent: 1,
            planning_config: None,
            swarm_config: None,
            swarm_peer_id: "test".to_string(),
            lora_training: None,
            federated_manager: None,
            swarm_manager: None,
            fleet_manager: None,
            rate_limiter: None,
            metrics: Arc::new(Metrics::new()),
            escapevector_cache: None,
            #[cfg(feature = "memory")]
            agent_memory: None,
            #[cfg(feature = "hitl")]
            hitl_coordinator: None,
            violation_log: None,
            peer_registry: None,
            runtime_public_key: None,
            signing_key: None,
            overture_public_key: None,
            receipt_log: None,
            lifecycle_registry: None,
            task_cancellation_registry: Arc::new(std::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
            bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
            #[cfg(feature = "ros2")]
            ros2_manager: None,
        }
    }

    fn build_runtime_only_state() -> AppState {
        let mut cfg = IgrisConfig::default();
        cfg.providers = vec![];
        cfg.auth.enabled = false;

        let db_path =
            std::env::temp_dir().join(format!("igris-runtime-test-{}.db", uuid::Uuid::new_v4()));
        AppState {
            config: Arc::new(cfg),
            storage: Arc::new(RedbStorage::new(db_path).unwrap()),
            speculative_router: Arc::new(SpeculativeRouter::new(
                3,
                std::time::Duration::from_secs(2),
            )),
            thompson_router: Arc::new(ThompsonSamplingRouter::new(vec![], 0.1)),
            council_router: Arc::new(CouncilRouter::new("mock".to_string())),
            cloud_providers: Arc::new(vec![]),
            local_provider: None,
            mcp_context_store: None,
            reflection_config: None,
            tool_registry: None,
            tool_max_steps: 1,
            tool_timeout_ms: 1000,
            tool_max_concurrent: 1,
            planning_config: None,
            swarm_config: None,
            swarm_peer_id: "test".to_string(),
            lora_training: None,
            federated_manager: None,
            swarm_manager: None,
            fleet_manager: None,
            rate_limiter: None,
            metrics: Arc::new(Metrics::new()),
            escapevector_cache: None,
            #[cfg(feature = "memory")]
            agent_memory: None,
            #[cfg(feature = "hitl")]
            hitl_coordinator: None,
            violation_log: None,
            peer_registry: None,
            runtime_public_key: None,
            signing_key: None,
            overture_public_key: None,
            receipt_log: None,
            lifecycle_registry: None,
            task_cancellation_registry: Arc::new(std::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
            bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
            #[cfg(feature = "ros2")]
            ros2_manager: None,
        }
    }

    fn build_test_app(state: AppState) -> Router {
        Router::new()
            .route("/v1/chat/completions", post(chat_completions))
            .with_state(state)
    }

    fn build_runtime_task_app(state: AppState) -> Router {
        Router::new()
            .route(
                "/v1/runtime/task/submit",
                post(task_executor::handle_task_submit),
            )
            .route(
                "/v1/runtime/task/stream",
                post(task_executor::handle_task_stream),
            )
            .route(
                "/v1/runtime/task/:task_id/cancel",
                post(task_executor::handle_task_cancel),
            )
            .with_state(state)
    }

    fn hex_digest(bytes: &[u8; 32]) -> String {
        bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
    }

    #[cfg(feature = "ros2")]
    fn canonical_governed_action_for_test(action: &serde_json::Value) -> serde_json::Value {
        let mut value = BTreeMap::<&str, serde_json::Value>::new();
        value.insert("action_name", action["action_name"].clone());
        value.insert("action_type", action["action_type"].clone());
        value.insert("domain", action["domain"].clone());
        value.insert("node_id", action["node_id"].clone());
        value.insert("requires_policy", action["requires_policy"].clone());
        value.insert(
            "safety_mode_required",
            action["safety_mode_required"].clone(),
        );
        value.insert("schema_version", action["schema_version"].clone());
        value.insert("step_index", action["step_index"].clone());
        if action.get("target").is_some_and(|value| !value.is_null()) {
            value.insert("target", action["target"].clone());
        }
        serde_json::to_value(value).unwrap()
    }

    #[cfg(feature = "ros2")]
    fn canonical_policy_decision_for_test(decision: &serde_json::Value) -> Vec<u8> {
        let mut value = BTreeMap::<&str, serde_json::Value>::new();
        value.insert(
            "action",
            canonical_governed_action_for_test(&decision["action"]),
        );
        value.insert("decision_id", decision["decision_id"].clone());
        value.insert("expires_at_unix_ms", decision["expires_at_unix_ms"].clone());
        value.insert("issued_at_unix_ms", decision["issued_at_unix_ms"].clone());
        value.insert("permit", decision["permit"].clone());
        value.insert("policy_permitted", decision["policy_permitted"].clone());
        value.insert("policy_version", decision["policy_version"].clone());
        value.insert("reason", decision["reason"].clone());
        value.insert(
            "robot_mode_permitted",
            decision["robot_mode_permitted"].clone(),
        );
        if decision
            .get("runtime_id")
            .is_some_and(|value| !value.is_null())
        {
            value.insert("runtime_id", decision["runtime_id"].clone());
        }
        value.insert("runtime_permitted", decision["runtime_permitted"].clone());
        value.insert("schema_version", decision["schema_version"].clone());
        if decision
            .get("signer_key_version")
            .is_some_and(|value| !value.is_null())
        {
            value.insert("signer_key_version", decision["signer_key_version"].clone());
        }
        value.insert("task_id", decision["task_id"].clone());
        value.insert("tenant_id", decision["tenant_id"].clone());
        value.insert("tenant_permitted", decision["tenant_permitted"].clone());
        serde_json::to_vec(&value).unwrap()
    }

    #[cfg(feature = "ros2")]
    fn signed_robotics_policy_decision_for_test(
        signing_key: &SigningKey,
        task_id: uuid::Uuid,
        tenant_id: &str,
        runtime_id: &str,
        permit: bool,
    ) -> serde_json::Value {
        signed_robotics_policy_decision_for_action_test(
            signing_key,
            task_id,
            tenant_id,
            runtime_id,
            permit,
            "publish_zero_velocity",
            "robotics-step-0",
            0,
            None,
        )
    }

    #[cfg(feature = "ros2")]
    fn signed_robotics_policy_decision_for_action_test(
        signing_key: &SigningKey,
        task_id: uuid::Uuid,
        tenant_id: &str,
        runtime_id: &str,
        permit: bool,
        action_name: &str,
        node_id: &str,
        step_index: u64,
        target: Option<&str>,
    ) -> serde_json::Value {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let mut decision = serde_json::json!({
            "schema_version": "governed_policy_decision.v1",
            "decision_id": format!("decision-{}", task_id),
            "tenant_id": tenant_id,
            "task_id": task_id,
            "runtime_id": runtime_id,
            "action": {
                "schema_version": "governed_action.v1",
                "domain": "robotics",
                "action_type": "ros2_action",
                "action_name": action_name,
                "node_id": node_id,
                "step_index": step_index,
                "requires_policy": true,
                "safety_mode_required": true
            },
            "permit": permit,
            "reason": if permit { "permitted" } else { "denied by test policy" },
            "policy_version": "robotics-policy.test",
            "runtime_permitted": permit,
            "tenant_permitted": permit,
            "policy_permitted": permit,
            "robot_mode_permitted": permit,
            "issued_at_unix_ms": now_ms,
            "expires_at_unix_ms": now_ms + 30_000,
            "signer_key_version": "test-key",
            "signature": ""
        });
        if let Some(target) = target {
            decision["action"]["target"] = serde_json::json!(target);
        }
        let canonical = canonical_policy_decision_for_test(&decision);
        let digest = Sha256::digest(&canonical);
        let signature = signing_key.sign(&digest);
        decision["signature"] = serde_json::json!(
            base64::engine::general_purpose::STANDARD.encode(signature.to_bytes())
        );
        decision
    }

    #[cfg(feature = "ros2")]
    async fn start_ros2_manager_for_task_test(
        name: &str,
    ) -> Option<Arc<crate::ros2_integration::Ros2Manager>> {
        let bus = igris_safety::ViolationEventBus::new();
        let ros2_log =
            std::env::temp_dir().join(format!("igris-ros2-{name}-{}.jsonl", uuid::Uuid::new_v4()));
        match crate::ros2_integration::Ros2Manager::start(
            igris_ros2::Ros2Config {
                enabled: true,
                node_name: format!("igris_{name}_{}", uuid::Uuid::new_v4().simple()),
                namespace: format!("/igris_{name}"),
                enable_nav2: true,
                ..Default::default()
            },
            &bus,
            SigningKey::from_bytes(&[0x47u8; 32]),
            ros2_log.to_string_lossy().to_string(),
            String::new(),
        )
        .await
        {
            Ok(manager) => Some(Arc::new(manager)),
            Err(err) => {
                eprintln!("skipping ROS2 task flow {name}: {err}");
                None
            }
        }
    }

    #[tokio::test]
    async fn chat_completions_non_stream_uses_cloud_provider() {
        std::env::set_var("TEST_API_KEY", "x");
        let addr = spawn_mock_openai().await;
        let state = build_test_state(format!("http://{}", addr));
        let app = build_test_app(state);

        let req_body = serde_json::json!({
            "model": "gpt-4",
            "messages": [{"role":"user","content":"hi"}]
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/chat/completions")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let content = v["choices"][0]["message"]["content"].as_str().unwrap();
        // Speculative routing races streams even for non-stream requests (first-token wins),
        // so the returned content comes from the streaming path ("hel" + "lo").
        assert_eq!(content, "hello");
    }

    #[tokio::test]
    async fn chat_completions_stream_sse_end_to_end() {
        std::env::set_var("TEST_API_KEY", "x");
        let addr = spawn_mock_openai().await;
        let state = build_test_state(format!("http://{}", addr));
        let app = build_test_app(state);

        let req_body = serde_json::json!({
            "model": "gpt-4",
            "messages": [{"role":"user","content":"hi"}],
            "stream": true
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/chat/completions")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Validate we got an SSE response body with at least one chunk.
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let text = String::from_utf8_lossy(&bytes);
        assert!(text.contains("data:"));
        assert!(text.contains("[DONE]"));
    }

    #[tokio::test]
    async fn runtime_task_submit_rejects_resume_when_digest_matches_but_step_differs() {
        std::env::set_var("TEST_API_KEY", "x");
        let state = build_runtime_only_state();
        let task_id = uuid::Uuid::new_v4();
        let wal = WalLog::new(state.storage.clone(), task_id, state.swarm_peer_id.clone());
        let entry = wal
            .write_intent(
                0,
                StepType::Inference {
                    provider: "mock".to_string(),
                    model: "mock-model".to_string(),
                },
                [0x11u8; 32],
            )
            .unwrap();
        let signing_key = SigningKey::from_bytes(&[0x22u8; 32]);
        wal.write_committed(entry.entry_id, [0x33u8; 32], &signing_key)
            .unwrap();
        let (local_step, local_digest) = wal.committed_state().unwrap();
        assert_eq!(local_step, Some(0));
        let digest_hex = hex_digest(&local_digest);

        let app = build_runtime_task_app(state);
        let req_body = serde_json::json!({
            "task_id": task_id,
            "task_type": {
                "type": "single_inference",
                "model": "gpt-4",
                "messages": [{"role":"user","content":"hi"}],
                "stream": false
            },
            "resume_from": {
                "last_committed_step": 1,
                "checkpoint_digest": digest_hex,
                "runtime_id": "runtime-old"
            },
            "resume_checkpoint": {
                "task_id": task_id,
                "resume_token": {
                    "last_committed_step": 1,
                    "checkpoint_digest": digest_hex,
                    "runtime_id": "runtime-old"
                },
                "wal_entries": []
            },
            "idempotency_key": "resume-step-mismatch",
            "tenant_id": "tenant-runtime-resume"
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/submit")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::CONFLICT);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["error"]["type"], "checkpoint_mismatch");
        assert_eq!(
            payload["resume"]["requested_resume_from"]["last_committed_step"],
            1
        );
        assert_eq!(payload["resume"]["local_last_committed_step"], 0);
        assert_eq!(payload["resume"]["local_checkpoint_digest"], digest_hex);
        assert_eq!(payload["resume"]["resume_checkpoint_provided"], true);
    }

    #[tokio::test]
    async fn runtime_task_stream_replays_completed_output_with_durability_contract() {
        std::env::set_var("TEST_API_KEY", "x");
        let state = build_runtime_only_state();
        let task_id = uuid::Uuid::new_v4();
        let stream_request = task_executor::TaskSubmitRequest {
            task_id,
            task_type: task_executor::TaskType::SingleInference {
                model: "gpt-4".to_string(),
                messages: vec![runtime_execute::ExecuteMessage {
                    role: "user".to_string(),
                    content: "hi".to_string(),
                }],
                max_tokens: None,
                temperature: None,
                stream: true,
                mode: None,
                memory: None,
                approval: None,
            },
            containment: None,
            resume_from: None,
            resume_checkpoint: None,
            idempotency_key: "stream-durability".to_string(),
            tenant_id: "tenant-stream".to_string(),
            signed_policy_decisions: Vec::new(),
            deadline_ms: None,
        };
        let request_hash = format!(
            "{:x}",
            Sha256::digest(
                serde_json::to_vec(&serde_json::json!({
                    "task_type": &stream_request.task_type,
                    "containment": &stream_request.containment,
                    "tenant_id": &stream_request.tenant_id,
                    "deadline_ms": &stream_request.deadline_ms,
                }))
                .unwrap(),
            )
        );
        let stored = StoredTaskSubmission {
            request_hash,
            response: task_executor::TaskSubmitResponse {
                task_id,
                steps_completed: 1,
                steps_total: 1,
                status: task_executor::TaskStatus::Completed,
                checkpoint: None,
                final_output: Some("hello".to_string()),
                usage: None,
                failure_details: None,
                execution_envelope: None,
                execution_receipt: None,
            },
        };
        state
            .storage
            .set(
                TASK_SUBMISSIONS,
                &format!(
                    "{}:{}",
                    stream_request.tenant_id, stream_request.idempotency_key
                ),
                &stored,
            )
            .unwrap();

        let app = build_runtime_task_app(state);
        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/stream")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&stream_request).unwrap()))
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            resp.headers()["x-igris-runtime-task-id"],
            task_id.to_string().as_str()
        );
        assert_eq!(
            resp.headers()["x-igris-runtime-stream-resume-supported"],
            "false"
        );
        assert_eq!(
            resp.headers()["x-igris-runtime-stream-replay-condition"],
            "completed-final-output"
        );
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let text = String::from_utf8_lossy(&bytes);
        assert!(text.contains("hello"));
        assert!(text.contains("event: task_result"));
        assert!(text.contains("\"mode\":\"streaming\""));
        assert!(text.contains("\"resume_supported\":false"));
        assert!(text.contains("\"replay_supported\":true"));
        assert!(text.contains("\"checkpoint_persisted\":false"));
    }

    #[tokio::test]
    async fn runtime_task_stream_replay_unavailable_preserves_failure_details() {
        std::env::set_var("TEST_API_KEY", "x");
        let state = build_runtime_only_state();
        let task_id = uuid::Uuid::new_v4();
        let stream_request = task_executor::TaskSubmitRequest {
            task_id,
            task_type: task_executor::TaskType::SingleInference {
                model: "gpt-4".to_string(),
                messages: vec![runtime_execute::ExecuteMessage {
                    role: "user".to_string(),
                    content: "hi".to_string(),
                }],
                max_tokens: None,
                temperature: None,
                stream: true,
                mode: None,
                memory: None,
                approval: None,
            },
            containment: None,
            resume_from: None,
            resume_checkpoint: None,
            idempotency_key: "stream-failure-replay".to_string(),
            tenant_id: "tenant-stream".to_string(),
            signed_policy_decisions: Vec::new(),
            deadline_ms: None,
        };
        let request_hash = format!(
            "{:x}",
            Sha256::digest(
                serde_json::to_vec(&serde_json::json!({
                    "task_type": &stream_request.task_type,
                    "containment": &stream_request.containment,
                    "tenant_id": &stream_request.tenant_id,
                    "deadline_ms": &stream_request.deadline_ms,
                }))
                .unwrap(),
            )
        );
        let stored = StoredTaskSubmission {
            request_hash,
            response: task_executor::TaskSubmitResponse {
                task_id,
                steps_completed: 0,
                steps_total: 1,
                status: task_executor::TaskStatus::Failed {
                    reason: "provider stream failed".to_string(),
                },
                checkpoint: None,
                final_output: None,
                usage: None,
                failure_details: Some(task_executor::TaskFailureDetails {
                    source: "runtime".to_string(),
                    operation: "execution".to_string(),
                    rejection_type: "step_failed".to_string(),
                    message: "provider stream failed".to_string(),
                    step_index: Some(0),
                    domain: Some("agent".to_string()),
                    node_id: Some("agent-0".to_string()),
                }),
                execution_envelope: None,
                execution_receipt: None,
            },
        };
        state
            .storage
            .set(
                TASK_SUBMISSIONS,
                &format!(
                    "{}:{}",
                    stream_request.tenant_id, stream_request.idempotency_key
                ),
                &stored,
            )
            .unwrap();

        let app = build_runtime_task_app(state);
        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/stream")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&stream_request).unwrap()))
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::CONFLICT);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["error"]["type"], "stream_replay_unavailable");
        assert_eq!(payload["task"]["status"]["status"], "failed");
        assert_eq!(
            payload["task"]["status"]["reason"],
            "provider stream failed"
        );
        assert_eq!(payload["task"]["failure_details"]["source"], "runtime");
        assert_eq!(payload["task"]["failure_details"]["operation"], "execution");
        assert_eq!(
            payload["task"]["failure_details"]["rejection_type"],
            "step_failed"
        );
        assert_eq!(payload["task"]["failure_details"]["step_index"], 0);
        assert_eq!(payload["task"]["failure_details"]["domain"], "agent");
        assert_eq!(payload["task"]["failure_details"]["node_id"], "agent-0");
        assert_eq!(payload["durability"]["mode"], "streaming");
        assert_eq!(payload["durability"]["replay_supported"], false);
        assert_eq!(payload["durability"]["checkpoint_persisted"], false);
    }

    #[tokio::test]
    async fn runtime_task_cancel_completed_stream_conflict_includes_durability() {
        std::env::set_var("TEST_API_KEY", "x");
        let state = build_runtime_only_state();
        let task_id = uuid::Uuid::new_v4();
        let response = task_executor::TaskSubmitResponse {
            task_id,
            steps_completed: 1,
            steps_total: 1,
            status: task_executor::TaskStatus::Completed,
            checkpoint: None,
            final_output: Some("hello".to_string()),
            usage: None,
            failure_details: None,
            execution_envelope: None,
            execution_receipt: None,
        };
        state
            .storage
            .set(
                TASK_SUBMISSION_STATUS_BY_TASK_ID,
                &task_id.to_string(),
                &response,
            )
            .unwrap();

        let app = build_runtime_task_app(state);
        let req = Request::builder()
            .method("POST")
            .uri(format!("/v1/runtime/task/{}/cancel", task_id))
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::CONFLICT);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["task_id"], task_id.to_string());
        assert_eq!(payload["canceled"], false);
        assert_eq!(payload["known"], true);
        assert_eq!(payload["active_execution"], false);
        assert_eq!(payload["cancellation_allowed"], false);
        assert_eq!(payload["reason"], "task_execution_completed");
        assert_eq!(payload["durability"]["mode"], "streaming");
        assert_eq!(payload["durability"]["resume_supported"], false);
        assert_eq!(payload["durability"]["replay_supported"], true);
        assert_eq!(
            payload["durability"]["replay_condition"],
            "completed-final-output"
        );
        assert_eq!(payload["durability"]["checkpoint_persisted"], false);
    }

    #[tokio::test]
    async fn runtime_task_robotics_denied_path_emits_signed_audit_artifacts() {
        let mut state = build_runtime_only_state();
        state.signing_key = Some(Arc::new(SigningKey::from_bytes(&[0x44u8; 32])));
        let app = build_runtime_task_app(state);
        let task_id = uuid::Uuid::new_v4();
        let req_body = serde_json::json!({
            "task_id": task_id,
            "task_type": {
                "type": "robotics_workflow",
                "steps": [
                    {"step_index": 0, "action": "publish_zero_velocity"}
                ]
            },
            "containment": {"max_tick_ms": 1000},
            "idempotency_key": "robotics-denied-artifacts",
            "tenant_id": "tenant-robotics-denied"
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/submit")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["status"]["status"], "failed");
        assert_eq!(payload["steps_completed"], 0);
        assert_eq!(payload["failure_details"]["rejection_type"], "step_failed");
        assert_eq!(payload["failure_details"]["domain"], "robotics");
        assert_eq!(payload["failure_details"]["node_id"], "robotics-step-0");
        assert!(payload["status"]["reason"]
            .as_str()
            .unwrap()
            .contains("missing signed policy verifier"));
        assert_eq!(
            payload["execution_envelope"]["routing_decision"],
            "runtime:robotics:failed"
        );
        assert!(payload["execution_envelope"]["violation"]
            .as_str()
            .unwrap()
            .contains("missing signed policy verifier"));
        assert!(payload["execution_envelope"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_eq!(payload["execution_receipt"]["violation_occurred"], true);
        assert!(payload["execution_receipt"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
    }

    #[cfg(feature = "ros2")]
    fn assert_ros2_replay_lookup_artifacts(
        payload: &serde_json::Value,
        task_id: uuid::Uuid,
        routing_decision: &str,
        violation_occurred: bool,
    ) {
        assert_eq!(
            payload["execution_envelope"]["routing_decision"],
            routing_decision
        );
        assert_eq!(
            payload["execution_envelope"]["policy_decision_id"],
            format!("decision-{task_id}")
        );
        assert!(payload["execution_envelope"]["governed_action_hash"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(payload["execution_envelope"]["policy_decision_hash"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(payload["execution_envelope"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(payload["execution_receipt"]["hash"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(payload["execution_receipt"]["transaction_id"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(payload["execution_receipt"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_eq!(
            payload["execution_receipt"]["violation_occurred"],
            violation_occurred
        );
    }

    #[cfg(feature = "ros2")]
    #[tokio::test]
    async fn runtime_task_signed_ros2_publish_zero_velocity_completes_with_audit_artifacts() {
        let runtime_signing_key = Arc::new(SigningKey::from_bytes(&[0x45u8; 32]));
        let overture_signing_key = SigningKey::from_bytes(&[0x46u8; 32]);
        let overture_verifying_key = Arc::new(overture_signing_key.verifying_key());
        let Some(manager) = start_ros2_manager_for_task_test("runtime_task").await else {
            return;
        };

        let mut state = build_runtime_only_state();
        state.swarm_peer_id = "runtime-robotics-signed".to_string();
        state.signing_key = Some(runtime_signing_key);
        state.overture_public_key = Some(overture_verifying_key);
        state.ros2_manager = Some(Arc::clone(&manager));
        let app = build_runtime_task_app(state);

        let task_id = uuid::Uuid::new_v4();
        let tenant_id = "tenant-robotics";
        let runtime_id = "runtime-robotics-signed";
        let decision = signed_robotics_policy_decision_for_test(
            &overture_signing_key,
            task_id,
            tenant_id,
            runtime_id,
            true,
        );
        let req_body = serde_json::json!({
            "task_id": task_id,
            "task_type": {
                "type": "robotics_workflow",
                "steps": [
                    {"step_index": 0, "action": "publish_zero_velocity"}
                ]
            },
            "containment": {"max_tick_ms": 1000},
            "signed_policy_decisions": [decision],
            "idempotency_key": "signed-ros2-zero-velocity",
            "tenant_id": tenant_id
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/submit")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["status"]["status"], "completed");
        assert_eq!(payload["steps_completed"], 1);
        assert_eq!(
            payload["execution_envelope"]["routing_decision"],
            "ros2:publish_zero_velocity"
        );
        assert_eq!(
            payload["execution_envelope"]["policy_decision_id"],
            format!("decision-{task_id}")
        );
        assert!(payload["execution_envelope"]["governed_action_hash"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(payload["execution_envelope"]["policy_decision_hash"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(payload["execution_envelope"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_eq!(payload["execution_receipt"]["violation_occurred"], false);
        assert!(payload["execution_receipt"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_ros2_replay_lookup_artifacts(
            &payload,
            task_id,
            "ros2:publish_zero_velocity",
            false,
        );
        assert_eq!(manager.node().last_velocity().await, [0.0, 0.0]);
    }

    #[cfg(feature = "ros2")]
    #[tokio::test]
    async fn runtime_task_signed_ros2_cancel_navigation_completes_with_audit_artifacts() {
        let runtime_signing_key = Arc::new(SigningKey::from_bytes(&[0x48u8; 32]));
        let overture_signing_key = SigningKey::from_bytes(&[0x49u8; 32]);
        let Some(manager) = start_ros2_manager_for_task_test("cancel_nav").await else {
            return;
        };

        let mut state = build_runtime_only_state();
        state.swarm_peer_id = "runtime-robotics-cancel".to_string();
        state.signing_key = Some(runtime_signing_key);
        state.overture_public_key = Some(Arc::new(overture_signing_key.verifying_key()));
        state.ros2_manager = Some(Arc::clone(&manager));
        let app = build_runtime_task_app(state);

        let task_id = uuid::Uuid::new_v4();
        let tenant_id = "tenant-robotics-cancel";
        let runtime_id = "runtime-robotics-cancel";
        let decision = signed_robotics_policy_decision_for_action_test(
            &overture_signing_key,
            task_id,
            tenant_id,
            runtime_id,
            true,
            "cancel_navigation",
            "robotics-step-0",
            0,
            None,
        );
        let req_body = serde_json::json!({
            "task_id": task_id,
            "task_type": {
                "type": "robotics_workflow",
                "steps": [
                    {"step_index": 0, "action": "cancel_navigation"}
                ]
            },
            "containment": {"max_tick_ms": 1000},
            "signed_policy_decisions": [decision],
            "idempotency_key": "signed-ros2-cancel-navigation",
            "tenant_id": tenant_id
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/submit")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["status"]["status"], "completed");
        assert_eq!(
            payload["execution_envelope"]["routing_decision"],
            "ros2:cancel_navigation"
        );
        assert_eq!(
            payload["execution_envelope"]["policy_decision_id"],
            format!("decision-{task_id}")
        );
        assert!(payload["execution_envelope"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_eq!(payload["execution_receipt"]["violation_occurred"], false);
        assert!(payload["execution_receipt"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_ros2_replay_lookup_artifacts(&payload, task_id, "ros2:cancel_navigation", false);
    }

    #[cfg(feature = "ros2")]
    #[tokio::test]
    async fn runtime_task_signed_ros2_timeout_emits_failure_audit_artifacts() {
        let runtime_signing_key = Arc::new(SigningKey::from_bytes(&[0x4Au8; 32]));
        let overture_signing_key = SigningKey::from_bytes(&[0x4Bu8; 32]);
        let Some(manager) = start_ros2_manager_for_task_test("nav_timeout").await else {
            return;
        };

        let mut state = build_runtime_only_state();
        state.swarm_peer_id = "runtime-robotics-timeout".to_string();
        state.signing_key = Some(runtime_signing_key);
        state.overture_public_key = Some(Arc::new(overture_signing_key.verifying_key()));
        state.ros2_manager = Some(Arc::clone(&manager));
        let app = build_runtime_task_app(state);

        let task_id = uuid::Uuid::new_v4();
        let tenant_id = "tenant-robotics-timeout";
        let runtime_id = "runtime-robotics-timeout";
        let decision = signed_robotics_policy_decision_for_action_test(
            &overture_signing_key,
            task_id,
            tenant_id,
            runtime_id,
            true,
            "navigate_to_pose",
            "robotics-step-0",
            0,
            Some("1,2,map"),
        );
        let req_body = serde_json::json!({
            "task_id": task_id,
            "task_type": {
                "type": "robotics_workflow",
                "steps": [
                    {
                        "step_index": 0,
                        "action": "navigate_to_pose",
                        "goal": {"x": 1.0, "y": 2.0, "frame_id": "map"},
                        "wait_timeout_ms": 1
                    }
                ]
            },
            "containment": {"max_tick_ms": 1000},
            "signed_policy_decisions": [decision],
            "idempotency_key": "signed-ros2-timeout",
            "tenant_id": tenant_id
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/submit")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["status"]["status"], "failed");
        assert_eq!(payload["failure_details"]["rejection_type"], "step_failed");
        assert_eq!(payload["failure_details"]["domain"], "robotics");
        assert!(payload["status"]["reason"]
            .as_str()
            .unwrap()
            .contains("timed out"));
        assert_eq!(
            payload["execution_envelope"]["routing_decision"],
            "runtime:robotics:failed"
        );
        assert_eq!(
            payload["execution_envelope"]["policy_decision_id"],
            format!("decision-{task_id}")
        );
        assert!(payload["execution_envelope"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_eq!(payload["execution_receipt"]["violation_occurred"], true);
        assert!(payload["execution_receipt"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_ros2_replay_lookup_artifacts(&payload, task_id, "runtime:robotics:failed", true);
    }

    #[cfg(feature = "ros2")]
    #[tokio::test]
    async fn runtime_task_signed_ros2_denied_policy_emits_failure_audit_artifacts() {
        let runtime_signing_key = Arc::new(SigningKey::from_bytes(&[0x4Cu8; 32]));
        let overture_signing_key = SigningKey::from_bytes(&[0x4Du8; 32]);
        let Some(manager) = start_ros2_manager_for_task_test("policy_denied").await else {
            return;
        };

        let mut state = build_runtime_only_state();
        state.swarm_peer_id = "runtime-robotics-denied-policy".to_string();
        state.signing_key = Some(runtime_signing_key);
        state.overture_public_key = Some(Arc::new(overture_signing_key.verifying_key()));
        state.ros2_manager = Some(Arc::clone(&manager));
        let app = build_runtime_task_app(state);

        let task_id = uuid::Uuid::new_v4();
        let tenant_id = "tenant-robotics-denied-policy";
        let runtime_id = "runtime-robotics-denied-policy";
        let decision = signed_robotics_policy_decision_for_test(
            &overture_signing_key,
            task_id,
            tenant_id,
            runtime_id,
            false,
        );
        let req_body = serde_json::json!({
            "task_id": task_id,
            "task_type": {
                "type": "robotics_workflow",
                "steps": [
                    {"step_index": 0, "action": "publish_zero_velocity"}
                ]
            },
            "containment": {"max_tick_ms": 1000},
            "signed_policy_decisions": [decision],
            "idempotency_key": "signed-ros2-policy-denied",
            "tenant_id": tenant_id
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/submit")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["status"]["status"], "failed");
        assert!(payload["status"]["reason"]
            .as_str()
            .unwrap()
            .contains("denied"));
        assert_eq!(
            payload["execution_envelope"]["routing_decision"],
            "runtime:robotics:failed"
        );
        assert_eq!(
            payload["execution_envelope"]["policy_decision_id"],
            format!("decision-{task_id}")
        );
        assert!(payload["execution_envelope"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert_eq!(payload["execution_receipt"]["violation_occurred"], true);
        assert!(payload["execution_receipt"]["signature"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
    }

    #[tokio::test]
    async fn load_test_100_concurrent_requests() {
        std::env::set_var("TEST_API_KEY", "x");
        let addr = spawn_mock_openai().await;
        let state = build_test_state(format!("http://{}", addr));
        let app = build_test_app(state);

        let mut tasks = Vec::new();
        for _ in 0..100 {
            let app = app.clone();
            tasks.push(tokio::spawn(async move {
                let req_body = serde_json::json!({
                    "model": "gpt-4",
                    "messages": [{"role":"user","content":"hi"}]
                });
                let req = Request::builder()
                    .method("POST")
                    .uri("/v1/chat/completions")
                    .header("content-type", "application/json")
                    .body(Body::from(req_body.to_string()))
                    .unwrap();
                let resp = app.oneshot(req).await.unwrap();
                resp.status()
            }));
        }

        for t in tasks {
            assert_eq!(t.await.unwrap(), StatusCode::OK);
        }
    }

    #[tokio::test]
    async fn escapevector_cache_hit_returns_degraded_response() {
        // Setup: Create EscapeVector cache and populate it
        let temp_dir = std::env::temp_dir().join(format!("igris-test-ev-{}", uuid::Uuid::new_v4()));
        let cache_key = [42u8; 32];
        let cache = Arc::new(EscapeVectorCache::new(&temp_dir, cache_key).unwrap());

        // Pre-populate cache with a response
        let prompt = "user: What is 2+2?";
        let cached_response = "The answer is 4.";
        cache
            .save_response(prompt, cached_response, "gpt-4", 0.95)
            .unwrap();

        // Build state with failing providers (invalid endpoint) and EscapeVector cache
        let mut cfg = IgrisConfig::default();
        cfg.providers = vec![igris_core::providers::ProviderConfig {
            id: "mock".to_string(),
            name: "Mock".to_string(),
            endpoint: "http://127.0.0.1:1".to_string(), // Unreachable endpoint
            model: "mock-model".to_string(),
            api_key_env: Some("TEST_API_KEY".to_string()),
            cost_per_1k_input: 0.0,
            cost_per_1k_output: 0.0,
            capabilities: vec![],
        }];
        cfg.auth.enabled = false;

        let cloud_providers = cfg
            .providers
            .iter()
            .map(|p| CloudProvider::new(p.clone()))
            .collect();
        let db_path = std::env::temp_dir().join(format!("igris-test-{}.db", uuid::Uuid::new_v4()));

        let state = AppState {
            config: Arc::new(cfg),
            storage: Arc::new(RedbStorage::new(db_path).unwrap()),
            speculative_router: Arc::new(SpeculativeRouter::new(
                3,
                std::time::Duration::from_millis(100),
            )),
            thompson_router: Arc::new(ThompsonSamplingRouter::new(vec!["mock".to_string()], 0.1)),
            council_router: Arc::new(CouncilRouter::new("mock".to_string())),
            cloud_providers: Arc::new(cloud_providers),
            local_provider: None,
            mcp_context_store: None,
            reflection_config: None,
            tool_registry: None,
            tool_max_steps: 1,
            tool_timeout_ms: 100,
            tool_max_concurrent: 1,
            planning_config: None,
            swarm_config: None,
            swarm_peer_id: "test".to_string(),
            lora_training: None,
            federated_manager: None,
            swarm_manager: None,
            fleet_manager: None,
            rate_limiter: None,
            metrics: Arc::new(Metrics::new()),
            escapevector_cache: Some(cache.clone()),
            #[cfg(feature = "memory")]
            agent_memory: None,
            #[cfg(feature = "hitl")]
            hitl_coordinator: None,
            violation_log: None,
            peer_registry: None,
            runtime_public_key: None,
            signing_key: None,
            overture_public_key: None,
            receipt_log: None,
            lifecycle_registry: None,
            task_cancellation_registry: Arc::new(std::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
            bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
            #[cfg(feature = "ros2")]
            ros2_manager: None,
        };

        let app = build_test_app(state);

        // Send request that matches cached prompt
        let req_body = serde_json::json!({
            "model": "gpt-4",
            "messages": [{"role":"user","content":"What is 2+2?"}]
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/chat/completions")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        // Verify response content
        let content = v["choices"][0]["message"]["content"].as_str().unwrap();
        assert_eq!(content, cached_response);

        // Verify metadata indicates degraded mode
        let metadata = &v["metadata"];
        assert!(metadata.is_object(), "metadata should be present");
        assert_eq!(metadata["degraded"].as_bool().unwrap(), true);
        assert!(metadata["source"]
            .as_str()
            .unwrap()
            .starts_with("escapevector-cache:"));
        assert!(metadata["cache_age_seconds"].is_u64());
        assert_eq!(metadata["quality_score"].as_f64().unwrap(), 0.95);

        // Cleanup
        cache.clear().unwrap();
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn escapevector_cache_miss_returns_503() {
        // Setup: Create empty EscapeVector cache
        let temp_dir =
            std::env::temp_dir().join(format!("igris-test-ev-miss-{}", uuid::Uuid::new_v4()));
        let cache_key = [43u8; 32];
        let cache = Arc::new(EscapeVectorCache::new(&temp_dir, cache_key).unwrap());

        // Build state with failing providers and empty cache
        let mut cfg = IgrisConfig::default();
        cfg.providers = vec![igris_core::providers::ProviderConfig {
            id: "mock".to_string(),
            name: "Mock".to_string(),
            endpoint: "http://127.0.0.1:1".to_string(), // Unreachable
            model: "mock-model".to_string(),
            api_key_env: Some("TEST_API_KEY".to_string()),
            cost_per_1k_input: 0.0,
            cost_per_1k_output: 0.0,
            capabilities: vec![],
        }];
        cfg.auth.enabled = false;

        let cloud_providers = cfg
            .providers
            .iter()
            .map(|p| CloudProvider::new(p.clone()))
            .collect();
        let db_path = std::env::temp_dir().join(format!("igris-test-{}.db", uuid::Uuid::new_v4()));

        let state = AppState {
            config: Arc::new(cfg),
            storage: Arc::new(RedbStorage::new(db_path).unwrap()),
            speculative_router: Arc::new(SpeculativeRouter::new(
                3,
                std::time::Duration::from_millis(100),
            )),
            thompson_router: Arc::new(ThompsonSamplingRouter::new(vec!["mock".to_string()], 0.1)),
            council_router: Arc::new(CouncilRouter::new("mock".to_string())),
            cloud_providers: Arc::new(cloud_providers),
            local_provider: None,
            mcp_context_store: None,
            reflection_config: None,
            tool_registry: None,
            tool_max_steps: 1,
            tool_timeout_ms: 100,
            tool_max_concurrent: 1,
            planning_config: None,
            swarm_config: None,
            swarm_peer_id: "test".to_string(),
            lora_training: None,
            federated_manager: None,
            swarm_manager: None,
            fleet_manager: None,
            rate_limiter: None,
            metrics: Arc::new(Metrics::new()),
            escapevector_cache: Some(cache.clone()),
            #[cfg(feature = "memory")]
            agent_memory: None,
            #[cfg(feature = "hitl")]
            hitl_coordinator: None,
            violation_log: None,
            peer_registry: None,
            runtime_public_key: None,
            signing_key: None,
            overture_public_key: None,
            receipt_log: None,
            lifecycle_registry: None,
            task_cancellation_registry: Arc::new(std::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
            bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
            #[cfg(feature = "ros2")]
            ros2_manager: None,
        };

        let app = build_test_app(state);

        // Send request with no cached response
        let req_body = serde_json::json!({
            "model": "gpt-4",
            "messages": [{"role":"user","content":"This prompt is not cached"}]
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/chat/completions")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();

        // Should return 503 Service Unavailable
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        // Verify error message
        let error_msg = v["error"]["message"].as_str().unwrap();
        assert!(error_msg.contains("unavailable"));
        assert_eq!(v["error"]["type"].as_str().unwrap(), "service_unavailable");

        // Cleanup
        cache.clear().unwrap();
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn normal_request_has_no_degraded_metadata() {
        std::env::set_var("TEST_API_KEY", "x");
        let addr = spawn_mock_openai().await;
        let state = build_test_state(format!("http://{}", addr));
        let app = build_test_app(state);

        let req_body = serde_json::json!({
            "model": "gpt-4",
            "messages": [{"role":"user","content":"hi"}]
        });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/chat/completions")
            .header("content-type", "application/json")
            .body(Body::from(req_body.to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        // Verify metadata is absent or null for normal requests
        assert!(
            v["metadata"].is_null(),
            "metadata should be null for normal responses"
        );
    }
}
