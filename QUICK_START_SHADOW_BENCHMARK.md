# Shadow Benchmark Quick Start

## What's Been Set Up

✅ **Observability Stack Configuration**
- Prometheus metrics collection (`:9090`)
- Grafana dashboards (`:3002`, admin/admin123)
- Jaeger distributed tracing (`:16686`)
- AlertManager for alerts (`:9093`)
- Node Exporter for system metrics
- cAdvisor for container metrics

✅ **Docker Compose Files**
- `infra/vps/docker-compose.monitoring.yml` - Updated with Jaeger

✅ **Configuration Files Created**
- `infra/vps/observability/prometheus.yml` - Prometheus scrape config
- `infra/vps/observability/alertmanager.yml` - Alert routing config
- `infra/vps/grafana/provisioning/` - Grafana datasources and dashboards

✅ **Helper Scripts**
- `configure_shadow_benchmark.sh` - Automated environment configuration
- `benchmarks/generate_report.py` - Report generation from results

✅ **Documentation**
- `docs/SHADOW_BENCHMARK_SETUP.md` - Comprehensive setup guide

## Next Steps

### 1. Start Docker Desktop

⚠️ **Docker is not currently running.** You need to start it first:

```bash
# On macOS
open -a Docker

# Wait for Docker to fully start, then verify:
docker ps
```

### 2. Set Your API Keys

```bash
# Set these in your terminal session
export OPENAI_API_KEY="sk-your-openai-key-here"
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key-here"
```

### 3. Run Configuration Script

```bash
cd /Users/wira/Desktop/schlep-engine
./configure_shadow_benchmark.sh
```

This will automatically:
- Backup your current `.env`
- Set `PROVIDER_MODE=real`
- Set `OPTIMIZER_MODE=shadow`
- Set `OPTIMIZER_SAMPLE_RATE=0.1` (10%)
- Enable Jaeger tracing
- Update API keys

### 4. Start Observability Stack

```bash
cd infra/vps
docker-compose -f docker-compose.monitoring.yml up -d
```

Verify all services are running:
```bash
docker-compose -f docker-compose.monitoring.yml ps
```

Expected output:
```
NAME                COMMAND                  SERVICE             STATUS              PORTS
alertmanager        "/bin/alertmanager ..."  alertmanager        running             0.0.0.0:9093->9093/tcp
cadvisor            "/usr/bin/cadvisor ..."  cadvisor            running             0.0.0.0:8080->8080/tcp
grafana-metrics     "/run.sh"                grafana-metrics     running             0.0.0.0:3002->3000/tcp
jaeger              "/go/bin/all-in-one-..." jaeger              running             Multiple ports
node-exporter       "/bin/node_exporter ..." node-exporter       running             0.0.0.0:9100->9100/tcp
prometheus          "/bin/prometheus --c..." prometheus          running             0.0.0.0:9090->9090/tcp
```

### 5. Start Schlep-Engine API

In a new terminal:

```bash
cd /Users/wira/Desktop/schlep-engine
go run cmd/server/main.go
```

Or if you have a built binary:
```bash
./schlep-engine
```

Wait for the API to start and verify:
```bash
curl http://localhost:8081/v1/health
```

### 6. Run the Benchmark

In another terminal:

```bash
cd /Users/wira/Desktop/schlep-engine

# Run with 1000 requests, 10 concurrent workers
python3 benchmarks/shadow_benchmark.py \
  --requests 1000 \
  --output benchmarks/results/shadow_benchmark_v2.json \
  --concurrent \
  --workers 10
```

### 7. Generate Report

After the benchmark completes:

```bash
python3 benchmarks/generate_report.py \
  benchmarks/results/shadow_benchmark_v2.json \
  docs/reports/shadow_benchmark_v2.md
```

View the report:
```bash
cat docs/reports/shadow_benchmark_v2.md
```

## Access the Observability Tools

While the benchmark is running, monitor in real-time:

| Service | URL | Purpose |
|---------|-----|---------|
| **Prometheus** | http://localhost:9090 | Query metrics and view targets |
| **Grafana** | http://localhost:3002 | Visualize metrics (login: admin/admin123) |
| **Jaeger** | http://localhost:16686 | View distributed traces |
| **AlertManager** | http://localhost:9093 | View and manage alerts |
| **Schlep API** | http://localhost:8081 | API health and inference |

## Useful Prometheus Queries

Visit http://localhost:9090/graph and try these:

```promql
# Request rate
rate(http_requests_total[1m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Total cost
sum(rate(provider_cost_usd_total[1m]))

# Error rate
rate(http_requests_total{status=~"5.."}[1m])
```

## Expected Benchmark Duration

With 1000 requests and 10 concurrent workers:
- **Sequential:** ~8-15 minutes (depending on provider latency)
- **Concurrent:** ~2-5 minutes

## Troubleshooting

### Docker Won't Start
```bash
# Check if Docker Desktop is installed
ls /Applications/Docker.app

# Check Docker status
docker info
```

### API Keys Not Working
```bash
# Verify they're set
echo $OPENAI_API_KEY | cut -c1-10
echo $ANTHROPIC_API_KEY | cut -c1-10

# Check .env file
grep API_KEY .env
```

### Services Won't Start
```bash
# View logs
cd infra/vps
docker-compose -f docker-compose.monitoring.yml logs -f

# Restart a specific service
docker-compose -f docker-compose.monitoring.yml restart prometheus
```

### Benchmark Fails
```bash
# Test API manually
curl -X POST http://localhost:8081/v1/infer \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "test"}],
    "max_tokens": 10
  }'

# Check API logs
tail -f logs/api.log
```

## Cleanup

When you're done:

```bash
# Stop observability stack
cd infra/vps
docker-compose -f docker-compose.monitoring.yml down

# Restore original .env (if needed)
cp .env.backup.YYYYMMDD_HHMMSS .env

# Stop Schlep-Engine API
# Just Ctrl+C in the terminal where it's running
```

## What Gets Measured

The shadow benchmark will measure:

### Performance Metrics
- Latency (mean, median, p50, p95, p99)
- Throughput (requests/second)
- Error rates

### Cost Metrics
- Total cost in USD
- Cost per request
- Cost per 1K requests
- Cost breakdown by provider

### Provider Routing
- Distribution of requests across providers
- Performance comparison between providers
- Optimizer decision accuracy (Go vs Rust)

### Shadow Mode Analysis
- 90% Go optimizer (baseline)
- 10% Rust optimizer (Thompson Sampling)
- Side-by-side comparison of routing decisions

## Success Criteria

✅ **Observability Stack Running**
- All 6 Docker containers running
- Prometheus scraping metrics
- Grafana displaying dashboards
- Jaeger collecting traces

✅ **Benchmark Completes**
- 1000 requests sent successfully
- Results saved to JSON file
- Report generated in Markdown

✅ **Metrics Visible**
- Prometheus shows provider metrics
- Grafana dashboards populated
- Jaeger traces visible

✅ **Shadow Mode Active**
- ~90% requests via Go optimizer
- ~10% requests via Rust optimizer
- Both routing decisions logged

## Next Steps After Benchmark

1. **Analyze the report** - Review `docs/reports/shadow_benchmark_v2.md`
2. **Compare optimizers** - Check which routing strategy performed better
3. **Tune sample rate** - Adjust `OPTIMIZER_SAMPLE_RATE` if needed
4. **Create custom dashboards** - Build Grafana visualizations
5. **Set up alerts** - Configure AlertManager rules
6. **Scale testing** - Run larger benchmarks (5K, 10K requests)

## Questions?

- Full documentation: `docs/SHADOW_BENCHMARK_SETUP.md`
- Benchmark script: `benchmarks/shadow_benchmark.py`
- Report generator: `benchmarks/generate_report.py`
- Configuration helper: `configure_shadow_benchmark.sh`

---

**Ready to start?** Just follow steps 1-7 above! 🚀
