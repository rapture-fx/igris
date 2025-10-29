# Quick Start: Running Reliability Benchmark

This guide helps you run the full 1000-request live reliability benchmark with real OpenAI and Anthropic providers.

## Prerequisites

✅ API keys configured in `.env`:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Step 1: Stop Any Running API Servers

```bash
killall schlep-engine-api
```

## Step 2: Set Environment Variables

```bash
export PROVIDER_MODE=real
export TRACING_ENABLED=false
export OPENAI_API_KEY="$(grep ^OPENAI_API_KEY= .env | cut -d= -f2-)"
export ANTHROPIC_API_KEY="$(grep ^ANTHROPIC_API_KEY= .env | cut -d= -f2-)"
```

## Step 3: Start API Server

```bash
./schlep-engine-api > logs/api_live.log 2>&1 &
```

Wait 5 seconds for startup, then verify:

```bash
curl -s http://localhost:8080/v1/health | python3 -m json.tool
```

Should show `"status": "healthy"`.

## Step 4: Run Benchmark

```bash
python3 benchmarks/reliability_benchmark.py \
  --url http://localhost:8080 \
  --requests 1000 \
  --workers 20 \
  --output benchmarks/results/reliability_benchmark_live.json
```

## Expected Output

```
================================================================================
🚀 RELIABILITY VALIDATION BENCHMARK
================================================================================
Configuration:
  Target URL:       http://localhost:8080
  Total Requests:   1000
  Concurrent Workers: 20
  Models:           gpt-4, claude-3-haiku-20240307
================================================================================

  Progress: 100/1000 (10.0%) | Rate: X req/s
  ...
  Progress: 1000/1000 (100.0%) | Rate: X req/s

================================================================================
✅ Benchmark Completed!
  Duration: XX seconds
  Throughput: XX requests/second
  Successful: XXX
  Failed: X
================================================================================

📊 BENCHMARK RESULTS
...

✅ Validation Results:
  Success Rate:  XX.XX% (target: ≥99.0%)
    Status: ✅ PASS / ❌ FAIL
  P95 Latency:   XXXXms (target: ≤3000ms)
    Status: ✅ PASS / ❌ FAIL
  Total Cost:    $X.XXXXXX (budget: ≤$5.00)
    Status: ✅ PASS / ❌ FAIL
```

## Validation Criteria

| Metric | Target | Pass/Fail |
|--------|--------|-----------|
| Success Rate | ≥99% | ✅ / ❌ |
| P95 Latency | ≤3000ms | ✅ / ❌ |
| Total Cost | ≤$5.00 | ✅ / ❌ |

## Results Location

- **JSON Data:** `benchmarks/results/reliability_benchmark_live.json`
- **Log Output:** `logs/reliability_1000_live.log` (if using `tee`)

## Troubleshooting

### API Server Not Starting

Check logs:
```bash
tail -50 logs/api_live.log
```

Common issues:
- **"FATAL: no API keys"** → Export OPENAI_API_KEY and ANTHROPIC_API_KEY
- **"Port already in use"** → Kill existing process with `killall schlep-engine-api`
- **"Tracing error"** → Set `TRACING_ENABLED=false`

### High Error Rate

If seeing >1% errors:
1. Check API key validity
2. Verify rate limits aren't too aggressive
3. Check provider status (OpenAI/Anthropic dashboards)
4. Review logs for specific error messages

### Slow Performance

If P95 > 3000ms:
1. Reduce concurrent workers (--workers 10)
2. Check network latency
3. Monitor queue depths in Prometheus
4. Verify API server isn't CPU/memory constrained

## Quick Test (100 Requests)

Test before running full benchmark:

```bash
python3 benchmarks/reliability_benchmark.py \
  --url http://localhost:8080 \
  --requests 100 \
  --workers 10
```

Should complete in ~10-30 seconds.

## Cleanup

Stop API server:
```bash
killall schlep-engine-api
```

## Mock Mode Testing

To test without using real APIs:

```bash
export PROVIDER_MODE=mock
./schlep-engine-api > logs/api_mock.log 2>&1 &

python3 benchmarks/reliability_benchmark.py \
  --url http://localhost:8080 \
  --requests 1000 \
  --workers 20
```

Mock mode should achieve:
- ✅ 100% success rate
- ✅ P95 latency <300ms
- ✅ Total cost ~$0.15

## Next Steps After Successful Benchmark

1. Review detailed results in JSON output
2. Check Prometheus metrics at http://localhost:9090
3. Update Grafana dashboards with new metrics
4. Document cost per 1K requests for budgeting
5. Run load tests with higher concurrency (50+ workers)

---

**Need Help?**
- Check `docs/reports/reliability_improvements_summary.md`
- Review API logs in `logs/`
- Examine Prometheus metrics at `/metrics` endpoint
