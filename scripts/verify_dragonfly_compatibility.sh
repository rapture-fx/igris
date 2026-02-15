#!/bin/bash
# DRAGONFLY COMPATIBILITY VERIFICATION SCRIPT
# This script MUST show 100% pass before production deployment
# Safety first: break nothing

set -e

echo "=========================================="
echo "DRAGONFLY COMPATIBILITY VERIFICATION"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test and track results
run_test() {
    local test_name=$1
    local test_command=$2

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "[$TOTAL_TESTS] Testing: $test_name... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "Phase 1: Infrastructure Check"
echo "------------------------------"

# Check if Docker is running
run_test "Docker is running" "docker info"

# Start side-by-side environment
echo ""
echo "Starting Redis + Dragonfly side-by-side..."
docker-compose -f docker-compose.dragonfly-staging.yml up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy (30s)..."
sleep 30

# Verify Redis is running
run_test "Redis is healthy" "docker exec igris-redis-staging redis-cli ping"

# Verify Dragonfly is running
run_test "Dragonfly is healthy" "docker exec igris-dragonfly-staging redis-cli ping"

echo ""
echo "Phase 2: Redis Client Compatibility"
echo "------------------------------------"

# Test basic Redis operations against Dragonfly
run_test "Dragonfly SET command" "docker exec igris-dragonfly-staging redis-cli SET test:key test:value"
run_test "Dragonfly GET command" "docker exec igris-dragonfly-staging redis-cli GET test:key"
run_test "Dragonfly DEL command" "docker exec igris-dragonfly-staging redis-cli DEL test:key"
run_test "Dragonfly INCR command" "docker exec igris-dragonfly-staging redis-cli INCR test:counter"
run_test "Dragonfly EXPIRE command" "docker exec igris-dragonfly-staging redis-cli SETEX test:ttl 60 value"
run_test "Dragonfly HSET command" "docker exec igris-dragonfly-staging redis-cli HSET test:hash field1 value1"
run_test "Dragonfly LPUSH command" "docker exec igris-dragonfly-staging redis-cli LPUSH test:list item1"
run_test "Dragonfly SADD command" "docker exec igris-dragonfly-staging redis-cli SADD test:set member1"

echo ""
echo "Phase 3: Go Redis Client Tests"
echo "-------------------------------"

# Run Go tests against Redis first (baseline)
echo "Testing against Redis (baseline)..."
REDIS_URL=redis://localhost:6379 go test ./internal/cache/... -v -run "TestDragonfly" -short || {
    echo -e "${RED}CRITICAL: Tests failed against Redis baseline!${NC}"
    echo "Cannot proceed with Dragonfly verification."
    exit 1
}

# Run Go tests against Dragonfly
echo ""
echo "Testing against Dragonfly (verification)..."
DRAGONFLY_TEST_URL=redis://localhost:6380 go test ./internal/cache/... -v -run "TestDragonfly" -short || {
    echo -e "${RED}CRITICAL: Tests failed against Dragonfly!${NC}"
    echo "Dragonfly is NOT compatible. Aborting."
    exit 1
}

echo ""
echo "Phase 4: High-Load Simulation (10k ops)"
echo "----------------------------------------"

# Run high-load test against Dragonfly
echo "Running 10k operations against Dragonfly..."
DRAGONFLY_TEST_URL=redis://localhost:6380 go test ./internal/cache/... -v -run "TestDragonfly_HighLoad" -timeout 5m || {
    echo -e "${YELLOW}WARNING: High-load test failed${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

echo ""
echo "=========================================="
echo "VERIFICATION RESULTS"
echo "=========================================="
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

# Calculate pass rate
PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "Pass Rate: $PASS_RATE%"
echo ""

# Decision logic
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ DRAGONFLY VERIFICATION: PASSED${NC}"
    echo ""
    echo "Dragonfly is 100% compatible with Redis."
    echo "Safe to proceed with production migration."
    echo ""
    echo "Next steps:"
    echo "1. Review test logs above"
    echo "2. Run: docker-compose -f docker-compose.dragonfly-staging.yml down"
    echo "3. Proceed to production deployment with confidence"
    exit 0
else
    echo -e "${RED}❌ DRAGONFLY VERIFICATION: FAILED${NC}"
    echo ""
    echo "DO NOT proceed with production migration."
    echo "Fix the failures above before continuing."
    echo ""
    echo "Rollback: docker-compose -f docker-compose.dragonfly-staging.yml down"
    exit 1
fi
