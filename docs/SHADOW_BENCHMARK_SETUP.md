# Shadow Benchmark Setup Guide

## Overview

This guide walks through the complete setup for running live-provider shadow benchmarking on Schlep-Engine with full observability.

## Architecture

### Observability Stack
- **Prometheus** (`:9090`) - Metrics collection and storage
- **Grafana** (`:3002`) - Metrics visualization dashboards
- **Jaeger** (`:16686`) - Distributed tracing UI
- **AlertManager** (`:9093`) - Alert routing and management
- **Node Exporter** (`:9100`) - System metrics
- **cAdvisor** (`:8080`) - Container metrics

### Shadow Mode
Shadow mode runs both Go and Rust optimizers in parallel:
- Go optimizer handles 90% of requests (stable baseline)
- Rust optimizer processes 10% of requests (Thompson Sampling evaluation)
- Results are logged for comparison without affecting production traffic

## Prerequisites

1. **Docker Desktop** - Must be running
2. **API Keys** - OpenAI and Anthropic credentials
3. **Python 3.x** - For running benchmarks

## Quick Start

### 1. Start Docker Desktop

Ensure Docker is running before proceeding.

### 2. Set API Keys

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 3. Configure Environment

```bash
./configure_shadow_benchmark.sh
```

This script will:
- Backup your current `.env` file
- Set `PROVIDER_MODE=real`
- Set `OPTIMIZER_MODE=shadow`
- Set `OPTIMIZER_SAMPLE_RATE=0.1` (10%)
- Enable Jaeger tracing
- Update API keys from environment

### 4. Start Observability Stack

```bash
cd infra/vps
docker-compose -f docker-compose.monitoring.yml up -d
```

Verify services are running:
```bash
docker-compose -f docker-compose.monitoring.yml ps
```

### 5. Start Schlep-Engine API

```bash
cd /Users/wira/Desktop/schlep-engine
go run cmd/server/main.go
```

Or if you have a binary:
```bash
./schlep-engine
```

### 6. Run Benchmark

```bash
python3 benchmarks/shadow_benchmark.py \
  --requests 1000 \
  --output benchmarks/results/shadow_benchmark_v2.json \
  --concurrent \
  --workers 10
```

## Accessing Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Prometheus | http://localhost:9090 | None |
| Grafana | http://localhost:3002 | admin/admin123 |
| Jaeger UI | http://localhost:16686 | None |
| AlertManager | http://localhost:9093 | None |
| Schlep API | http://localhost:8081 | None |

## Monitoring During Benchmark

### Prometheus Queries

```promql
# Request rate
rate(http_requests_total[1m])

# Latency percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Cost tracking
sum(rate(provider_cost_usd_total[1m]))

# Optimizer comparison
rate(optimizer_decisions_total[1m])
```

### Jaeger Traces

1. Open http://localhost:16686
2. Select service: `schlep-engine`
3. Filter by operation: `/v1/infer`
4. Look for traces tagged with `optimizer=shadow`

## Configuration Details

### Shadow Mode Settings

```bash
# .env configuration
PROVIDER_MODE=real                 # Use real API calls
OPTIMIZER_MODE=shadow             # Run both optimizers
OPTIMIZER_SAMPLE_RATE=0.1        # 10% to Rust optimizer
TRACING_ENABLED=true             # Enable Jaeger traces
METRICS_ENABLED=true             # Enable Prometheus metrics
```

### Benchmark Parameters

```python
# Default configuration
BASE_URL = "http://localhost:8081"
NUM_REQUESTS = 1000
CONCURRENT_WORKERS = 10
MODELS = ["gpt-4", "claude-3-opus-20240229"]
```

## Expected Results

### Benchmark Output

The benchmark generates:
1. **JSON Results** - `benchmarks/results/shadow_benchmark_v2.json`
   - Latency metrics (mean, p50, p95, p99)
   - Cost breakdown by provider
   - Success/error rates
   - Provider distribution

2. **Console Summary** - Real-time progress and statistics

### Metrics in Prometheus

- `http_requests_total` - Total requests by endpoint
- `http_request_duration_seconds` - Latency histograms
- `provider_cost_usd_total` - Cumulative costs
- `optimizer_decisions_total` - Routing decisions
- `provider_errors_total` - Error rates by provider

### Traces in Jaeger

Each request trace shows:
- API gateway latency
- Optimizer decision time
- Provider API call latency
- Token usage
- Cost calculation

## Generating Reports

### Automated Report Generation

```bash
python3 benchmarks/generate_report.py \
  --input benchmarks/results/shadow_benchmark_v2.json \
  --output docs/reports/shadow_benchmark_v2.md
```

### Manual Analysis

```bash
# Extract key metrics
jq '.metrics' benchmarks/results/shadow_benchmark_v2.json

# Provider comparison
jq '.metrics.providers' benchmarks/results/shadow_benchmark_v2.json
```

## Troubleshooting

### Docker Not Running
```bash
# Check Docker status
docker ps

# Start Docker Desktop on macOS
open -a Docker
```

### Services Not Starting
```bash
# Check logs
docker-compose -f docker-compose.monitoring.yml logs -f

# Restart services
docker-compose -f docker-compose.monitoring.yml restart
```

### API Key Issues
```bash
# Verify keys are set
echo $OPENAI_API_KEY | cut -c1-10
echo $ANTHROPIC_API_KEY | cut -c1-10

# Check .env file
grep "API_KEY" .env
```

### Benchmark Failures
```bash
# Check API health
curl http://localhost:8081/v1/health

# View API logs
tail -f logs/api.log

# Test single request
curl -X POST http://localhost:8081/v1/infer \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}],"max_tokens":10}'
```

## Cleanup

### Stop Observability Stack
```bash
cd infra/vps
docker-compose -f docker-compose.monitoring.yml down
```

### Restore Original Configuration
```bash
# Restore from backup
cp .env.backup.YYYYMMDD_HHMMSS .env
```

### Remove Data Volumes
```bash
docker-compose -f docker-compose.monitoring.yml down -v
```

## Next Steps

1. **Analyze Results** - Review latency and cost metrics
2. **Compare Optimizers** - Evaluate Go vs Rust performance
3. **Tune Sample Rate** - Adjust `OPTIMIZER_SAMPLE_RATE` based on results
4. **Create Dashboards** - Build custom Grafana visualizations
5. **Set Alerts** - Configure AlertManager rules for SLA monitoring

## Additional Resources

- [Prometheus Query Examples](../observability/prometheus_queries.md)
- [Grafana Dashboard Setup](../observability/grafana_dashboards.md)
- [Optimizer Comparison Analysis](../reports/optimizer_comparison.md)
- [Cost Optimization Guide](../guides/cost_optimization.md)
