# Optimizer Shadow Mode Integration

## Overview

The Rust Optimizer integration uses Thompson Sampling for intelligent provider/model selection. Shadow mode allows running Rust decisions in parallel with existing Go routing logic without affecting live traffic.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  /v1/infer Request                                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Go Router (Authoritative)                                   │
│  • Makes routing decision                                    │
│  • Returns response to user                                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├──────────────────┐
                  │                  │ (Parallel, async)
                  ▼                  ▼
┌──────────────────────┐  ┌──────────────────────┐
│  Live Response       │  │  Shadow Runner       │
│  (Go Decision)       │  │  • Rust FFI call     │
└──────────────────────┘  │  • Compare decisions │
                          │  • Log to JSONL      │
                          │  • Update metrics    │
                          └──────────────────────┘
```

## Components

### 1. Rust Optimizer (`rust-core/rust_kernel/src/optimizer/`)

- **arms.rs**: Bandit arm with Beta distribution
- **bandits.rs**: Thompson Sampling implementation
- **rewards.rs**: Multi-factor reward calculation
- **ffi.rs**: C-compatible FFI exports

### 2. Go FFI Wrapper (`internal/inference/optimizer/ffi/`)

- cgo bindings to Rust cdylib
- Type-safe Go interface
- Memory management (handle lifecycle)

### 3. Shadow Components (`internal/inference/optimizer/shadow/`)

- **shadow_runner.go**: Parallel execution & comparison logic
- **shadow_logger.go**: JSONL file logging with daily rotation
- **shadow_metrics.go**: Prometheus metrics

## Configuration

### Environment Variables

```bash
# Optimizer mode
OPTIMIZER_MODE=shadow  # Options: disabled, shadow, go, rust

# Shadow mode sampling rate (0.0 to 1.0)
OPTIMIZER_SAMPLE_RATE=1.0

# Log directory for comparison logs
OPTIMIZER_LOG_DIR=logs/optimizer
```

### Modes

| Mode       | Behavior                                           |
|------------|---------------------------------------------------|
| `disabled` | No optimizer, use existing routing                |
| `shadow`   | Run Rust in parallel, log comparisons (NO IMPACT) |
| `go`       | Use Go optimizer only                             |
| `rust`     | Use Rust optimizer for live routing (FULL ROLLOUT)|

## Shadow Mode Behavior

### What Happens

1. **Go router makes decision** (existing logic, authoritative)
2. **Shadow runner samples request** (based on `OPTIMIZER_SAMPLE_RATE`)
3. **Rust optimizer called in parallel** (non-blocking)
4. **Decisions compared**:
   - Agreement: Both chose same provider/model
   - Disagreement: Different choices
5. **Results logged to JSONL**:
   ```json
   {
     "trace_id": "req-abc-123",
     "timestamp": "2025-10-15T20:00:00Z",
     "go_decision": "openai/gpt-4",
     "rust_decision": "anthropic/claude-3-5-sonnet",
     "agreed": false,
     "go_cost_usd": 0.003,
     "rust_cost_usd": 0.002,
     "cost_delta_usd": -0.001,
     "go_latency_ms": 150,
     "rust_latency_ms": 120,
     "latency_delta_ms": -30,
     "policy": "cost-optimized",
     "arms": [...]
   }
   ```
6. **Metrics exported** to Prometheus (`/metrics`)

### Zero Impact Guarantee

- ✅ Live routing uses **only** Go decision
- ✅ Rust runs **asynchronously** (goroutine)
- ✅ Errors in Rust **silently logged**, no user impact
- ✅ FFI panics **caught**, Go continues normally
- ✅ Sampling allows **gradual validation** (1% → 10% → 100%)

## Metrics

### Prometheus Endpoints

```
optimizer_shadow_requests_total              # Total shadow requests
optimizer_shadow_agreement_total             # Go == Rust
optimizer_shadow_disagreement_total          # Go != Rust
optimizer_shadow_decision_latency_ms         # Rust decision time (histogram)
optimizer_shadow_cost_delta_usd              # Cost difference (histogram)
optimizer_shadow_latency_delta_ms            # Latency difference (histogram)
optimizer_shadow_errors_total{error_type}    # Errors by type
optimizer_shadow_sampling_rate               # Current sample rate (gauge)
optimizer_shadow_parity_rate                 # Agreement % (gauge)
```

### Example Queries

```promql
# Parity rate (agreement percentage)
optimizer_shadow_agreement_total /
  (optimizer_shadow_agreement_total + optimizer_shadow_disagreement_total)

# Rust decision latency p99
histogram_quantile(0.99, optimizer_shadow_decision_latency_ms)

# Average cost savings (negative = Rust cheaper)
avg_over_time(optimizer_shadow_cost_delta_usd[1h])
```

## Log Files

### Location

`logs/optimizer/shadow-YYYYMMDD.jsonl`

### Rotation

- Daily rotation (automatic)
- Each day creates new file: `shadow-20251015.jsonl`
- Old files retained for analysis

### Example Analysis

```bash
# Count agreements vs disagreements
jq -r '.agreed' logs/optimizer/shadow-20251015.jsonl | sort | uniq -c

# Find cases where Rust was cheaper
jq 'select(.cost_delta_usd < 0)' logs/optimizer/shadow-20251015.jsonl

# Average latency difference
jq '.latency_delta_ms' logs/optimizer/shadow-20251015.jsonl | \
  awk '{sum+=$1; count++} END {print sum/count}'
```

## Integration Example

```go
import (
    "context"
    "github.com/schlep-engine/schlep-engine/internal/config"
    "github.com/schlep-engine/schlep-engine/internal/inference/optimizer/shadow"
)

// Initialize shadow runner
optConfig := config.LoadOptimizerConfig()
shadowConfig := config.CreateShadowConfig(optConfig)
runner, err := shadow.NewShadowRunner(shadowConfig)
if err != nil {
    log.Fatalf("Failed to init shadow runner: %v", err)
}
defer runner.Close()

// In your /v1/infer handler:
func handleInference(ctx context.Context, req InferenceRequest) (*Response, error) {
    // 1. Your existing Go router decision
    goDecision := yourExistingRouter.SelectProvider(req)

    // 2. Run shadow comparison (async, non-blocking)
    go func() {
        shadowReq := shadow.DecisionRequest{
            TraceID:         req.ID,
            AvailableModels: getAvailableModels(),
            Policy:          req.Policy,
        }

        goResult := shadow.DecisionResult{
            ModelID:   goDecision.ProviderModel,
            LatencyMs: goDecision.EstimatedLatencyMs,
            CostUsd:   goDecision.EstimatedCostUsd,
            Source:    "go",
        }

        if err := runner.RunShadowComparison(ctx, shadowReq, goResult); err != nil {
            log.Warnf("Shadow comparison failed: %v", err)
        }
    }()

    // 3. Continue with Go decision (authoritative)
    return executeInference(goDecision)
}
```

## Rollout Plan

### Phase 1: Shadow Mode (Week 1-2)

- Set `OPTIMIZER_MODE=shadow`
- Start with `OPTIMIZER_SAMPLE_RATE=0.01` (1%)
- Monitor metrics for errors
- Analyze log files for parity

### Phase 2: Increase Sampling (Week 3)

- Gradually increase sample rate: 1% → 10% → 50% → 100%
- Monitor:
  - Parity rate (target: >80% agreement)
  - Decision latency (target: <50ms p99)
  - Error rate (target: <0.1%)

### Phase 3: Validation (Week 4)

- Analyze cost savings
- Validate reward improvements
- Review arm statistics
- Decision: Continue shadow or rollout?

### Phase 4: Full Rollout (Week 5+)

- Set `OPTIMIZER_MODE=rust`
- Rust becomes authoritative
- Keep Go as fallback
- Monitor for regressions

## Troubleshooting

### Rust Library Not Loading

```
Error: failed to initialize Rust optimizer: optimizer_init returned null
```

**Fix**: Verify library path:
```bash
ls rust-core/rust_kernel/target/release/libschlep_kernel.*
# Should show .dylib (macOS), .so (Linux), or .dll (Windows)
```

### High Disagreement Rate

If parity < 60%:
1. Check if Go and Rust use same provider pool
2. Verify reward calculation consistency
3. Review arm initialization (alpha, beta priors)

### FFI Panics

```
Error: optimizer_select_action returned null
```

Rust panics are caught at FFI boundary. Check Rust logs for panic details.

## References

- [OPTIMIZER_RFC.md](./architecture/OPTIMIZER_RFC.md) - Full technical RFC
- [Rust optimizer source](../rust-core/rust_kernel/src/optimizer/)
- [Thompson Sampling paper](https://web.stanford.edu/~bvr/pubs/TS_Tutorial.pdf)

## Support

For issues or questions:
- Check logs: `logs/optimizer/shadow-*.jsonl`
- Review metrics: `/metrics` endpoint
- File issue: [GitHub Issues](https://github.com/schlep-engine/schlep-engine/issues)
