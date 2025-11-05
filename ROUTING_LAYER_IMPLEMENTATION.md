# Universal Routing Layer (Open BYOK MVP)

## 🎯 Overview

The Universal Routing Layer extends Schlep-Engine beyond provider registration to active multi-provider routing. It implements intelligent request routing with automatic failover, health-aware selection, and comprehensive telemetry for cost and performance optimization.

## ✅ Implementation Status

**Status**: ✅ **COMPLETE** - Production-ready intelligent routing with fallback

### Completed Components

- ✅ POST /v1/chat/completions with OpenAI-compatible API
- ✅ Generic HTTP adapter for provider communication
- ✅ Provider selection engine with health-aware ranking
- ✅ Automatic fallback on provider failures (up to 3 providers)
- ✅ Comprehensive telemetry collection and storage
- ✅ Background telemetry aggregation (10-minute intervals)
- ✅ Provider leaderboard with health scores
- ✅ Routing analytics endpoints
- ✅ Integration with existing multi-tenancy and security

## 📁 File Structure

```
schlep-engine/
├── migrations/
│   └── 005_create_routing_telemetry.sql          # Telemetry schema
├── internal/
│   ├── adapters/
│   │   └── http_adapter.go                        # Generic HTTP adapter
│   ├── routing/
│   │   └── provider_selector.go                   # Provider selection engine
│   ├── telemetry/
│   │   └── telemetry_collector.go                 # Telemetry collector
│   ├── scheduler/
│   │   └── telemetry_aggregator.go               # Background aggregation
│   └── api/
│       ├── routes_routing.go                      # Route registration
│       └── telemetry_aggregator_wrapper.go        # API wrapper
└── cmd/schlep-engine-api/
    └── handlers/
        └── chat_router.go                         # Main routing handler
```

## 🗄️ Database Schema

### 1. routing_telemetry

Captures every routed request with detailed metrics:

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant reference |
| trace_id | UUID | Request trace ID |
| provider_id | UUID | Provider used (nullable) |
| provider_name | VARCHAR | Provider name |
| model | VARCHAR | Model requested |
| latency_ms | INTEGER | Response latency |
| tokens_in | INTEGER | Input tokens |
| tokens_out | INTEGER | Output tokens |
| total_tokens | INTEGER | Total tokens |
| success | BOOLEAN | Request success |
| status_code | INTEGER | HTTP status code |
| error_message | TEXT | Error if failed |
| cost_usd | DECIMAL | Estimated cost |
| fallback_count | INTEGER | Fallback attempts |
| selection_reason | VARCHAR | Why provider was selected |
| created_at | TIMESTAMP | Request timestamp |

### 2. provider_performance_aggregates

Pre-computed metrics updated every 10 minutes:

| Field | Type | Description |
|-------|------|-------------|
| provider_id | UUID | Provider reference |
| window_start | TIMESTAMP | Aggregation window start |
| window_end | TIMESTAMP | Aggregation window end |
| total_requests | INTEGER | Total requests in window |
| successful_requests | INTEGER | Successful requests |
| failed_requests | INTEGER | Failed requests |
| success_rate | DECIMAL | Success percentage |
| avg_latency_ms | INTEGER | Average latency |
| p50_latency_ms | INTEGER | Median latency |
| p95_latency_ms | INTEGER | 95th percentile latency |
| p99_latency_ms | INTEGER | 99th percentile latency |
| max_latency_ms | INTEGER | Maximum latency |
| total_cost_usd | DECIMAL | Total cost in window |
| is_degraded | BOOLEAN | Provider is degraded |

### 3. provider_leaderboard (Materialized View)

Fast access to provider rankings:

```sql
SELECT * FROM provider_leaderboard
WHERE tenant_id = 'uuid'
ORDER BY health_score DESC;
```

**Health Score Formula:**
- 40% weight: Success rate (0-100%)
- 30% weight: Latency score (inverse)
  - <500ms: 30 points
  - <1000ms: 25 points
  - <2000ms: 20 points
  - <5000ms: 10 points
- 30% weight: Uptime percentage

## 🚦 Routing Flow

### Request Path

```
1. POST /v1/chat/completions
   ↓
2. Authenticate tenant (JWT/API Key)
   ↓
3. Parse request and validate
   ↓
4. Provider Selection Engine
   - Query active providers for tenant
   - Filter by health (uptime > 80%, latency < 5s)
   - Apply user preferences if provided
   - Rank by health score
   - Return top 3 candidates
   ↓
5. Try Provider #1
   - Get API key from vault
   - Send request via HTTP adapter
   - Record telemetry
   ↓
6. Success? → Return response
   ↓
7. Failure? → Try Provider #2 (fallback)
   ↓
8. Success? → Return response
   ↓
9. All failed? → Return 503 error
```

### Provider Selection Logic

```go
// Selection criteria
criteria := &routing.SelectionCriteria{
    TenantID:           "tenant-uuid",
    Model:              "gpt-4-turbo",
    ProviderPreference: ["openai", "mistral", "deepseek"],  // Optional
    MinUptimePercent:   80.0,    // Default: 80%
    MaxLatencyMs:       5000,    // Default: 5000ms
}

// Get ordered candidates (max 3 for fallback)
candidates := selector.SelectProviders(ctx, criteria, 3)

// Candidates are ranked by:
// 1. User preference (if provided)
// 2. Health score (weighted formula)
// 3. Verified status (verified first)
// 4. Alphabetical name
```

## 🔌 API Endpoints

### 1. Main Routing Endpoint

**POST /v1/chat/completions**

OpenAI-compatible chat completions endpoint with intelligent routing.

**Request:**
```json
{
  "model": "gpt-4-turbo",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "provider_preference": ["openai", "mistral", "deepseek"]
}
```

**Response Headers:**
```
X-Schlep-Routed-By: openai
X-Schlep-Provider-ID: uuid
X-Schlep-Latency-Ms: 423
X-Schlep-Fallback-Count: 0
X-Schlep-Trace-ID: uuid
```

**Response:**
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1699999999,
  "model": "gpt-4-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 9,
    "total_tokens": 24
  }
}
```

**Error Response (All Providers Failed):**
```json
{
  "error": {
    "message": "All providers failed",
    "type": "service_unavailable",
    "code": "ALL_PROVIDERS_FAILED"
  },
  "trace_id": "uuid"
}
```

### 2. Routing Statistics

**GET /v1/routing/stats?hours=24**

Get routing statistics for the authenticated tenant.

**Response:**
```json
{
  "usage": {
    "time_window_hours": 24,
    "total_requests": 1523,
    "successful_requests": 1498,
    "failed_requests": 25,
    "success_rate_percent": 98.36,
    "avg_latency_ms": 445,
    "total_tokens_in": 45672,
    "total_tokens_out": 12345,
    "total_tokens": 58017,
    "total_cost_usd": 1.23,
    "unique_providers_used": 3
  },
  "providers": {
    "total_providers": 5,
    "active_providers": 3,
    "pending_providers": 1,
    "disabled_providers": 1,
    "invalid_providers": 0,
    "avg_latency_ms": 445
  }
}
```

### 3. Recent Requests

**GET /v1/routing/recent?limit=50**

Get recent routing requests for debugging and analysis.

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "trace_id": "uuid",
      "provider_name": "openai",
      "model": "gpt-4-turbo",
      "latency_ms": 423,
      "tokens_in": 15,
      "tokens_out": 9,
      "success": true,
      "status_code": 200,
      "cost_usd": 0.00045,
      "created_at": "2025-11-05T10:30:00Z"
    }
  ],
  "count": 50
}
```

### 4. Provider Leaderboard

**GET /v1/routing/leaderboard**

Get provider rankings based on health score.

**Response:**
```json
{
  "leaderboard": [
    {
      "provider_id": "uuid",
      "provider_name": "openai",
      "status": "active",
      "is_verified": true,
      "compatibility_class": "openai_compatible",
      "current_latency_ms": 423,
      "uptime_percent": 99.8,
      "requests_24h": 523,
      "successful_requests_24h": 521,
      "avg_latency_24h": 445,
      "total_cost_24h": 0.52,
      "health_score": 96.5
    },
    {
      "provider_id": "uuid",
      "provider_name": "deepseek",
      "status": "active",
      "is_verified": true,
      "compatibility_class": "openai_compatible",
      "current_latency_ms": 580,
      "uptime_percent": 98.2,
      "requests_24h": 412,
      "successful_requests_24h": 405,
      "avg_latency_24h": 592,
      "total_cost_24h": 0.08,
      "health_score": 92.3
    }
  ],
  "count": 2
}
```

## 🎯 Provider Selection Engine

### Health-Aware Ranking

The provider selector uses a composite health score:

```go
healthScore = (uptime * 0.4) + (latencyScore * 0.3) + (successRate * 0.3)

// Latency scoring (inverse relationship)
latencyScore := func(latencyMs int) float64 {
    if latencyMs < 500  { return 30.0 }
    if latencyMs < 1000 { return 25.0 }
    if latencyMs < 2000 { return 20.0 }
    if latencyMs < 3000 { return 15.0 }
    if latencyMs < 5000 { return 10.0 }
    return 5.0
}
```

### Filtering Rules

Providers are filtered out if:
- Status is `disabled` or `invalid`
- Uptime < 80% (configurable)
- Latency > 5000ms (configurable)
- Consecutive failures ≥ 3
- In exclusion list (for fallback attempts)

### User Preferences

If `provider_preference` is specified in the request, the selector:
1. Checks if any preferred providers are available and healthy
2. Uses the first available preferred provider
3. Falls back to health-based selection if none available

## 📊 Telemetry Collection

### Automatic Telemetry

Every routed request is automatically logged with:
- **Provider metrics**: latency, status code, success/failure
- **Token usage**: input tokens, output tokens, total tokens
- **Cost estimation**: calculated from provider pricing
- **Selection metadata**: why provider was selected, fallback count
- **Trace ID**: for distributed tracing

### Stored Procedure

Telemetry is recorded via an efficient stored procedure:

```sql
SELECT record_routing_telemetry(
    p_tenant_id,
    p_trace_id,
    p_provider_id,
    p_provider_name,
    p_model,
    p_latency_ms,
    p_tokens_in,
    p_tokens_out,
    p_success,
    p_status_code,
    p_error_message,
    p_cost_usd,
    p_fallback_count,
    p_selection_reason
);
```

This function:
- Inserts telemetry record
- Updates provider health in `provider_registry`
- Returns telemetry ID

## 🔄 Background Jobs

### 1. Telemetry Aggregator

**Frequency:** Every 10 minutes
**Purpose:** Aggregate routing metrics and update provider health

**Actions:**
1. Aggregate last 10 minutes of telemetry per provider
2. Calculate:
   - Total/successful/failed requests
   - Success rate percentage
   - Average, P50, P95, P99, max latency
   - Total tokens and cost
3. Identify degraded providers (success rate < 80% OR avg latency > 5s)
4. Mark degraded providers as `disabled`
5. Refresh provider leaderboard materialized view

**Configuration:**
```bash
export ENABLE_TELEMETRY_AGGREGATOR=true  # Default: true
```

### 2. Provider Health Monitor

**Frequency:** Every 10 minutes
**Purpose:** Validate provider connectivity

**Actions:**
1. Ping all active providers
2. Update health metrics
3. Auto-disable after 3 consecutive failures

## 🔒 Security & Isolation

### Tenant Isolation

- All providers scoped to `tenant_id`
- API keys stored in encrypted vault (AES-256)
- Cross-tenant access blocked by middleware
- Telemetry partitioned by tenant

### Request Security

- JWT or API key authentication required
- Provider API keys retrieved from secure vault
- Keys never logged or exposed in responses
- Trace headers added for internal debugging only

### Rate Limiting

Rate limiting is enforced at the tenant level through the existing multi-tenancy middleware. Future enhancements may add per-provider rate limits.

## 🚀 Setup & Deployment

### 1. Run Database Migration

```bash
psql -h localhost -U schlep_user -d schlep_engine \
  -f migrations/005_create_routing_telemetry.sql
```

### 2. Configure Environment

```bash
# Required
export ENABLE_MULTI_TENANCY=true
export ENABLE_PERSISTENCE=true
export DATABASE_URL=postgres://schlep_user:changeme@localhost:5432/schlep_engine?sslmode=disable
export JWT_SECRET=your-jwt-secret
export VAULT_MASTER_KEY=your-vault-master-key

# Optional
export ENABLE_TELEMETRY_AGGREGATOR=true   # Default: true
export ENABLE_PROVIDER_HEALTH_MONITOR=true # Default: true
```

### 3. Build and Run

```bash
go build -o schlep-engine-api ./cmd/schlep-engine-api/
./schlep-engine-api
```

### 4. Expected Startup Logs

```
[Database] ✅ Database connection established
[Phase 2] Multi-tenancy enabled - initializing...
[Routes] ✓ Registered chat completions routing endpoint
[Routes]   - POST /v1/chat/completions (Intelligent multi-provider routing)
[TelemetryAggregator] ✅ Telemetry aggregator started
[ProviderHealthMonitor] ✅ Provider health monitor started
[Phase 2] ✅ Multi-tenancy initialized successfully
✅ Server ready on port 8080
```

## 📝 Usage Examples

### Complete Workflow

```bash
# 1. Login to get JWT
TOKEN=$(curl -X POST http://localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your-tenant-api-key"}' | jq -r '.token')

# 2. Store provider API keys
curl -X POST http://localhost:8080/v1/vault/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "key_name": "main",
    "api_key": "sk-openai-xxx"
  }'

curl -X POST http://localhost:8080/v1/vault/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deepseek",
    "key_name": "main",
    "api_key": "sk-deepseek-xxx"
  }'

# 3. Register providers
curl -X POST http://localhost:8080/v1/providers/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openai",
    "base_url": "https://api.openai.com/v1",
    "auth_header": "Authorization: Bearer {key}",
    "models": ["gpt-4-turbo", "gpt-3.5-turbo"],
    "pricing": {"input": 0.01, "output": 0.03}
  }'

curl -X POST http://localhost:8080/v1/providers/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "deepseek",
    "base_url": "https://api.deepseek.com/v1",
    "auth_header": "Authorization: Bearer {key}",
    "models": ["deepseek-chat", "deepseek-coder"],
    "pricing": {"input": 0.00014, "output": 0.00028}
  }'

# 4. Send chat completion request (with fallback)
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4-turbo",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain quantum computing in simple terms."}
    ],
    "temperature": 0.7,
    "max_tokens": 500,
    "provider_preference": ["openai", "deepseek"]
  }'

# 5. Check routing statistics
curl -X GET "http://localhost:8080/v1/routing/stats?hours=24" \
  -H "Authorization: Bearer $TOKEN"

# 6. View provider leaderboard
curl -X GET http://localhost:8080/v1/routing/leaderboard \
  -H "Authorization: Bearer $TOKEN"

# 7. View recent requests
curl -X GET "http://localhost:8080/v1/routing/recent?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Provider Fallback Example

If OpenAI fails, request automatically falls back to DeepSeek:

```bash
# Request with provider preference
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "provider_preference": ["openai", "deepseek", "mistral"]
  }' -v

# Response headers show fallback occurred:
# X-Schlep-Routed-By: deepseek
# X-Schlep-Fallback-Count: 1
```

## 📈 Performance Characteristics

### Latency Breakdown

```
Total request latency =
  Authentication (5-10ms) +
  Provider selection (1-3ms) +
  Vault key retrieval (2-5ms) +
  Provider request (200-1000ms) +
  Telemetry recording (2-5ms)

Typical total: 210-1023ms
```

### Throughput

- **Single provider**: Limited by provider rate limits
- **With fallback**: Higher reliability, same throughput
- **Telemetry overhead**: <5ms per request
- **Aggregation**: Runs async, no impact on request path

### Scalability

- **Horizontal scaling**: Fully stateless, scales with app instances
- **Database**: PostgreSQL with optimized indexes
- **Materialized view**: Refreshed every 10 minutes, fast reads
- **Telemetry**: Stored procedure for efficient inserts

## 🐛 Troubleshooting

### All Providers Fail

**Cause:** No healthy providers available or all API keys invalid.

**Solution:**
1. Check provider status: `GET /v1/providers`
2. Verify API keys in vault: `GET /v1/vault/keys`
3. Test individual provider: `POST /v1/providers/test`

### High Latency

**Cause:** Provider is slow or degraded.

**Solution:**
1. Check leaderboard: `GET /v1/routing/leaderboard`
2. View aggregates: Query `provider_performance_aggregates`
3. Manually disable slow provider or wait for auto-disable

### Telemetry Not Recording

**Cause:** Database connection issue or aggregator not running.

**Solution:**
1. Check database connection
2. Verify aggregator is running: logs should show `[TelemetryAggregator] ✅`
3. Check for SQL errors in logs

### Provider Not Being Selected

**Cause:** Provider is disabled, degraded, or doesn't match criteria.

**Solution:**
1. Check provider status and health
2. Verify uptime > 80% and latency < 5000ms
3. Check consecutive failures < 3

## 🔮 Future Enhancements

### Phase 2 Features

- [ ] **Cost-aware routing**: Select cheapest provider within latency bounds
- [ ] **Adaptive caching**: Cache repeated prompts to reduce costs
- [ ] **Streaming support**: Support SSE streaming for chat completions
- [ ] **Custom adapters**: Google Gemini, Amazon Bedrock integration
- [ ] **Request batching**: Batch multiple requests to same provider
- [ ] **Smart retries**: Exponential backoff with jitter
- [ ] **Circuit breakers**: Per-provider circuit breakers
- [ ] **A/B testing**: Split traffic for provider comparison

### Analytics Enhancements

- [ ] **Cost optimization dashboard**: Real-time cost tracking
- [ ] **Provider comparison**: Side-by-side performance metrics
- [ ] **Anomaly detection**: Alert on unusual patterns
- [ ] **Custom alerts**: Webhook/email alerts on failures
- [ ] **Historical trends**: Long-term performance analysis

## 📊 Metrics & Observability

### Prometheus Metrics

The routing layer integrates with existing Prometheus metrics:

```
# Request metrics
schlep_routing_requests_total{provider, model, status}
schlep_routing_latency_seconds{provider, model}
schlep_routing_tokens_total{provider, model, type}
schlep_routing_cost_usd{provider, model}

# Provider health
schlep_provider_health_score{provider}
schlep_provider_uptime_percent{provider}
schlep_provider_latency_ms{provider}

# Fallback metrics
schlep_routing_fallbacks_total{reason}
```

### OpenTelemetry Traces

All routing requests are traced with:
- Span name: `routing.chat_completions`
- Attributes: `provider.name`, `provider.id`, `model`, `fallback.count`
- Events: `provider.selected`, `provider.failed`, `fallback.triggered`

## 🎉 Definition of Done

✅ **All criteria met:**

- [x] POST /v1/chat/completions successfully routes to at least 3 verified providers
- [x] Fallback logic verified under failure conditions (automatic retry)
- [x] Latency and cost telemetry stored and queryable
- [x] Provider selector respects tenant scope and health state
- [x] Basic documentation updated in ROUTING_LAYER_IMPLEMENTATION.md

### Verification

```bash
# 1. Verify routing endpoint works
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}'

# 2. Verify fallback (disable primary provider)
curl -X DELETE http://localhost:8080/v1/providers/{id} \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}'

# Should still succeed with fallback provider

# 3. Verify telemetry
curl -X GET "http://localhost:8080/v1/routing/recent?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# 4. Verify health-based selection
curl -X GET http://localhost:8080/v1/routing/leaderboard \
  -H "Authorization: Bearer $TOKEN"
```

## 🏗️ Architecture Summary

```
User Request
     ↓
┌────────────────────────────────────────────────────────────┐
│  POST /v1/chat/completions                                 │
│  (OpenAI-compatible API)                                   │
└────────────────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────────────────┐
│  Tenant Authentication                                      │
│  (JWT or API Key)                                          │
└────────────────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────────────────┐
│  Provider Selection Engine                                  │
│  ├─ Query active providers for tenant                      │
│  ├─ Filter by health (uptime > 80%, latency < 5s)         │
│  ├─ Apply user preferences                                 │
│  ├─ Rank by health score                                   │
│  └─ Return top 3 candidates                                │
└────────────────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────────────────┐
│  Fallback Loop (up to 3 providers)                        │
│  ├─ Get API key from vault                                 │
│  ├─ Send request via HTTP adapter                          │
│  ├─ Record telemetry                                       │
│  └─ On failure → try next provider                         │
└────────────────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────────────────┐
│  Success: Return provider response                          │
│  Failure: Return 503 with trace ID                         │
└────────────────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────────────────┐
│  Background: Telemetry Aggregator (every 10 min)          │
│  ├─ Aggregate metrics per provider                         │
│  ├─ Update provider health                                 │
│  ├─ Disable degraded providers                             │
│  └─ Refresh leaderboard                                    │
└────────────────────────────────────────────────────────────┘
```

## 📚 Related Documentation

- **Provider Registry**: See `PROVIDER_REGISTRY_IMPLEMENTATION.md`
- **Multi-Tenancy**: See existing docs for authentication and vault
- **API Reference**: OpenAPI spec (coming soon)

---

**Implementation Date:** 2025-11-05
**Version:** 1.0.0
**Author:** Schlep-Engine Team
**License:** MIT
