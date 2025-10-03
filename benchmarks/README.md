# Hybrid Architecture Benchmark Suite

Comprehensive benchmarking and validation suite for the Schlep-Engine hybrid architecture (Go + Rust + Python).

## Overview

This benchmark suite validates:
- ✅ **Rust FFI latency** <1μs (sub-microsecond overhead)
- ✅ **Python gRPC latency** <20ms (acceptable for ML operations)
- ✅ **Go API throughput** >5000 req/s
- ✅ **Memory leak prevention** over 1M FFI calls
- ✅ **gRPC auto-reconnection** after Python service failures
- ✅ **Horizontal scaling** with multiple replicas

## Quick Start

### Prerequisites

1. **Services must be running:**
   ```bash
   docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml up
   ```

2. **Go 1.21+ installed** (for building benchmark suite)

### Run Full Benchmark Suite

```bash
# Run with default settings (100 concurrent, 10s duration)
./benchmarks/run_benchmarks.sh

# Or customize concurrency and duration
CONCURRENCY=1000 DURATION=60 ./benchmarks/run_benchmarks.sh
```

### View Results

```bash
# Machine-readable JSON
cat benchmarks/results/results.json

# Human-readable report
cat benchmarks/results/REPORT.md
```

## Benchmark Structure

### 1. Endpoint Benchmarks

Tests each endpoint with configurable concurrency:

| Endpoint | Purpose | Target |
|----------|---------|--------|
| `/health` | Baseline Go API latency | P99 <10ms |
| `/rust/add` | Rust FFI validation | P99 <1ms |
| `/rust/hello` | String handling across FFI | P99 <1ms |
| `/ml/predict` | Python gRPC latency | P99 <20ms |
| `/test/hybrid` | Full stack (Go→Rust→Python) | P99 <30ms |

**Metrics collected:**
- Latency distribution (P50, P95, P99, P99.9)
- Throughput (requests/sec)
- Resource usage (CPU, memory, goroutines)
- Error rates

### 2. Stress Tests

#### Sustained Load Test
- **Duration:** 600 seconds (10 minutes)
- **Target:** 10,000 RPS sustained
- **Validates:** System stability under prolonged load

#### Burst Load Test
- **Target:** 1M requests in <60 seconds
- **Validates:** Peak capacity handling

#### Failure Injection
- **Scenarios:**
  - Rust kernel panic simulation
  - Python gRPC service downtime
  - Network latency injection
- **Validates:** Resilience and recovery

### 3. Validation Tests

#### Memory Leak Test
- **Method:** 1M Rust FFI calls with string allocation
- **Measurement:** Memory growth before/after
- **Pass criteria:** <10% memory growth
- **Validates:** Proper `rust_free_string()` usage

#### gRPC Auto-Reconnect Test
- **Method:** Restart Python ML service mid-test
- **Measurement:** Reconnection time and success rate
- **Pass criteria:** Successful reconnection <5s
- **Validates:** Connection pool resilience

#### Horizontal Scaling Test
- **Method:** Scale to 3 Go gateway replicas
- **Measurement:** Load distribution and latency
- **Pass criteria:** Requests evenly distributed
- **Validates:** Stateless architecture

## Example Output

### Terminal Output

```
🚀 Schlep-Engine Hybrid Architecture Benchmark Suite
====================================================

⏳ Checking if services are running...
✅ Services are ready

📊 Running Endpoint Benchmarks...
  Testing health (GET /health)...
    ✓ P50: 3.42ms, P99: 8.15ms, RPS: 8542, Errors: 0
  Testing rust_add (GET /rust/add?x=42&y=58)...
    ✓ P50: 0.12ms, P99: 0.85ms, RPS: 125000, Errors: 0
  Testing ml_predict (POST /ml/predict)...
    ✓ P50: 8.23ms, P99: 15.42ms, RPS: 1203, Errors: 0

🔥 Running Stress Tests...
  Running sustained load test (600s, 10k RPS target)...
    ✓ Success Rate: 99.98%, P99: 12.34ms
  Running burst load test (1M requests target)...
    ✓ Duration: 45.23s, Success Rate: 99.95%

✅ Running Validation Tests...
  Running memory leak test (1M FFI calls)...
    ✓ PASSED - Memory growth: 4.23MB (3.2%)
  Running gRPC auto-reconnect test...
    ✓ PASSED - Reconnected in 1234ms
  Running horizontal scaling test...
    ✓ PASSED - 3 replicas, avg latency: 5.67ms

📊 Benchmark Summary
====================
Key Metrics:
  health: P99=8.15ms, RPS=8542
  rust_add: P99=0.85ms, RPS=125000
  rust_hello: P99=0.92ms, RPS=118000
  ml_predict: P99=15.42ms, RPS=1203
  hybrid_test: P99=18.67ms, RPS=987

Validation Tests:
  Memory Leak: ✅ PASSED
  gRPC Recovery: ✅ PASSED
  Horizontal Scaling: ✅ PASSED

📁 Files Generated:
   - benchmarks/results/results.json (machine-readable)
   - benchmarks/results/REPORT.md (human-readable)

✅ Benchmark suite completed successfully!
```

### Generated Files

#### results.json (excerpt)

```json
{
  "timestamp": "2025-10-03T10:30:00Z",
  "architecture": "Go + Rust FFI + Python gRPC",
  "concurrency": 100,
  "endpoints": {
    "rust_add": {
      "endpoint": "rust_add",
      "method": "GET",
      "latency": {
        "p50_ms": 0.12,
        "p95_ms": 0.45,
        "p99_ms": 0.85,
        "p999_ms": 1.23,
        "mean_ms": 0.18,
        "min_ms": 0.08,
        "max_ms": 2.15,
        "std_dev_ms": 0.22
      },
      "throughput": {
        "requests_per_second": 125000,
        "total_requests": 1250000,
        "duration_seconds": 10.0
      },
      "resources": {
        "cpu_percent": 45.2,
        "memory_mb": 128.5,
        "memory_percent": 3.2,
        "goroutines": 154
      },
      "errors": 0,
      "error_rate_percent": 0.0
    }
  },
  "validation_results": {
    "memory_leak_test": {
      "passed": true,
      "total_calls": 1000000,
      "initial_memory_mb": 125.3,
      "final_memory_mb": 129.5,
      "memory_growth_mb": 4.2,
      "growth_percent": 3.35,
      "acceptable_growth": true
    }
  }
}
```

#### REPORT.md (excerpt)

```markdown
# Schlep-Engine Hybrid Architecture Benchmark Report

**Generated:** 2025-10-03T10:45:00Z
**Architecture:** Go + Rust FFI + Python gRPC
**Test Duration:** 720.45 seconds
**Concurrency Level:** 100

## Executive Summary

### Overall Performance

| Metric | Value |
|--------|-------|
| **Total Requests** | 15,234,567 |
| **Success Rate** | 99.97% |
| **Average P99 Latency** | 12.34ms |
| **Endpoints Tested** | 5 |

### Key Achievements ✅

- ✅ **Rust FFI latency**: P99 = 0.850ms (<1ms target achieved)
- ✅ **Python gRPC latency**: P99 = 15.42ms (<20ms target achieved)
- ✅ **Throughput**: 8542 req/s (>5000 target achieved)
- ✅ **Memory leak test**: PASSED (3.35% growth over 1M calls)

...
```

## Customization

### Adjust Concurrency

```bash
# Light load (10 concurrent)
CONCURRENCY=10 ./benchmarks/run_benchmarks.sh

# Medium load (100 concurrent - default)
CONCURRENCY=100 ./benchmarks/run_benchmarks.sh

# Heavy load (1000 concurrent)
CONCURRENCY=1000 ./benchmarks/run_benchmarks.sh

# Extreme load (10k concurrent)
CONCURRENCY=10000 ./benchmarks/run_benchmarks.sh
```

### Adjust Duration

```bash
# Quick test (5 seconds per endpoint)
DURATION=5 ./benchmarks/run_benchmarks.sh

# Standard test (10 seconds - default)
DURATION=10 ./benchmarks/run_benchmarks.sh

# Long test (60 seconds per endpoint)
DURATION=60 ./benchmarks/run_benchmarks.sh
```

### Run Individual Tests

```bash
cd benchmarks

# Build first
go build -o bin/load_test load_test.go

# Run specific test
./bin/load_test -c 100 -d 10 -o results/custom.json

# Generate report
go run generate_report.go -i results/custom.json -o results/custom_report.md
```

## Performance Targets

### Latency Targets

| Component | P50 | P95 | P99 | P99.9 |
|-----------|-----|-----|-----|-------|
| **Go API (health)** | <5ms | <8ms | <10ms | <15ms |
| **Rust FFI** | <0.5ms | <0.8ms | <1ms | <2ms |
| **Python gRPC** | <10ms | <15ms | <20ms | <30ms |
| **Full Stack** | <15ms | <25ms | <30ms | <50ms |

### Throughput Targets

| Endpoint | Target RPS | Stretch Goal |
|----------|-----------|--------------|
| `/health` | >5,000 | >10,000 |
| `/rust/add` | >50,000 | >100,000 |
| `/ml/predict` | >1,000 | >2,000 |

### Resource Targets

| Resource | Target | Max Acceptable |
|----------|--------|----------------|
| **CPU (100 concurrent)** | <50% | <80% |
| **Memory** | <200MB | <500MB |
| **Memory growth (1M calls)** | <5% | <10% |

## Troubleshooting

### Benchmark fails to start

**Error:** `Services not running on localhost:8080`

**Solution:**
```bash
# Start services first
docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml up -d

# Wait for health check
curl http://localhost:8080/health
```

### High latency results

**Possible causes:**
1. System under load from other processes
2. Docker resource limits too low
3. Network congestion

**Solutions:**
```bash
# Check Docker resources
docker stats

# Increase Docker memory/CPU limits in Docker Desktop preferences

# Stop other services
docker ps
```

### Memory leak test fails

**Possible causes:**
1. Go GC not running frequently enough
2. Rust string cleanup missing
3. System memory pressure

**Solutions:**
- Review `rust_free_string()` calls in Go code
- Check for goroutine leaks
- Run with verbose GC: `GODEBUG=gctrace=1`

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Benchmark Hybrid Architecture

on:
  pull_request:
    paths:
      - 'go_gateway/**'
      - 'rust_kernel/**'
      - 'python_ml/**'

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml up -d

      - name: Wait for health
        run: |
          timeout 60 sh -c 'until curl -f http://localhost:8080/health; do sleep 1; done'

      - name: Run benchmarks
        run: ./benchmarks/run_benchmarks.sh

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: benchmarks/results/

      - name: Check performance regression
        run: |
          # Compare with baseline
          python scripts/check_regression.py \
            --current benchmarks/results/results.json \
            --baseline benchmarks/baseline.json \
            --threshold 10  # Fail if >10% regression
```

## Advanced Usage

### Compare with Baseline

```bash
# Save current results as baseline
cp benchmarks/results/results.json benchmarks/baseline.json

# After changes, run benchmarks again
./benchmarks/run_benchmarks.sh

# Compare (requires jq)
jq -s '.[0].endpoints.health.latency.p99_ms as $baseline |
       .[1].endpoints.health.latency.p99_ms as $current |
       (($current - $baseline) / $baseline * 100) as $change |
       "P99 latency change: \($change)%"' \
  benchmarks/baseline.json benchmarks/results/results.json
```

### Profile Memory

```bash
cd benchmarks

# Build with profiling
go build -o bin/load_test_profile load_test.go

# Run with memory profiling
./bin/load_test_profile -memprofile=mem.prof

# Analyze with pprof
go tool pprof mem.prof
```

### Continuous Benchmarking

Set up a cron job to run benchmarks daily:

```bash
# Add to crontab
0 2 * * * cd /path/to/schlep-engine && ./benchmarks/run_benchmarks.sh
```

## Contributing

To add new benchmark tests:

1. Add test function to `load_test.go`
2. Update metrics collection in `internal/metrics.go`
3. Add reporting logic in `generate_report.go`
4. Update this README with new test description

## Support

**Issues:** Create GitHub issue with `benchmark` label
**Questions:** See [PROTOTYPE_README.md](../PROTOTYPE_README.md)
