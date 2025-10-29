# Observability Stack Quick Reference

**Status:** ✅ All services running
**Last Updated:** 2025-10-28

---

## Service Access

### Metrics & Monitoring

**Prometheus**
- URL: http://localhost:9090
- Purpose: Metrics database and query engine
- Auth: None required

**Grafana**
- URL: http://localhost:3002
- Purpose: Metrics visualization dashboards
- Login: `admin` / `admin123`

**Node Exporter**
- URL: http://localhost:9100/metrics
- Purpose: System-level metrics (CPU, memory, disk, network)

**cAdvisor**
- URL: http://localhost:8080
- Purpose: Container resource usage and performance

### Distributed Tracing

**Jaeger UI**
- URL: http://localhost:16686
- Purpose: View distributed traces, request flows
- Auth: None required

**Jaeger Collector**
- HTTP: http://localhost:14268/api/traces
- gRPC: localhost:14250

**Jaeger Agent (UDP)**
- Thrift Compact: localhost:6831
- Thrift Binary: localhost:6832

### Alerting

**AlertManager**
- URL: http://localhost:9093
- Purpose: Alert routing, grouping, silencing
- Auth: None required

---

## Schlep-Engine API

**Main API**
- URL: http://localhost:8081
- Health: http://localhost:8081/v1/health
- Inference: http://localhost:8081/v1/infer

---

## Quick Commands

### Check Service Health

```bash
# All services
cd /Users/wira/Desktop/schlep-engine/infra/vps
docker-compose -f docker-compose.monitoring.yml ps

# Prometheus ready check
curl -s http://localhost:9090/-/ready

# API health
curl -s http://localhost:8081/v1/health | jq
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.monitoring.yml logs -f

# Specific service
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
docker-compose -f docker-compose.monitoring.yml logs -f jaeger
docker-compose -f docker-compose.monitoring.yml logs -f grafana-metrics
```

### Restart Services

```bash
cd /Users/wira/Desktop/schlep-engine/infra/vps

# Restart all
docker-compose -f docker-compose.monitoring.yml restart

# Restart specific service
docker-compose -f docker-compose.monitoring.yml restart prometheus
```

### Stop/Start Stack

```bash
cd /Users/wira/Desktop/schlep-engine/infra/vps

# Stop (preserves data)
docker-compose -f docker-compose.monitoring.yml stop

# Start again
docker-compose -f docker-compose.monitoring.yml start

# Stop and remove containers (preserves volumes)
docker-compose -f docker-compose.monitoring.yml down

# Stop and remove everything including data
docker-compose -f docker-compose.monitoring.yml down -v
```

---

## Useful Prometheus Queries

Access via: http://localhost:9090/graph

```promql
# Request rate (once API exports metrics)
rate(http_requests_total[1m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Total cost tracking
sum(rate(provider_cost_usd_total[1m]))

# Error rate
rate(http_requests_total{status=~"5.."}[1m])

# Service uptime
up{job="schlep-engine-api"}

# System CPU usage
rate(node_cpu_seconds_total{mode!="idle"}[5m])

# System memory
node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes

# Container CPU
rate(container_cpu_usage_seconds_total[5m])

# Container memory
container_memory_usage_bytes
```

---

## Grafana Dashboard Setup

1. **Access Grafana:** http://localhost:3002
2. **Login:** admin / admin123
3. **Add Dashboard:**
   - Click "+" → "Dashboard"
   - Click "Add visualization"
   - Select "Prometheus" datasource
   - Enter PromQL query
   - Configure visualization type
   - Save dashboard

### Recommended Dashboards

**API Performance**
- Request rate (requests/sec)
- P50, P95, P99 latency
- Error rate
- Success rate

**Cost Tracking**
- Cost per minute
- Cost per provider
- Cost per model
- Budget remaining

**System Health**
- CPU utilization
- Memory usage
- Network I/O
- Disk I/O

---

## Jaeger Trace Queries

Access via: http://localhost:16686

**Find traces by:**
- Service: `schlep-engine`
- Operation: `/v1/infer`
- Tags: `optimizer=shadow`, `provider=openai`, etc.
- Duration: `> 200ms`

**Useful filters:**
```
service=schlep-engine operation=/v1/infer
service=schlep-engine tag=error:true
service=schlep-engine minDuration=200ms
```

---

## AlertManager Configuration

Config file: `/Users/wira/Desktop/schlep-engine/infra/vps/observability/alertmanager.yml`

**After editing, reload:**
```bash
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

**Check config:**
```bash
curl http://localhost:9093/api/v1/status
```

---

## Data Persistence

**Volumes:**
- `vps_prometheus_data` - Prometheus time-series data
- `vps_grafana_metrics_data` - Grafana dashboards and settings
- `vps_alertmanager_data` - AlertManager silences and state

**Backup:**
```bash
docker volume ls | grep vps
docker run --rm -v vps_prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus_backup.tar.gz /data
```

**Restore:**
```bash
docker run --rm -v vps_prometheus_data:/data -v $(pwd):/backup alpine tar xzf /backup/prometheus_backup.tar.gz -C /
```

---

## Troubleshooting

### Service won't start

```bash
# Check logs
docker-compose -f docker-compose.monitoring.yml logs <service-name>

# Check ports
lsof -i :9090  # Prometheus
lsof -i :3002  # Grafana
lsof -i :16686 # Jaeger
```

### Can't access UI

```bash
# Verify service is running
docker-compose -f docker-compose.monitoring.yml ps

# Check network
docker network inspect schlep-engine

# Test connectivity
curl -v http://localhost:9090
```

### Data not appearing in Prometheus

```bash
# Check targets
curl http://localhost:9090/api/v1/targets | jq

# Check scrape config
curl http://localhost:9090/api/v1/status/config | jq
```

---

## Performance Tuning

### Prometheus

**Retention:** Default 15 days
```yaml
command:
  - '--storage.tsdb.retention.time=30d'
```

**Memory:** Adjust based on metrics volume
```yaml
deploy:
  resources:
    limits:
      memory: 4G
```

### Grafana

**Session timeout:**
Edit `grafana.ini` or set via env:
```yaml
environment:
  - GF_AUTH_SESSION_LIFE_TIME=86400
```

---

## Security Notes

⚠️ **Default Credentials**
- Grafana: admin/admin123
- Change in production!

⚠️ **Network Access**
- Services exposed on localhost
- For production: use reverse proxy with TLS
- Restrict access via firewall

⚠️ **API Keys**
- Stored in `.env.local`
- Never commit to git
- Use secrets management in production

---

## Related Documentation

- Benchmark Results: `/docs/reports/shadow_benchmark_live.md`
- Execution Summary: `/docs/reports/shadow_benchmark_execution_summary.md`
- Setup Guide: `/docs/SHADOW_BENCHMARK_SETUP.md`
- Quick Start: `/QUICK_START_SHADOW_BENCHMARK.md`

---

**Questions or Issues?**
Check the troubleshooting section or view service logs for detailed error messages.
