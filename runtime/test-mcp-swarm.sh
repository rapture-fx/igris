#!/bin/bash
# Integration test for MCP Swarm Mode
# Starts two Igris Runtime instances and tests peer discovery & context sync

set -e

echo "========================================"
echo "Igris Runtime v1.2 - MCP Swarm Test"
echo "========================================"
echo

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
    echo
    echo -e "${YELLOW}Cleaning up...${NC}"
    pkill -f "igris-runtime.*8080" || true
    pkill -f "igris-runtime.*8081" || true
    rm -f instance1.db instance2.db mcp_contexts_1.db mcp_contexts_2.db
    echo -e "${GREEN}Cleanup complete${NC}"
}

trap cleanup EXIT

# Build binary
echo -e "${BLUE}Building Igris Runtime...${NC}"
cargo build --release
echo

# Create config for instance 1 (port 8080)
cat > /tmp/instance1.json5 <<'EOF'
{
  server: { host: "0.0.0.0", port: 8080 },
  storage: { path: "instance1.db" },
  providers: [],
  routing: {
    thompson_sampling: { enabled: false, exploration_rate: 0.1 },
    speculative: { enabled: false, max_providers: 1, first_token_timeout_ms: 5000 },
    council: { enabled: false, chairman: "none" },
  },
  auth: { api_key: "test" },
  local_fallback: { enabled: false, model_path: "none", context_size: 512, threads: 1, max_tokens: 50, temperature: 0.7, cost_per_1k_tokens: 0.0 },
  mcp: {
    enabled: true,
    mdns: true,
    multicast: true,
    persist: true,
    storage_path: "mcp_contexts_1.db",
    peer_id: "instance-1",
  },
}
EOF

# Create config for instance 2 (port 8081)
cat > /tmp/instance2.json5 <<'EOF'
{
  server: { host: "0.0.0.0", port: 8081 },
  storage: { path: "instance2.db" },
  providers: [],
  routing: {
    thompson_sampling: { enabled: false, exploration_rate: 0.1 },
    speculative: { enabled: false, max_providers: 1, first_token_timeout_ms: 5000 },
    council: { enabled: false, chairman: "none" },
  },
  auth: { api_key: "test" },
  local_fallback: { enabled: false, model_path: "none", context_size: 512, threads: 1, max_tokens: 50, temperature: 0.7, cost_per_1k_tokens: 0.0 },
  mcp: {
    enabled: true,
    mdns: true,
    multicast: true,
    persist: true,
    storage_path: "mcp_contexts_2.db",
    peer_id: "instance-2",
  },
}
EOF

# Start instance 1
echo -e "${BLUE}Starting Instance 1 (port 8080)...${NC}"
IGRIS_CONFIG=/tmp/instance1.json5 ../target/release/igris-runtime > /tmp/instance1.log 2>&1 &
INSTANCE1_PID=$!
echo "Instance 1 PID: $INSTANCE1_PID"

# Wait for instance 1 to start
sleep 3

# Start instance 2
echo -e "${BLUE}Starting Instance 2 (port 8081)...${NC}"
IGRIS_CONFIG=/tmp/instance2.json5 ../target/release/igris-runtime > /tmp/instance2.log 2>&1 &
INSTANCE2_PID=$!
echo "Instance 2 PID: $INSTANCE2_PID"

# Wait for instance 2 to start and discover instance 1
echo
echo -e "${YELLOW}Waiting for peer discovery (15 seconds)...${NC}"
sleep 15

# Test 1: Health checks
echo
echo -e "${BLUE}Test 1: Health Checks${NC}"
echo "Instance 1:"
curl -s http://localhost:8080/v1/health
echo
echo "Instance 2:"
curl -s http://localhost:8081/v1/health
echo

# Test 2: MCP Ping
echo -e "${BLUE}Test 2: MCP Ping${NC}"
echo "Pinging Instance 1 MCP endpoint:"
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}' | jq .
echo

# Test 3: Context Sync
echo -e "${BLUE}Test 3: Context Sync${NC}"
echo "Syncing context to Instance 1:"
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"context/sync",
    "params":{
      "conversation_id":"test-conversation-123",
      "messages":[
        {"role":"user","content":"Hello from test","timestamp":1234567890,"peer_id":"test"}
      ],
      "tool_state":{},
      "last_updated":1234567890,
      "peer_id":"test"
    }
  }' | jq .
echo

# Test 4: Retrieve Context
echo -e "${BLUE}Test 4: Retrieve Context${NC}"
echo "Retrieving context from Instance 1:"
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"context/get",
    "params":{"conversation_id":"test-conversation-123"}
  }' | jq .
echo

# Test 5: List Contexts
echo -e "${BLUE}Test 5: List Contexts${NC}"
echo "Listing contexts from Instance 2:"
curl -s -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"context/list","params":{}}' | jq .
echo

# Show logs
echo -e "${YELLOW}Instance 1 Log Excerpt:${NC}"
tail -20 /tmp/instance1.log
echo
echo -e "${YELLOW}Instance 2 Log Excerpt:${NC}"
tail -20 /tmp/instance2.log

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MCP Swarm Test Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo "Two instances started:"
echo "  - Instance 1: http://localhost:8080 (peer: instance-1)"
echo "  - Instance 2: http://localhost:8081 (peer: instance-2)"
echo
echo "They should have discovered each other via mDNS + multicast"
echo "and are now sharing context in real-time."
echo
echo "Press CTRL+C to stop both instances."

# Wait for user interrupt
wait
