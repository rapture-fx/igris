# Phase 1: Cost Visibility - Quick Reference

## 🎯 What Phase 1 Delivers

✅ **Cost Forecasting** - Every request gets estimated cost
✅ **Provider Normalization** - OpenAI & Anthropic unified interface
✅ **Cost Telemetry** - 6 new Prometheus metrics
✅ **Forecast Header** - `X-Schlep-Est-Cost-USD` in response

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `internal/config/cost_map.yaml` | Provider pricing configuration |
| `internal/config/cost_map_loader.go` | YAML loader + cost calculator |
| `internal/providers/provider_adapter.go` | Adapter interface + OpenAI/Anthropic impl |
| `internal/middleware/cost_forecast.go` | Cost forecasting middleware |
| `internal/observability/metrics.go` | Cost metrics (extended) |
| `tests/phase1_cost_forecast_test.go` | Validation tests |

---

## 🚀 Quick Start

### Add Cost Middleware

```go
import "github.com/schlep-engine/schlep-engine/internal/middleware"

// In your main.go
costMiddleware, _ := middleware.NewCostForecastMiddleware()
app.Use(costMiddleware.Handler())
app.Use(costMiddleware.PostRequestHandler()) // After route handlers
```

### Test It

```bash
# Run Phase 1 validation
go test -v -run TestPhase1SuccessCriteria ./tests/

# Check metrics (requires running HTTP service)
curl http://localhost:8080/metrics | grep schlep_
```

---

## 💰 Cost Calculation Examples

### OpenAI GPT-4 Turbo
```
Input: 1000 tokens @ $0.01/1K = $0.01
Output: 500 tokens @ $0.03/1K = $0.015
Total: $0.025
```

### Anthropic Claude 3 Sonnet
```
Input: 1000 tokens @ $0.003/1K = $0.003
Output: 500 tokens @ $0.015/1K = $0.0075
Total: $0.0105
```

---

## 📊 New Metrics

### Cost Tracking
```promql
# Total estimated cost
schlep_estimated_cost_usd_total{provider="openai", model="gpt-4-turbo"}

# Requests with forecast
schlep_forecast_requests_total{provider="openai", forecast_method="pre_request"}

# Cost efficiency
schlep_provider_cost_ratio{provider="anthropic", model="claude-3-sonnet"}
```

### Distribution Metrics
```promql
# Per-request cost (95th percentile)
histogram_quantile(0.95, schlep_request_cost_usd)

# Cost per token (average)
histogram_quantile(0.50, schlep_cost_per_token)

# Forecast accuracy
histogram_quantile(0.95, schlep_cost_forecast_accuracy)
```

---

## 🔌 Provider Adapters

### Get Adapter
```go
registry := providers.NewAdapterRegistry()
adapter, _ := registry.Get("openai")
```

### Normalize Usage
```go
usage, err := adapter.NormalizeUsage(response)
// Returns: inputTokens, outputTokens, totalTokens, estimatedCost
```

### Classify Error
```go
classified := adapter.ClassifyError(err)
if classified.Retryable {
    // Retry with backoff
    time.Sleep(time.Duration(classified.RetryAfter) * time.Second)
}
```

---

## 🧪 Testing Commands

```bash
# All Phase 1 tests
go test -v -run "TestPhase1.*" ./tests/

# Just success criteria
go test -v -run "TestPhase1SuccessCriteria" ./tests/

# Cost map only
go test -v -run "TestCostMapLoading" ./tests/

# Provider adapters only
go test -v -run "TestProviderAdapters" ./tests/
```

---

## 📝 Update Cost Map

Edit `internal/config/cost_map.yaml`:

```yaml
openai:
  gpt-4-turbo:
    input_per_1k: 0.01
    output_per_1k: 0.03
```

Reload without restart:
```go
costMiddleware.ReloadCostMap()
```

---

## 🔍 Error Classification

### Retryable Errors
- `rate_limit` - Wait 60s
- `timeout` - Retry with smaller request
- `service_unavailable` - Wait 10s
- `overloaded` - Exponential backoff

### Non-Retryable Errors
- `authentication` - Fix API key
- `invalid_request` - Fix request format
- `content_filter` - Modify content
- `not_found` - Check model name

---

## ⚙️ Configuration

### Environment Variables
```bash
# Optional: Custom cost map path
export COST_MAP_PATH="/path/to/cost_map.yaml"
```

### Cost Map Config
```yaml
config:
  cost_precision: 6
  enable_fallback: true
  max_cost_per_request: 1.0
  enable_forecast_header: true
  forecast_header_name: "X-Schlep-Est-Cost-USD"
  enable_cost_logging: true
```

---

## 📈 Monitoring Queries

### Cost Analysis
```promql
# Total spend per provider (last hour)
increase(schlep_estimated_cost_usd_total[1h])

# Average cost per request
rate(schlep_estimated_cost_usd_total[5m]) / rate(schlep_forecast_requests_total[5m])

# Expensive requests (>$0.01)
schlep_request_cost_usd > 0.01
```

### Forecast Quality
```promql
# Forecast accuracy (should be near 1.0)
histogram_quantile(0.50, schlep_cost_forecast_accuracy)

# Under-estimates (ratio < 1.0)
count(schlep_cost_forecast_accuracy < 1.0)

# Over-estimates (ratio > 1.0)
count(schlep_cost_forecast_accuracy > 1.0)
```

---

## 🐛 Troubleshooting

### Cost Map Not Loading
```bash
# Check file exists
ls -la internal/config/cost_map.yaml

# Verify YAML syntax
yamllint internal/config/cost_map.yaml

# Test loading
go test -v -run TestCostMapLoading ./tests/
```

### Metrics Not Appearing
```bash
# Check middleware is registered
# Ensure costMiddleware.Handler() is called

# Check metrics endpoint
curl http://localhost:8080/metrics | grep schlep_

# Verify HTTP service is processing requests
```

### Header Not in Response
```yaml
# Check cost map config
config:
  enable_forecast_header: true  # Must be true
  forecast_header_name: "X-Schlep-Est-Cost-USD"
```

---

## ✅ Success Criteria Checklist

- [x] `forecast_header_present` - X-Schlep-Est-Cost-USD enabled
- [x] `cost_map_loaded` - 4 providers loaded
- [x] `providers_normalized` - OpenAI & Anthropic adapters
- [x] `telemetry_metrics_active` - 6 cost metrics defined

**Status**: ✅ ALL MET

---

## 📚 Related Docs

- Full implementation: `PHASE_1_COMPLETE.md`
- Cost map format: `internal/config/cost_map.yaml`
- Metrics definitions: `internal/observability/metrics.go`
- Test examples: `tests/phase1_cost_forecast_test.go`

---

**Version**: Phase 1.0
**Last Updated**: November 8, 2025
