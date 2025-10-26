# Load Testing Framework - Phase 4.1

This directory contains the production-grade load and soak testing infrastructure for Schlep-Engine Phase 4 (Observability & Optimization).

## Overview

The load testing framework provides two key test types:

1. **Extended Load Test** (`extended_load_test.go`) - 6-hour high-throughput test (1k RPS)
2. **Soak Test** (`soak_test.go`) - 24-hour memory stability test (100 RPS)

## Quick Start

### Prerequisites

```bash
# Ensure API is running
docker-compose -f docker-compose.production.yml up -d

# Verify API is accessible
curl http://localhost:8080/v1/health
```

### Running Extended Load Test (6 hours, 1k RPS)

```bash
# Run with default settings (benchmark mode)
./run_extended_load_test.sh

# Run with real providers (BYOK required)
export USE_REAL_PROVIDERS=true
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
./run_extended_load_test.sh

# Custom configuration
RPS=500 DURATION=3h ./run_extended_load_test.sh
```

### Running Soak Test (24 hours, memory stability)

```bash
# Run default 24h soak test
./run_soak_test.sh

# Run shorter test for validation
DURATION=2h ./run_soak_test.sh

# Run in background
nohup ./run_soak_test.sh > soak_test.log 2>&1 &
tail -f soak_test.log
```

## Test Descriptions

### Extended Load Test (Task 4.1.2)

**Purpose**: Validate system performance under sustained high load with real AI providers.

**Key Metrics**:
- Throughput: Target 1000 RPS sustained over 6 hours
- Latency: P50, P95, P99 latency distribution
- Error Rate: Must be <1%
- Cost Tracking: Cost per request, total cost estimation
- Provider Performance: Per-provider success rates and latencies

**Validation Criteria**:
- ✅ Stable throughput over 6h
- ✅ No memory leaks (RSS stable)
- ✅ Average latency <1s
- ✅ Error rate <1%

**Output**:
- `results/load_test_<timestamp>.json` - Full metrics data
- `results/load_test_report_<timestamp>.md` - Human-readable report
- Prometheus metrics (if pushgateway configured)

### Soak Test (Task 4.1.3)

**Purpose**: Detect memory leaks and resource exhaustion over extended period.

**Key Metrics**:
- Memory Growth: Heap, Stack, Total Allocation
- Goroutine Growth: Detect goroutine leaks
- Performance Stability: Latency drift over time
- GC Pressure: Number of GC cycles, pause times

**Validation Criteria**:
- ✅ RSS stable (<100MB growth over 24h)
- ✅ No memory leaks (<5MB/hour growth rate)
- ✅ Goroutine count stable
- ✅ No performance degradation

**Output**:
- `results/soak_test_<timestamp>.json` - Full memory timeline
- `results/soak_test_report_<timestamp>.md` - Stability analysis report

## Configuration Options

### Extended Load Test

| Flag | Default | Description |
|------|---------|-------------|
| `-rps` | 1000 | Target requests per second |
| `-duration` | 6h | Test duration |
| `-url` | http://localhost:8080 | API base URL |
| `-output` | tests/load/results | Output directory |
| `-real-providers` | false | Use real AI providers (BYOK) |
| `-pushgateway` | "" | Prometheus Pushgateway URL |

### Soak Test

| Flag | Default | Description |
|------|---------|-------------|
| `-rps` | 100 | Sustained request rate |
| `-duration` | 24h | Test duration |
| `-url` | http://localhost:8080 | API base URL |
| `-output` | tests/load/results | Output directory |
| `-mem-check` | 5m | Memory snapshot interval |

## Environment Variables

```bash
# API Configuration
API_URL=http://localhost:8080

# Load Test Configuration
RPS=1000
DURATION=6h
USE_REAL_PROVIDERS=false

# Provider Keys (for real provider testing)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Monitoring
PUSHGATEWAY_URL=http://localhost:9091
```

## Results and Reports

### Report Structure

Each test generates:

1. **JSON Data File**: Complete metrics in machine-readable format
   - Request counts, latencies, errors
   - Resource metrics (memory, goroutines, CPU)
   - Provider-specific performance data
   - Cost tracking

2. **Markdown Report**: Human-readable summary
   - Executive summary
   - Performance metrics
   - Validation criteria pass/fail
   - Recommendations and next steps

### Analyzing Results

```bash
# View latest load test report
cat results/load_test_report_*.md | tail -n 100

# View latest soak test report
cat results/soak_test_report_*.md | tail -n 100

# Extract JSON metrics for analysis
jq '.provider_metrics' results/load_test_*.json
jq '.memory_snapshots' results/soak_test_*.json
```

## Integration with Monitoring

### Prometheus Metrics

Both tests expose Prometheus metrics:

```
load_test_requests_total{status,provider}
load_test_request_duration_seconds{provider}
load_test_cost_per_request_usd{provider,model}
```

To push to Prometheus Pushgateway:

```bash
PUSHGATEWAY_URL=http://localhost:9091 ./run_extended_load_test.sh
```

### Grafana Dashboards

Load test metrics can be visualized in Grafana:
- Import dashboard: `infra/grafana/dashboards/load_test_dashboard.json`
- View real-time test progress
- Compare test runs over time

## Performance Baseline (Task 4.1.4)

After running tests, generate performance baseline:

```bash
# This will be created in Task 4.1.4
./generate_performance_baseline.sh
```

## Troubleshooting

### Test fails immediately

```bash
# Check API health
curl http://localhost:8080/v1/health

# Check logs
docker-compose -f docker-compose.production.yml logs -f api
```

### High error rate

- Check provider API keys if using real providers
- Verify rate limits aren't exceeded
- Check database connection pool settings
- Review Redis cache health

### Memory leak detected

- Review goroutine growth in soak test report
- Check for unclosed HTTP connections
- Verify database connection cleanup
- Use Go's pprof for detailed analysis:
  ```bash
  go tool pprof http://localhost:8080/debug/pprof/heap
  ```

### Performance degradation over time

- Check database connection pool exhaustion
- Verify Redis cache hit rates
- Review Rust optimizer performance
- Check for lock contention

## Architecture

```
tests/load/
├── extended_load_test.go      # 6h high-throughput test
├── soak_test.go                # 24h memory stability test
├── run_extended_load_test.sh  # Runner script for load test
├── run_soak_test.sh            # Runner script for soak test
├── README.md                   # This file
├── results/                    # Test results and reports
│   ├── *.json                  # Raw metrics data
│   ├── *.md                    # Generated reports
│   └── *.log                   # Test execution logs
└── reports/                    # Performance baselines
    └── baseline_*.md           # Performance baseline reports
```

## Next Steps (Phase 4)

- ✅ Task 4.1.1: Load testing framework ← **COMPLETE**
- 🔄 Task 4.1.2: Run 6h extended load test with real providers
- 🔄 Task 4.1.3: Run 24h soak test
- 🔄 Task 4.1.4: Generate performance baseline report
- ⏭️  Task 4.2: Distributed tracing integration (OpenTelemetry)
- ⏭️  Task 4.3: Metrics dashboards & alerting
- ⏭️  Task 4.4: Log aggregation
- ⏭️  Task 4.5: Reliability & recovery enhancements

## Contributing

When adding new load tests:

1. Follow the existing structure
2. Include comprehensive metrics collection
3. Generate both JSON and Markdown reports
4. Add validation criteria with pass/fail logic
5. Update this README
6. Add example usage to shell scripts

## References

- Phase 4 Task List: `docs_int/PHASE4_TASKS.md`
- Production Deployment: `DEPLOYMENT.md`
- Monitoring Setup: `docs_int/observability/README.md`
- Prometheus Configuration: `infra/observability/prometheus.yml`
