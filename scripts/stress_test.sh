#!/bin/bash

# Schlep-Engine Phase 8 - Stress Testing & Performance Validation
# Target: 10K RPS sustained, 50ms P99 latency

set -e

echo "=========================================="
echo "Schlep-Engine Phase 8 Stress Testing"
echo "=========================================="
echo ""

# Configuration
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
DURATION="${DURATION:-300s}"
CONNECTIONS="${CONNECTIONS:-100}"
TARGET_RPS="${TARGET_RPS:-10000}"
WORKERS="${WORKERS:-50}"

echo "Configuration:"
echo "  Gateway URL: $GATEWAY_URL"
echo "  Test Duration: $DURATION"
echo "  Connections: $CONNECTIONS"
echo "  Target RPS: $TARGET_RPS"
echo "  Workers: $WORKERS"
echo ""

# Create test results directory
RESULTS_DIR="./test-results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "Results will be saved to: $RESULTS_DIR"
echo ""

# Test 1: Health Check Baseline
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Health Check Baseline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s "$GATEWAY_URL/health" | jq '.' > "$RESULTS_DIR/health_check.json"
cat "$RESULTS_DIR/health_check.json"
echo ""

# Test 2: Lightweight Load Test (using Apache Bench if available)
if command -v ab &> /dev/null; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Test 2: Apache Bench - Health Endpoint"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    ab -n 10000 -c 100 -g "$RESULTS_DIR/ab_health.tsv" "$GATEWAY_URL/health" \
        > "$RESULTS_DIR/ab_health.txt" 2>&1

    echo "Completed 10K requests to /health"
    grep "Requests per second" "$RESULTS_DIR/ab_health.txt" || true
    grep "Time per request" "$RESULTS_DIR/ab_health.txt" || true
    echo ""
fi

# Test 3: Vegeta Load Test (more comprehensive)
if command -v vegeta &> /dev/null; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Test 3: Vegeta Load Test - Progressive Load"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Progressive load: 1K, 5K, 10K RPS
    for RPS in 1000 5000 10000; do
        echo "Testing at ${RPS} RPS for 60s..."

        echo "GET $GATEWAY_URL/health" | vegeta attack \
            -rate=$RPS \
            -duration=60s \
            -timeout=30s \
            > "$RESULTS_DIR/vegeta_${RPS}rps.bin"

        vegeta report \
            -type=text \
            "$RESULTS_DIR/vegeta_${RPS}rps.bin" \
            > "$RESULTS_DIR/vegeta_${RPS}rps_report.txt"

        vegeta report \
            -type=json \
            "$RESULTS_DIR/vegeta_${RPS}rps.bin" \
            > "$RESULTS_DIR/vegeta_${RPS}rps_report.json"

        # Display key metrics
        echo "Results for ${RPS} RPS:"
        cat "$RESULTS_DIR/vegeta_${RPS}rps_report.json" | jq '{
            success_rate: .success_rate,
            latencies: .latencies,
            throughput: .throughput,
            requests: .requests
        }'
        echo ""
    done
fi

# Test 4: k6 Load Test (if available)
if command -v k6 &> /dev/null; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Test 4: k6 Load Test - Sustained Load"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Create k6 test script
    cat > "$RESULTS_DIR/k6_test.js" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '30s', target: 100 },   // Ramp-up to 100 VUs
        { duration: '1m', target: 500 },    // Ramp-up to 500 VUs
        { duration: '2m', target: 1000 },   // Ramp-up to 1000 VUs
        { duration: '3m', target: 1000 },   // Stay at 1000 VUs (10K RPS)
        { duration: '30s', target: 0 },     // Ramp-down
    ],
    thresholds: {
        http_req_duration: ['p(99)<50'],    // 99% of requests under 50ms
        http_req_failed: ['rate<0.01'],     // Error rate under 1%
        errors: ['rate<0.01'],
    },
};

export default function () {
    const responses = http.batch([
        ['GET', `${__ENV.GATEWAY_URL}/health`],
        ['GET', `${__ENV.GATEWAY_URL}/metrics`],
    ]);

    responses.forEach((res) => {
        const success = check(res, {
            'status is 200': (r) => r.status === 200,
            'response time < 50ms': (r) => r.timings.duration < 50,
        });
        errorRate.add(!success);
    });

    sleep(0.01); // 10ms think time
}
EOF

    k6 run --out json="$RESULTS_DIR/k6_results.json" \
        --env GATEWAY_URL="$GATEWAY_URL" \
        "$RESULTS_DIR/k6_test.js" \
        > "$RESULTS_DIR/k6_output.txt" 2>&1 || true

    echo "k6 test completed. See $RESULTS_DIR/k6_output.txt for details"
    echo ""
fi

# Test 5: wrk Load Test (if available)
if command -v wrk &> /dev/null; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Test 5: wrk Load Test - High Concurrency"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    wrk -t$WORKERS -c$CONNECTIONS -d$DURATION \
        --latency \
        "$GATEWAY_URL/health" \
        > "$RESULTS_DIR/wrk_health.txt"

    cat "$RESULTS_DIR/wrk_health.txt"
    echo ""
fi

# Test 6: Collect Prometheus Metrics During Test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 6: Prometheus Metrics Collection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s "$GATEWAY_URL/metrics" > /dev/null; then
    curl -s "$GATEWAY_URL/metrics" > "$RESULTS_DIR/metrics_snapshot.txt"

    # Extract key metrics
    echo "Key Metrics:"
    grep "http_requests_total" "$RESULTS_DIR/metrics_snapshot.txt" | head -5
    grep "http_request_duration" "$RESULTS_DIR/metrics_snapshot.txt" | head -5
    echo ""
fi

# Test 7: System Resource Monitoring
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 7: System Resource Snapshot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v docker &> /dev/null; then
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
        > "$RESULTS_DIR/docker_stats.txt" 2>&1 || true
    cat "$RESULTS_DIR/docker_stats.txt" 2>/dev/null || echo "Docker stats unavailable"
fi
echo ""

# Generate Summary Report
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Generating Summary Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > "$RESULTS_DIR/SUMMARY.md" << EOF
# Schlep-Engine Phase 8 Stress Test Summary

**Test Date:** $(date)
**Gateway URL:** $GATEWAY_URL
**Target:** 10K RPS sustained, P99 < 50ms

## Test Configuration
- Duration: $DURATION
- Connections: $CONNECTIONS
- Workers: $WORKERS
- Target RPS: $TARGET_RPS

## Test Results

### Health Check
\`\`\`json
$(cat "$RESULTS_DIR/health_check.json" 2>/dev/null || echo "{}")
\`\`\`

### Load Test Results

EOF

# Add vegeta results if available
if [ -f "$RESULTS_DIR/vegeta_10000rps_report.json" ]; then
    echo "#### Vegeta @ 10K RPS" >> "$RESULTS_DIR/SUMMARY.md"
    echo '```json' >> "$RESULTS_DIR/SUMMARY.md"
    cat "$RESULTS_DIR/vegeta_10000rps_report.json" | jq '{
        success_rate,
        latencies,
        throughput,
        requests
    }' >> "$RESULTS_DIR/SUMMARY.md"
    echo '```' >> "$RESULTS_DIR/SUMMARY.md"
    echo "" >> "$RESULTS_DIR/SUMMARY.md"
fi

# Add wrk results if available
if [ -f "$RESULTS_DIR/wrk_health.txt" ]; then
    echo "#### wrk Results" >> "$RESULTS_DIR/SUMMARY.md"
    echo '```' >> "$RESULTS_DIR/SUMMARY.md"
    cat "$RESULTS_DIR/wrk_health.txt" >> "$RESULTS_DIR/SUMMARY.md"
    echo '```' >> "$RESULTS_DIR/SUMMARY.md"
    echo "" >> "$RESULTS_DIR/SUMMARY.md"
fi

cat >> "$RESULTS_DIR/SUMMARY.md" << EOF

## Validation Criteria

| Metric | Target | Result | Pass/Fail |
|--------|--------|--------|-----------|
| Sustained RPS | 10,000 | TBD | ⏳ |
| P99 Latency | < 50ms | TBD | ⏳ |
| Error Rate | < 1% | TBD | ⏳ |
| CPU Usage | < 80% | TBD | ⏳ |
| Memory Usage | < 80% | TBD | ⏳ |

## Recommendations

1. Review Prometheus dashboards for detailed metrics
2. Check Jaeger traces for slow requests
3. Analyze resource utilization patterns
4. Optimize hot paths if necessary

---
**Generated by:** Schlep-Engine Phase 8 Stress Testing Framework
EOF

echo ""
echo "=========================================="
echo "✅ Stress Testing Complete"
echo "=========================================="
echo ""
echo "Results saved to: $RESULTS_DIR"
echo "Summary report: $RESULTS_DIR/SUMMARY.md"
echo ""
echo "Next steps:"
echo "  1. Review test results and metrics"
echo "  2. Analyze performance bottlenecks"
echo "  3. Validate against 10K RPS target"
echo "  4. Generate final validation report"
echo ""
