# Schlep-Engine Stability Testing - Quick Reference Card

## 🚀 Quick Start (5 minutes)

```bash
# 1. Start API in benchmark mode (no costs)
export PROVIDER_MODE=benchmark
export OPTIMIZER_MODE=shadow
cd /Users/wira/Desktop/igris-inertial
go run cmd/igris-overture/main.go &

# 2. Wait and verify
sleep 10
curl http://localhost:8080/healthz

# 3. Run quick smoke test
cd stability-tests/scripts
python load_test_basic_requests.py --requests 100 --concurrency 10
```

## 📋 Test Suite Checklist

- [ ] **Load Test** - Basic reliability (2 min)
- [ ] **Format Validation** - Response consistency (1 min)
- [ ] **FFI Stress** - Go↔Rust stability (5 min)
- [ ] **Streaming** - SSE reliability (2 min)
- [ ] **SLO Enforcer** - Auto-remediation (3 min)
- [ ] **Failover** - Provider resilience (2 min)
- [ ] **Circuit Breaker** - Fast-fail (3 min)
- [ ] **Concurrent Load** - Performance (5 min)
- [ ] **Malformed Input** - Security (2 min)

**Total Runtime**: ~25 minutes for full suite

## 🎯 Critical Commands

### Health Checks
```bash
curl http://localhost:8080/healthz      # Liveness
curl http://localhost:8080/readyz       # Readiness
curl http://localhost:8080/metrics      # Prometheus
curl http://localhost:8080/v1/providers/stats  # Providers
```

### Run All Tests
```bash
cd stability-tests/scripts
./run_all_tests.sh
# Report: stability-tests/reports/stability_report_*.txt
```

### Individual Tests
```bash
# FFI boundary (most important)
python test_ffi_boundary.py --duration 120 --concurrency 20

# Streaming
python test_streaming_concurrency.py --concurrent 20 --iterations 50

# Load test
python load_test_basic_requests.py --requests 1000 --concurrency 50

# SLO enforcer
python test_slo_enforcer.py

# Malformed input
python test_malformed_requests.py --iterations 500
```

### Rollback
```bash
# Automatic
./rollback_automation.sh

# Manual (Kubernetes)
kubectl rollout undo deployment/igris-overture
kubectl rollout status deployment/igris-overture
```

## ⚠️ Critical Alerts

| Alert | Threshold | Action |
|-------|-----------|--------|
| **HighServerErrorRate** | 5xx > 1% | Investigate immediately |
| **APICompleteOutage** | No 200s for 2m | Page on-call |
| **FFI Panic** | Any panic | Disable optimizer |
| **BrokenStreams** | Broken pipes | Check load balancer |
| **MemoryLeak** | Growth > 10% | Restart pods |

## 🔥 Emergency Procedures

### Complete Outage
```bash
# 1. Check API
curl http://localhost:8080/healthz

# 2. Check logs
kubectl logs deployment/igris-overture --tail=100

# 3. Rollback if needed
kubectl rollout undo deployment/igris-overture
```

### High 5xx Rate
```bash
# 1. Check providers
curl http://localhost:8080/v1/providers/stats

# 2. Check recent deployment
kubectl rollout history deployment/igris-overture

# 3. Rollback if recent deploy
kubectl rollout undo deployment/igris-overture
```

### FFI Crash/Panic
```bash
# 1. Disable Rust optimizer immediately
kubectl set env deployment/igris-overture OPTIMIZER_MODE=go-only

# 2. Restart
kubectl rollout restart deployment/igris-overture

# 3. Monitor recovery
watch -n 2 'curl -s http://localhost:8080/metrics | grep http_requests_total'
```

## 📊 Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| 5xx Rate | 0% | 🔴 Critical |
| Availability | ≥99.9% | 🔴 Critical |
| P95 Latency | <2000ms | 🟡 Warning |
| FFI Panics | 0 | 🔴 Critical |
| Streams Complete | ≥99% | 🔴 Critical |
| Memory Growth | <10% | 🟡 Warning |

## 🔧 Configuration Modes

### Benchmark Mode (Testing - No Costs)
```bash
export PROVIDER_MODE=benchmark
export ENABLE_BENCHMARK_FALLBACK=true
# Safe for aggressive load testing
```

### Real Mode (Production Validation)
```bash
export PROVIDER_MODE=real
export OPENAI_API_KEY=sk-...
export MAX_MONTHLY_COST_USD=10.0
# Use sparingly, incurs costs
```

### Shadow Mode (Optimizer Testing)
```bash
export OPTIMIZER_MODE=shadow
export OPTIMIZER_SAMPLE_RATE=0.1
# Tests optimizer without affecting prod traffic
```

## 📈 Monitoring URLs

- **Grafana**: http://grafana:3000/d/igris-inertial
- **Prometheus**: http://prometheus:9090/targets
- **API Metrics**: http://localhost:8080/metrics
- **Health**: http://localhost:8080/healthz

## 📞 Escalation

1. **On-Call Engineer**: Check PagerDuty
2. **Platform Team Lead**: [Contact]
3. **Engineering Manager**: [Contact]
4. **CTO** (SEV-1 only): [Contact]

## 📚 Documentation

- **README**: `stability-tests/README.md`
- **Incident Response**: `stability-tests/INCIDENT_RESPONSE_PLAYBOOK.md`
- **Summary**: `stability-tests/TESTING_SUMMARY.md`
- **This Card**: `stability-tests/QUICK_REFERENCE.md`

## ✅ Pre-Deployment Checklist

- [ ] All stability tests pass (100%)
- [ ] No 5xx errors in last 24 hours
- [ ] FFI stress test passes (no panics)
- [ ] Streaming test passes (no broken pipes)
- [ ] Monitoring alerts configured
- [ ] Rollback procedure tested
- [ ] Team trained on incident response
- [ ] Customer communication template ready

## 🎓 Training Resources

**New Team Member Setup** (15 minutes):
1. Read TESTING_SUMMARY.md
2. Run `./run_all_tests.sh` once
3. Review INCIDENT_RESPONSE_PLAYBOOK.md
4. Practice manual rollback in staging

**Weekly Review** (30 minutes):
1. Run full test suite
2. Review any new alerts/incidents
3. Update baseline metrics
4. Review cost trends

## 🐛 Troubleshooting

### Tests Won't Start
```bash
# Check API running
lsof -i :8080

# Check Python deps
pip install aiohttp psutil requests

# Check permissions
chmod +x stability-tests/scripts/*.sh
```

### Tests Timeout
```bash
# Increase timeout
python script.py --timeout 60

# Reduce concurrency
python script.py --concurrency 10

# Check API logs
kubectl logs deployment/igris-overture
```

### False Positives
```bash
# Verify API is healthy first
curl http://localhost:8080/healthz

# Check baseline performance
curl -w "@curl-format.txt" http://localhost:8080/v1/models

# Review recent changes
git log --oneline -10
```

## 📝 Common Patterns

### Before Each Deployment
```bash
# 1. Run tests
./run_all_tests.sh

# 2. Verify pass
grep "ALL TESTS PASSED" reports/stability_report_*.txt

# 3. Deploy
kubectl apply -f k8s/deployment.yaml

# 4. Monitor
watch -n 5 'curl -s http://localhost:8080/metrics | grep 5xx'
```

### After Incident
```bash
# 1. Ensure stability
./run_all_tests.sh

# 2. Generate report
cat reports/stability_report_*.txt

# 3. Schedule post-incident review
# Use template in INCIDENT_RESPONSE_PLAYBOOK.md
```

### Weekly Maintenance
```bash
# 1. Run full suite
./run_all_tests.sh > weekly_report_$(date +%Y%m%d).txt

# 2. Compare to baseline
diff weekly_report_*.txt baseline_report.txt

# 3. Update metrics
# Document any trends (latency, throughput, etc.)
```

---

**Keep This Handy**: Print or bookmark for quick reference during incidents

**Last Updated**: 2025-01-21
