#!/bin/bash
#
# Setup and Test Script
# Starts API in benchmark mode and runs stability tests
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
API_PORT=8081
API_URL="http://localhost:${API_PORT}"
PROJECT_ROOT="/Users/wira/Desktop/schlep-engine"

echo ""
echo "========================================================================"
echo "     SCHLEP-ENGINE STABILITY TESTING - SETUP AND EXECUTION"
echo "========================================================================"
echo ""

# Check if API is already running
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_warn "API appears to be running on port 8080"
    API_PORT=8080
    API_URL="http://localhost:8080"
    log_info "Using existing API at ${API_URL}"
elif lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_warn "API appears to be running on port 8081"
    API_URL="http://localhost:8081"
    log_info "Using existing API at ${API_URL}"
else
    log_info "No API detected. You'll need to start it manually."
    echo ""
    echo "To start the API in benchmark mode (no costs):"
    echo ""
    echo "  cd ${PROJECT_ROOT}"
    echo "  export PROVIDER_MODE=benchmark"
    echo "  export ENABLE_COGNITIVE_ADVISOR=true"
    echo "  export OPTIMIZER_MODE=shadow"
    echo "  export PORT=${API_PORT}"
    echo "  go run cmd/schlep-engine-api/main.go &"
    echo ""
    echo "Wait ~10 seconds, then run this script again:"
    echo "  ./stability-tests/scripts/setup_and_test.sh"
    echo ""
    exit 1
fi

# Verify API health
log_info "Checking API health at ${API_URL}/healthz..."
if curl -sf "${API_URL}/healthz" > /dev/null 2>&1; then
    log_info "✅ API is healthy and ready for testing"
else
    log_error "❌ API health check failed"
    log_error "Please ensure the API is running and healthy"
    exit 1
fi

# Check API endpoints
log_info "Verifying API endpoints..."
endpoints_ok=true

if curl -sf "${API_URL}/v1/models" > /dev/null 2>&1; then
    log_info "✅ /v1/models endpoint responding"
else
    log_warn "⚠️  /v1/models endpoint not responding"
    endpoints_ok=false
fi

if curl -sf "${API_URL}/v1/providers/stats" > /dev/null 2>&1; then
    log_info "✅ /v1/providers/stats endpoint responding"
else
    log_warn "⚠️  /v1/providers/stats endpoint not responding (may not be enabled)"
fi

echo ""
log_info "API ready for testing!"
echo ""

# Display current configuration
log_info "Current Test Configuration:"
echo "  API URL: ${API_URL}"
echo "  Project Root: ${PROJECT_ROOT}"
echo ""

# Ask user what to run
echo "========================================================================"
echo "                    TEST EXECUTION OPTIONS"
echo "========================================================================"
echo ""
echo "1. Quick Smoke Test (2 minutes) - Fast validation"
echo "2. Core Stability Tests (10 minutes) - Essential tests only"
echo "3. Full Test Suite (25 minutes) - All 9 tests"
echo "4. Individual Test Menu - Choose specific tests"
echo "5. Exit"
echo ""
read -p "Select option [1-5]: " choice

case $choice in
    1)
        log_info "Running Quick Smoke Test..."
        cd "${PROJECT_ROOT}/stability-tests/scripts"
        python3 load_test_basic_requests.py --url ${API_URL} --requests 100 --concurrency 10
        ;;
    2)
        log_info "Running Core Stability Tests..."
        cd "${PROJECT_ROOT}/stability-tests/scripts"

        echo ""
        log_info "Test 1/4: Load Test"
        python3 load_test_basic_requests.py --url ${API_URL} --requests 500 --concurrency 25

        echo ""
        log_info "Test 2/4: Response Format Validation"
        python3 response_format_validation.py --url ${API_URL} --iterations 50

        echo ""
        log_info "Test 3/4: FFI Boundary Stress Test"
        python3 test_ffi_boundary.py --url ${API_URL} --duration 120 --concurrency 20

        echo ""
        log_info "Test 4/4: Streaming Reliability"
        python3 test_streaming_concurrency.py --url ${API_URL} --concurrent 10 --iterations 30

        log_info "✅ Core tests complete!"
        ;;
    3)
        log_info "Running Full Test Suite..."
        cd "${PROJECT_ROOT}/stability-tests/scripts"
        API_URL=${API_URL} ./run_all_tests.sh
        ;;
    4)
        echo ""
        echo "========================================================================"
        echo "                    INDIVIDUAL TEST MENU"
        echo "========================================================================"
        echo ""
        echo "1. Load Test - Basic reliability"
        echo "2. Response Format Validation"
        echo "3. FFI Boundary Stress Test ⭐"
        echo "4. Streaming Reliability ⭐"
        echo "5. SLO Enforcer Validation ⭐"
        echo "6. Provider Failover Simulation"
        echo "7. Circuit Breaker Testing"
        echo "8. Concurrent Load Test"
        echo "9. Malformed Request Handling"
        echo "10. Back to main menu"
        echo ""
        read -p "Select test [1-10]: " test_choice

        cd "${PROJECT_ROOT}/stability-tests/scripts"
        case $test_choice in
            1) python3 load_test_basic_requests.py --url ${API_URL} ;;
            2) python3 response_format_validation.py --url ${API_URL} ;;
            3) python3 test_ffi_boundary.py --url ${API_URL} ;;
            4) python3 test_streaming_concurrency.py --url ${API_URL} ;;
            5) python3 test_slo_enforcer.py --url ${API_URL} ;;
            6) python3 simulate_provider_outage.py --url ${API_URL} ;;
            7) python3 test_circuit_breaker.py --url ${API_URL} ;;
            8) python3 concurrent_load_test.py --url ${API_URL} ;;
            9) python3 test_malformed_requests.py --url ${API_URL} ;;
            10) log_info "Exiting..." ;;
            *) log_error "Invalid choice" ;;
        esac
        ;;
    5)
        log_info "Exiting..."
        exit 0
        ;;
    *)
        log_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "========================================================================"
echo "                    TESTING COMPLETE"
echo "========================================================================"
echo ""
log_info "Next steps:"
echo "  1. Review test results above"
echo "  2. Check reports in: stability-tests/reports/"
echo "  3. View documentation: stability-tests/README.md"
echo "  4. Review incident response: stability-tests/INCIDENT_RESPONSE_PLAYBOOK.md"
echo ""
