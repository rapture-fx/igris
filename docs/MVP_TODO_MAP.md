# MVP /v1/infer TODO Map

**Generated**: 2025-10-15
**Status**: MVP Scaffolding Complete - Implementation Pending

---

## Executive Summary

The MVP scaffolding for `/v1/infer` endpoint has been completed with comprehensive provider abstractions, intelligent routing, and test infrastructure. The following TODO items represent the next phase of implementation.

---

## Critical Path Items (P0 - Required for MVP)

### 1. Provider API Integration

**OpenAI Provider** (`internal/providers/openai/openai_provider.go`)
- [ ] Replace `interface{}` client with actual OpenAI HTTP client
- [ ] Implement `Infer()` method with real API calls
- [ ] Implement `InferStream()` for streaming completions
- [ ] Implement accurate token counting (tiktoken library)
- [ ] Add model-specific pricing tables (GPT-4, GPT-3.5, etc.)
- [ ] Implement proper error handling and retries
- [ ] Add request/response logging

**Anthropic Provider** (`internal/providers/anthropic/anthropic_provider.go`)
- [ ] Replace `interface{}` client with actual Anthropic HTTP client
- [ ] Implement `Infer()` method with real API calls
- [ ] Handle Anthropic-specific message format (system message as parameter)
- [ ] Implement `InferStream()` for streaming SSE events
- [ ] Implement Anthropic token counting
- [ ] Add model-specific pricing (Claude 3 Opus, Sonnet, Haiku)
- [ ] Handle Anthropic API versioning headers

### 2. Configuration Management

**Environment Variables** (`cmd/schlep-api/handlers/infer.go`)
- [ ] Load OpenAI API key from environment (`OPENAI_API_KEY`)
- [ ] Load Anthropic API key from environment (`ANTHROPIC_API_KEY`)
- [ ] Support configuration files (YAML/TOML)
- [ ] Add secrets management integration (Vault, AWS Secrets Manager)
- [ ] Implement configuration validation on startup

### 3. Model Provider Detection

**Smart Routing** (`internal/models/infer_request.go:GetProvider()`)
- [ ] Implement intelligent model name parsing:
  - `gpt-4` → OpenAI
  - `claude-3-opus` → Anthropic
  - Custom models → Python adapter
- [ ] Add model registry lookup
- [ ] Handle model aliases and versions
- [ ] Validate model availability before routing

### 4. Health Checks

**Provider Health** (`internal/providers/*/provider.go:HealthCheck()`)
- [ ] Implement OpenAI health check (API key validation)
- [ ] Implement Anthropic health check (lightweight API call)
- [ ] Add circuit breaker pattern for failing providers
- [ ] Expose `/v1/health` with provider status

---

## High Priority Items (P1 - Critical for Production)

### 5. Rust Optimizer Integration

**FFI Integration** (`internal/inference/router_integration.go`)
- [ ] Integrate Rust FFI optimizer per `OPTIMIZER_RFC.md`
- [ ] Replace `optimizeProviderSelection()` with Rust Thompson Sampling
- [ ] Implement `sendOptimizerFeedback()` to update arm states
- [ ] Add feature flag for Rust optimizer (`ENABLE_RUST_OPTIMIZER`)
- [ ] Implement fallback to Go router on Rust failure

**Thompson Sampling**
- [ ] Replace placeholder weighted random selection
- [ ] Implement proper Beta distribution sampling
- [ ] Track provider performance metrics (latency, cost, success rate)
- [ ] Calculate reward signals for reinforcement learning

### 6. Python Adapter Provider

**ML Service Integration** (`cmd/schlep-api/handlers/infer.go`)
- [ ] Create Python adapter provider implementation
- [ ] Connect to existing gRPC Python ML service
- [ ] Map InferRequest → Python gRPC format
- [ ] Map Python response → InferResponse format
- [ ] Add model registration for custom models

### 7. Cost Tracking and Billing

**Cost Estimation** (`internal/providers/*/provider.go:EstimateCost()`)
- [ ] Load real-time pricing from provider APIs
- [ ] Implement cost caching with TTL
- [ ] Add cost alerts and budgets
- [ ] Expose cost breakdown in response metadata

### 8. Caching Layer

**Response Caching** (`internal/models/infer_request.go:EnableCaching`)
- [ ] Integrate with existing Redis cache (`internal/cache/`)
- [ ] Implement semantic cache key generation
- [ ] Add cache warming for popular prompts
- [ ] Support cache TTL per request
- [ ] Add cache hit/miss metrics

---

## Medium Priority Items (P2 - Post-MVP)

### 9. Streaming Enhancements

**Real-time Streaming** (tests/infer_api_test.go)
- [ ] Add comprehensive streaming tests
- [ ] Implement backpressure handling
- [ ] Add token-by-token latency metrics (TTFT, TBT)
- [ ] Support Server-Sent Events (SSE) correctly
- [ ] Add WebSocket streaming option

### 10. Model Registry

**Centralized Model Management** (`cmd/schlep-api/handlers/infer.go:HandleModels()`)
- [ ] Create model registry with capabilities
- [ ] Auto-discover models from providers
- [ ] Add model versioning support
- [ ] Implement model deprecation warnings
- [ ] Add model performance benchmarks

### 11. Advanced Routing

**Policy-based Routing** (`internal/inference/router_integration.go`)
- [ ] Implement cost-optimized routing
- [ ] Add latency-optimized routing
- [ ] Support multi-objective optimization
- [ ] Add A/B testing framework
- [ ] Implement canary deployments

### 12. Observability

**Metrics and Tracing**
- [ ] Add Prometheus metrics for all endpoints
- [ ] Implement OpenTelemetry tracing
- [ ] Add request/response logging (structured)
- [ ] Create Grafana dashboards
- [ ] Set up alerting rules

---

## Low Priority Items (P3 - Future Enhancements)

### 13. Performance Optimization

**Benchmarking** (tests/infer_api_test.go)
- [ ] Add performance benchmarks (`BenchmarkInferEndpoint`)
- [ ] Add concurrency stress tests
- [ ] Measure FFI overhead
- [ ] Optimize JSON parsing/serialization
- [ ] Add connection pooling

### 14. Security

**Authentication and Authorization**
- [ ] Add API key authentication
- [ ] Implement JWT token validation
- [ ] Add rate limiting per user/organization
- [ ] Implement request signing
- [ ] Add CORS configuration

### 15. Documentation

**API Documentation**
- [ ] Generate OpenAPI/Swagger specs
- [ ] Add API usage examples
- [ ] Document error codes and responses
- [ ] Create migration guide from OpenAI/Anthropic
- [ ] Add performance tuning guide

---

## Build Blockers (Must Fix Before MVP)

### Package Conflicts

**Issue**: Multiple package names in same directory

**Affected Files**:
1. `internal/inference/` - contains both `ml` and `router` packages
   - `handler.go` (package ml)
   - `policy.go` (package router)
   - **Fix**: Separate into `internal/inference/ml/` and `internal/inference/router/`

2. `internal/api/` - contains both `middleware` and `api` packages
   - `ratelimit.go` (package middleware)
   - `routes_infer.go` (package api)
   - **Fix**: Move `ratelimit.go` to `internal/middleware/`

3. `labs/proto/proto/` - contains both `ml` and `proto` packages
   - **Fix**: Consolidate to single package name

4. `web/apps/python-ml-service/proto/` - contains `ml` and `ml_service` packages
   - **Fix**: Standardize on single package name

### Missing Dependencies

**go.sum entries needed**:
```bash
go get go.opentelemetry.io/otel/sdk/resource@v1.21.0
go get github.com/gofiber/fiber/v2@v2.52.0
go get github.com/prometheus/client_golang/api/prometheus/v1@v1.18.0
go get golang.org/x/crypto/blake2b@v0.40.0
```

### Missing Packages

**Create or fix import paths**:
- `github.com/schlep-engine/schlep-engine/proto` (currently missing)
- `github.com/schlep-engine/schlep-engine/proto/orchestration` (currently missing)
- `github.com/schlep-engine/schlep-engine/web/apps/go-gateway/proto/ml/v1` (currently missing)
- `github.com/schlep-engine/schlep-engine/internal/vault` (currently missing)

---

## Implementation Priority

### Week 1-2: MVP Core
1. Fix package conflicts
2. Add missing dependencies
3. Implement OpenAI provider (real API calls)
4. Implement Anthropic provider (real API calls)
5. Add configuration management (env vars)
6. Implement basic health checks

### Week 3-4: Production Readiness
7. Integrate Rust optimizer (per OPTIMIZER_RFC.md)
8. Add Python adapter provider
9. Implement caching layer
10. Add comprehensive logging and metrics

### Week 5-6: Polish and Testing
11. Add streaming tests
12. Performance benchmarking
13. Security hardening (API keys, rate limiting)
14. Documentation and examples

---

## Success Criteria

**MVP is production-ready when**:
- [ ] All P0 items completed
- [ ] Build passes without errors
- [ ] All tests pass
- [ ] OpenAI and Anthropic providers working
- [ ] Response times < 2s (p95)
- [ ] Cost tracking accurate within 5%
- [ ] Health checks functional
- [ ] Basic monitoring in place

---

## Related Documentation

- [OPTIMIZER_RFC.md](architecture/OPTIMIZER_RFC.md) - Rust optimizer integration guide
- [STRUCTURE_STABILIZATION_LOG.md](STRUCTURE_STABILIZATION_LOG.md) - Repository structure changes
- Proto generation: `docs/proto_generation_report.txt`

---

**Last Updated**: 2025-10-15
**Next Review**: After fixing build blockers
