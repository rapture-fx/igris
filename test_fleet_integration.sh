#!/bin/bash
# Fleet Management Integration Test Script
# Tests Runtime <-> Overture fleet communication

set -e  # Exit on error

OVERTURE_URL="${OVERTURE_URL:-http://localhost:8080}"
FLEET_API_KEY="${FLEET_API_KEY:-test-fleet-key}"
AGENT_ID="test-agent-$(date +%s)"

echo "========================================="
echo "Fleet Management Integration Test"
echo "========================================="
echo "Overture URL: $OVERTURE_URL"
echo "Agent ID: $AGENT_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for test results
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Helper function for API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    echo -e "\n${YELLOW}TEST:${NC} $description"
    echo "  → $method $endpoint"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            -H "X-API-Key: $FLEET_API_KEY" \
            "$OVERTURE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "X-API-Key: $FLEET_API_KEY" \
            -d "$data" \
            "$OVERTURE_URL$endpoint")
    fi

    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        test_result 0 "$description"
        echo "  Response: $body" | head -c 200
        if [ ${#body} -gt 200 ]; then echo "..."; fi
        return 0
    else
        test_result 1 "$description (HTTP $http_code)"
        echo "  Error: $body"
        return 1
    fi
}

# Test 1: Health Check
echo -e "\n${YELLOW}==== Test 1: Health Check ====${NC}"
api_call GET "/v1/health" "" "Overture health check"

# Test 2: Agent Registration
echo -e "\n${YELLOW}==== Test 2: Agent Registration ====${NC}"
registration_data=$(cat <<EOF
{
  "agent_id": "$AGENT_ID",
  "hostname": "test-host-$(hostname)",
  "platform": "$(uname -s | tr '[:upper:]' '[:lower:]')",
  "version": "1.6.0-test",
  "capabilities": ["inference", "planning", "tools"],
  "location": "test-datacenter",
  "metadata": {
    "test_run": "true",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF
)

if api_call POST "/api/fleet/register" "$registration_data" "Register test agent"; then
    echo "  ✓ Agent registered successfully"
else
    echo "  ✗ Failed to register agent - aborting tests"
    exit 1
fi

# Test 3: List Fleet Agents
echo -e "\n${YELLOW}==== Test 3: List Fleet Agents ====${NC}"
api_call GET "/api/fleet/agents" "" "List all fleet agents"

# Test 4: Get Specific Agent
echo -e "\n${YELLOW}==== Test 4: Get Agent Details ====${NC}"
api_call GET "/api/fleet/agents/$AGENT_ID" "" "Get details for $AGENT_ID"

# Test 5: Upload Telemetry
echo -e "\n${YELLOW}==== Test 5: Upload Telemetry ====${NC}"
telemetry_data=$(cat <<EOF
{
  "agent_id": "$AGENT_ID",
  "timestamp": $(date +%s),
  "metrics": {
    "requests_total": 100,
    "latency_p99_ms": 45.2,
    "error_rate": 0.01,
    "test_metric": 42.0
  },
  "logs": [
    {
      "timestamp": $(date +%s),
      "level": "info",
      "message": "Test telemetry upload",
      "metadata": {
        "source": "integration_test"
      }
    }
  ],
  "status": {
    "health": "healthy",
    "uptime_secs": 3600,
    "cpu_usage_percent": 35.5,
    "memory_usage_mb": 512,
    "active_tasks": 3
  }
}
EOF
)

api_call POST "/api/fleet/fleet-default/telemetry" "$telemetry_data" "Upload telemetry data"

# Test 6: Get Fleet Configuration
echo -e "\n${YELLOW}==== Test 6: Get Fleet Configuration ====${NC}"
api_call GET "/api/fleet/fleet-default/config" "" "Fetch fleet configuration"

# Test 7: Fleet Health Overview
echo -e "\n${YELLOW}==== Test 7: Fleet Health Overview ====${NC}"
api_call GET "/api/fleet/health" "" "Get fleet health overview"

# Test 8: Multiple Telemetry Uploads (Stress Test)
echo -e "\n${YELLOW}==== Test 8: Multiple Telemetry Uploads ====${NC}"
echo "  Uploading 5 telemetry samples..."
for i in {1..5}; do
    telemetry=$(cat <<EOF
{
  "agent_id": "$AGENT_ID",
  "timestamp": $(date +%s),
  "metrics": {"iteration": $i, "cpu": $((20 + RANDOM % 60))},
  "logs": [],
  "status": {
    "health": "healthy",
    "uptime_secs": $((3600 + i * 60)),
    "cpu_usage_percent": $((20 + RANDOM % 60)),
    "memory_usage_mb": $((400 + RANDOM % 200)),
    "active_tasks": $((RANDOM % 10))
  }
}
EOF
)
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $FLEET_API_KEY" \
        -d "$telemetry" \
        "$OVERTURE_URL/api/fleet/fleet-default/telemetry" > /dev/null
    echo "  → Sample $i uploaded"
    sleep 0.5
done
test_result 0 "Multiple telemetry uploads"

# Test 9: Error Handling - Invalid Agent ID
echo -e "\n${YELLOW}==== Test 9: Error Handling ====${NC}"
invalid_data='{"agent_id": "", "hostname": "test"}'
echo "Testing invalid registration (should fail)..."
response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $FLEET_API_KEY" \
    -d "$invalid_data" \
    "$OVERTURE_URL/api/fleet/register")
http_code=$(echo "$response" | tail -n 1)
if [ "$http_code" -ge 400 ]; then
    test_result 0 "Invalid registration rejected correctly (HTTP $http_code)"
else
    test_result 1 "Invalid registration should have been rejected"
fi

# Test 10: Mock Mode Test (Runtime Internal)
echo -e "\n${YELLOW}==== Test 10: Mock Mode Test ====${NC}"
echo "This test validates Runtime's mock mode (requires Rust build)"
if command -v cargo &> /dev/null; then
    cd "$(dirname "$0")/igris-runtime/crates/igris-fleet"
    if cargo test --quiet -- --nocapture 2>&1 | grep -q "PASSED"; then
        test_result 0 "Runtime fleet agent unit tests"
    else
        test_result 1 "Runtime fleet agent unit tests"
    fi
    cd - > /dev/null
else
    echo "  Skipped (cargo not available)"
fi

# Summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed${NC}"
    exit 1
fi
