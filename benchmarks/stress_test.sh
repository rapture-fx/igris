#!/bin/bash
set -e

# Schlep-Engine Stress Testing Suite
# Tests: 1M requests, 24h endurance, burst load

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_HOST="${API_HOST:-http://localhost:8080}"
CONCURRENT_USERS="${CONCURRENT_USERS:-100}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Schlep-Engine Stress Testing Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "API Host: $API_HOST"
echo "Results: $RESULTS_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Check dependencies
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"

    if ! command -v hey &> /dev/null; then
        echo -e "${RED}Error: 'hey' not found. Install with: go install github.com/rakyll/hey@latest${NC}"
        exit 1
    fi

    if ! command -v vegeta &> /dev/null; then
        echo -e "${YELLOW}Warning: 'vegeta' not found. Some tests will be skipped.${NC}"
        echo -e "${YELLOW}Install with: go install github.com/tsenart/vegeta@latest${NC}"
    fi

    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: 'jq' not found. Install with: brew install jq${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Dependencies check complete${NC}"
    echo ""
}

# Health check
health_check() {
    echo -e "${YELLOW}Running health check...${NC}"

    if ! curl -sf "$API_HOST/health" > /dev/null; then
        echo -e "${RED}Error: API is not healthy at $API_HOST/health${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ API is healthy${NC}"
    echo ""
}

# Test 1: Baseline Performance (10k requests)
baseline_test() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test 1: Baseline Performance${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo "Requests: 10,000"
    echo "Concurrency: 50"
    echo ""

    hey -n 10000 -c 50 \
        -m GET \
        -H "Content-Type: application/json" \
        "$API_HOST/api/v1/health" \
        > "$RESULTS_DIR/baseline_${TIMESTAMP}.txt"

    echo -e "${GREEN}✓ Baseline test complete${NC}"
    echo "Results: $RESULTS_DIR/baseline_${TIMESTAMP}.txt"
    echo ""
}

# Test 2: 1 Million Requests
million_requests_test() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test 2: 1 Million Requests${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo "Requests: 1,000,000"
    echo "Concurrency: 100"
    echo "Estimated time: ~15-30 minutes"
    echo ""

    START_TIME=$(date +%s)

    hey -n 1000000 -c 100 \
        -m GET \
        -H "Content-Type: application/json" \
        "$API_HOST/api/v1/health" \
        > "$RESULTS_DIR/1m_requests_${TIMESTAMP}.txt"

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    echo -e "${GREEN}✓ 1M requests test complete in ${DURATION}s${NC}"
    echo "Results: $RESULTS_DIR/1m_requests_${TIMESTAMP}.txt"
    echo ""
}

# Test 3: Burst Load (spike to 10k RPS)
burst_load_test() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test 3: Burst Load${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo "Target: 10,000 RPS spike"
    echo "Duration: 60 seconds"
    echo ""

    if ! command -v vegeta &> /dev/null; then
        echo -e "${YELLOW}Skipping burst test - vegeta not installed${NC}"
        return
    fi

    echo "GET $API_HOST/api/v1/health" | \
        vegeta attack -rate=10000 -duration=60s | \
        vegeta report -type=text > "$RESULTS_DIR/burst_${TIMESTAMP}.txt"

    echo -e "${GREEN}✓ Burst load test complete${NC}"
    echo "Results: $RESULTS_DIR/burst_${TIMESTAMP}.txt"
    echo ""
}

# Test 4: ML Prediction Load
ml_prediction_test() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test 4: ML Prediction Load${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo "Requests: 100,000"
    echo "Concurrency: 50"
    echo "Target: P99 < 20ms"
    echo ""

    hey -n 100000 -c 50 \
        -m POST \
        -H "Content-Type: application/json" \
        -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}' \
        "$API_HOST/api/v1/ml/predict" \
        > "$RESULTS_DIR/ml_prediction_${TIMESTAMP}.txt"

    echo -e "${GREEN}✓ ML prediction test complete${NC}"
    echo "Results: $RESULTS_DIR/ml_prediction_${TIMESTAMP}.txt"
    echo ""
}

# Test 5: Hybrid Architecture Test (Go → Rust → Python)
hybrid_test() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test 5: Hybrid Architecture${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo "Requests: 50,000"
    echo "Concurrency: 25"
    echo "Path: Go → Rust FFI → Python gRPC"
    echo ""

    hey -n 50000 -c 25 \
        -m GET \
        -H "Content-Type: application/json" \
        "$API_HOST/api/v1/test/hybrid" \
        > "$RESULTS_DIR/hybrid_${TIMESTAMP}.txt"

    echo -e "${GREEN}✓ Hybrid architecture test complete${NC}"
    echo "Results: $RESULTS_DIR/hybrid_${TIMESTAMP}.txt"
    echo ""
}

# Test 6: 24-Hour Endurance Test
endurance_test() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test 6: 24-Hour Endurance${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo "Duration: 24 hours"
    echo "Rate: 100 RPS (8.64M total requests)"
    echo "This will take 24 hours. Continue? (y/N)"
    read -r CONFIRM

    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Skipping endurance test${NC}"
        echo ""
        return
    fi

    if ! command -v vegeta &> /dev/null; then
        echo -e "${YELLOW}Skipping endurance test - vegeta not installed${NC}"
        return
    fi

    echo ""
    echo "Starting 24-hour endurance test..."
    echo "Start time: $(date)"

    echo "GET $API_HOST/api/v1/health" | \
        vegeta attack -rate=100 -duration=24h | \
        vegeta report -type=text > "$RESULTS_DIR/endurance_24h_${TIMESTAMP}.txt"

    echo "End time: $(date)"
    echo -e "${GREEN}✓ 24-hour endurance test complete${NC}"
    echo "Results: $RESULTS_DIR/endurance_24h_${TIMESTAMP}.txt"
    echo ""
}

# Test 7: Failure Injection - Circuit Breaker
circuit_breaker_test() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test 7: Circuit Breaker${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo "Testing circuit breaker behavior"
    echo ""

    echo "Step 1: Stop ML service"
    docker stop schlep-python-ml-1 2>/dev/null || true
    sleep 2

    echo "Step 2: Send 20 requests (should trigger circuit breaker)"
    hey -n 20 -c 5 \
        -m POST \
        -H "Content-Type: application/json" \
        -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}' \
        "$API_HOST/api/v1/ml/predict" \
        > "$RESULTS_DIR/circuit_breaker_open_${TIMESTAMP}.txt"

    echo "Step 3: Restart ML service"
    docker start schlep-python-ml-1
    sleep 10

    echo "Step 4: Wait for circuit breaker to close (30s)"
    sleep 30

    echo "Step 5: Verify recovery"
    hey -n 10 -c 2 \
        -m POST \
        -H "Content-Type: application/json" \
        -d '{"model_id":"iris-classifier","features":[5.1,3.5,1.4,0.2]}' \
        "$API_HOST/api/v1/ml/predict" \
        > "$RESULTS_DIR/circuit_breaker_closed_${TIMESTAMP}.txt"

    echo -e "${GREEN}✓ Circuit breaker test complete${NC}"
    echo "Results: $RESULTS_DIR/circuit_breaker_*_${TIMESTAMP}.txt"
    echo ""
}

# Generate summary report
generate_report() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Generating Summary Report${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    REPORT_FILE="$RESULTS_DIR/STRESS_TEST_REPORT_${TIMESTAMP}.md"

    cat > "$REPORT_FILE" <<EOF
# Stress Test Report - Schlep-Engine Hybrid Architecture

**Generated:** $(date)
**API Host:** $API_HOST

---

## Test Results Summary

EOF

    # Parse baseline results
    if [ -f "$RESULTS_DIR/baseline_${TIMESTAMP}.txt" ]; then
        echo "### Test 1: Baseline Performance" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        grep -A 20 "Summary:" "$RESULTS_DIR/baseline_${TIMESTAMP}.txt" >> "$REPORT_FILE" || true
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi

    # Parse 1M requests results
    if [ -f "$RESULTS_DIR/1m_requests_${TIMESTAMP}.txt" ]; then
        echo "### Test 2: 1 Million Requests" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        grep -A 20 "Summary:" "$RESULTS_DIR/1m_requests_${TIMESTAMP}.txt" >> "$REPORT_FILE" || true
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi

    # Parse ML prediction results
    if [ -f "$RESULTS_DIR/ml_prediction_${TIMESTAMP}.txt" ]; then
        echo "### Test 4: ML Prediction Load" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        grep -A 20 "Summary:" "$RESULTS_DIR/ml_prediction_${TIMESTAMP}.txt" >> "$REPORT_FILE" || true
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi

    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**All test results available in:** \`$RESULTS_DIR\`" >> "$REPORT_FILE"

    echo -e "${GREEN}✓ Report generated${NC}"
    echo "Report: $REPORT_FILE"
    echo ""
}

# Main execution
main() {
    check_dependencies
    health_check

    echo -e "${YELLOW}Select tests to run:${NC}"
    echo "1) All tests (except 24h endurance)"
    echo "2) Quick tests (baseline + ML prediction)"
    echo "3) Full suite (including 24h endurance)"
    echo "4) Custom selection"
    echo ""
    read -p "Enter choice (1-4): " CHOICE

    case $CHOICE in
        1)
            baseline_test
            million_requests_test
            burst_load_test
            ml_prediction_test
            hybrid_test
            circuit_breaker_test
            ;;
        2)
            baseline_test
            ml_prediction_test
            ;;
        3)
            baseline_test
            million_requests_test
            burst_load_test
            ml_prediction_test
            hybrid_test
            circuit_breaker_test
            endurance_test
            ;;
        4)
            echo "Available tests:"
            echo "  b) Baseline"
            echo "  m) 1M requests"
            echo "  s) Burst load"
            echo "  p) ML prediction"
            echo "  h) Hybrid architecture"
            echo "  c) Circuit breaker"
            echo "  e) 24h endurance"
            read -p "Enter tests to run (e.g., bmp): " TESTS

            [[ "$TESTS" == *"b"* ]] && baseline_test
            [[ "$TESTS" == *"m"* ]] && million_requests_test
            [[ "$TESTS" == *"s"* ]] && burst_load_test
            [[ "$TESTS" == *"p"* ]] && ml_prediction_test
            [[ "$TESTS" == *"h"* ]] && hybrid_test
            [[ "$TESTS" == *"c"* ]] && circuit_breaker_test
            [[ "$TESTS" == *"e"* ]] && endurance_test
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac

    generate_report

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Stress testing complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "View results:"
    echo "  cat $RESULTS_DIR/STRESS_TEST_REPORT_${TIMESTAMP}.md"
    echo ""
}

# Run main
main
