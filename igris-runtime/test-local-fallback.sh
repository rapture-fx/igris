#!/bin/bash
set -e

echo "========================================"
echo "Igris Runtime Local Fallback Test"
echo "========================================"
echo ""
echo "This test verifies that the local LLM fallback"
echo "works when all cloud providers are unavailable."
echo ""

# Check if server is running
if ! curl -s http://localhost:8080/v1/health > /dev/null 2>&1; then
    echo "Error: Igris Runtime is not running on localhost:8080"
    echo "Please start the server first with:"
    echo "  cd runtime && cargo run --release"
    exit 1
fi

echo "✓ Server is running"
echo ""

# Test 1: Health check
echo "Test 1: Health check"
response=$(curl -s http://localhost:8080/v1/health)
if [ "$response" = "OK" ]; then
    echo "✓ Health check passed"
else
    echo "✗ Health check failed"
    exit 1
fi
echo ""

# Test 2: Chat completion with fallback
echo "Test 2: Chat completion (should use local fallback if cloud unavailable)"
echo "Request: What is 2+2?"
echo ""

response=$(curl -s -X POST http://localhost:8080/v1/chat/completions \
    -H 'Content-Type: application/json' \
    -d '{
        "model": "phi3",
        "messages": [{"role": "user", "content": "What is 2+2? Answer with just the number."}],
        "max_tokens": 50
    }')

# Check if we got a response
if echo "$response" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    content=$(echo "$response" | jq -r '.choices[0].message.content')
    model=$(echo "$response" | jq -r '.model')

    echo "Response: $content"
    echo "Model used: $model"
    echo ""

    if echo "$model" | grep -q "local"; then
        echo "✓ Local LLM fallback was used"
    else
        echo "  Cloud provider was used (fallback not needed)"
    fi

    echo "✓ Chat completion test passed"
else
    echo "✗ Chat completion test failed"
    echo "Response: $response"
    exit 1
fi

echo ""
echo "========================================"
echo "All tests passed!"
echo "========================================"
echo ""
echo "To test offline fallback specifically:"
echo "1. Disable your internet connection"
echo "2. Run this test again"
echo "3. It should still work using local Phi-3 model"
echo ""
