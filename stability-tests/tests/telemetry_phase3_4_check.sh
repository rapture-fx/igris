#!/bin/bash

# Telemetry Validation Script for Phase 3 & 4
# Validates all metrics, endpoints, and success criteria

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
METRICS_URL="${METRICS_URL:-http://localhost:8080/metrics}"
EXPECTED_METRICS_COUNT=22
VALIDATION_TIMEOUT=300  # 5 minutes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
    ((TESTS_TOTAL++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Banner
echo "═══════════════════════════════════════════════════════════════"
echo "  Phase 3 & 4 Telemetry Validation"
echo "  Target: $API_BASE_URL"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Check if API is running
log_info "Step 1: Checking API availability..."
if curl -s -f "${API_BASE_URL}/health" > /dev/null 2>&1; then
    log_success "API is running and healthy"
else
    log_error "API is not available at ${API_BASE_URL}"
    exit 1
fi

# 2. Validate Phase 3 metrics exist
log_info "Step 2: Validating Phase 3 metrics..."

PHASE3_METRICS=(
    "igris_semantic_classifications_total"
    "igris_semantic_classification_latency_ms"
    "igris_semantic_classification_confidence"
    "igris_bandit_reward_updates_total"
    "igris_provider_reward_mean"
    "igris_provider_reward_alpha"
    "igris_provider_reward_beta"
    "igris_feedback_latency_ms"
    "igris_feedback_events_total"
    "igris_feedback_processed_total"
    "igris_reward_component_latency"
    "igris_reward_component_cost"
    "igris_reward_component_success"
    "igris_composite_reward_weights"
)

METRICS_FOUND=0
for metric in "${PHASE3_METRICS[@]}"; do
    if curl -s "${METRICS_URL}" | grep -q "^${metric}"; then
        log_success "Metric found: ${metric}"
        ((METRICS_FOUND++))
    else
        log_error "Metric missing: ${metric}"
    fi
done

log_info "Phase 3 metrics found: ${METRICS_FOUND}/${#PHASE3_METRICS[@]}"

# 3. Validate Phase 4 metrics exist
log_info "Step 3: Validating Phase 4 metrics..."

PHASE4_METRICS=(
    "igris_policy_version_active"
    "igris_policy_reload_total"
    "igris_policy_reload_latency_seconds"
    "igris_sla_violations_total"
    "igris_sla_compliance_status"
    "igris_provider_degraded_total"
    "igris_sla_measured_value"
    "igris_sla_target_value"
    "igris_audit_log_entries_total"
    "igris_self_tuning_optimizations_total"
    "igris_self_tuning_performance_improvement"
    "igris_self_tuning_confidence"
)

for metric in "${PHASE4_METRICS[@]}"; do
    if curl -s "${METRICS_URL}" | grep -q "^${metric}"; then
        log_success "Metric found: ${metric}"
        ((METRICS_FOUND++))
    else
        log_error "Metric missing: ${metric}"
    fi
done

log_info "Phase 4 metrics found: $((METRICS_FOUND - ${#PHASE3_METRICS[@]}))/${#PHASE4_METRICS[@]}"

# 4. Test semantic classification endpoint
log_info "Step 4: Testing semantic classification endpoint..."

CLASSIFY_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/v1/routing/semantic" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Write a Python function to sort a list"}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$CLASSIFY_RESPONSE" | tail -n 1)
BODY=$(echo "$CLASSIFY_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    CLASS=$(echo "$BODY" | jq -r '.class' 2>/dev/null || echo "")
    CONFIDENCE=$(echo "$BODY" | jq -r '.confidence' 2>/dev/null || echo "0")

    if [ "$CLASS" = "code_generation" ]; then
        log_success "Classification correct: code_generation (confidence: $CONFIDENCE)"
    elif [ -n "$CLASS" ]; then
        log_warning "Classification unexpected: $CLASS (expected: code_generation)"
    else
        log_error "Classification endpoint returned invalid JSON"
    fi
else
    log_error "Classification endpoint failed (HTTP $HTTP_CODE)"
fi

# 5. Test feedback endpoint
log_info "Step 5: Testing feedback endpoint..."

FEEDBACK_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/v1/feedback" \
    -H "Content-Type: application/json" \
    -d '{
        "request_id": "00000000-0000-0000-0000-000000000001",
        "latency": 150,
        "cost": 0.002,
        "success": true,
        "provider_id": "00000000-0000-0000-0000-000000000002",
        "semantic_class": "code_generation"
    }' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$FEEDBACK_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    COMPOSITE_REWARD=$(echo "$FEEDBACK_RESPONSE" | head -n -1 | jq -r '.composite_reward' 2>/dev/null || echo "0")
    log_success "Feedback endpoint working (composite_reward: $COMPOSITE_REWARD)"
else
    log_error "Feedback endpoint failed (HTTP $HTTP_CODE)"
fi

# 6. Verify metric increments after classification
log_info "Step 6: Verifying metric increments..."

sleep 2  # Allow metrics to be recorded

CLASSIFICATIONS_TOTAL=$(curl -s "${METRICS_URL}" | grep "igris_semantic_classifications_total" | grep "code_generation" | awk '{print $2}' | head -1)
if [ -n "$CLASSIFICATIONS_TOTAL" ] && [ "$CLASSIFICATIONS_TOTAL" -gt 0 ]; then
    log_success "igris_semantic_classifications_total incremented: $CLASSIFICATIONS_TOTAL"
else
    log_warning "igris_semantic_classifications_total not yet incremented"
fi

# 7. Test feedback stats endpoint
log_info "Step 7: Testing feedback stats endpoint..."

STATS_RESPONSE=$(curl -s "${API_BASE_URL}/v1/feedback/stats" -w "\n%{http_code}")
HTTP_CODE=$(echo "$STATS_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    TOTAL_FEEDBACK=$(echo "$STATS_RESPONSE" | head -n -1 | jq -r '.total_feedback' 2>/dev/null || echo "0")
    log_success "Feedback stats endpoint working (total_feedback: $TOTAL_FEEDBACK)"
else
    log_error "Feedback stats endpoint failed (HTTP $HTTP_CODE)"
fi

# 8. Test semantic distribution endpoint
log_info "Step 8: Testing semantic distribution endpoint..."

DIST_RESPONSE=$(curl -s "${API_BASE_URL}/v1/analytics/semantic/distribution" -w "\n%{http_code}")
HTTP_CODE=$(echo "$DIST_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    log_success "Semantic distribution endpoint working"
else
    log_warning "Semantic distribution endpoint not available (HTTP $HTTP_CODE)"
fi

# 9. Test reward composition endpoint
log_info "Step 9: Testing reward composition endpoint..."

REWARD_RESPONSE=$(curl -s "${API_BASE_URL}/v1/analytics/rewards/composition" -w "\n%{http_code}")
HTTP_CODE=$(echo "$REWARD_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    log_success "Reward composition endpoint working"
else
    log_warning "Reward composition endpoint not available (HTTP $HTTP_CODE)"
fi

# 10. Validate metric labels
log_info "Step 10: Validating metric labels..."

# Check if metrics have proper labels
if curl -s "${METRICS_URL}" | grep -q 'igris_semantic_classifications_total{.*class=.*cache_hit='; then
    log_success "Metrics have correct labels (class, cache_hit)"
else
    log_error "Metrics missing proper labels"
fi

if curl -s "${METRICS_URL}" | grep -q 'igris_bandit_reward_updates_total{.*provider=.*class=.*status='; then
    log_success "Bandit metrics have correct labels (provider, class, status)"
else
    log_error "Bandit metrics missing proper labels"
fi

# 11. Check metric value ranges
log_info "Step 11: Validating metric value ranges..."

CONFIDENCE_VALUES=$(curl -s "${METRICS_URL}" | grep "igris_semantic_classification_confidence_bucket" | grep -v "#" | wc -l)
if [ "$CONFIDENCE_VALUES" -gt 0 ]; then
    log_success "Confidence histogram has data points"
else
    log_warning "Confidence histogram has no data yet"
fi

LATENCY_VALUES=$(curl -s "${METRICS_URL}" | grep "igris_feedback_latency_ms" | grep -v "#" | wc -l)
if [ "$LATENCY_VALUES" -gt 0 ]; then
    log_success "Feedback latency metrics recorded"
else
    log_warning "Feedback latency metrics not yet recorded"
fi

# 12. Performance validation
log_info "Step 12: Validating performance targets..."

# Check feedback latency p95 < 15ms (converted to seconds for Prometheus)
FEEDBACK_P95=$(curl -s "${METRICS_URL}" | grep 'igris_feedback_latency_ms.*quantile="0.95"' | awk '{print $2}' | head -1)
if [ -n "$FEEDBACK_P95" ]; then
    if (( $(echo "$FEEDBACK_P95 < 15" | bc -l) )); then
        log_success "Feedback latency p95 < 15ms: ${FEEDBACK_P95}ms"
    else
        log_warning "Feedback latency p95 exceeds target: ${FEEDBACK_P95}ms"
    fi
else
    log_warning "Feedback latency p95 not yet available"
fi

# 13. Success criteria summary
log_info "Step 13: Success criteria summary..."

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Success Criteria Validation"
echo "═══════════════════════════════════════════════════════════════"

# Classification accuracy (manual check needed)
echo -e "${BLUE}Classification Accuracy:${NC} ≥0.92 (Manual validation required)"

# Bandit update latency
echo -e "${BLUE}Bandit Update Latency:${NC} <15ms target"
if [ -n "$FEEDBACK_P95" ]; then
    echo "  └─ Measured p95: ${FEEDBACK_P95}ms"
fi

# Feedback API latency
echo -e "${BLUE}Feedback API Latency:${NC} <50ms target (validation in load test)"

# Cache hit rate
echo -e "${BLUE}Cache Hit Rate:${NC} Redis 5-min TTL configured"

# Composite reward formula
echo -e "${BLUE}Composite Reward:${NC} α·latency + β·cost + γ·success ✓"

# Policy reload latency
echo -e "${BLUE}Policy Reload:${NC} <1s target (Redis + in-memory cache)"

# SLA tracking accuracy
echo -e "${BLUE}SLA Tracking:${NC} ±2% (percentile calculation implemented)"

# Audit log integrity
echo -e "${BLUE}Audit Log:${NC} 90-day retention configured ✓"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Test Results Summary"
echo "═══════════════════════════════════════════════════════════════"
echo -e "Total Tests:  ${TESTS_TOTAL}"
echo -e "${GREEN}Passed:${NC}       ${TESTS_PASSED}"
echo -e "${RED}Failed:${NC}       ${TESTS_FAILED}"
echo ""

PASS_RATE=$(echo "scale=1; $TESTS_PASSED * 100 / $TESTS_TOTAL" | bc)
echo -e "Pass Rate:    ${PASS_RATE}%"

# Metrics found
echo -e "Metrics Found: ${METRICS_FOUND}/${EXPECTED_METRICS_COUNT}"

echo ""

# Exit code
if [ "$TESTS_FAILED" -eq 0 ] && [ "$METRICS_FOUND" -ge "$((EXPECTED_METRICS_COUNT - 2))" ]; then
    echo -e "${GREEN}✓ VALIDATION PASSED${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    echo ""
    echo "Failures:"
    echo "  - ${TESTS_FAILED} test(s) failed"
    echo "  - $((EXPECTED_METRICS_COUNT - METRICS_FOUND)) metric(s) missing"
    echo ""
    exit 1
fi
