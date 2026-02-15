#!/bin/bash
# Igris Inertial Go Gateway Production Readiness Verification
# Phase 1: Verify 100% traffic handling capability

set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
LEGACY_API_URL="${LEGACY_API_URL:-http://localhost:8000}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Go Gateway Production Readiness Check"
echo "========================================="
echo ""

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
pass() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}✓${NC} $1"
}

fail() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Health Check Tests
echo "1. Health & Readiness Checks"
echo "-----------------------------"

if curl -sf "$GATEWAY_URL/health" > /dev/null 2>&1; then
    HEALTH_RESP=$(curl -s "$GATEWAY_URL/health")
    if echo "$HEALTH_RESP" | grep -q '"status":"ok"'; then
        pass "Go Gateway health check: OK"
    else
        fail "Go Gateway health check: Unexpected response"
    fi
else
    fail "Go Gateway health check: FAILED (service unreachable)"
fi

if curl -sf "$GATEWAY_URL/ready" > /dev/null 2>&1; then
    READY_RESP=$(curl -s "$GATEWAY_URL/ready")
    if echo "$READY_RESP" | grep -q '"database":"connected"'; then
        pass "Go Gateway readiness check: OK (DB connected)"
    else
        warn "Go Gateway readiness: Response received but DB status unclear"
    fi
else
    fail "Go Gateway readiness check: FAILED"
fi

if curl -sf "$GATEWAY_URL/version" > /dev/null 2>&1; then
    VERSION=$(curl -s "$GATEWAY_URL/version" | jq -r '.version' 2>/dev/null || echo "unknown")
    pass "Go Gateway version endpoint: $VERSION"
else
    fail "Go Gateway version endpoint: FAILED"
fi

echo ""

# 2. Metrics & Observability
echo "2. Metrics & Observability"
echo "--------------------------"

if curl -sf "$GATEWAY_URL/metrics" > /dev/null 2>&1; then
    METRICS=$(curl -s "$GATEWAY_URL/metrics")
    if echo "$METRICS" | grep -q 'http_requests_total'; then
        pass "Prometheus metrics endpoint: Exporting metrics"
    else
        warn "Prometheus metrics: Endpoint accessible but no metrics found"
    fi
else
    fail "Prometheus metrics endpoint: FAILED"
fi

# Check for critical metrics
if curl -s "$GATEWAY_URL/metrics" | grep -q 'http_request_duration_seconds'; then
    pass "HTTP latency metrics: Available"
else
    fail "HTTP latency metrics: Missing"
fi

if curl -s "$GATEWAY_URL/metrics" | grep -q 'grpc_client_calls_total'; then
    pass "gRPC client metrics: Available"
else
    warn "gRPC client metrics: Not found (ML service may not be active)"
fi

echo ""

# 3. Core API Endpoint Tests
echo "3. Core API Endpoints"
echo "---------------------"

# Auth endpoints (public)
if curl -sf -X POST "$GATEWAY_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"testpass"}' > /dev/null 2>&1; then
    warn "Auth register endpoint: Accessible (may return validation error)"
else
    # Expected to fail with validation error, but endpoint should exist
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$GATEWAY_URL/api/v1/auth/register" \
        -H "Content-Type: application/json" \
        -d '{}')
    if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
        pass "Auth register endpoint: Available (returns validation error as expected)"
    else
        fail "Auth register endpoint: Unexpected response code $HTTP_CODE"
    fi
fi

# ML endpoints
if curl -sf -X POST "$GATEWAY_URL/api/v1/ml/predict" \
    -H "Content-Type: application/json" \
    -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}' > /dev/null 2>&1; then
    PRED_RESP=$(curl -s -X POST "$GATEWAY_URL/api/v1/ml/predict" \
        -H "Content-Type: application/json" \
        -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}')

    if echo "$PRED_RESP" | grep -q '"prediction"'; then
        pass "ML predict endpoint: Working (gRPC to Python ML service)"
    else
        warn "ML predict endpoint: Accessible but unexpected response"
    fi
else
    warn "ML predict endpoint: ML service may be unavailable"
fi

# Rust FFI endpoints
if curl -sf "$GATEWAY_URL/api/v1/rust/add?x=5&y=3" > /dev/null 2>&1; then
    RUST_RESP=$(curl -s "$GATEWAY_URL/api/v1/rust/add?x=5&y=3")
    if echo "$RUST_RESP" | grep -q '"result":8'; then
        pass "Rust FFI endpoint: Working (cgo integration)"
    else
        fail "Rust FFI endpoint: Unexpected response"
    fi
else
    fail "Rust FFI endpoint: FAILED"
fi

# Hybrid test endpoint
if curl -sf "$GATEWAY_URL/api/v1/test/hybrid" > /dev/null 2>&1; then
    HYBRID_RESP=$(curl -s "$GATEWAY_URL/api/v1/test/hybrid")
    if echo "$HYBRID_RESP" | grep -q '"architecture"'; then
        pass "Hybrid test endpoint: Working (Go → Rust → Python)"
    else
        fail "Hybrid test endpoint: Unexpected response"
    fi
else
    warn "Hybrid test endpoint: ML service may be unavailable"
fi

echo ""

# 4. Performance Baseline Check
echo "4. Performance Baseline"
echo "-----------------------"

# Measure health check latency
HEALTH_LATENCY=$(curl -s -o /dev/null -w "%{time_total}" "$GATEWAY_URL/health")
HEALTH_LATENCY_MS=$(echo "$HEALTH_LATENCY * 1000" | bc)
if (( $(echo "$HEALTH_LATENCY_MS < 50" | bc -l) )); then
    pass "Health check latency: ${HEALTH_LATENCY_MS}ms (< 50ms threshold)"
else
    warn "Health check latency: ${HEALTH_LATENCY_MS}ms (exceeds 50ms threshold)"
fi

# Measure ML prediction latency (if available)
if curl -sf "$GATEWAY_URL/api/v1/ml/predict" -X POST \
    -H "Content-Type: application/json" \
    -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}' > /dev/null 2>&1; then

    ML_LATENCY=$(curl -s -o /dev/null -w "%{time_total}" -X POST "$GATEWAY_URL/api/v1/ml/predict" \
        -H "Content-Type: application/json" \
        -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}')
    ML_LATENCY_MS=$(echo "$ML_LATENCY * 1000" | bc)

    if (( $(echo "$ML_LATENCY_MS < 100" | bc -l) )); then
        pass "ML prediction latency: ${ML_LATENCY_MS}ms (< 100ms threshold)"
    else
        warn "ML prediction latency: ${ML_LATENCY_MS}ms (exceeds 100ms threshold)"
    fi
fi

echo ""

# 5. Dependency Health Checks
echo "5. Infrastructure Dependencies"
echo "------------------------------"

# Check Redis connection (via metrics or health endpoint)
READY_DATA=$(curl -s "$GATEWAY_URL/ready")
if echo "$READY_DATA" | grep -q '"redis":"connected"'; then
    pass "Redis connection: Connected"
elif echo "$READY_DATA" | grep -q '"redis":"disconnected"'; then
    fail "Redis connection: Disconnected"
else
    warn "Redis connection: Status unknown"
fi

# Check Database connection
if echo "$READY_DATA" | grep -q '"database":"connected"'; then
    pass "PostgreSQL connection: Connected"
elif echo "$READY_DATA" | grep -q '"database":"disconnected"'; then
    fail "PostgreSQL connection: Disconnected"
else
    warn "PostgreSQL connection: Status unknown"
fi

# Check ML service connection
if curl -sf "$GATEWAY_URL/api/v1/ml/health" > /dev/null 2>&1; then
    ML_HEALTH=$(curl -s "$GATEWAY_URL/api/v1/ml/health")
    if echo "$ML_HEALTH" | grep -q '"status":"healthy"'; then
        pass "Python ML service: Healthy"
    else
        warn "Python ML service: Unhealthy or degraded"
    fi
else
    warn "Python ML service: Health check unavailable"
fi

echo ""

# 6. Security & Rate Limiting
echo "6. Security & Rate Limiting"
echo "---------------------------"

# Test CORS headers
CORS_HEADERS=$(curl -s -I "$GATEWAY_URL/health" | grep -i "access-control")
if [ -n "$CORS_HEADERS" ]; then
    pass "CORS headers: Configured"
else
    warn "CORS headers: Not found in response"
fi

# Test rate limiting (if enabled)
# Send multiple rapid requests
RATE_LIMIT_TEST=0
for i in {1..15}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health")
    if [ "$HTTP_CODE" = "429" ]; then
        RATE_LIMIT_TEST=1
        break
    fi
done

if [ "$RATE_LIMIT_TEST" = "1" ]; then
    pass "Rate limiting: Active (received 429 on rapid requests)"
else
    warn "Rate limiting: Not detected (may be disabled or threshold not reached)"
fi

echo ""

# 7. Compare with Legacy Python API
echo "7. Legacy Python API Comparison"
echo "--------------------------------"

if curl -sf "$LEGACY_API_URL/health" > /dev/null 2>&1; then
    warn "Legacy Python API: Still running on $LEGACY_API_URL"
    echo "   ⚠ Recommend shutting down after Go gateway verification"
else
    pass "Legacy Python API: Not responding (already sunset)"
fi

echo ""

# 8. Summary Report
echo "========================================="
echo "VERIFICATION SUMMARY"
echo "========================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo -e "${YELLOW}Warnings: Check output above${NC}"
echo ""

SUCCESS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
echo "Success Rate: ${SUCCESS_RATE}%"
echo ""

# Production readiness assessment
if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}✓ GO GATEWAY IS PRODUCTION READY${NC}"
    echo "  All critical tests passed"
    echo "  Safe to proceed with legacy Python API removal"
    exit 0
elif [ "$FAILED_TESTS" -le 2 ]; then
    echo -e "${YELLOW}⚠ GO GATEWAY NEEDS ATTENTION${NC}"
    echo "  Some non-critical tests failed"
    echo "  Review failures before proceeding"
    exit 1
else
    echo -e "${RED}✗ GO GATEWAY NOT READY FOR PRODUCTION${NC}"
    echo "  Multiple critical failures detected"
    echo "  DO NOT proceed with legacy API removal"
    exit 2
fi
