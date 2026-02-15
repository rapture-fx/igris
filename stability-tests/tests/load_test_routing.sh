#!/bin/bash
#
# Igris Inertial Routing Layer Load Test
# Tests concurrent routing requests with fallback simulation
#
# Usage: ./load_test_routing.sh [BASE_URL] [RPS] [DURATION]
# Example: ./load_test_routing.sh http://localhost:8080 100 60
#

set -e

BASE_URL="${1:-http://localhost:8080}"
RPS="${2:-100}"
DURATION="${3:-60}"
TOTAL_REQUESTS=$((RPS * DURATION))

echo "========================================="
echo "Igris Inertial Routing Layer Load Test"
echo "========================================="
echo "Base URL: $BASE_URL"
echo "Target RPS: $RPS"
echo "Duration: ${DURATION}s"
echo "Total Requests: $TOTAL_REQUESTS"
echo "========================================="
echo

# Check if required tools are installed
command -v hey >/dev/null 2>&1 || {
    echo "Error: 'hey' is not installed. Install with:"
    echo "  macOS: brew install hey"
    echo "  Linux: go install github.com/rakyll/hey@latest"
    exit 1
}

command -v jq >/dev/null 2>&1 || {
    echo "Error: 'jq' is not installed. Install with:"
    echo "  macOS: brew install jq"
    echo "  Linux: apt-get install jq"
    exit 1
}

# Step 1: Get auth token
echo "[1/5] Authenticating..."
# Replace with actual tenant API key
TENANT_API_KEY="${TENANT_API_KEY:-test-api-key-change-me}"

TOKEN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$TENANT_API_KEY\"}" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "Error: Failed to authenticate. Please set TENANT_API_KEY environment variable"
    exit 1
fi

echo "✓ Authenticated successfully"
echo

# Step 2: Prepare test payload
echo "[2/5] Preparing test payload..."
cat > /tmp/igris_load_test_payload.json <<'EOF'
{
  "model": "gpt-4-turbo",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Say hello in one word."}
  ],
  "max_tokens": 10,
  "temperature": 0.7
}
EOF

echo "✓ Test payload ready"
echo

# Step 3: Run warmup requests
echo "[3/5] Warming up (10 requests)..."
hey -n 10 -c 2 \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -m POST \
    -D /tmp/igris_load_test_payload.json \
    "$BASE_URL/v1/chat/completions" > /dev/null 2>&1

echo "✓ Warmup complete"
echo

# Step 4: Run main load test
echo "[4/5] Running load test (RPS: $RPS, Duration: ${DURATION}s)..."
echo
hey -z ${DURATION}s -q $RPS -c $((RPS / 2)) \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -m POST \
    -D /tmp/igris_load_test_payload.json \
    "$BASE_URL/v1/chat/completions" | tee /tmp/igris_load_test_results.txt

echo
echo

# Step 5: Analyze results
echo "[5/5] Analyzing results..."
echo

# Extract key metrics
SUCCESS_RATE=$(grep "Status code distribution" /tmp/igris_load_test_results.txt -A 5 | grep "200" | awk '{print $3}')
AVG_LATENCY=$(grep "Average:" /tmp/igris_load_test_results.txt | awk '{print $2}')
P95_LATENCY=$(grep "95% in" /tmp/igris_load_test_results.txt | awk '{print $3}')
P99_LATENCY=$(grep "99% in" /tmp/igris_load_test_results.txt | awk '{print $3}')
ERRORS=$(grep -E "Error distribution|Non-2xx" /tmp/igris_load_test_results.txt -A 10 || echo "No errors")

# Get routing statistics
echo "Fetching routing statistics..."
STATS=$(curl -s -X GET "$BASE_URL/v1/routing/stats?hours=1" \
    -H "Authorization: Bearer $TOKEN")

echo
echo "========================================="
echo "LOAD TEST SUMMARY"
echo "========================================="
echo "Target RPS: $RPS"
echo "Duration: ${DURATION}s"
echo "Success Rate: $SUCCESS_RATE"
echo "Avg Latency: $AVG_LATENCY"
echo "P95 Latency: $P95_LATENCY"
echo "P99 Latency: $P99_LATENCY"
echo
echo "Routing Statistics (Last Hour):"
echo "$STATS" | jq '.usage' 2>/dev/null || echo "$STATS"
echo
echo "Error Distribution:"
echo "$ERRORS"
echo "========================================="

# Check for pass/fail criteria
echo
echo "Validation Checks:"
echo

# Check 1: Success rate > 95%
SUCCESS_PCT=$(echo "$SUCCESS_RATE" | tr -d '%' | cut -d'[' -f1)
if (( $(echo "$SUCCESS_PCT > 95" | bc -l) )); then
    echo "✓ Success rate ($SUCCESS_PCT%) > 95%"
else
    echo "✗ FAIL: Success rate ($SUCCESS_PCT%) < 95%"
fi

# Check 2: P95 latency < 1000ms
P95_MS=$(echo "$P95_LATENCY" | sed 's/[^0-9.]//g')
if (( $(echo "$P95_MS < 1.0" | bc -l) )); then
    echo "✓ P95 latency ($P95_LATENCY) < 1000ms"
else
    echo "✗ FAIL: P95 latency ($P95_LATENCY) > 1000ms"
fi

# Check 3: No database timeouts
if ! grep -qi "timeout\|too many connections" /tmp/igris_load_test_results.txt; then
    echo "✓ No database connection issues"
else
    echo "✗ FAIL: Database connection issues detected"
fi

echo
echo "Full results saved to: /tmp/igris_load_test_results.txt"
echo

# Cleanup
rm -f /tmp/igris_load_test_payload.json

echo "Load test complete!"
