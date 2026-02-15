#!/bin/bash
#
# Igris Inertial Telemetry Aggregation Validation
# Validates telemetry collection and aggregation under load
#
# Usage: ./validate_telemetry.sh [BASE_URL]
# Example: ./validate_telemetry.sh http://localhost:8080
#

set -e

BASE_URL="${1:-http://localhost:8080}"

echo "========================================="
echo "Telemetry Aggregation Validation"
echo "========================================="
echo "Base URL: $BASE_URL"
echo "========================================="
echo

# Authenticate
TENANT_API_KEY="${TENANT_API_KEY:-test-api-key-change-me}"
TOKEN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$TENANT_API_KEY\"}" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "Error: Failed to authenticate"
    exit 1
fi

echo "✓ Authenticated"
echo

# Test 1: Verify telemetry recording
echo "[Test 1] Verifying telemetry recording..."
echo

# Get initial request count
INITIAL_STATS=$(curl -s -X GET "$BASE_URL/v1/routing/stats?hours=1" \
    -H "Authorization: Bearer $TOKEN")
INITIAL_COUNT=$(echo "$INITIAL_STATS" | jq -r '.usage.total_requests // 0')

echo "Initial request count: $INITIAL_COUNT"

# Make 10 test requests
echo "Sending 10 test requests..."
for i in {1..10}; do
    curl -s -X POST "$BASE_URL/v1/chat/completions" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "gpt-4-turbo",
            "messages": [{"role": "user", "content": "Test '$i'"}],
            "max_tokens": 10
        }' > /dev/null
    echo -n "."
done
echo " done"

# Wait for telemetry to be recorded
echo "Waiting 2 seconds for telemetry..."
sleep 2

# Check updated count
UPDATED_STATS=$(curl -s -X GET "$BASE_URL/v1/routing/stats?hours=1" \
    -H "Authorization: Bearer $TOKEN")
UPDATED_COUNT=$(echo "$UPDATED_STATS" | jq -r '.usage.total_requests // 0')

echo "Updated request count: $UPDATED_COUNT"

DELTA=$((UPDATED_COUNT - INITIAL_COUNT))
if [ $DELTA -ge 10 ]; then
    echo "✓ PASS: Telemetry recorded ($DELTA new requests)"
else
    echo "✗ FAIL: Expected at least 10 new requests, got $DELTA"
fi
echo

# Test 2: Verify recent requests API
echo "[Test 2] Verifying recent requests API..."
RECENT=$(curl -s -X GET "$BASE_URL/v1/routing/recent?limit=10" \
    -H "Authorization: Bearer $TOKEN")

RECENT_COUNT=$(echo "$RECENT" | jq '.requests | length')

if [ "$RECENT_COUNT" -gt 0 ]; then
    echo "✓ PASS: Retrieved $RECENT_COUNT recent requests"
    echo "Sample request:"
    echo "$RECENT" | jq '.requests[0]' 2>/dev/null || echo "Error parsing JSON"
else
    echo "✗ FAIL: No recent requests found"
fi
echo

# Test 3: Verify provider leaderboard
echo "[Test 3] Verifying provider leaderboard..."
LEADERBOARD=$(curl -s -X GET "$BASE_URL/v1/routing/leaderboard" \
    -H "Authorization: Bearer $TOKEN")

PROVIDER_COUNT=$(echo "$LEADERBOARD" | jq '.leaderboard | length')

if [ "$PROVIDER_COUNT" -gt 0 ]; then
    echo "✓ PASS: Leaderboard contains $PROVIDER_COUNT providers"
    echo "Top provider:"
    echo "$LEADERBOARD" | jq '.leaderboard[0]' 2>/dev/null || echo "Error parsing JSON"
else
    echo "⚠ WARNING: Leaderboard is empty (expected if no providers registered)"
fi
echo

# Test 4: Verify telemetry fields
echo "[Test 4] Verifying telemetry data completeness..."
SAMPLE_REQUEST=$(echo "$RECENT" | jq '.requests[0]')

REQUIRED_FIELDS=("id" "trace_id" "provider_name" "model" "latency_ms" "success" "created_at")
MISSING_FIELDS=()

for field in "${REQUIRED_FIELDS[@]}"; do
    VALUE=$(echo "$SAMPLE_REQUEST" | jq -r ".$field // empty")
    if [ -z "$VALUE" ] || [ "$VALUE" == "null" ]; then
        MISSING_FIELDS+=("$field")
    fi
done

if [ ${#MISSING_FIELDS[@]} -eq 0 ]; then
    echo "✓ PASS: All required telemetry fields present"
else
    echo "✗ FAIL: Missing fields: ${MISSING_FIELDS[*]}"
fi
echo

# Test 5: Verify aggregation job execution
echo "[Test 5] Checking aggregation job logs..."
echo "Note: This requires access to application logs"
echo "Manual verification needed:"
echo "  1. Check logs for: [TelemetryAggregator] Starting aggregation cycle..."
echo "  2. Verify aggregation runs every 10 minutes"
echo "  3. Check for: Aggregated metrics for N providers"
echo "  4. Verify no SQL errors in aggregation"
echo

# Test 6: Load test scenario
echo "[Test 6] Load test scenario (100 RPS for 10 seconds)..."

if command -v hey &> /dev/null; then
    echo "Running load test..."

    # Prepare payload
    cat > /tmp/telemetry_test_payload.json <<'EOF'
{
  "model": "gpt-4-turbo",
  "messages": [{"role": "user", "content": "Test"}],
  "max_tokens": 5
}
EOF

    # Get count before
    BEFORE_LOAD=$(curl -s -X GET "$BASE_URL/v1/routing/stats?hours=1" \
        -H "Authorization: Bearer $TOKEN" | jq -r '.usage.total_requests // 0')

    # Run load test
    hey -z 10s -q 100 -c 50 \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -m POST \
        -D /tmp/telemetry_test_payload.json \
        "$BASE_URL/v1/chat/completions" > /tmp/telemetry_load_results.txt 2>&1

    # Wait for telemetry
    echo "Waiting 5 seconds for telemetry processing..."
    sleep 5

    # Get count after
    AFTER_LOAD=$(curl -s -X GET "$BASE_URL/v1/routing/stats?hours=1" \
        -H "Authorization: Bearer $TOKEN" | jq -r '.usage.total_requests // 0')

    LOAD_DELTA=$((AFTER_LOAD - BEFORE_LOAD))
    EXPECTED=1000  # 100 RPS * 10s

    echo "Requests sent: ~$EXPECTED"
    echo "Telemetry recorded: $LOAD_DELTA"

    # Check if at least 95% recorded (allowing for some failures)
    MIN_EXPECTED=$((EXPECTED * 95 / 100))

    if [ $LOAD_DELTA -ge $MIN_EXPECTED ]; then
        echo "✓ PASS: Telemetry recording handles load ($LOAD_DELTA >= $MIN_EXPECTED)"
    else
        echo "✗ FAIL: Telemetry recording missed requests ($LOAD_DELTA < $MIN_EXPECTED)"
    fi

    # Check for database errors in results
    if grep -qi "database\|timeout\|connection" /tmp/telemetry_load_results.txt; then
        echo "⚠ WARNING: Potential database issues detected during load"
    else
        echo "✓ No database errors during load"
    fi

    rm -f /tmp/telemetry_test_payload.json /tmp/telemetry_load_results.txt
else
    echo "⚠ Skipped: 'hey' not installed"
    echo "  Install with: brew install hey"
fi
echo

# Summary
echo "========================================="
echo "VALIDATION SUMMARY"
echo "========================================="
echo "All critical telemetry functions should be verified:"
echo "  1. Recording - Captures every request"
echo "  2. Storage - Persists to database"
echo "  3. Retrieval - APIs work correctly"
echo "  4. Completeness - All fields present"
echo "  5. Performance - Handles concurrent load"
echo "  6. Aggregation - Background job runs (check logs)"
echo
echo "For production readiness:"
echo "  • Verify aggregation job runs consistently"
echo "  • Monitor database connection pool under load"
echo "  • Check for any dropped telemetry records"
echo "  • Validate aggregates table has proper indexes"
echo "========================================="
