#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        middleware::from_fn_with_state,
        routing::{get, post},
        Router,
    };
    use base64::Engine;
    use std::sync::Arc;
    use tower::ServiceExt;

    use crate::middleware::security::{security_middleware, RateLimiter};
    use crate::{metrics::Metrics, AppState, RuntimeLicenseStatus};
    use igris_core::config::IgrisConfig;
    use igris_core::storage::RedbStorage;
    use igris_routing::{CouncilRouter, SpeculativeRouter, ThompsonSamplingRouter};
    use igris_safety::ViolationEventBus;

    async fn ok() -> &'static str {
        "OK"
    }

    fn make_state(auth_enabled: bool, api_key: &str) -> AppState {
        let mut cfg = IgrisConfig::default();
        cfg.auth.enabled = auth_enabled;
        cfg.auth.api_key = api_key.to_string();

        let db_path = std::env::temp_dir().join(format!("igris-test-{}.db", uuid::Uuid::new_v4()));
        AppState {
            config: Arc::new(cfg),
            storage: Arc::new(RedbStorage::new(db_path).unwrap()),
            speculative_router: Arc::new(SpeculativeRouter::new(
                1,
                std::time::Duration::from_secs(1),
            )),
            thompson_router: Arc::new(ThompsonSamplingRouter::new(vec![], 0.1)),
            council_router: Arc::new(CouncilRouter::new("x".to_string())),
            cloud_providers: Arc::new(vec![]),
            local_provider: None,
            mcp_context_store: None,
            reflection_config: None,
            tool_registry: None,
            tool_max_steps: 1,
            tool_timeout_ms: 1,
            tool_max_concurrent: 1,
            planning_config: None,
            swarm_config: None,
            swarm_peer_id: "test".to_string(),
            lora_training: None,
            federated_manager: None,
            swarm_manager: None,
            fleet_manager: None,
            rate_limiter: Some(RateLimiter::new(60, 1)),
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
            violation_bus: ViolationEventBus::new(),
            license_status: RuntimeLicenseStatus {
                state: "licensed_online".to_string(),
                tier: Some("seed".to_string()),
                license_expires_at: None,
                offline_artifact_expires_at: None,
            },
            receipt_log: None,
            lifecycle_registry: None,
            task_cancellation_registry: Arc::new(std::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
            bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
            #[cfg(feature = "robotics-platform")]
            ros2_manager: None,
        }
    }

    #[tokio::test]
    async fn auth_blocks_without_key() {
        let state = make_state(true, "secret");
        let app = Router::new()
            .route("/private", get(ok))
            .layer(from_fn_with_state(state.clone(), security_middleware))
            .with_state(state);

        let req = Request::builder()
            .uri("/private")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_allows_with_x_api_key() {
        let state = make_state(true, "secret");
        let app = Router::new()
            .route("/private", get(ok))
            .layer(from_fn_with_state(state.clone(), security_middleware))
            .with_state(state);

        let req = Request::builder()
            .uri("/private")
            .header("x-api-key", "secret")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn runtime_profile_is_public() {
        let state = make_state(true, "secret");
        let app = Router::new()
            .route("/v1/runtime/profile", get(ok))
            .layer(from_fn_with_state(state.clone(), security_middleware))
            .with_state(state);

        let req = Request::builder()
            .uri("/v1/runtime/profile")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    /// Build a state with IGRIS_OVERTURE_PUBLIC_KEY set to the given verifying key.
    fn make_state_with_overture_key(verifying_key: ed25519_dalek::VerifyingKey) -> AppState {
        let mut state = make_state(false, "");
        state.overture_public_key = Some(Arc::new(verifying_key));
        state
    }

    /// Sign body bytes with the given signing key and return base64-encoded signature.
    fn sign_body(signing_key: &ed25519_dalek::SigningKey, body: &[u8]) -> String {
        use ed25519_dalek::Signer;
        use sha2::Digest;
        let hash = sha2::Sha256::digest(body);
        let sig = signing_key.sign(&hash);
        base64::engine::general_purpose::STANDARD.encode(sig.to_bytes())
    }

    fn runtime_submission_app(path: &'static str, state: AppState) -> Router {
        Router::new()
            .route(path, post(ok))
            .layer(from_fn_with_state(state.clone(), security_middleware))
            .with_state(state)
    }

    // P0-3: Valid decision signature → request passes through (200).
    #[tokio::test]
    async fn decision_sig_valid_passes() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let state = make_state_with_overture_key(verifying_key);

        let body = br#"{"model":"mock","messages":[]}"#;
        let sig = sign_body(&signing_key, body);

        let app = runtime_submission_app("/v1/runtime/execute", state);

        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/execute")
            .header("content-type", "application/json")
            .header("x-igris-decision-sig", sig)
            .body(Body::from(body.as_slice()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    // P0-3: Invalid/tampered decision signature → 401.
    #[tokio::test]
    async fn decision_sig_invalid_rejected() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let state = make_state_with_overture_key(verifying_key);

        // Sign original body, then tamper with it.
        let original_body = br#"{"model":"mock","messages":[]}"#;
        let sig = sign_body(&signing_key, original_body);
        let tampered_body = br#"{"model":"evil","messages":[]}"#;

        let app = runtime_submission_app("/v1/runtime/execute", state);

        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/execute")
            .header("content-type", "application/json")
            .header("x-igris-decision-sig", sig)
            .body(Body::from(tampered_body.as_slice()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    // P0-3: Missing decision signature when overture key is set → 401.
    #[tokio::test]
    async fn decision_sig_missing_rejected() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let state = make_state_with_overture_key(verifying_key);

        let app = runtime_submission_app("/v1/runtime/execute", state);

        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/execute")
            .header("content-type", "application/json")
            .body(Body::from(br#"{"model":"mock","messages":[]}"#.as_slice()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn decision_sig_verification_unavailable_rejected() {
        let state = make_state(false, "");
        let app = runtime_submission_app("/v1/runtime/execute", state);

        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/execute")
            .header("content-type", "application/json")
            .body(Body::from(br#"{"model":"mock","messages":[]}"#.as_slice()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn task_submit_sig_valid_passes() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let state = make_state_with_overture_key(verifying_key);

        let body = br#"{"task_id":"task-1","task_type":{"type":"single_inference","model":"mock","messages":[]}}"#;
        let sig = sign_body(&signing_key, body);
        let app = runtime_submission_app("/v1/runtime/task/submit", state);

        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/submit")
            .header("content-type", "application/json")
            .header("x-igris-decision-sig", sig)
            .body(Body::from(body.as_slice()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn task_submit_sig_missing_rejected() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let state = make_state_with_overture_key(verifying_key);
        let app = runtime_submission_app("/v1/runtime/task/submit", state);

        let req = Request::builder()
            .method("POST")
            .uri("/v1/runtime/task/submit")
            .header("content-type", "application/json")
            .body(Body::from(
                br#"{"task_id":"task-1","task_type":{"type":"single_inference","model":"mock","messages":[]}}"#
                    .as_slice(),
            ))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }
}
