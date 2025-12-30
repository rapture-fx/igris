# API Endpoints Reference for Cost & Insights Implementation

This document compiles all available API endpoints from Overture (cloud gateway) and Runtime (edge execution) for implementing the Cost & Insights tab.

---

## OVERTURE APIs (Cloud Gateway)

### 1. Usage & Cost Endpoints

#### `GET /v1/usage`
**Purpose**: Get current month usage and cost data
**Response**:
```json
{
  "tenant_id": "string",
  "current_month": "2025-01",
  "total_spend_usd": 1234.56,
  "budget_limit_usd": 5000.00,
  "remaining_usd": 3765.44,
  "percentage_used": 24.69,
  "breached": false,
  "request_count": 15000,
  "provider_count": 3,
  "model_count": 5,
  "by_provider": [
    {
      "provider": "openai",
      "total_cost_usd": 800.00,
      "request_count": 10000,
      "avg_cost_usd": 0.08,
      "input_tokens": 500000,
      "output_tokens": 300000
    }
  ],
  "by_model": [
    {
      "model": "gpt-4",
      "provider": "openai",
      "total_cost_usd": 500.00,
      "request_count": 5000,
      "avg_cost_usd": 0.10,
      "input_tokens": 250000,
      "output_tokens": 150000
    }
  ]
}
```

#### `GET /v1/usage/history?months=6`
**Purpose**: Get historical monthly usage
**Query Params**: `months` (default: 6, max: 24)
**Response**:
```json
{
  "history": [
    {
      "year_month": "2024-12",
      "total_spend_usd": 4850.00,
      "budget_limit_usd": 5000.00,
      "request_count": 45000,
      "breached": false,
      "breached_at": null
    }
  ],
  "count": 6
}
```

#### `GET /v1/analytics/cost?window=24h`
**Purpose**: Cost analytics for time window
**Query Params**: `window` (default: "1h", format: Go duration)
**Response**:
```json
{
  "provider_breakdown": {
    "openai": 65.5,
    "anthropic": 25.2,
    "custom": 9.3
  },
  "avg_cost_per_request": 0.082,
  "avg_latency_ms": 450,
  "forecast_accuracy": 0.92,
  "total_requests": 15000,
  "total_cost_usd": 1230.00,
  "time_window": "24h",
  "generated_at": "2025-01-15T10:30:00Z"
}
```

#### `GET /v1/analytics/cost/providers?window=24h`
**Purpose**: Per-provider cost statistics
**Response**:
```json
{
  "providers": [
    {
      "provider": "openai",
      "total_cost": 805.65,
      "request_count": 10000,
      "avg_cost": 0.081,
      "avg_latency": 420,
      "forecast_accuracy": 0.94
    }
  ],
  "time_window": "24h",
  "generated_at": "2025-01-15T10:30:00Z"
}
```

#### `GET /v1/analytics/cost/trend?window=24h&interval=1h`
**Purpose**: Cost trend over time
**Query Params**: `window` (default: "24h"), `interval` (default: "1h")
**Response**:
```json
{
  "window": "24h",
  "interval": "1h",
  "trend": [
    {
      "timestamp": "2025-01-15T09:00:00Z",
      "total_cost": 52.30,
      "requests": 650
    }
  ]
}
```

### 2. Routing & Performance Endpoints

#### `GET /v1/routing/stats?hours=24`
**Purpose**: Routing statistics and circuit breaker status
**Query Params**: `hours` (default: 24, max: 168)
**Response**:
```json
{
  "usage": {
    "total_requests": 15000,
    "successful_requests": 14700,
    "failed_requests": 300,
    "success_rate": 98.0
  },
  "providers": {
    "openai": {
      "requests": 10000,
      "latency_ms": 420,
      "error_rate": 0.02
    }
  },
  "circuit_breakers": {
    "anthropic": {
      "status": "closed",
      "failure_count": 0,
      "last_failure_time": null
    }
  }
}
```

#### `GET /v1/routing/leaderboard`
**Purpose**: Top 10 providers by health score
**Response**:
```json
{
  "leaderboard": [
    {
      "provider_id": "openai-1",
      "provider_name": "OpenAI",
      "status": "active",
      "is_verified": true,
      "compatibility_class": "openai",
      "current_latency_ms": 420,
      "uptime_percent": 99.8,
      "requests_24h": 10000,
      "successful_requests_24h": 9800,
      "avg_latency_24h": 425,
      "total_cost_24h": 805.65,
      "health_score": 98.5
    }
  ],
  "count": 10
}
```

### 3. Policy & Quota Endpoints

#### `GET /v1/policy`
**Purpose**: Get budget and quota policy
**Response**:
```json
{
  "tenant_id": "tenant-123",
  "max_monthly_cost_usd": 5000.00,
  "enable_budget_limit": true,
  "fallback_on_budget_breach": true,
  "max_tokens_per_request": 4096,
  "enable_token_limit": true,
  "max_requests_per_minute": 100,
  "max_requests_per_hour": 5000,
  "max_requests_per_day": 100000,
  "enable_rate_limiting": true,
  "alert_webhook_url": "https://hooks.slack.com/...",
  "alert_on_budget_80_percent": true,
  "alert_on_budget_100_percent": true,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### 4. Audit & Logging Endpoints

#### `GET /v1/audit?limit=100&since_hours=24`
**Purpose**: Get audit log entries
**Query Params**: `limit` (max: 1000), `offset`, `event_type`, `category`, `severity`, `since_hours`
**Response**:
```json
{
  "events": [
    {
      "id": "evt-123",
      "event_type": "cost_spike",
      "event_category": "cost_optimization",
      "severity": "warning",
      "provider": "openai",
      "model": "gpt-4",
      "cost_usd": 150.00,
      "trace_id": "trace-456",
      "metadata": {},
      "error_message": null,
      "timestamp": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 500,
  "limit": 100,
  "offset": 0
}
```

### 5. Provider Management Endpoints

#### `GET /v1/providers?status=active`
**Purpose**: List all providers
**Response**:
```json
{
  "providers": [
    {
      "id": "provider-openai-1",
      "name": "OpenAI",
      "status": "active",
      "health": "healthy",
      "last_validated_at": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 3
}
```

---

## RUNTIME APIs (Edge Execution)

### 1. Fleet Management Endpoints

#### `GET /v1/fleet/instances`
**Purpose**: List all fleet instances with detailed metrics
**Response**:
```json
[
  {
    "id": "igris-runtime-us-east-1-a",
    "name": "US-EAST-1 A Runtime",
    "region": "us-east-1",
    "availability_zone": "us-east-1a",
    "status": "Online",
    "version": "v1.6.0",
    "last_heartbeat": "2025-01-15T10:30:00Z",
    "uptime_seconds": 2592000,
    "requests_processed": 50000,
    "error_rate": 0.5,
    "avg_latency": 120,
    "cpu_usage": 45.2,
    "memory_usage": 62.8,
    "sync_status": "InSync",
    "last_sync_time": "2025-01-15T10:00:00Z",
    "capabilities": ["speculative_execution", "council_mode", "cache_optimization"],
    "provider_connections": 3,
    "active_requests": 5
  }
]
```

#### `GET /v1/fleet/metrics`
**Purpose**: Aggregate fleet-wide metrics
**Response**:
```json
{
  "total_instances": 10,
  "online_instances": 9,
  "offline_instances": 1,
  "maintenance_instances": 0,
  "avg_uptime_percentage": 99.8,
  "total_requests_served": 500000,
  "fleet_error_rate": 0.3,
  "regions_covered": 5,
  "total_capacity": 1000,
  "used_capacity": 650
}
```

### 2. Prometheus Metrics Endpoint

#### `GET /metrics`
**Purpose**: Prometheus metrics (text/plain format)
**Available Metrics**:
```
igris_uptime_seconds              # Process uptime in seconds (gauge)
igris_http_requests_total         # Total HTTP requests (counter)
igris_chat_requests_total         # Chat completion requests (counter)
igris_chat_stream_requests_total  # Streaming requests (counter)
igris_tool_exec_total             # Tool executions (counter)
```

### 3. Cost Tracking (Internal Module)

**Note**: Cost tracking is available via Prometheus metrics and internal modules. No dedicated REST endpoint exists.

**Available Cost Metrics** (from cost_tracking.rs):
- `total_cost_usd`: Total cumulative cost
- `winner_cost_usd`: Cost of winning provider
- `wasted_cost_usd`: Cost of failed/unused speculative attempts
- `waste_ratio`: Percentage of wasted cost

---

## KEY INSIGHTS FOR IMPLEMENTATION

### High-Priority Metrics to Display:

**Overture (Cloud) Insights:**
1. **Total Cost & Trend**: `/v1/usage` + `/v1/usage/history`
2. **Cost per Provider/Model**: `/v1/usage` (by_provider, by_model)
3. **Routing Success Rate**: `/v1/routing/stats` (success_rate)
4. **Provider Health & Leaderboard**: `/v1/routing/leaderboard`
5. **Quota Burn Rate**: `/v1/usage` (percentage_used) + `/v1/policy` (max_monthly_cost_usd)
6. **Cost Anomalies**: `/v1/audit` (event_type: "cost_spike")
7. **Forecast Accuracy**: `/v1/analytics/cost` (forecast_accuracy)

**Runtime (Edge) Insights:**
1. **Inference Cost**: Cost tracking module (via Prometheus or internal APIs)
2. **Cost per 1M Tokens**: Calculate from fleet metrics + cost data
3. **GPU Utilization**: `/v1/fleet/instances` (cpu_usage, memory_usage)
4. **Fleet Health**: `/v1/fleet/metrics` (online_instances, error_rate)
5. **Top Cost Drivers**: Aggregate from `/v1/fleet/instances` (requests_processed)

### API Configuration:

All APIs will require authentication. Check the existing dashboard for API configuration:
- Overture base URL: Likely configured in environment or config file
- Runtime base URL: Likely configured in environment or config file
- Auth headers: Check existing API calls in the dashboard codebase

---

## NEXT STEPS:

1. ✅ **Task 1 Complete**: API endpoints compiled
2. **Task 2**: Implement Overture Cost Insights with real API calls
3. **Task 3**: Implement Runtime Cost Insights with real API calls
4. **Task 4**: Add blended insights and polish

---

**Generated**: 2025-01-15
**Source**: Deep codebase audit of /igris-overture and /igris-runtime
