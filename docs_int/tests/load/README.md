# Load Testing for Schlep-Engine

This directory contains load testing scripts and documentation for schlep-engine.

## Quick Start

### Using Go Benchmarks

The fastest way to perform load testing is using the built-in Go benchmark tests:

```bash
# Run benchmark tests
go test ./tests/integration/... -bench=. -benchtime=10s

# Example output:
# BenchmarkE2E_InferenceLatency-8   	      20	 840123456 ns/op
```

### Manual Load Testing with curl

For simple load testing without additional tools:

```bash
# Start the server
PROVIDER_MODE=benchmark PORT=8081 ./schlep-engine-api

# Run concurrent requests using parallel
seq 100 | parallel -j 10 'curl -s -X POST http://localhost:8081/v1/infer \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"gpt-3.5-turbo\",\"messages\":[{\"role\":\"user\",\"content\":\"Test\"}],\"max_tokens\":10}" \
  | jq -r ".id"'
```

### Using Apache Bench (ab)

```bash
# Install Apache Bench (usually pre-installed on macOS/Linux)
# Create request body
cat > /tmp/request.json <<EOF
{
  "model": "gpt-3.5-turbo",
  "messages": [{"role": "user", "content": "Performance test"}],
  "max_tokens": 10
}
EOF

# Run load test: 100 requests, 10 concurrent
ab -n 100 -c 10 -p /tmp/request.json -T application/json \
  http://localhost:8081/v1/infer
```

## Load Test Scenarios

### Scenario 1: Baseline Performance (Single Provider)

**Objective:** Measure baseline latency and throughput

```bash
# Configuration
export PROVIDER_MODE=benchmark
export PORT=8081

# Expected Results
# - Latency: 200-1000ms per request (simulated)
# - Throughput: ~10-20 req/s (limited by simulated latency)
# - Error Rate: <1%
```

### Scenario 2: Multi-Tenant Load

**Objective:** Verify tenant isolation under load

```bash
# Start with multi-tenancy enabled
export ENABLE_MULTI_TENANCY=true
export DATABASE_URL=postgres://user:pass@localhost:5432/schlep
export PROVIDER_MODE=benchmark

# Simulate multiple tenants
for i in {1..5}; do
  (
    # Each tenant makes 20 requests
    seq 20 | while read n; do
      curl -s -X POST http://localhost:8081/v1/infer \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: tenant-$i" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Test"}],"max_tokens":5}'
    done
  ) &
done
wait
```

### Scenario 3: Budget Exhaustion Under Load

**Objective:** Verify budget limits work correctly under concurrent load

```bash
# Set low budget limit
export MAX_MONTHLY_COST_USD=1.00
export PROVIDER_MODE=benchmark

# Send requests until budget exhausted
# Monitor for 403 Forbidden responses when budget exceeded
```

## Metrics to Monitor

### Application Metrics

- **Request Latency:** Target P95 < 2s for benchmark mode
- **Throughput:** Actual req/s achieved
- **Error Rate:** Should be < 1% under normal load
- **Success Rate:** Should be > 99%

### System Metrics

- **CPU Usage:** Monitor Go process CPU %
- **Memory Usage:** Check for memory leaks
- **Goroutine Count:** Should remain stable

### Business Metrics

- **Cost Tracking:** Verify budget tracking accuracy
- **Tenant Isolation:** Confirm no cross-tenant interference

## Expected Results

Based on Phase 2 integration tests:

| Metric | Expected Value | Actual (Integration Tests) |
|--------|---------------|---------------------------|
| Basic Request Success Rate | >99% | 100% (5/5) |
| Avg Latency (Benchmark Mode) | 500-1000ms | 840ms |
| Request Validation | 100% | 100% (3/3 tests) |
| Health Endpoint Response | <100ms | <10ms |
| Metadata Inclusion | 100% | 100% |

## Load Testing with k6 (Advanced)

For more sophisticated load testing, install k6:

```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io/

# Create k6 script
cat > load_test.js <<'EOF'
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
};

export default function () {
  const payload = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Load test' }],
    max_tokens: 10,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  let res = http.post('http://localhost:8081/v1/infer', payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has trace ID': (r) => r.headers['X-Trace-Id'] !== undefined,
  });
}
EOF

# Run the load test
k6 run load_test.js
```

## Continuous Load Testing

For ongoing performance monitoring:

```bash
# Run benchmark every hour
while true; do
  date
  go test ./tests/integration/... -bench=BenchmarkE2E_InferenceLatency -benchtime=30s
  sleep 3600
done
```

## Troubleshooting

### High Latency

- Check provider mode (benchmark has simulated latency)
- Verify no rate limiting is active
- Check system resources (CPU, memory)

### Request Failures

- Check logs: `./schlep-engine-api` output
- Verify budget not exhausted
- Confirm providers are registered correctly

### Memory Issues

- Run with race detector: `go test -race`
- Check for goroutine leaks: `curl http://localhost:8081/debug/pprof/goroutine`

## Phase 2 Validation Checklist

✅ Basic inference requests succeed (100% pass rate)
✅ Request validation works correctly (empty/invalid rejected)
✅ Health endpoints respond correctly
✅ Performance within acceptable bounds (<1s latency)
✅ Sequential requests all succeed (5/5 = 100%)
✅ Metadata included in all responses
✅ Trace IDs present in all responses

## Next Steps

For production deployment, consider:

1. **Real Provider Testing:** Test with actual OpenAI/Anthropic APIs
2. **Extended Load Tests:** Run for hours/days to detect memory leaks
3. **Chaos Testing:** Simulate provider failures, network issues
4. **Geographic Distribution:** Test from multiple regions
5. **Rate Limiting Validation:** Verify rate limits work under load
