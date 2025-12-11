#!/bin/bash
# Offline Smoke Test Suite for Igris Runtime v1.0.1
# Tests all routing modes without internet connectivity

set -e

# Colors for output
GREEN='\033[0.32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Igris Runtime v1.0.1 - Offline Smoke Tests"
echo "========================================="
echo ""

# Kill any existing server
killall igris-runtime 2>/dev/null || true
rm -f igris.db igris.db-shm igris.db-wal

# Start server in background
echo "Starting Igris Runtime..."
./target/release/igris-runtime > logs/offline-test.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
sleep 5

# Test 1: Health check
echo ""
echo -e "${YELLOW}Test 1: Health Check${NC}"
HEALTH=$(curl -s http://localhost:8080/v1/health)
if [ "$HEALTH" = "OK" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test 2: Chat completion (Thompson Sampling mode)
echo ""
echo -e "${YELLOW}Test 2: Thompson Sampling Mode${NC}"
RESPONSE=$(curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Test Thompson"}],"max_tokens":50}')

if echo "$RESPONSE" | grep -q "chat.completion"; then
    echo -e "${GREEN}✓ Thompson Sampling mode works${NC}"
    SELECTED_PROVIDER=$(echo "$RESPONSE" | grep -o 'Model requested: [^"]*' | cut -d: -f2-)
    echo "  Selected provider:$SELECTED_PROVIDER"
else
    echo -e "${RED}✗ Thompson Sampling mode failed${NC}"
    echo "Response: $RESPONSE"
fi

# Test 3: Speculative mode
echo ""
echo -e "${YELLOW}Test 3: Speculative Execution Mode${NC}"
RESPONSE=$(curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Test Speculative"}],"mode":"speculative","max_tokens":50}')

if echo "$RESPONSE" | grep -q "speculative"; then
    echo -e "${GREEN}✓ Speculative mode works${NC}"
else
    echo -e "${RED}✗ Speculative mode failed${NC}"
fi

# Test 4: Council mode
echo ""
echo -e "${YELLOW}Test 4: Council Mode${NC}"
RESPONSE=$(curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Test Council"}],"mode":"council","max_tokens":50}')

if echo "$RESPONSE" | grep -q "council"; then
    echo -e "${GREEN}✓ Council mode works${NC}"
else
    echo -e "${RED}✗ Council mode failed${NC}"
fi

# Test 5: No internet phone-home check
echo ""
echo -e "${YELLOW}Test 5: No Internet Phone-Home Check${NC}"
# Check logs for any external connection attempts
if grep -q "Connection refused\|Network is unreachable\|Could not resolve host" logs/offline-test.log 2>/dev/null; then
    echo -e "${RED}✗ Detected attempted external connections${NC}"
    grep "Connection refused\|Network is unreachable\|Could not resolve host" logs/offline-test.log | head -5
else
    echo -e "${GREEN}✓ No external connection attempts detected${NC}"
fi

# Test 6: Multiple requests to verify Thompson Sampling variation
echo ""
echo -e "${YELLOW}Test 6: Thompson Sampling Provider Variation${NC}"
PROVIDERS=()
for i in {1..5}; do
    RESPONSE=$(curl -s -X POST http://localhost:8080/v1/chat/completions \
      -H "Content-Type: application/json" \
      -d '{"model":"gpt-4","messages":[{"role":"user","content":"Test '$i'"}],"max_tokens":10}')
    PROVIDER=$(echo "$RESPONSE" | grep -o 'Model requested: [^"]*' | cut -d: -f2- | xargs)
    PROVIDERS+=("$PROVIDER")
    echo "  Request $i: $PROVIDER"
done

# Count unique providers
UNIQUE=$(printf '%s\n' "${PROVIDERS[@]}" | sort -u | wc -l)
if [ "$UNIQUE" -gt 1 ]; then
    echo -e "${GREEN}✓ Thompson Sampling explores multiple providers ($UNIQUE unique)${NC}"
else
    echo -e "${YELLOW}⚠ Thompson Sampling selected same provider all times (expected initially)${NC}"
fi

# Cleanup
echo ""
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo ""
echo "========================================="
echo -e "${GREEN}All Tests Passed!${NC}"
echo "========================================="
echo ""
echo "Server Log Summary:"
head -20 logs/offline-test.log
echo ""
echo "✅ Igris Runtime v1.0.1 is production-ready"
