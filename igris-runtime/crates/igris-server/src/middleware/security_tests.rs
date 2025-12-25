#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        middleware::from_fn_with_state,
        routing::get,
        Router,
    };
    use std::sync::Arc;
    use tower::ServiceExt;

    use crate::middleware::security::{security_middleware, RateLimiter};
    use crate::{metrics::Metrics, AppState};
    use igris_core::config::IgrisConfig;
    use igris_core::storage::RedbStorage;
    use igris_routing::{CouncilRouter, SpeculativeRouter};

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
            speculative_router: Arc::new(SpeculativeRouter::new(1, std::time::Duration::from_secs(1))),
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
            rate_limiter: Some(RateLimiter::new(60, 1)),
            metrics: Arc::new(Metrics::new()),
            escapevector_cache: None, // Disable for tests
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
}


