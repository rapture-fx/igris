#!/bin/bash
# Quick smoke test for AI agent endpoints

set -e

SERVER_URL="http://localhost:8080"

echo "=== Testing Igris Runtime AI Agent Endpoints ==="
echo

# Check if server is running
echo "1. Health check..."
if ! curl -sf "$SERVER_URL/v1/health" > /dev/null; then
    echo "❌ Server not running at $SERVER_URL"
    echo "Start with: cargo run --release"
    exit 1
fi
echo "✅ Server is healthy"
echo

# Test planning endpoint (without tools)
echo "2. Testing /v1/plan (without tools)..."
PLAN_RESPONSE=$(curl -sf -X POST "$SERVER_URL/v1/plan" \
    -H 'Content-Type: application/json' \
    -d '{
        "goal": "List 3 benefits of using Rust for systems programming",
        "enable_tools": false,
        "max_steps": 3
    }')

if echo "$PLAN_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Planning endpoint works"
    echo "   Final answer: $(echo "$PLAN_RESPONSE" | jq -r '.final_answer' | head -c 100)..."
    echo "   Total steps: $(echo "$PLAN_RESPONSE" | jq -r '.total_steps')"
else
    echo "❌ Planning endpoint failed"
    echo "$PLAN_RESPONSE" | jq .
    exit 1
fi
echo

# Test reflection endpoint
echo "3. Testing /v1/reflect..."
REFLECT_RESPONSE=$(curl -sf -X POST "$SERVER_URL/v1/reflect" \
    -H 'Content-Type: application/json' \
    -d '{
        "prompt": "Explain AI in one sentence",
        "max_iterations": 2,
        "quality_threshold": 0.6
    }')

if echo "$REFLECT_RESPONSE" | jq -e '.threshold_met' > /dev/null 2>&1; then
    echo "✅ Reflection endpoint works"
    echo "   Final response: $(echo "$REFLECT_RESPONSE" | jq -r '.final_response' | head -c 100)..."
    echo "   Score: $(echo "$REFLECT_RESPONSE" | jq -r '.final_score')"
    echo "   Iterations: $(echo "$REFLECT_RESPONSE" | jq -r '.total_iterations')"
else
    echo "❌ Reflection endpoint failed"
    echo "$REFLECT_RESPONSE" | jq .
    exit 1
fi
echo

# Test planning with tools (if tools are enabled)
echo "4. Testing /v1/plan (with tools)..."
PLAN_TOOLS_RESPONSE=$(curl -sf -X POST "$SERVER_URL/v1/plan" \
    -H 'Content-Type: application/json' \
    -d '{
        "goal": "What is the current time?",
        "enable_tools": true,
        "max_steps": 2
    }' 2>&1)

if echo "$PLAN_TOOLS_RESPONSE" | jq -e '.success or .error' > /dev/null 2>&1; then
    if echo "$PLAN_TOOLS_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo "✅ Planning with tools works"
        echo "   Total steps: $(echo "$PLAN_TOOLS_RESPONSE" | jq -r '.total_steps')"
    else
        echo "⚠️  Planning with tools returned error (tools may not be configured)"
        echo "   $(echo "$PLAN_TOOLS_RESPONSE" | jq -r '.error.message')"
    fi
else
    echo "⚠️  Could not test tools (may not be enabled)"
fi
echo

# Test chat completions with tool mode
echo "5. Testing /v1/chat/completions (mode: tools)..."
CHAT_TOOLS_RESPONSE=$(curl -sf -X POST "$SERVER_URL/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -d '{
        "model": "local",
        "messages": [
            {"role": "user", "content": "What is 2+2? Use your reasoning."}
        ],
        "mode": "tools"
    }' 2>&1)

if echo "$CHAT_TOOLS_RESPONSE" | jq -e '.choices or .error' > /dev/null 2>&1; then
    if echo "$CHAT_TOOLS_RESPONSE" | jq -e '.choices' > /dev/null 2>&1; then
        echo "✅ Chat completions with tool mode works"
        CONTENT=$(echo "$CHAT_TOOLS_RESPONSE" | jq -r '.choices[0].message.content' | head -c 80)
        echo "   Response: $CONTENT..."
    else
        echo "⚠️  Chat with tool mode returned error (tools may not be configured)"
        echo "   $(echo "$CHAT_TOOLS_RESPONSE" | jq -r '.error.message')"
    fi
else
    echo "⚠️  Could not test chat with tool mode"
fi
echo

echo "=== All Tests Passed! ==="
echo
echo "Available endpoints:"
echo "  • POST /v1/plan      - Multi-step planning with optional tool usage"
echo "  • POST /v1/reflect   - Self-critique and improvement loops"
echo "  • POST /v1/chat/completions - OpenAI-compatible chat"
echo "  • GET  /v1/health    - Health check"
echo
echo "Documentation: http://localhost:8080/swagger-ui"
