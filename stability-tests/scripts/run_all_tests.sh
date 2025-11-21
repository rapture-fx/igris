#!/bin/bash
#
# Master Test Runner - Executes all stability tests in sequence
# Generates comprehensive report with pass/fail results
#

set -euo pipefail

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
REPORT_DIR="stability-tests/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/stability_report_${TIMESTAMP}.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results tracking
declare -a TEST_RESULTS
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if API is running
    if ! curl -sf "${API_URL}/healthz" > /dev/null 2>&1; then
        log_error "API is not running at ${API_URL}"
        log_error "Please start the API first: go run cmd/schlep-engine-api/main.go"
        exit 1
    fi

    log_info "✅ API is running at ${API_URL}"

    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "python3 not found"
        exit 1
    fi

    log_info "✅ Python 3 available"

    # Check required Python packages
    for pkg in aiohttp psutil requests; do
        if ! python3 -c "import ${pkg}" 2>/dev/null; then
            log_warn "Python package '${pkg}' not found. Install with: pip install ${pkg}"
        fi
    done

    # Create report directory
    mkdir -p "${REPORT_DIR}"
}

# Run a single test and record result
run_test() {
    local test_name=$1
    local test_command=$2
    local test_description=$3

    log_test "Running: ${test_name}"
    echo ""
    echo "========================================================================"
    echo "  ${test_description}"
    echo "========================================================================"
    echo ""

    local start_time=$(date +%s)

    # Run test and capture exit code
    set +e
    eval "${test_command}"
    local exit_code=$?
    set -e

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Record result
    if [ $exit_code -eq 0 ]; then
        log_info "✅ ${test_name} PASSED (${duration}s)"
        TEST_RESULTS+=("PASS|${test_name}|${duration}s")
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "❌ ${test_name} FAILED (${duration}s)"
        TEST_RESULTS+=("FAIL|${test_name}|${duration}s")
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    echo ""
    echo "========================================================================"
    echo ""
    sleep 3  # Brief pause between tests
}

# Generate final report
generate_report() {
    log_info "Generating comprehensive test report..."

    cat > "${REPORT_FILE}" <<EOF
================================================================================
                    SCHLEP-ENGINE STABILITY TEST REPORT
================================================================================

Report Generated: $(date)
API URL: ${API_URL}
Test Duration: $(($(date +%s) - START_TIME))s

================================================================================
                              EXECUTIVE SUMMARY
================================================================================

Total Tests: $((TESTS_PASSED + TESTS_FAILED))
Tests Passed: ${TESTS_PASSED} (✅)
Tests Failed: ${TESTS_FAILED} (❌)
Success Rate: $(awk "BEGIN {printf \"%.1f\", (${TESTS_PASSED}/(${TESTS_PASSED}+${TESTS_FAILED})*100)}")%

EOF

    if [ $TESTS_FAILED -eq 0 ]; then
        cat >> "${REPORT_FILE}" <<EOF
Overall Status: ✅ ALL TESTS PASSED
Recommendation: System is stable and ready for production deployment

EOF
    else
        cat >> "${REPORT_FILE}" <<EOF
Overall Status: ❌ SOME TESTS FAILED
Recommendation: Review failures before production deployment
                DO NOT DEPLOY until all critical tests pass

EOF
    fi

    cat >> "${REPORT_FILE}" <<EOF
================================================================================
                            DETAILED TEST RESULTS
================================================================================

EOF

    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r status name duration <<< "$result"
        if [ "$status" = "PASS" ]; then
            echo "✅ ${name}: PASSED (${duration})" >> "${REPORT_FILE}"
        else
            echo "❌ ${name}: FAILED (${duration})" >> "${REPORT_FILE}"
        fi
    done

    cat >> "${REPORT_FILE}" <<EOF

================================================================================
                            RECOMMENDATIONS
================================================================================

EOF

    if [ $TESTS_FAILED -eq 0 ]; then
        cat >> "${REPORT_FILE}" <<EOF
1. ✅ All stability tests passed - system is production-ready
2. Schedule regular stability test runs (weekly recommended)
3. Set up continuous monitoring with Prometheus + Grafana
4. Configure alerting for critical metrics (5xx rate, latency, etc.)
5. Document baseline performance metrics for future comparison

EOF
    else
        cat >> "${REPORT_FILE}" <<EOF
1. ❌ CRITICAL: Review and fix all failing tests before deployment
2. Investigate root cause of failures (check logs, metrics, traces)
3. Re-run tests after fixes are applied
4. Consider rolling back recent changes if tests were passing before
5. Ensure all dependencies (database, Redis, providers) are healthy

Next Steps:
- Review API logs: kubectl logs deployment/schlep-engine-api --tail=500
- Check provider health: curl ${API_URL}/v1/providers/stats
- Review metrics: curl ${API_URL}/metrics
- Check database connectivity and query performance
- Verify FFI boundary stability if optimizer is enabled

EOF
    fi

    cat >> "${REPORT_FILE}" <<EOF
================================================================================
                            APPENDIX: TEST COMMANDS
================================================================================

All tests can be re-run individually using:

1. Load Test:
   python3 stability-tests/scripts/load_test_basic_requests.py --url ${API_URL}

2. Response Format Validation:
   python3 stability-tests/scripts/response_format_validation.py --url ${API_URL}

3. FFI Boundary Stress Test:
   python3 stability-tests/scripts/test_ffi_boundary.py --url ${API_URL}

4. Streaming Reliability:
   python3 stability-tests/scripts/test_streaming_concurrency.py --url ${API_URL}

5. SLO Enforcer Validation:
   python3 stability-tests/scripts/test_slo_enforcer.py --url ${API_URL}

6. Provider Failover:
   python3 stability-tests/scripts/simulate_provider_outage.py --url ${API_URL}

7. Circuit Breaker:
   python3 stability-tests/scripts/test_circuit_breaker.py --url ${API_URL}

8. Concurrent Load:
   python3 stability-tests/scripts/concurrent_load_test.py --url ${API_URL}

9. Malformed Requests:
   python3 stability-tests/scripts/test_malformed_requests.py --url ${API_URL}

================================================================================
                                END OF REPORT
================================================================================
EOF

    log_info "Report saved to: ${REPORT_FILE}"
    echo ""
    cat "${REPORT_FILE}"
}

# Main execution
main() {
    START_TIME=$(date +%s)

    echo ""
    echo "========================================================================"
    echo "         SCHLEP-ENGINE COMPREHENSIVE STABILITY TEST SUITE"
    echo "========================================================================"
    echo ""
    echo "Started: $(date)"
    echo "API URL: ${API_URL}"
    echo ""
    echo "This will run all stability tests in sequence and generate a report."
    echo "Estimated duration: 15-30 minutes depending on test parameters"
    echo ""
    echo "========================================================================"
    echo ""

    check_prerequisites

    # Test 1: Load Test (Basic Reliability)
    run_test \
        "Load Test" \
        "python3 stability-tests/scripts/load_test_basic_requests.py --url ${API_URL} --requests 1000 --concurrency 50" \
        "Phase 1: Basic API Reliability - Zero 5xx under load"

    # Test 2: Response Format Validation
    run_test \
        "Response Format Validation" \
        "python3 stability-tests/scripts/response_format_validation.py --url ${API_URL} --iterations 100" \
        "Phase 2: Response Format Consistency"

    # Test 3: FFI Boundary Stress Test
    run_test \
        "FFI Boundary Stress Test" \
        "python3 stability-tests/scripts/test_ffi_boundary.py --url ${API_URL} --concurrency 50 --duration 120" \
        "Phase 3: Go ↔ Rust FFI Stability (2 min stress test)"

    # Test 4: Streaming Reliability
    run_test \
        "Streaming Reliability" \
        "python3 stability-tests/scripts/test_streaming_concurrency.py --url ${API_URL} --concurrent 20 --iterations 50" \
        "Phase 4: SSE Streaming Stability"

    # Test 5: SLO Enforcer
    run_test \
        "SLO Enforcer Validation" \
        "python3 stability-tests/scripts/test_slo_enforcer.py --url ${API_URL}" \
        "Phase 5: SLO Enforcer Remediation"

    # Test 6: Provider Failover
    run_test \
        "Provider Failover Simulation" \
        "python3 stability-tests/scripts/simulate_provider_outage.py --url ${API_URL} --duration 60" \
        "Phase 6: Provider Failover and Graceful Degradation"

    # Test 7: Circuit Breaker
    run_test \
        "Circuit Breaker Testing" \
        "python3 stability-tests/scripts/test_circuit_breaker.py --url ${API_URL}" \
        "Phase 7: Circuit Breaker Activation and Recovery"

    # Test 8: Concurrent Load
    run_test \
        "Concurrent Load Test" \
        "python3 stability-tests/scripts/concurrent_load_test.py --url ${API_URL} --concurrency 100 --duration 180" \
        "Phase 8: Performance Under Concurrent Load (3 min)"

    # Test 9: Malformed Requests
    run_test \
        "Malformed Request Handling" \
        "python3 stability-tests/scripts/test_malformed_requests.py --url ${API_URL} --iterations 500" \
        "Phase 9: Edge Case and Security Testing"

    # Generate final report
    echo ""
    echo "========================================================================"
    echo "                    ALL TESTS COMPLETED"
    echo "========================================================================"
    echo ""

    generate_report

    # Exit with appropriate code
    if [ $TESTS_FAILED -eq 0 ]; then
        log_info "✅ ALL TESTS PASSED - System is production-ready!"
        exit 0
    else
        log_error "❌ ${TESTS_FAILED} TEST(S) FAILED - Review report and fix issues"
        exit 1
    fi
}

# Run main
main "$@"
