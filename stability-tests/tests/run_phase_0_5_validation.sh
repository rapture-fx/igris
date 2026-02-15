#!/bin/bash
#
# Igris Inertial Phase 0.5 Validation Suite Runner
# Orchestrates all validation tests and generates comprehensive summary
#
# Usage: ./run_phase_0_5_validation.sh [BASE_URL] [REDIS_URL]
# Example: ./run_phase_0_5_validation.sh http://localhost:8080 redis://localhost:6379/0
#

set -e

BASE_URL="${1:-http://localhost:8080}"
REDIS_URL="${2:-redis://localhost:6379/0}"

RESULTS_DIR="tests/results"
SECURITY_DIR="tests/security"
SUMMARY_FILE="$RESULTS_DIR/phase_0_5_validation_summary.json"

mkdir -p "$RESULTS_DIR" "$SECURITY_DIR"

echo "========================================="
echo "Igris Inertial Phase 0.5 Validation Suite"
echo "========================================="
echo "Base URL: $BASE_URL"
echo "Redis URL: $REDIS_URL"
echo "Results Directory: $RESULTS_DIR"
echo "========================================="
echo
echo "Objective: Verify Igris Inertial backend foundation is"
echo "operationally safe, observably correct, and performant"
echo "under realistic load before enabling Phase 1."
echo
echo "Estimated runtime: 15-30 minutes"
echo "========================================="
echo

START_TIME=$(date +%s)

# Module tracking
declare -A MODULE_STATUS
declare -A MODULE_RESULTS

# Helper function to run a test module
run_module() {
    local module_id="$1"
    local module_name="$2"
    local command="$3"

    echo
    echo "========================================="
    echo "Running: $module_name"
    echo "Module ID: $module_id"
    echo "========================================="
    echo

    if eval "$command"; then
        MODULE_STATUS["$module_id"]="PASS"
        echo "✓ $module_name: PASS"
    else
        MODULE_STATUS["$module_id"]="FAIL"
        echo "✗ $module_name: FAIL"
    fi
}

# Module 1: Redis Lock Performance Test
run_module \
    "redis_lock_test" \
    "Redis Distributed Lock Performance Test" \
    "cd /Users/wira/Desktop/igris-inertial && REDIS_URL='$REDIS_URL' go test -v -run TestRedisDistributedLockPerformance ./tests/"

# Module 2: JWT & BYOK Security Audit
run_module \
    "jwt_byok_security_audit" \
    "JWT and BYOK Security Audit" \
    "cd /Users/wira/Desktop/igris-inertial && go test -v -run TestJWTAndBYOKSecurityAudit ./tests/"

# Module 3: Telemetry Completeness Check
run_module \
    "telemetry_completeness_check" \
    "Telemetry Completeness Check" \
    "bash tests/telemetry_completeness_check.sh $BASE_URL/metrics"

# Module 4: Load Resilience Test
run_module \
    "load_resilience_test" \
    "Load Resilience Test (500 RPS for 60s)" \
    "bash tests/load_test_routing.sh $BASE_URL 500 60"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo
echo "========================================="
echo "All validation modules completed"
echo "Total duration: ${DURATION}s"
echo "========================================="
echo

# Collect results from individual modules
echo "Collecting results from individual modules..."

# Initialize results array
REDIS_RESULT="{}"
JWT_RESULT="{}"
TELEMETRY_RESULT="{}"
LOAD_RESULT="{}"

# Read Redis lock test results
if [ -f "$RESULTS_DIR/redis_lock_perf.json" ]; then
    REDIS_RESULT=$(cat "$RESULTS_DIR/redis_lock_perf.json")
    echo "  ✓ Redis lock test results loaded"
else
    echo "  ⚠ Redis lock test results not found"
fi

# Read JWT security audit results
if [ -f "$SECURITY_DIR/jwt_rotation_test.log" ]; then
    JWT_RESULT=$(cat "$SECURITY_DIR/jwt_rotation_test.log")
    echo "  ✓ JWT security audit results loaded"
else
    echo "  ⚠ JWT security audit results not found"
fi

# Read telemetry completeness results
if [ -f "$RESULTS_DIR/metrics_coverage_report.json" ]; then
    TELEMETRY_RESULT=$(cat "$RESULTS_DIR/metrics_coverage_report.json")
    echo "  ✓ Telemetry completeness results loaded"
else
    echo "  ⚠ Telemetry completeness results not found"
fi

# Parse load test results (from log file)
if [ -f "/tmp/igris_load_test_results.txt" ]; then
    P95_LATENCY=$(grep "95% in" /tmp/igris_load_test_results.txt | awk '{print $3}' || echo "N/A")
    SUCCESS_RATE=$(grep "Status code distribution" /tmp/igris_load_test_results.txt -A 5 | grep "200" | awk '{print $3}' || echo "N/A")

    LOAD_RESULT=$(cat <<EOF
{
  "module_id": "load_resilience_test",
  "p95_latency": "$P95_LATENCY",
  "success_rate": "$SUCCESS_RATE",
  "pass_fail": "${MODULE_STATUS[load_resilience_test]}"
}
EOF
)
    echo "  ✓ Load test results parsed"
else
    echo "  ⚠ Load test results not found"
fi

# Determine overall status
OVERALL_STATUS="PASS"
FAILED_MODULES=()
WARN_MODULES=()

for module in "${!MODULE_STATUS[@]}"; do
    if [ "${MODULE_STATUS[$module]}" == "FAIL" ]; then
        OVERALL_STATUS="FAIL"
        FAILED_MODULES+=("$module")
    elif [ "${MODULE_STATUS[$module]}" == "WARN" ]; then
        if [ "$OVERALL_STATUS" != "FAIL" ]; then
            OVERALL_STATUS="WARN"
        fi
        WARN_MODULES+=("$module")
    fi
done

# Determine Phase 1 recommendation
PHASE1_RECOMMENDATION="PROCEED"
PHASE1_MESSAGE="All validation tests passed. Ready for Phase 1."

if [ "$OVERALL_STATUS" == "FAIL" ]; then
    PHASE1_RECOMMENDATION="HALT"
    PHASE1_MESSAGE="Critical validation failures detected. Do NOT proceed to Phase 1 until issues are resolved."
elif [ "$OVERALL_STATUS" == "WARN" ]; then
    PHASE1_RECOMMENDATION="PROCEED_WITH_CAUTION"
    PHASE1_MESSAGE="Minor deviations detected. May proceed to Phase 1 but monitor closely."
fi

# Generate comprehensive summary JSON
echo
echo "Generating Phase 0.5 validation summary..."

cat > "$SUMMARY_FILE" <<EOF
{
  "validation_suite": "Igris Inertial Phase 0.5 Validation",
  "version": "0.5",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "duration_seconds": $DURATION,
  "overall_status": "$OVERALL_STATUS",
  "phase1_recommendation": "$PHASE1_RECOMMENDATION",
  "phase1_message": "$PHASE1_MESSAGE",
  "environment": {
    "base_url": "$BASE_URL",
    "redis_url": "$REDIS_URL"
  },
  "modules": {
    "redis_lock_test": $REDIS_RESULT,
    "jwt_byok_security_audit": $JWT_RESULT,
    "telemetry_completeness_check": $TELEMETRY_RESULT,
    "load_resilience_test": $LOAD_RESULT
  },
  "summary": {
    "total_modules": ${#MODULE_STATUS[@]},
    "passed_modules": $(echo "${MODULE_STATUS[@]}" | tr ' ' '\n' | grep -c "PASS" || echo "0"),
    "failed_modules": $(echo "${MODULE_STATUS[@]}" | tr ' ' '\n' | grep -c "FAIL" || echo "0"),
    "warn_modules": $(echo "${MODULE_STATUS[@]}" | tr ' ' '\n' | grep -c "WARN" || echo "0")
  },
  "next_steps": $([ "$PHASE1_RECOMMENDATION" == "PROCEED" ] && echo '["Proceed to Phase 1: Implement cost_map.yaml", "Implement forecast header logic", "Build ProviderAdapter interfaces"]' || echo '["Review and fix failed validation modules", "Re-run Phase 0.5 validation", "Do not proceed to Phase 1 until all tests pass"]')
}
EOF

# Pretty print summary
echo
echo "========================================="
echo "PHASE 0.5 VALIDATION SUMMARY"
echo "========================================="
echo "Overall Status: $OVERALL_STATUS"
echo "Phase 1 Recommendation: $PHASE1_RECOMMENDATION"
echo
echo "Module Results:"
for module in "${!MODULE_STATUS[@]}"; do
    echo "  - $module: ${MODULE_STATUS[$module]}"
done
echo
echo "Summary:"
echo "  Total Modules: ${#MODULE_STATUS[@]}"
echo "  Passed: $(echo "${MODULE_STATUS[@]}" | tr ' ' '\n' | grep -c "PASS" || echo "0")"
echo "  Failed: $(echo "${MODULE_STATUS[@]}" | tr ' ' '\n' | grep -c "FAIL" || echo "0")"
echo "  Warnings: $(echo "${MODULE_STATUS[@]}" | tr ' ' '\n' | grep -c "WARN" || echo "0")"
echo
echo "Duration: ${DURATION}s"
echo
echo "========================================="
echo "$PHASE1_MESSAGE"
echo "========================================="
echo
echo "Detailed results saved to: $SUMMARY_FILE"
echo
echo "Individual module results:"
echo "  - Redis Lock: $RESULTS_DIR/redis_lock_perf.json"
echo "  - JWT Security: $SECURITY_DIR/jwt_rotation_test.log"
echo "  - Telemetry: $RESULTS_DIR/metrics_coverage_report.json"
echo "  - Load Test: /tmp/igris_load_test_results.txt"
echo "========================================="

# Exit with appropriate code
if [ "$OVERALL_STATUS" == "FAIL" ]; then
    echo
    echo "❌ VALIDATION FAILED - Do not proceed to Phase 1"
    echo
    exit 1
elif [ "$OVERALL_STATUS" == "WARN" ]; then
    echo
    echo "⚠️  VALIDATION PASSED WITH WARNINGS - Proceed with caution"
    echo
    exit 0
else
    echo
    echo "✅ VALIDATION PASSED - Ready for Phase 1"
    echo
    exit 0
fi
