# Phase 10: Rust Optimizer Phased Activation

## Overview

Phase 10 implements phased rollout of the Rust optimizer with admin control, live decision routing, SLO guardrails, and automatic rollback safety. This enables gradual activation from 1% to 100% with real-time monitoring and automatic reversion on performance degradation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Admin API                                                    │
│  POST /admin/optimizer                                        │
│  • Set mode (go, shadow, rust)                              │
│  • Set sample_rate (0.0 to 1.0)                             │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Runtime Configuration (Hot-Reload)                          │
│  • Mode: go | shadow | rust                                  │
│  • Sample Rate: 0.0 to 1.0                                   │
│  • Thread-safe updates                                       │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  /v1/infer Request Handler                                   │
└───────────────┬─────────────────────────────────────────────┘
                │
                ├──────────── Mode Check ────────────┐
                │                                     │
        mode=rust && rand()<sample_rate?      mode=go/shadow?
                │                                     │
                ▼                                     ▼
┌──────────────────────────┐          ┌──────────────────────────┐
│  Rust Optimizer          │          │  Go Router (Default)     │
│  • SelectAction()        │          │  • Legacy routing        │
│  • FFI call              │          │  • Authoritative         │
│  • Panic handling        │          └──────────────────────────┘
└────────┬─────────────────┘
         │
         ├─── Success ────┐
         │                │
         ▼                ▼ Error/Panic
    Execute          ┌──────────────────────────┐
    Inference        │  Automatic Fallback      │
                     │  • Log failure           │
                     │  • Use Go router         │
                     │  • Record metric         │
                     └──────────────────────────┘
                                │
                                ▼
                     ┌──────────────────────────┐
                     │  SLO Guardrails          │
                     │  • P95 latency check     │
                     │  • Cost delta check      │
                     │  • Error rate check      │
                     │  • Auto-revert to Go     │
                     └──────────────────────────┘
```

## Components

### 1. Runtime Configuration (`internal/config/optimizer_config.go`)

**Features:**
- Thread-safe configuration with RWMutex
- Hot-reload without server restart
- Automatic value validation and clamping

**Key Methods:**
```go
func GetRuntimeConfig() *RuntimeOptimizerConfig
func (r *RuntimeOptimizerConfig) GetMode() shadow.ShadowMode
func (r *RuntimeOptimizerConfig) SetMode(mode shadow.ShadowMode)
func (r *RuntimeOptimizerConfig) GetSampleRate() float64
func (r *RuntimeOptimizerConfig) SetSampleRate(rate float64)
```

### 2. Admin API (`internal/api/admin_optimizer.go`)

**Endpoints:**

#### POST /admin/optimizer
Update optimizer configuration in real-time.

**Request:**
```json
{
  "mode": "rust",
  "sample_rate": 0.25
}
```

**Response:**
```json
{
  "status": "ok",
  "current_mode": "rust",
  "sample_rate": 0.25,
  "timestamp": "2025-10-15T20:00:00Z"
}
```

**Authentication:**
- Header: `X-Admin-Token: <ADMIN_TOKEN>`
- Token must match `ADMIN_TOKEN` environment variable

#### GET /admin/optimizer/status
Get current optimizer status and arm statistics.

**Response:**
```json
{
  "status": "ok",
  "current_mode": "rust",
  "sample_rate": 0.25,
  "updated_at": "2025-10-15T19:55:00Z",
  "timestamp": "2025-10-15T20:00:00Z",
  "arm_stats": [
    {
      "action_id": "openai/gpt-4",
      "alpha": 120.5,
      "beta": 15.2,
      "mean": 0.888
    }
  ]
}
```

### 3. Infer Handler Integration (`cmd/schlep-api/handlers/infer.go`)

**Routing Logic:**
```go
currentMode := h.runtimeConfig.GetMode()
currentSampleRate := h.runtimeConfig.GetSampleRate()

if currentMode == shadow.ShadowModeRust {
    if rand.Float64() < currentSampleRate {
        // Use Rust optimizer with automatic Go fallback
        resp, err = h.routeWithRustOptimizer(c, &req)
        if err != nil {
            // Fallback to Go router
            resp, err = h.router.Route(c.Context(), &req)
        }
    } else {
        // Use Go router (not sampled)
        resp, err = h.router.Route(c.Context(), &req)
    }
}
```

### 4. SLO Guardrails (`internal/inference/optimizer/slo_breaker.go`)

**Monitored Metrics:**
- **P95 Latency Delta**: Max 10% increase
- **Cost Delta**: Max 5% increase
- **Error Rate Delta**: Max 0.5% increase

**Behavior:**
- Collects metrics in sliding 5-minute window
- Requires minimum 100 samples before checking
- Auto-reverts to Go mode on SLO breach
- Logs breach details and records metrics

**Configuration:**
```go
thresholds := optimizer.SLOThresholds{
    P95LatencyDeltaThreshold: 0.10,  // 10%
    CostDeltaThreshold:       0.05,  // 5%
    ErrorRateDeltaThreshold:  0.005, // 0.5%
    WindowDuration:           5 * time.Minute,
    MinSampleSize:            100,
}
```

### 5. Activation Metrics (`internal/inference/optimizer/activation_metrics.go`)

**Prometheus Metrics:**
```
optimizer_live_sample_rate                     # Current sample rate (gauge)
optimizer_current_mode_info{mode}              # Current mode (gauge)
optimizer_rust_decisions_total                 # Rust decisions count (counter)
optimizer_go_fallbacks_total{reason}           # Fallbacks by reason (counter)
optimizer_slo_breaks_total{metric_type}        # SLO breaches (counter)
optimizer_rust_failures_total{error_type}      # Rust failures (counter)
optimizer_activation_requests_total{mode,source} # Requests by mode/source (counter)
optimizer_activation_latency_ms{source}        # Latency histogram (histogram)
optimizer_activation_cost_usd{source}          # Cost histogram (histogram)
```

## Environment Variables

```bash
# Optimizer mode: go, shadow, rust
OPTIMIZER_MODE=shadow

# Sample rate: 0.0 to 1.0 (percentage of traffic to Rust optimizer in rust mode)
OPTIMIZER_SAMPLE_RATE=0.0

# Log directory for shadow mode comparison logs
OPTIMIZER_LOG_DIR=logs/optimizer

# Admin API authentication token (required for /admin/optimizer)
ADMIN_TOKEN=your-secure-token-here
```

## Rollout Plan

### Week 1: Shadow Mode Baseline

```bash
# Set environment variables
export OPTIMIZER_MODE=shadow
export OPTIMIZER_SAMPLE_RATE=1.0
export ADMIN_TOKEN=your-secure-token

# Start server
./schlep-api
```

**Objectives:**
- Establish baseline metrics
- Validate Rust optimizer decisions
- Measure agreement rate with Go router
- Identify any FFI stability issues

**Success Criteria:**
- Agreement rate > 80%
- Zero FFI panics
- Decision latency < 50ms p99

### Week 2-3: Phased Rust Activation

#### Step 1: 1% Traffic
```bash
curl -X POST http://localhost:8080/admin/optimizer \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "rust", "sample_rate": 0.01}'
```

**Monitor for 24 hours:**
- P95 latency delta < 10%
- Cost delta < 5%
- Error rate delta < 0.5%

#### Step 2: 10% Traffic
```bash
curl -X POST http://localhost:8080/admin/optimizer \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "rust", "sample_rate": 0.10}'
```

**Monitor for 48 hours:**
- All SLO metrics within bounds
- No automatic rollbacks
- Cost savings vs Go router

#### Step 3: 25% Traffic
```bash
curl -X POST http://localhost:8080/admin/optimizer \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "rust", "sample_rate": 0.25}'
```

#### Step 4: 50% Traffic
```bash
curl -X POST http://localhost:8080/admin/optimizer \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "rust", "sample_rate": 0.50}'
```

#### Step 5: 100% Traffic
```bash
curl -X POST http://localhost:8080/admin/optimizer \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "rust", "sample_rate": 1.0}'
```

### Rollback Procedure

#### Manual Rollback
```bash
# Immediate revert to Go mode
curl -X POST http://localhost:8080/admin/optimizer \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "go", "sample_rate": 0.0}'
```

#### Automatic Rollback
The SLO breaker automatically reverts to Go mode when:
- P95 latency increases by >10%
- Cost increases by >5%
- Error rate increases by >0.5%

Check metrics:
```promql
# View SLO breaches
optimizer_slo_breaks_total

# View automatic fallbacks
optimizer_go_fallbacks_total
```

## Monitoring

### Grafana Dashboard Queries

**Current Mode:**
```promql
optimizer_current_mode_info
```

**Current Sample Rate:**
```promql
optimizer_live_sample_rate
```

**Rust Decision Rate:**
```promql
rate(optimizer_rust_decisions_total[5m])
```

**Fallback Rate:**
```promql
rate(optimizer_go_fallbacks_total[5m])
```

**SLO Breach Count:**
```promql
optimizer_slo_breaks_total
```

**P95 Latency Comparison:**
```promql
histogram_quantile(0.95,
  rate(optimizer_activation_latency_ms_bucket[5m])
)
```

**Cost Comparison:**
```promql
avg_over_time(optimizer_activation_cost_usd_sum[5m])
  / avg_over_time(optimizer_activation_cost_usd_count[5m])
```

### Alert Rules

**High Fallback Rate:**
```yaml
- alert: HighOptimizerFallbackRate
  expr: rate(optimizer_go_fallbacks_total[5m]) > 0.1
  for: 5m
  annotations:
    summary: "High Rust optimizer fallback rate"
```

**SLO Breach:**
```yaml
- alert: OptimizerSLOBreach
  expr: increase(optimizer_slo_breaks_total[5m]) > 0
  annotations:
    summary: "Optimizer SLO breach detected"
```

**Rust Failures:**
```yaml
- alert: RustOptimizerFailures
  expr: rate(optimizer_rust_failures_total[5m]) > 0.01
  for: 2m
  annotations:
    summary: "Rust optimizer failures detected"
```

## Testing

Run activation tests:
```bash
go test ./tests -run TestOptimizerActivation -v
```

**Test Coverage:**
- Runtime config hot-reload
- Admin API mode switching
- Sample rate rollout (1%, 10%, 25%, 100%)
- SLO guardrail triggers
- Automatic fallback on Rust panic
- Metrics recording

## Troubleshooting

### Issue: High Fallback Rate

**Symptom:**
```
optimizer_go_fallbacks_total{reason="error"} increasing rapidly
```

**Diagnosis:**
```bash
# Check Rust optimizer logs
tail -f logs/optimizer/shadow-*.jsonl | grep error

# Check FFI errors
curl http://localhost:8080/admin/optimizer/status \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

**Resolution:**
1. Revert to Go mode via Admin API
2. Review Rust optimizer FFI errors
3. Fix underlying issue
4. Re-enable with lower sample rate

### Issue: SLO Breach - Latency

**Symptom:**
```
optimizer_slo_breaks_total{metric_type="p95_latency"} > 0
```

**Diagnosis:**
```promql
# Compare latency distributions
histogram_quantile(0.95,
  rate(optimizer_activation_latency_ms_bucket{decision_source="rust_optimizer"}[5m])
)
vs
histogram_quantile(0.95,
  rate(optimizer_activation_latency_ms_bucket{decision_source="go_router"}[5m])
)
```

**Resolution:**
- System automatically reverted to Go mode
- Investigate Rust optimizer performance
- Optimize decision latency
- Re-enable with lower sample rate

### Issue: SLO Breach - Cost

**Symptom:**
```
optimizer_slo_breaks_total{metric_type="cost_delta"} > 0
```

**Diagnosis:**
Review shadow comparison logs:
```bash
jq 'select(.cost_delta_usd > 0)' logs/optimizer/shadow-*.jsonl | head -n 20
```

**Resolution:**
- Review Rust optimizer reward function
- Adjust cost weights in Thompson Sampling
- Verify provider pricing accuracy

## Security

### Admin API Authentication

The Admin API requires a secure token:
```bash
# Set a strong random token
export ADMIN_TOKEN=$(openssl rand -base64 32)

# Use in requests
curl -H "X-Admin-Token: $ADMIN_TOKEN" ...
```

**Best Practices:**
- Use environment variables, not hardcoded tokens
- Rotate tokens regularly
- Use HTTPS in production
- Restrict Admin API to internal network

## Future Enhancements

### Phase 11: Full Rust Optimizer Integration
- Remove Go router dependency
- Direct provider execution from Rust decisions
- Eliminate dual code paths

### Phase 12: Multi-Armed Bandit Tuning
- Auto-tune alpha/beta priors
- Dynamic reward weight adjustment
- Context-aware action selection

### Phase 13: Advanced SLO Guardrails
- Per-provider SLO thresholds
- Time-of-day adjusted thresholds
- Automatic sample rate optimization

## References

- [OPTIMIZER_SHADOW_MODE.md](./OPTIMIZER_SHADOW_MODE.md) - Shadow mode documentation
- [OPTIMIZER_RFC.md](./architecture/OPTIMIZER_RFC.md) - Full technical RFC
- [Rust optimizer source](../rust-core/rust_kernel/src/optimizer/)
- [Thompson Sampling paper](https://web.stanford.edu/~bvr/pubs/TS_Tutorial.pdf)

## Support

For issues or questions:
- Check logs: `logs/optimizer/shadow-*.jsonl`
- Review metrics: `/metrics` endpoint
- Check admin status: `GET /admin/optimizer/status`
- File issue: [GitHub Issues](https://github.com/schlep-engine/schlep-engine/issues)
