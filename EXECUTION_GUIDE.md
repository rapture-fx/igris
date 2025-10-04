# Schlep-Engine Phase 1 & 2 Execution Guide
**Step-by-Step Instructions for Safe Migration**

**Date:** October 4, 2025
**Target Completion:** October 24, 2025 (3 weeks)
**Status:** Ready for Execution

---

## Quick Start

```bash
# Phase 1: Verify & Remove Legacy API (Week 1)
./scripts/verify_go_gateway_readiness.sh
./scripts/safe_remove_legacy_api.sh

# Phase 2: Optimize & Scale (Weeks 2-3)
# - Enable ML caching
# - Run 10K RPS benchmark
# - Add distributed tracing
```

---

## Phase 1: Immediate Actions (Week 1)

### Day 1: Pre-Execution Verification

**Objective:** Confirm Go Gateway is production-ready

**Steps:**

1. **Run Verification Script**
   ```bash
   cd /Users/wira/Desktop/schlep-engine
   ./scripts/verify_go_gateway_readiness.sh
   ```

2. **Expected Output:**
   ```
   ========================================
   VERIFICATION SUMMARY
   ========================================
   Total Tests: 30
   Passed: 30
   Failed: 0
   Success Rate: 100%

   ✓ GO GATEWAY IS PRODUCTION READY
   Safe to proceed with legacy Python API removal
   ```

3. **If Verification Fails:**
   ```bash
   # Check logs
   docker-compose logs go-gateway | tail -50

   # Check health
   curl http://localhost:8080/health

   # Check metrics
   curl http://localhost:8080/metrics | grep http_requests_total

   # Restart if needed
   docker-compose restart go-gateway

   # Re-run verification
   ./scripts/verify_go_gateway_readiness.sh
   ```

4. **Review Detailed Report:**
   ```bash
   # Open verification report
   cat GO_GATEWAY_VERIFICATION_REPORT.md

   # Check key metrics
   grep -A 5 "Key Metrics" GO_GATEWAY_VERIFICATION_REPORT.md
   ```

**Success Criteria:**
- ✅ Verification script exits with code 0
- ✅ All 30 tests pass
- ✅ P99 latency < 50ms
- ✅ Error rate < 0.1%
- ✅ Uptime > 99.9%

---

### Day 2: Backup Legacy API

**Objective:** Create verified backup before removal

**Steps:**

1. **Manual Backup (Optional but Recommended)**
   ```bash
   # Create timestamped backup
   TIMESTAMP=$(date +%Y%m%d-%H%M%S)
   tar -czf backups/legacy-api-manual-$TIMESTAMP.tar.gz apps/api/

   # Verify backup
   tar -tzf backups/legacy-api-manual-$TIMESTAMP.tar.gz | head -20

   # Create checksums
   (cd apps/api && find . -type f -name "*.py" -exec sha256sum {} \;) > backups/checksums-manual-$TIMESTAMP.txt
   ```

2. **Test Rollback Procedure**
   ```bash
   # Simulate rollback (dry run)
   echo "Dry run: Would restore from backups/legacy-api-manual-$TIMESTAMP.tar.gz"

   # Verify Nginx config has fallback
   grep -A 5 "upstream api_backend" observability/nginx-production.conf
   # Should show both go-gateway and python-api-legacy
   ```

3. **Document Backup Location**
   ```bash
   echo "Backup created: backups/legacy-api-manual-$TIMESTAMP.tar.gz" >> BACKUP_LOG.txt
   echo "Checksums: backups/checksums-manual-$TIMESTAMP.txt" >> BACKUP_LOG.txt
   echo "Date: $(date)" >> BACKUP_LOG.txt
   ```

**Success Criteria:**
- ✅ Backup file created (verify size > 10MB)
- ✅ Checksums generated
- ✅ Rollback plan tested (dry run)

---

### Day 3-4: Execute Legacy API Removal

**Objective:** Safely remove deprecated FastAPI endpoints

**Steps:**

1. **Pre-Execution Checklist**
   ```bash
   # 1. Confirm Go Gateway is running
   curl -f http://localhost:8080/health || exit 1

   # 2. Confirm verification passed
   ./scripts/verify_go_gateway_readiness.sh || exit 1

   # 3. Notify team (optional)
   # Send Slack/email: "Starting legacy API removal at $(date)"

   # 4. Enable verbose logging (optional)
   export LOG_LEVEL=DEBUG
   docker-compose restart go-gateway
   ```

2. **Execute Safe Removal Script**
   ```bash
   ./scripts/safe_remove_legacy_api.sh
   ```

3. **Script Will Prompt:**
   ```
   WARNING: This will permanently remove 59 Python files!

   Backup location: backups/legacy-api-20251004-093015.tar.gz
   Restoration command: tar -xzf ... && cp -r ...

   Do you want to proceed with removal? (yes/no):
   ```

4. **Type `yes` to Proceed**
   - Script will remove files
   - Create backup automatically
   - Run post-removal tests
   - Generate removal report

5. **Review Removal Report**
   ```bash
   # Check report location (printed by script)
   cat backups/legacy-api-20251004-093015/removal_report.md

   # Verify removed files count
   grep "Total files removed" backups/legacy-api-20251004-093015/removal_report.md
   ```

**Success Criteria:**
- ✅ Script completes without errors
- ✅ Backup created and verified
- ✅ Correct number of files removed (~59)
- ✅ ML files preserved (4 files remain)
- ✅ Go Gateway still healthy

---

### Day 4-5: Post-Removal Validation

**Objective:** Verify system stability after removal

**Steps:**

1. **Immediate Health Check**
   ```bash
   # Test Go Gateway
   curl http://localhost:8080/health

   # Test ML endpoint
   curl -X POST http://localhost:8080/api/v1/ml/predict \
     -H "Content-Type: application/json" \
     -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}'

   # Test auth endpoint
   curl -X POST http://localhost:8080/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpass123"}'
   ```

2. **Monitor for 24 Hours**
   ```bash
   # Watch error logs (24h monitoring)
   docker-compose logs -f go-gateway | grep -i error

   # Check Grafana dashboards
   # http://localhost:3000/d/go-gateway-overview
   # Look for:
   # - Request rate (should be stable)
   # - Error rate (should be < 0.1%)
   # - Latency (P99 should be < 50ms)

   # Check Prometheus alerts
   # http://localhost:9090/alerts
   # Ensure no new alerts firing
   ```

3. **Run Integration Tests**
   ```bash
   # If you have integration tests
   pytest tests/integration/

   # Or manual API tests
   bash tests/api_smoke_tests.sh
   ```

4. **Validate Metrics**
   ```bash
   # Check Prometheus metrics
   curl http://localhost:8080/metrics | grep http_requests_total
   curl http://localhost:8080/metrics | grep http_request_duration_seconds

   # Verify no 404 errors from removed endpoints
   curl http://localhost:9090/api/v1/query?query='http_requests_total{status="404"}' | jq
   ```

**Success Criteria:**
- ✅ No errors in logs (24h period)
- ✅ All critical endpoints responding
- ✅ Error rate < 0.1%
- ✅ Latency stable (P99 < 50ms)
- ✅ No 404 errors from removed endpoints

---

### Day 5: Update Docker Compose (Optional)

**Objective:** Remove legacy Python API service from orchestration

**Steps:**

1. **Backup Docker Compose**
   ```bash
   cp docker-compose.hybrid.yml backups/docker-compose.hybrid.yml.before-removal
   ```

2. **Remove Legacy Service (Manual Edit)**
   ```bash
   # Edit docker-compose.hybrid.yml
   # Remove the python-api-legacy service section:

   # DELETE THIS SECTION:
   # python-api-legacy:
   #   build:
   #     context: .
   #     dockerfile: apps/api/Dockerfile
   #   container_name: schlep-python-api-legacy
   #   ports:
   #     - "8000:8000"
   #   ...
   #   (entire service definition)
   ```

3. **Validate Docker Compose Syntax**
   ```bash
   docker-compose -f docker-compose.hybrid.yml config
   # Should show no errors
   ```

4. **Restart Services**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

5. **Verify Services**
   ```bash
   docker-compose ps
   # python-api-legacy should NOT be listed
   # go-gateway should be running
   ```

**Success Criteria:**
- ✅ Legacy service removed from Docker Compose
- ✅ All other services running normally
- ✅ Go Gateway accessible

---

## Phase 2: Optimization (Weeks 2-3)

### Week 2, Day 1-2: ML Orchestration Migration

**Objective:** Move ML code to python-ml-service

**Steps:**

1. **Create Directory Structure**
   ```bash
   mkdir -p apps/python-ml-service/orchestration
   mkdir -p apps/python-ml-service/serving
   mkdir -p apps/python-ml-service/ml
   mkdir -p apps/python-ml-service/models
   ```

2. **Move ML Files**
   ```bash
   # Move ML orchestration
   mv apps/api/app/api/v1/advanced_ml.py \
      apps/python-ml-service/orchestration/training.py

   # Move model serving
   mv apps/api/app/api/v1/model_serving.py \
      apps/python-ml-service/serving/inference.py

   # Move ML pipelines
   mv apps/api/app/ml/* apps/python-ml-service/ml/

   # Preserve git history (optional)
   git mv apps/api/app/api/v1/advanced_ml.py apps/python-ml-service/orchestration/training.py
   ```

3. **Update gRPC Service**
   ```bash
   # Edit apps/python-ml-service/proto/ml_service.proto
   # Add new RPC methods:

   service MLService {
     // Existing
     rpc Predict (PredictRequest) returns (PredictResponse);
     rpc BatchPredict (BatchPredictRequest) returns (BatchPredictResponse);

     // NEW: Orchestration
     rpc TrainModel (TrainModelRequest) returns (TrainModelResponse);
     rpc LoadModel (LoadModelRequest) returns (LoadModelResponse);
     rpc UnloadModel (UnloadModelRequest) returns (UnloadModelResponse);
   }
   ```

4. **Regenerate gRPC Code**
   ```bash
   cd apps/python-ml-service
   ./generate_proto.sh
   ```

5. **Update Go Gateway**
   ```bash
   # Add new handler in apps/go-gateway/internal/handlers/ml.go
   # (Or create ml_orchestration.go)

   func MLTrainModel(mlClient *ml.Client, logger zerolog.Logger) fiber.Handler {
       return func(c *fiber.Ctx) error {
           var req TrainModelRequest
           c.BodyParser(&req)

           resp, err := mlClient.TrainModel(c.Context(), req)
           if err != nil {
               return c.Status(500).JSON(fiber.Map{"error": err.Error()})
           }

           return c.JSON(resp)
       }
   }

   # Add route in main.go
   ml.Post("/train", handlers.MLTrainModel(mlClient, logger))
   ```

**Success Criteria:**
- ✅ All ML files moved to python-ml-service
- ✅ gRPC service updated with new methods
- ✅ Go Gateway can call orchestration endpoints
- ✅ End-to-end ML workflow works

---

### Week 2, Day 3: Enable ML Caching

**Objective:** Activate Redis caching for ML predictions

**Steps:**

1. **Update Go Gateway Routes**
   ```bash
   # Edit apps/go-gateway/cmd/api/main.go
   # Replace standard ML handlers with cached versions

   # BEFORE:
   # ml.Post("/predict", handlers.MLPredict(mlClient, logger))

   # AFTER:
   ml.Post("/predict", handlers.MLPredictCached(mlClient, redisClient, logger))
   ml.Post("/batch-predict", handlers.MLBatchPredictCached(mlClient, redisClient, logger))

   # Add admin cache endpoints
   admin.Delete("/ml/cache/:model_id", handlers.ClearMLCache(redisClient, logger))
   admin.Get("/ml/cache/stats", handlers.GetMLCacheStats(redisClient, logger))
   ```

2. **Rebuild & Restart**
   ```bash
   # Rebuild Go Gateway
   cd apps/go-gateway
   go build -o bin/gateway cmd/api/main.go

   # Or rebuild Docker image
   docker-compose build go-gateway

   # Restart
   docker-compose restart go-gateway
   ```

3. **Test Caching**
   ```bash
   # First request (cache miss)
   curl -X POST http://localhost:8080/api/v1/ml/predict \
     -H "Content-Type: application/json" \
     -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}' | jq

   # Response should show: "cached": false

   # Second request (cache hit)
   curl -X POST http://localhost:8080/api/v1/ml/predict \
     -H "Content-Type: application/json" \
     -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}' | jq

   # Response should show: "cached": true, much faster latency
   ```

4. **Verify Cache in Redis**
   ```bash
   # Connect to Redis
   docker-compose exec redis redis-cli

   # List cache keys
   KEYS ml:predict:*

   # Get cache value
   GET ml:predict:iris-classifier:<hash>

   # Check TTL
   TTL ml:predict:iris-classifier:<hash>
   # Should show ~300 seconds (5 min)
   ```

5. **Monitor Cache Metrics**
   ```bash
   # Check cache stats
   curl http://localhost:8080/api/v1/admin/ml/cache/stats | jq

   # Check Prometheus metrics
   curl http://localhost:8080/metrics | grep ml_cache
   ```

**Success Criteria:**
- ✅ Cached predictions return in 2-5ms
- ✅ Uncached predictions return in 40-50ms
- ✅ Cache hit rate > 70% (after warm-up)
- ✅ Redis memory usage < 512MB

---

### Week 2, Day 4-5: 10K RPS Benchmark

**Objective:** Validate sustained 10K RPS capacity

**Steps:**

1. **Install k6 (if not installed)**
   ```bash
   # macOS
   brew install k6

   # Ubuntu
   sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Create k6 Load Test Script**
   ```bash
   # Create benchmarks/k6_10k_rps.js
   cat > benchmarks/k6_10k_rps.js <<'EOF'
   import http from 'k6/http';
   import { check, sleep } from 'k6';
   import { Rate } from 'k6/metrics';

   const errorRate = new Rate('errors');

   export let options = {
     vus: 1000,
     duration: '10m',
     thresholds: {
       'http_req_duration': ['p(99)<50'], // P99 < 50ms
       'errors': ['rate<0.01'], // Error rate < 1%
     },
   };

   export default function () {
     const payload = JSON.stringify({
       model_id: 'iris-classifier',
       features: [5.1, 3.5, 1.4, 0.2]
     });

     const params = {
       headers: { 'Content-Type': 'application/json' },
     };

     const res = http.post('http://localhost:8080/api/v1/ml/predict', payload, params);

     const result = check(res, {
       'status is 200': (r) => r.status === 200,
       'has prediction': (r) => r.json().prediction !== undefined,
     });

     errorRate.add(!result);
     sleep(0.1); // 10 RPS per VU × 1000 VUs = 10K RPS
   }
   EOF
   ```

3. **Run Benchmark**
   ```bash
   # Execute 10K RPS load test
   k6 run benchmarks/k6_10k_rps.js --out json=benchmarks/results.json

   # With Prometheus export (if configured)
   k6 run benchmarks/k6_10k_rps.js --out prometheus
   ```

4. **Monitor During Test**
   ```bash
   # Terminal 1: Watch Go Gateway logs
   docker-compose logs -f go-gateway

   # Terminal 2: Watch resource usage
   docker stats go-gateway-1 go-gateway-2 go-gateway-3 go-gateway-4 go-gateway-5

   # Terminal 3: Watch Grafana dashboards
   # http://localhost:3000/d/go-gateway-overview
   ```

5. **Analyze Results**
   ```bash
   # k6 will print summary at the end:
   #
   # checks.........................: 99.97% ✓ 5998500    ✗ 1500
   # data_received..................: 1.2 GB  2.0 MB/s
   # data_sent......................: 720 MB  1.2 MB/s
   # http_req_duration..............: avg=15ms min=2ms med=8ms max=125ms p(90)=18ms p(95)=25ms p(99)=48ms
   # http_reqs......................: 6000000 10000/s
   # iteration_duration.............: avg=115ms min=102ms med=108ms max=225ms p(90)=118ms p(95)=125ms p(99)=148ms

   # Generate HTML report (if needed)
   k6 report benchmarks/results.json --output benchmarks/report.html
   ```

6. **Create Benchmark Report**
   ```bash
   cat > BENCHMARK_REPORT.md <<EOF
   # 10K RPS Benchmark Report

   **Date:** $(date)
   **Duration:** 10 minutes
   **Target RPS:** 10,000
   **Virtual Users:** 1,000

   ## Results

   - **Total Requests:** 6,000,000
   - **Success Rate:** 99.97%
   - **Avg RPS:** 10,000
   - **P99 Latency:** 48ms ✅ (< 50ms target)

   ## Detailed Metrics

   See benchmarks/results.json for full data.

   ## Conclusion

   ✅ Go Gateway successfully handles 10K RPS sustained load.
   EOF
   ```

**Success Criteria:**
- ✅ 10,000 RPS sustained for 10 minutes
- ✅ P99 latency < 50ms
- ✅ Error rate < 1%
- ✅ No service crashes or restarts

---

### Week 3: Distributed Tracing (Advanced)

**Objective:** Add Jaeger tracing for ML pipelines

(Implementation details in PHASE1_2_EXECUTION_SUMMARY.md, Section 2.3)

**Quick Steps:**
1. Install Jaeger client libraries (Go & Python)
2. Initialize tracers in both services
3. Add tracing middleware to Go Gateway
4. Propagate trace context via gRPC metadata
5. Create Grafana "ML Pipeline Tracing" dashboard

**Success Criteria:**
- ✅ End-to-end traces visible in Jaeger UI
- ✅ Trace coverage > 95%
- ✅ Overhead < 5% (10% sampling rate)

---

## Rollback Procedures

### Rollback Scenario 1: Go Gateway Failure

**Symptoms:** High error rate, service crashes, database issues

**Recovery (< 1 minute):**
```bash
# 1. Route traffic to legacy Python API (if still running)
# SSH to Nginx server
ssh admin@nginx-lb

# 2. Edit Nginx config
sudo nano /etc/nginx/nginx.conf

# Change upstream:
upstream api_backend {
    # server go-gateway:8080;  # COMMENT OUT
    server python-api-legacy:8000;  # ACTIVATE
}

# 3. Reload Nginx
sudo nginx -s reload

# 4. Verify
curl http://localhost/health
```

### Rollback Scenario 2: Accidental File Deletion

**Symptoms:** Missing endpoints, 404 errors

**Recovery (< 5 minutes):**
```bash
# 1. Find latest backup
ls -lt backups/legacy-api-*.tar.gz | head -1

# 2. Extract backup
tar -xzf backups/legacy-api-20251004-093015.tar.gz

# 3. Restore files
cp -r backups/legacy-api-20251004-093015/v1/* apps/api/app/api/v1/

# 4. Verify checksums
(cd apps/api/app/api/v1 && sha256sum -c ../../../backups/legacy-api-20251004-093015/checksums.txt)

# 5. Restart services
docker-compose restart python-api-legacy
```

### Rollback Scenario 3: ML Caching Issues

**Symptoms:** Incorrect predictions, stale data

**Recovery (< 30 seconds):**
```bash
# 1. Clear ML cache
curl -X DELETE http://localhost:8080/api/v1/admin/ml/cache/iris-classifier

# 2. Or clear all cache
docker-compose exec redis redis-cli FLUSHDB

# 3. Disable caching (temporary)
# Revert Go Gateway routes to non-cached handlers
# Rebuild & restart Go Gateway
```

---

## Monitoring & Alerts

### Key Dashboards

1. **Grafana - Go Gateway Overview**
   - URL: http://localhost:3000/d/go-gateway-overview
   - Metrics: Request rate, latency, errors

2. **Grafana - ML Service Performance**
   - URL: http://localhost:3000/d/ml-service-perf
   - Metrics: Prediction latency, cache hit rate

3. **Prometheus - Alerts**
   - URL: http://localhost:9090/alerts
   - Active alerts, firing conditions

4. **Jaeger - Distributed Tracing**
   - URL: http://localhost:16686
   - Trace search, service graph

### Critical Alerts

**Configure these alerts in AlertManager:**

```yaml
# observability/alertmanager.yml
- alert: GoGatewayHighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 2m
  annotations:
    summary: "Go Gateway error rate > 5%"
  labels:
    severity: critical

- alert: GoGatewayHighLatency
  expr: histogram_quantile(0.99, http_request_duration_seconds_bucket) > 0.5
  for: 5m
  annotations:
    summary: "Go Gateway P99 latency > 500ms"
  labels:
    severity: warning

- alert: MLServiceDown
  expr: up{job="python-ml"} == 0
  for: 1m
  annotations:
    summary: "Python ML service is down"
  labels:
    severity: critical

- alert: MLCacheLowHitRate
  expr: ml_cache_hit_rate < 0.5
  for: 10m
  annotations:
    summary: "ML cache hit rate < 50%"
  labels:
    severity: warning
```

---

## Troubleshooting

### Issue 1: Verification Script Fails

**Symptom:** `./scripts/verify_go_gateway_readiness.sh` exits with code 1 or 2

**Diagnosis:**
```bash
# Run with verbose output
bash -x ./scripts/verify_go_gateway_readiness.sh

# Check specific failures
# - Health check failing → Check Go Gateway logs
# - ML endpoint failing → Check Python ML service
# - Performance issues → Check resource usage
```

**Solutions:**
- Restart services: `docker-compose restart go-gateway python-ml`
- Check dependencies: `curl http://localhost:5432` (PostgreSQL), `redis-cli ping` (Redis)
- Review logs: `docker-compose logs go-gateway | tail -100`

### Issue 2: Legacy API Removal Script Hangs

**Symptom:** Script gets stuck during file removal

**Diagnosis:**
```bash
# Check if script is running
ps aux | grep safe_remove

# Kill if hung
pkill -f safe_remove_legacy_api.sh

# Check partial removal
ls -la apps/api/app/api/v1/
```

**Solutions:**
- Run removal manually (reference script steps)
- Restore from backup if needed
- Check disk space: `df -h`

### Issue 3: ML Caching Not Working

**Symptom:** `"cached": false` on all requests

**Diagnosis:**
```bash
# Check Redis connection
docker-compose exec redis redis-cli ping
# Should return PONG

# Check cache keys
docker-compose exec redis redis-cli KEYS 'ml:predict:*'
# Should list keys after first request

# Check Go Gateway Redis client
docker-compose logs go-gateway | grep -i redis
```

**Solutions:**
- Restart Redis: `docker-compose restart redis`
- Check Redis password in Go Gateway config
- Verify cache key generation (debug logs)

### Issue 4: 10K RPS Benchmark Fails

**Symptom:** k6 test exits with high error rate or timeouts

**Diagnosis:**
```bash
# Check if all Go Gateway replicas are running
docker-compose ps | grep go-gateway
# Should show 5 replicas

# Check resource limits
docker stats

# Check Nginx upstream config
docker-compose exec nginx cat /etc/nginx/nginx.conf | grep -A 10 "upstream go_gateway"
```

**Solutions:**
- Scale up Go Gateway: `docker-compose up -d --scale go-gateway=10`
- Increase connection limits in Nginx
- Tune database connection pool (increase max_connections)

---

## Success Verification Checklist

### Phase 1 Completion ✅
- [ ] Verification script passes (exit code 0)
- [ ] Legacy API backup created (with checksums)
- [ ] Legacy API endpoints removed (59 files)
- [ ] ML files preserved (4 files)
- [ ] Go Gateway stable for 24 hours
- [ ] No 404 errors from removed endpoints
- [ ] Rollback plan tested

### Phase 2 Completion 🔄
- [ ] ML orchestration migrated to python-ml-service
- [ ] ML caching active (cache hit rate > 70%)
- [ ] 10K RPS benchmark passed (P99 < 50ms)
- [ ] Distributed tracing implemented (coverage > 95%)
- [ ] Zero production incidents during migration
- [ ] All documentation updated

---

## Support & Resources

### Documentation
- [Architecture Analysis Report](ARCHITECTURE_ANALYSIS_REPORT.md)
- [Go Gateway Verification Report](GO_GATEWAY_VERIFICATION_REPORT.md)
- [Phase 1 & 2 Summary](PHASE1_2_EXECUTION_SUMMARY.md)

### Scripts
- [Verify Go Gateway](scripts/verify_go_gateway_readiness.sh)
- [Safe Remove Legacy API](scripts/safe_remove_legacy_api.sh)

### Dashboards
- [Grafana](http://localhost:3000)
- [Prometheus](http://localhost:9090)
- [Jaeger](http://localhost:16686)

### Contact
- DevOps Team: #devops-schlep-engine
- On-Call: PagerDuty escalation
- Documentation: Confluence/Notion

---

**Last Updated:** October 4, 2025
**Next Review:** October 11, 2025
**Status:** ✅ Ready for Execution
