# Schlep-Engine Stability Testing Suite

Comprehensive stability testing framework to ensure API reliability, prevent customer application breaks, and validate FFI stability.

## Overview

This testing suite validates:
- **API Reliability**: Zero 5xx errors under load
- **FFI Stability**: Go ↔ Rust Thompson Sampling boundary
- **Streaming Reliability**: SSE stream stability
- **SLO Enforcement**: Automatic remediation
- **Provider Failover**: Graceful degradation
- **Circuit Breaker**: Fast-fail behavior
- **Error Handling**: Malformed request safety
- **Performance**: Latency and throughput targets

## Quick Start

### Prerequisites

```bash
# Install Python dependencies
pip install aiohttp psutil requests

# Start API in benchmark mode (no real API costs)
cd /Users/wira/Desktop/schlep-engine
export PROVIDER_MODE=benchmark
export ENABLE_COGNITIVE_ADVISOR=true
export OPTIMIZER_MODE=shadow  # or "full" to test FFI
go run cmd/schlep-engine-api/main.go
```

### Run All Tests

```bash
cd stability-tests/scripts

# 1. Load test (basic reliability)
python load_test_basic_requests.py --requests 1000 --concurrency 50

# 2. Response format validation
python response_format_validation.py --iterations 100

# 3. FFI boundary stress test
python test_ffi_boundary.py --concurrency 50 --duration 300

# 4. Streaming reliability
python test_streaming_concurrency.py --concurrent 20 --iterations 100

# 5. SLO Enforcer validation
python test_slo_enforcer.py

# 6. Provider failover simulation
python simulate_provider_outage.py --provider openai --duration 60

# 7. Circuit breaker testing
python test_circuit_breaker.py

# 8. Concurrent load test
python concurrent_load_test.py --concurrency 100 --duration 300

# 9. Malformed request handling
python test_malformed_requests.py --iterations 1000
```

## Test Phases

### Phase 1: FFI Boundary Stress Test

**Purpose**: Validate Go ↔ Rust Thompson Sampling FFI under heavy load

```bash
python test_ffi_boundary.py --concurrency 50 --duration 300
```

**Success Criteria**:
- ✅ No Rust panics or FFI crashes
- ✅ Memory growth < 15%
- ✅ Optimizer successfully processes requests
- ✅ Request success rate ≥ 95%

**What it tests**:
- FFI call stability under concurrent load
- Memory leak detection across FFI boundary
- Thompson Sampling convergence
- Provider selection distribution

### Phase 2: Streaming Reliability Test

**Purpose**: Ensure SSE streams don't hang or drop connections

```bash
python test_streaming_concurrency.py --concurrent 20 --iterations 100
```

**Success Criteria**:
- ✅ Stream completion rate ≥ 99%
- ✅ TTFT (Time to First Token) P95 < 500ms (benchmark mode)
- ✅ Zero broken pipes
- ✅ Timeout rate < 1%

**What it tests**:
- Concurrent SSE stream handling
- Stream completion reliability
- First token latency
- Connection stability

### Phase 3: SLO Enforcer Validation

**Purpose**: Verify SLO Enforcer detects breaches and remediates

```bash
python test_slo_enforcer.py
```

**Success Criteria**:
- ✅ Enforcer detects burn_rate > threshold
- ✅ Strategy switches to optimize for latency
- ✅ Audit events logged with remediation actions

**What it tests**:
- SLO burn rate detection
- Automatic strategy switching
- Audit trail completeness
- Post-remediation performance

**Manual Verification**:
```sql
-- Check audit events in database
SELECT * FROM audit_events
WHERE event_type LIKE '%slo%'
ORDER BY created_at DESC
LIMIT 10;
```

### Phase 4: API Reliability (Standard Load)

**Purpose**: Validate core API never returns 5xx under normal load

```bash
python load_test_basic_requests.py --requests 5000 --concurrency 100
```

**Success Criteria**:
- ✅ 0% 5xx error rate
- ✅ < 1% 4xx error rate
- ✅ P95 latency < 2000ms
- ✅ Availability ≥ 99.9%

### Phase 5: Provider Failover

**Purpose**: Validate graceful degradation when providers fail

```bash
python simulate_provider_outage.py --provider openai --duration 60
```

**Success Criteria**:
- ✅ API availability ≥ 99% during outage
- ✅ No 5xx errors
- ✅ P95 latency < 5000ms

### Phase 6: Circuit Breaker Testing

**Purpose**: Validate circuit breaker opens and recovers properly

```bash
python test_circuit_breaker.py
```

**Success Criteria**:
- ✅ Circuit opens after threshold failures
- ✅ Fast-fail rate ≥ 70% when open
- ✅ Successful recovery after timeout
- ✅ No cascading failures

### Phase 7: Concurrent Load Test

**Purpose**: Performance under realistic concurrent load

```bash
python concurrent_load_test.py --concurrency 100 --duration 300
```

**Success Criteria**:
- ✅ P95 latency < 2000ms
- ✅ Availability ≥ 99.9%
- ✅ Memory growth < 10%
- ✅ No 5xx errors

### Phase 8: Malformed Request Handling

**Purpose**: Robustness against edge cases and attacks

```bash
python test_malformed_requests.py --iterations 1000
```

**Success Criteria**:
- ✅ All malformed requests return 4xx (not 5xx)
- ✅ No server crashes
- ✅ Rejection rate ≥ 70%

## Monitoring & Observability

### Prometheus Alerts

```bash
# Load alert rules into Prometheus
kubectl apply -f monitoring/prometheus-alerts.yml
```

**Key Alerts**:
- `HighServerErrorRate`: 5xx rate > 1% for 2m
- `APICompleteOutage`: No successful requests for 2m
- `ProviderCircuitBreakerOpen`: Circuit open for 5m
- `SLOAvailabilityBreach`: Availability < 99.9%

### Grafana Dashboard

```bash
# Import dashboard
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana-dashboard.json
```

**Dashboard Panels**:
- API Health Overview (availability %)
- P95 Response Latency
- Error Rate (5xx)
- Provider Health Status
- Circuit Breaker States
- Memory Usage
- Cost per Hour

### Real-Time Monitoring

```bash
# Watch API metrics
watch -n 2 'curl -s http://localhost:8080/metrics | grep -E "http_requests_total|latency"'

# Check provider stats
curl -s http://localhost:8080/v1/providers/stats | jq

# Health check
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```

## Rollback Procedures

### Automatic Rollback

```bash
# Run automatic rollback check
./scripts/rollback_automation.sh
```

**Trigger Conditions**:
- 5xx error rate > 5% for 10 minutes
- P95 latency > 10 seconds
- Complete API outage for 2 minutes

### Manual Rollback

```bash
# Kubernetes
kubectl rollout undo deployment/schlep-engine-api
kubectl rollout status deployment/schlep-engine-api

# Docker Compose
docker-compose down
docker-compose up -d
```

## Success Criteria Summary

| Test | Target | Critical |
|------|--------|----------|
| 5xx Error Rate | 0% | ✅ Yes |
| Availability | ≥99.9% | ✅ Yes |
| P95 Latency | <2000ms | ⚠️ Warning |
| FFI Panics | 0 | ✅ Yes |
| Stream Completion | ≥99% | ✅ Yes |
| Broken Pipes | 0 | ✅ Yes |
| Memory Growth | <10% | ⚠️ Warning |
| Server Crashes | 0 | ✅ Yes |

## Configuration for Testing

### Benchmark Mode (Recommended)

```bash
export PROVIDER_MODE=benchmark
export ENABLE_BENCHMARK_FALLBACK=true
```

**Benefits**:
- Zero API costs
- Realistic latency simulation
- Predictable responses
- Safe for stress testing

### Real Mode (Production Validation)

```bash
export PROVIDER_MODE=real
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export MAX_MONTHLY_COST_USD=10.0
```

**Use for**:
- Pre-production validation
- Live failover testing
- Cost safety validation

## Incident Response

### Detected Issues During Testing

1. **High 5xx Rate**
   ```bash
   # Check recent logs
   kubectl logs deployment/schlep-engine-api --tail=100

   # Check provider health
   curl http://localhost:8080/v1/providers/stats

   # Initiate rollback if needed
   ./scripts/rollback_automation.sh
   ```

2. **FFI Crash/Panic**
   ```bash
   # Check for core dumps
   ls -lh /tmp/core.*

   # Review Rust optimizer logs
   grep -i "panic\|ffi" logs/*.log

   # Disable optimizer as fallback
   export OPTIMIZER_MODE=go-only
   kubectl rollout restart deployment/schlep-engine-api
   ```

3. **Memory Leak**
   ```bash
   # Get heap profile
   curl http://localhost:8080/debug/pprof/heap > heap.prof
   go tool pprof -http=:8081 heap.prof

   # Check for FFI leaks
   ps aux | grep schlep-engine-api
   ```

4. **Circuit Breaker Stuck Open**
   ```bash
   # Check provider health
   curl http://localhost:8080/v1/providers/stats

   # Reset circuit breaker (if endpoint exists)
   curl -X POST http://localhost:8080/v1/circuit-breaker/reset
   ```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Stability Tests
on: [push, pull_request]
jobs:
  stability:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start API
        run: |
          export PROVIDER_MODE=benchmark
          go run cmd/schlep-engine-api/main.go &
          sleep 10
      - name: Run Stability Tests
        run: |
          cd stability-tests/scripts
          python load_test_basic_requests.py --requests 100
          python test_ffi_boundary.py --duration 60
          python test_streaming_concurrency.py --iterations 20
```

## Reporting

### Generate Test Report

```bash
# Run all tests and generate report
./scripts/run_all_tests.sh > stability_report_$(date +%Y%m%d).txt
```

### Report Format

- Executive Summary
- Test Results by Phase
- Performance Metrics
- Failure Analysis
- Recommendations

## Troubleshooting

### Tests Failing

1. **Connection Refused**
   - Ensure API is running: `curl http://localhost:8080/healthz`
   - Check port: `lsof -i :8080`

2. **Timeout Errors**
   - Increase timeout: `--timeout 60`
   - Check API logs for slow queries

3. **Memory Errors**
   - Reduce concurrency: `--concurrency 20`
   - Check available memory: `free -h`

### Common Issues

- **FFI tests show 0 optimizer calls**: Set `OPTIMIZER_MODE=full`
- **SLO enforcer not detected**: Requires database access or observability
- **Streaming tests timeout**: Check for firewall blocking SSE

## Next Steps

1. **Baseline Testing**: Run all tests to establish baseline metrics
2. **Regular Testing**: Schedule weekly stability test runs
3. **Pre-Deployment**: Run before each production deployment
4. **Continuous Monitoring**: Set up Prometheus + Grafana
5. **Incident Response**: Use rollback automation for critical issues

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/schlep-engine/issues
- Documentation: https://docs.schlep-engine.com
- On-call: Check PagerDuty rotation
