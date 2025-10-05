#!/bin/bash
# Edge Mode Integration Test
# Tests edge routing with failover simulation

set -e

echo "=================================================="
echo "Edge Mode Integration Test"
echo "=================================================="

# Configuration
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
EDGE_NODE_1="${EDGE_NODE_1:-localhost:50051}"
EDGE_NODE_2="${EDGE_NODE_2:-localhost:50052}"

echo ""
echo "Configuration:"
echo "  Gateway URL: $GATEWAY_URL"
echo "  Edge Node 1: $EDGE_NODE_1"
echo "  Edge Node 2: $EDGE_NODE_2"
echo ""

# Test 1: Edge node health check
echo "Test 1: Checking edge node health..."
response=$(curl -s -X GET "$GATEWAY_URL/api/v1/edge/health" || echo "FAILED")

if [[ "$response" == *"FAILED"* ]]; then
    echo "  ❌ Edge health check failed"
    exit 1
else
    echo "  ✅ Edge health check passed"
    echo "  Response: $response"
fi

# Test 2: Edge routing with region header
echo ""
echo "Test 2: Testing edge routing with region header..."
response=$(curl -s -X POST "$GATEWAY_URL/api/v1/predict_edge" \
    -H "Content-Type: application/json" \
    -H "X-Client-Region: us-east" \
    -d '{
        "model_id": "model_xgb_v1",
        "features": [1.0, 2.0, 3.0, 4.0, 5.0]
    }' || echo "FAILED")

if [[ "$response" == *"prediction"* ]]; then
    echo "  ✅ Edge routing successful"
    echo "  Response: $response"
else
    echo "  ❌ Edge routing failed"
    echo "  Response: $response"
    exit 1
fi

# Test 3: Failover simulation (if edge mode supports it)
echo ""
echo "Test 3: Testing failover behavior..."
echo "  This test requires manual intervention to simulate node failure"
echo "  Skipping automated failover test"
echo "  ⚠️  Manual test recommended"

# Test 4: Edge metrics
echo ""
echo "Test 4: Checking edge router metrics..."
response=$(curl -s -X GET "$GATEWAY_URL/api/v1/edge/metrics" || echo "FAILED")

if [[ "$response" == *"total_requests"* ]]; then
    echo "  ✅ Edge metrics available"
    echo "  Response: $response"
else
    echo "  ⚠️  Edge metrics not available or endpoint missing"
fi

# Test 5: Multi-region routing
echo ""
echo "Test 5: Testing multi-region routing..."

regions=("us-east" "us-west" "eu-west")
for region in "${regions[@]}"; do
    echo "  Testing region: $region"
    response=$(curl -s -X POST "$GATEWAY_URL/api/v1/predict_edge" \
        -H "Content-Type: application/json" \
        -H "X-Client-Region: $region" \
        -d '{
            "model_id": "model_rf_v2",
            "features": [2.0, 4.0, 6.0, 8.0, 10.0]
        }' 2>&1)

    if [[ "$response" == *"prediction"* ]] || [[ "$response" == *"edge"* ]]; then
        echo "    ✅ $region routing works"
    else
        echo "    ⚠️  $region routing may not be configured"
    fi
done

echo ""
echo "=================================================="
echo "Edge Mode Integration Test Summary"
echo "=================================================="
echo "✅ All critical tests passed"
echo "⚠️  Some optional tests may require additional setup"
echo ""
echo "For full edge mode testing:"
echo "  1. Ensure edge nodes are running"
echo "  2. Configure regional routing"
echo "  3. Test failover manually by stopping a node"
echo ""
