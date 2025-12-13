# 🚀 START HERE - Schlep-Engine Stability Testing

## Quick Start (5 Minutes)

### Step 1: Start the API in Test Mode

Open a terminal and run:

```bash
cd /Users/wira/Desktop/igris-inertial

# Set test configuration (NO API COSTS - uses benchmark mode)
export PROVIDER_MODE=benchmark
export ENABLE_COGNITIVE_ADVISOR=true
export OPTIMIZER_MODE=shadow
export PORT=8081
export ENABLE_BENCHMARK_FALLBACK=true

# Start API
go run cmd/igris-overture/main.go
```

**Expected Output:**
```
🚀 Schlep-Engine API Server
📡 Starting on port 8081
✅ Database connected
✅ Redis connected
🎯 Provider mode: benchmark (no costs)
✨ Ready to accept requests
```

**Keep this terminal open** - the API needs to stay running.

### Step 2: Run Tests (in a new terminal)

Open a **new terminal** and run:

```bash
cd /Users/wira/Desktop/igris-inertial/stability-tests/scripts

# Interactive menu (recommended for first time)
./setup_and_test.sh

# OR quick smoke test (2 minutes)
python3 load_test_basic_requests.py --url http://localhost:8081 --requests 100 --concurrency 10

# OR full test suite (25 minutes)
./run_all_tests.sh
```

---

## What Each Test Does

### 1. **Quick Smoke Test** (2 min) ✅ Start Here
```bash
python3 load_test_basic_requests.py --url http://localhost:8081 --requests 100 --concurrency 10
```
- **Purpose**: Fast validation that API is working
- **Tests**: Basic request/response, error rates
- **Pass Criteria**: 0% 5xx errors, <2s P95 latency

### 2. **FFI Boundary Stress Test** (5 min) ⭐ Critical
```bash
python3 test_ffi_boundary.py --url http://localhost:8081 --duration 120 --concurrency 20
```
- **Purpose**: Validate Go ↔ Rust Thompson Sampling stability
- **Tests**: FFI calls under load, memory leaks, panics
- **Pass Criteria**: 0 panics, <15% memory growth
- **Why Important**: FFI bugs cause complete crashes

### 3. **Streaming Reliability** (2 min) ⭐ Critical
```bash
python3 test_streaming_concurrency.py --url http://localhost:8081 --concurrent 10 --iterations 30
```
- **Purpose**: Ensure SSE streams don't hang
- **Tests**: Concurrent streams, TTFT, broken pipes
- **Pass Criteria**: 99% completion, 0 broken pipes
- **Why Important**: Broken streams = poor UX

### 4. **SLO Enforcer** (3 min) ⭐ NEW Feature
```bash
python3 test_slo_enforcer.py --url http://localhost:8081
```
- **Purpose**: Verify SLO breach auto-remediation
- **Tests**: Burn rate detection, strategy switching
- **Pass Criteria**: Detects breaches, logs audit events
- **Why Important**: Prevents SLA violations

### 5. **Full Test Suite** (25 min) 🎯 Pre-Deployment
```bash
./run_all_tests.sh
```
- **Purpose**: Complete validation before production
- **Tests**: All 9 tests in sequence
- **Output**: Comprehensive report in `reports/`
- **When to Run**: Before every production deployment

---

## Understanding Test Results

### ✅ All Tests Pass
```
✅ LOAD TEST PASSED
✅ FFI BOUNDARY PASSED
✅ STREAMING PASSED
✅ ALL TESTS PASSED - System is production-ready!
```
**Action**: Safe to deploy to production

### ⚠️ Some Tests Have Warnings
```
✅ LOAD TEST PASSED
⚠️  FFI BOUNDARY: Memory growth 12% (target: <15%)
✅ STREAMING PASSED
⚠️  Some warnings detected - review before deployment
```
**Action**: Review warnings, monitor in production, deploy OK

### ❌ Tests Failed
```
✅ LOAD TEST PASSED
❌ FFI BOUNDARY FAILED - 3 panics detected
✅ STREAMING PASSED
❌ SOME TESTS FAILED - DO NOT DEPLOY
```
**Action**: Fix issues, re-run tests, DO NOT deploy until all pass

---

## Troubleshooting

### API Won't Start

**Problem**: `panic: dial tcp connect: connection refused`
```bash
# Check if database is running
psql postgres://wira@localhost:5432/schlep -c "SELECT 1"

# If not running, start PostgreSQL
brew services start postgresql@14
```

**Problem**: `redis: connection refused`
```bash
# Start Redis
brew services start redis

# Or run in foreground
redis-server
```

### Tests Fail to Connect

**Problem**: `Connection refused to localhost:8081`
```bash
# Check if API is running
curl http://localhost:8081/healthz

# Check what's using port 8081
lsof -i :8081

# If nothing, restart API
```

### Import Errors in Python

**Problem**: `ModuleNotFoundError: No module named 'aiohttp'`
```bash
# Install dependencies
pip3 install aiohttp psutil requests

# Or with specific versions
pip3 install aiohttp==3.9.0 psutil==5.9.0 requests==2.31.0
```

### Tests Timeout

**Problem**: Tests hang or timeout
```bash
# Reduce concurrency
python3 load_test_basic_requests.py --concurrency 5 --requests 50

# Check API logs for errors
# (in API terminal, look for error messages)

# Check API health
curl http://localhost:8081/healthz
curl http://localhost:8081/v1/providers/stats
```

---

## Test Configuration

### Benchmark Mode (Default - Recommended)
```bash
export PROVIDER_MODE=benchmark
export ENABLE_BENCHMARK_FALLBACK=true
```
- ✅ **Zero API costs** (simulated responses)
- ✅ Safe for aggressive testing
- ✅ Realistic latency
- ✅ Reproducible results

### Real Mode (Use Sparingly)
```bash
export PROVIDER_MODE=real
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export MAX_MONTHLY_COST_USD=5.0
```
- ⚠️ **Incurs real API costs**
- Use only for final pre-production validation
- Keep MAX_MONTHLY_COST_USD low (e.g., $5)

---

## What to Check After Tests

### 1. Test Reports
```bash
# View latest report
cat stability-tests/reports/stability_report_*.txt | tail -100

# Count passed tests
grep "PASSED" stability-tests/reports/stability_report_*.txt | wc -l
```

### 2. API Logs
Check API terminal for:
- ❌ Any `panic` or `fatal` messages
- ❌ Unexpected `error` messages
- ✅ Successful request logs
- ✅ Provider stats updates

### 3. Key Metrics
```bash
# Get current metrics
curl http://localhost:8081/metrics | grep http_requests_total

# Check for 5xx errors (should be 0)
curl http://localhost:8081/metrics | grep 'http_requests_total.*5[0-9][0-9]'

# Check provider health
curl http://localhost:8081/v1/providers/stats | jq
```

---

## Next Steps After Testing

### If Tests Pass ✅

1. **Set up Continuous Monitoring**
   ```bash
   kubectl apply -f stability-tests/monitoring/prometheus-alerts.yml
   ```

2. **Import Grafana Dashboard**
   ```bash
   # Import monitoring/grafana-dashboard.json into Grafana
   ```

3. **Schedule Regular Tests**
   ```bash
   # Add to cron or CI/CD
   0 2 * * * cd /path/to/igris-inertial && ./stability-tests/scripts/run_all_tests.sh
   ```

4. **Deploy with Confidence**
   - All tests passing = Safe to deploy
   - Set up production monitoring
   - Keep rollback procedure handy

### If Tests Fail ❌

1. **Review Failure Details**
   - Check test output for specific errors
   - Review API logs for root cause
   - Check database/Redis connectivity

2. **Common Fixes**
   - **FFI Panic**: Set `OPTIMIZER_MODE=go-only`
   - **Database Timeout**: Check connection pool size
   - **Memory Leak**: Review recent code changes
   - **Stream Broken Pipe**: Check timeout settings

3. **Re-run After Fixes**
   ```bash
   # Run failed test individually
   python3 test_that_failed.py --url http://localhost:8081

   # Or run full suite again
   ./run_all_tests.sh
   ```

4. **Get Help**
   - Review: `stability-tests/INCIDENT_RESPONSE_PLAYBOOK.md`
   - Check: `stability-tests/README.md`
   - Contact: Platform engineering team

---

## Quick Command Reference

```bash
# Start API (benchmark mode - no costs)
export PROVIDER_MODE=benchmark && go run cmd/igris-overture/main.go

# Quick smoke test (2 min)
./stability-tests/scripts/setup_and_test.sh

# Individual critical tests
python3 test_ffi_boundary.py --url http://localhost:8081 --duration 120
python3 test_streaming_concurrency.py --url http://localhost:8081 --concurrent 10

# Full test suite (25 min)
./stability-tests/scripts/run_all_tests.sh

# Check API health
curl http://localhost:8081/healthz

# Get metrics
curl http://localhost:8081/metrics | grep http_requests

# View latest report
cat stability-tests/reports/stability_report_*.txt
```

---

## Documentation Index

- **This File**: Quick start guide (you are here)
- `README.md`: Complete testing documentation
- `TESTING_SUMMARY.md`: Executive summary and overview
- `INCIDENT_RESPONSE_PLAYBOOK.md`: Emergency procedures
- `QUICK_REFERENCE.md`: One-page emergency reference

---

**Ready to start?**

1. Open terminal → Start API (Step 1 above)
2. Open new terminal → Run tests (Step 2 above)
3. Review results and deploy! 🚀

**Questions?** See `stability-tests/README.md` or `QUICK_REFERENCE.md`
