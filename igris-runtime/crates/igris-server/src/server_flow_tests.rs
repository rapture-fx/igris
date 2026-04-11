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
    use std::{convert::Infallible, net::SocketAddr, sync::Arc};
    use tokio::net::TcpListener;
    use tower::ServiceExt;
    use igris_routing::thompson::ThompsonSamplingRouter;

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
            Ok::<Event, Infallible>(Event::default().data(
                serde_json::json!({
                    "choices": [{ "delta": { "content": "hel" } }]
                })
                .to_string(),
            )),
            Ok::<Event, Infallible>(Event::default().data(
                serde_json::json!({
                    "choices": [{ "delta": { "content": "lo" } }]
                })
                .to_string(),
            )),
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

        let cloud_providers = cfg.providers.iter().map(|p| CloudProvider::new(p.clone())).collect();
        let db_path = std::env::temp_dir().join(format!("igris-test-{}.db", uuid::Uuid::new_v4()));
        AppState {
            config: Arc::new(cfg),
            storage: Arc::new(RedbStorage::new(db_path).unwrap()),
            speculative_router: Arc::new(SpeculativeRouter::new(3, std::time::Duration::from_secs(2))),
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
            task_cancellation_registry: Arc::new(std::sync::RwLock::new(std::collections::HashMap::new())),
            bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
        }
    }

    fn build_test_app(state: AppState) -> Router {
        Router::new()
            .route("/v1/chat/completions", post(chat_completions))
            .with_state(state)
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

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
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
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let text = String::from_utf8_lossy(&bytes);
        assert!(text.contains("data:"));
        assert!(text.contains("[DONE]"));
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
        cache.save_response(prompt, cached_response, "gpt-4", 0.95).unwrap();

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

        let cloud_providers = cfg.providers.iter().map(|p| CloudProvider::new(p.clone())).collect();
        let db_path = std::env::temp_dir().join(format!("igris-test-{}.db", uuid::Uuid::new_v4()));

        let state = AppState {
            config: Arc::new(cfg),
            storage: Arc::new(RedbStorage::new(db_path).unwrap()),
            speculative_router: Arc::new(SpeculativeRouter::new(3, std::time::Duration::from_millis(100))),
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
            task_cancellation_registry: Arc::new(std::sync::RwLock::new(std::collections::HashMap::new())),
            bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
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

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        // Verify response content
        let content = v["choices"][0]["message"]["content"].as_str().unwrap();
        assert_eq!(content, cached_response);

        // Verify metadata indicates degraded mode
        let metadata = &v["metadata"];
        assert!(metadata.is_object(), "metadata should be present");
        assert_eq!(metadata["degraded"].as_bool().unwrap(), true);
        assert!(metadata["source"].as_str().unwrap().starts_with("escapevector-cache:"));
        assert!(metadata["cache_age_seconds"].is_u64());
        assert_eq!(metadata["quality_score"].as_f64().unwrap(), 0.95);

        // Cleanup
        cache.clear().unwrap();
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn escapevector_cache_miss_returns_503() {
        // Setup: Create empty EscapeVector cache
        let temp_dir = std::env::temp_dir().join(format!("igris-test-ev-miss-{}", uuid::Uuid::new_v4()));
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

        let cloud_providers = cfg.providers.iter().map(|p| CloudProvider::new(p.clone())).collect();
        let db_path = std::env::temp_dir().join(format!("igris-test-{}.db", uuid::Uuid::new_v4()));

        let state = AppState {
            config: Arc::new(cfg),
            storage: Arc::new(RedbStorage::new(db_path).unwrap()),
            speculative_router: Arc::new(SpeculativeRouter::new(3, std::time::Duration::from_millis(100))),
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
            task_cancellation_registry: Arc::new(std::sync::RwLock::new(std::collections::HashMap::new())),
            bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
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

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
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

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        // Verify metadata is absent or null for normal requests
        assert!(v["metadata"].is_null(), "metadata should be null for normal responses");
    }
}
