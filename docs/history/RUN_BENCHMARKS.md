# Quick Start: Run Hybrid Architecture Benchmarks

**Estimated Time:** 5-10 minutes
**Purpose:** Validate Go + Rust + Python architecture performance

---

## Prerequisites Check

```bash
# 1. Docker & Docker Compose installed
docker --version
docker-compose --version

# 2. Go 1.21+ installed (for building benchmark suite)
go version

# 3. jq installed (optional, for pretty output)
jq --version  # Or: brew install jq / apt install jq
```

---

## Step 1: Start Services (2 minutes)

```bash
# Start all services in background
docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml up -d

# Wait for services to be ready (should take ~30-60 seconds)
echo "Waiting for services to start..."
sleep 30

# Verify services are healthy
curl http://localhost:8080/health

# Expected output:
# {"status":"ok","service":"go-gateway","timestamp":...}
```

**If health check fails:**
```bash
# Check service status
docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml ps

# View logs if services aren't starting
docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml logs go-gateway
docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml logs python-ml
```

---

## Step 2: Run Benchmarks (5-10 minutes)

### Quick Test (5 minutes)
```bash
# Light load: 10 concurrent, 5 seconds per endpoint
CONCURRENCY=10 DURATION=5 ./benchmarks/run_benchmarks.sh
```

### Standard Test (10 minutes - Recommended)
```bash
# Default: 100 concurrent, 10 seconds per endpoint
./benchmarks/run_benchmarks.sh
```

### Full Test (30+ minutes)
```bash
# Heavy load: 1000 concurrent, 60 seconds per endpoint
CONCURRENCY=1000 DURATION=60 ./benchmarks/run_benchmarks.sh
```

**Expected output:**
```
🚀 Schlep-Engine Hybrid Architecture Benchmark Suite
====================================================

⏳ Checking if services are running...
✅ Services are ready

🔨 Building benchmark suite...
✅ Build complete

📊 Running Endpoint Benchmarks...
  Testing health (GET /health)...
    ✓ P50: 3.42ms, P99: 8.15ms, RPS: 8542, Errors: 0
  Testing rust_add (GET /rust/add?x=42&y=58)...
    ✓ P50: 0.12ms, P99: 0.85ms, RPS: 125000, Errors: 0
  ...

✅ Benchmark suite completed successfully!
```

---

## Step 3: View Results

### Option A: Terminal Summary (if jq is installed)

```bash
# Automatically displayed at end of benchmark run
# Shows:
# - Key metrics for each endpoint
# - Validation test results (PASSED/FAILED)
# - File locations
```

### Option B: Full JSON Results

```bash
# View all metrics in JSON format
cat benchmarks/results/results.json

# Or pretty-print specific metrics
jq '.endpoints.rust_add.latency' benchmarks/results/results.json
```

**Example output:**
```json
{
  "p50_ms": 0.12,
  "p95_ms": 0.45,
  "p99_ms": 0.85,
  "mean_ms": 0.18,
  "total_calls": 125000
}
```

### Option C: Human-Readable Report

```bash
# View comprehensive markdown report
cat benchmarks/results/REPORT.md

# Or open in editor
code benchmarks/results/REPORT.md  # VS Code
open benchmarks/results/REPORT.md  # macOS default app
```

**Report includes:**
- Executive summary with key achievements
- Detailed latency/throughput per endpoint
- Stress test results
- Validation test results (memory leak, gRPC recovery, scaling)
- Performance analysis and comparison
- Key findings with ✅/❌ verdicts
- Recommendations for optimization
- Final verdict: APPROVED/CONDITIONAL/NOT READY

---

## Step 4: Interpret Results

### Performance Targets

| Test | Target | Status |
|------|--------|--------|
| **Rust FFI latency** | P99 <1ms | ⏳ Check REPORT.md |
| **Python gRPC latency** | P99 <20ms | ⏳ Check REPORT.md |
| **Go API throughput** | >5,000 RPS | ⏳ Check REPORT.md |
| **Memory leak test** | <10% growth | ⏳ Check REPORT.md |
| **gRPC recovery** | Reconnect <5s | ⏳ Check REPORT.md |

### What "PASSED" Means

**If all tests pass:**
```
### ✅ APPROVED FOR MIGRATION

Benchmark suite passed: 100% of key metrics met targets.

Recommendation: Proceed with phased migration starting with Phase 1.
```

**This means:**
- Rust FFI overhead is negligible (<1μs)
- Python gRPC latency is acceptable for ML operations (<20ms)
- Go API can handle production traffic (>5k RPS)
- No memory leaks detected in FFI calls
- System is resilient (auto-reconnects, scales horizontally)

**Next step:** Proceed with migration - see [HYBRID_ARCHITECTURE_MIGRATION_ASSESSMENT.md](HYBRID_ARCHITECTURE_MIGRATION_ASSESSMENT.md)

---

## Step 5: Cleanup

```bash
# Stop services
docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml down

# Remove volumes (optional, to free disk space)
docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml down -v
```

---

## Troubleshooting

### Problem: Services won't start

**Check Docker resources:**
```bash
# Ensure Docker has enough resources
docker info | grep -i memory
docker info | grep -i cpus

# Increase limits in Docker Desktop:
# Settings → Resources → Memory (4GB+), CPUs (2+)
```

**Check for port conflicts:**
```bash
# Port 8080 (Go Gateway)
lsof -i :8080

# Port 50051 (Python ML)
lsof -i :50051

# Kill conflicting processes if needed
```

### Problem: Benchmark build fails

**Missing Go modules:**
```bash
cd benchmarks
go mod download
go mod tidy
```

**Missing dependencies:**
```bash
# Install protoc if generating gRPC code
brew install protobuf  # macOS
apt install protobuf-compiler  # Linux
```

### Problem: High latency in results

**Possible causes:**
- System under load from other processes
- Docker resource limits too low
- Running in VM or shared environment

**Solutions:**
```bash
# 1. Close other applications
# 2. Increase Docker resources
# 3. Run on dedicated machine for accurate results
# 4. Check system load:
top
htop
```

### Problem: Memory leak test fails

**Review FFI string handling:**
```bash
# Check Go code for proper cleanup
grep -r "rust_free_string" go_gateway/

# Every rust_hello() call should have corresponding free
# Example:
# cResult := C.rust_hello(cName)
# defer C.rust_free_string(cResult)  # ← Must have this!
```

---

## Advanced Usage

### Run Individual Components

```bash
cd benchmarks

# Build
go build -o bin/load_test load_test.go

# Run specific concurrency
./bin/load_test -c 500 -d 30 -o results/custom.json

# Generate report
go build -o bin/generate_report generate_report.go
./bin/generate_report -i results/custom.json -o results/custom_report.md
```

### Compare with Baseline

```bash
# 1. Run benchmarks and save as baseline
./benchmarks/run_benchmarks.sh
cp benchmarks/results/results.json benchmarks/baseline.json

# 2. Make changes to code

# 3. Run benchmarks again
./benchmarks/run_benchmarks.sh

# 4. Compare (requires jq)
echo "Rust FFI P99 change:"
jq -s '
  .[0].endpoints.rust_add.latency.p99_ms as $old |
  .[1].endpoints.rust_add.latency.p99_ms as $new |
  (($new - $old) / $old * 100) | "\(. | floor)%"
' benchmarks/baseline.json benchmarks/results/results.json
```

### Profile Memory

```bash
cd benchmarks

# Build with profiling
go build -o bin/load_test load_test.go

# Run with memory profiling
./bin/load_test -memprofile=mem.prof

# Analyze
go tool pprof mem.prof
# Commands in pprof:
# > top10        # Show top 10 memory allocations
# > list <func>  # Show allocations in specific function
# > web          # Open graphical view
```

---

## Quick Reference

### File Locations

```
benchmarks/
├── results/
│   ├── results.json     # Machine-readable metrics
│   └── REPORT.md        # Human-readable report
├── load_test.go         # Benchmark implementation
├── generate_report.go   # Report generator
└── run_benchmarks.sh    # Automation script (run this)
```

### Environment Variables

```bash
# Concurrency level (1-100k)
CONCURRENCY=100

# Test duration per endpoint (seconds)
DURATION=10

# Example: Heavy load test
CONCURRENCY=1000 DURATION=60 ./benchmarks/run_benchmarks.sh
```

### Key Metrics to Check

1. **Rust FFI P99**: Should be <1ms (ideally <0.5ms)
2. **Python gRPC P99**: Should be <20ms (ideally <15ms)
3. **Health RPS**: Should be >5,000 (ideally >8,000)
4. **Memory Growth**: Should be <10% over 1M calls
5. **Error Rate**: Should be <1% (ideally <0.1%)

---

## What's Next?

### If Benchmarks Pass ✅

1. Review full report: `cat benchmarks/results/REPORT.md`
2. Check migration plan: [HYBRID_ARCHITECTURE_MIGRATION_ASSESSMENT.md](HYBRID_ARCHITECTURE_MIGRATION_ASSESSMENT.md)
3. Proceed to Phase 1: Migrate health endpoints (13 endpoints, Week 1-2)

### If Benchmarks Fail ❌

1. Review REPORT.md for specific failures
2. Check "Recommendations" section for optimization suggestions
3. Address performance issues:
   - FFI latency >1ms: Review cgo overhead
   - gRPC latency >20ms: Check Python service, consider Unix sockets
   - Memory leak: Review rust_free_string() usage
4. Re-run benchmarks after fixes

---

## Getting Help

**Documentation:**
- Full benchmark docs: [benchmarks/README.md](benchmarks/README.md)
- Prototype guide: [PROTOTYPE_README.md](PROTOTYPE_README.md)
- Migration plan: [HYBRID_ARCHITECTURE_MIGRATION_ASSESSMENT.md](HYBRID_ARCHITECTURE_MIGRATION_ASSESSMENT.md)

**Common Issues:**
- Service won't start: Check Docker logs
- Build fails: Run `go mod download`
- High latency: Check system resources

---

## Summary

**Complete benchmark run in 3 commands:**

```bash
# 1. Start services
docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml up -d

# 2. Run benchmarks
./benchmarks/run_benchmarks.sh

# 3. View results
cat benchmarks/results/REPORT.md
```

**Expected duration:** 5-10 minutes for standard test

**Success criteria:**
- ✅ Rust FFI P99 <1ms
- ✅ Python gRPC P99 <20ms
- ✅ Throughput >5,000 RPS
- ✅ No memory leaks
- ✅ Final verdict: "APPROVED FOR MIGRATION"

**Next step:** Review migration plan and proceed to Phase 1 ✅
