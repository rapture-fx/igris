#!/bin/bash
set -e

# Create logs directory
mkdir -p logs

# Start server in background
echo "Starting Igris Runtime v1.0..."
./target/release/igris-runtime > logs/runtime.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Test health endpoint
echo ""
echo "=== Health Check ==="
curl -s http://localhost:8080/v1/health
echo ""

# Test chat completions endpoint
echo ""
echo "=== Chat Completion Request ==="
curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hello, world!"}],"max_tokens":50}'
echo ""

# Stop server
echo ""
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

# Show server log
echo ""
echo "=== Server Log ==="
cat logs/runtime.log

echo ""
echo "=== Test Complete ==="
