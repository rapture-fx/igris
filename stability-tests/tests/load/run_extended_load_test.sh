#!/bin/bash

# Extended Load Test Runner - Phase 4.1
# This script runs the 6-hour extended load test with real providers

set -e

echo "=========================================="
echo " Igris Inertial Extended Load Test Runner"
echo " Phase 4.1.2 - Production Load Testing   "
echo "=========================================="
echo ""

# Configuration
RPS=${RPS:-1000}
DURATION=${DURATION:-6h}
API_URL=${API_URL:-http://localhost:8080}
OUTPUT_DIR="tests/load/results"
USE_REAL_PROVIDERS=${USE_REAL_PROVIDERS:-false}
PUSHGATEWAY_URL=${PUSHGATEWAY_URL:-""}

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if API is running
echo "🔍 Checking if API is accessible..."
if ! curl -sf "$API_URL/v1/health" > /dev/null 2>&1; then
    echo "❌ Error: API at $API_URL is not accessible"
    echo "   Please start the API server first:"
    echo "   docker-compose -f docker-compose.production.yml up -d"
    exit 1
fi

echo "✅ API is accessible"
echo ""

# Display configuration
echo "Configuration:"
echo "  - Target RPS: $RPS"
echo "  - Duration: $DURATION"
echo "  - API URL: $API_URL"
echo "  - Real Providers: $USE_REAL_PROVIDERS"
echo "  - Output Directory: $OUTPUT_DIR"
if [ -n "$PUSHGATEWAY_URL" ]; then
    echo "  - Pushgateway: $PUSHGATEWAY_URL"
fi
echo ""

# Warning for real providers
if [ "$USE_REAL_PROVIDERS" = "true" ]; then
    echo "⚠️  WARNING: Running with real AI providers"
    echo "   This will incur costs. Make sure you have:"
    echo "   - OPENAI_API_KEY set"
    echo "   - ANTHROPIC_API_KEY set"
    echo "   - Budget limits configured"
    echo ""
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
fi

# Build the load test
echo "🔨 Building load test binary..."
cd "$(dirname "$0")"
go build -o extended_load_test extended_load_test.go

echo "✅ Build complete"
echo ""

# Run the load test
echo "🚀 Starting extended load test..."
echo "   This will run for $DURATION. You can stop it with Ctrl+C"
echo ""

# Build command
CMD="./extended_load_test -rps=$RPS -duration=$DURATION -url=$API_URL -output=$OUTPUT_DIR"

if [ "$USE_REAL_PROVIDERS" = "true" ]; then
    CMD="$CMD -real-providers=true"
fi

if [ -n "$PUSHGATEWAY_URL" ]; then
    CMD="$CMD -pushgateway=$PUSHGATEWAY_URL"
fi

# Run with output to both console and log file
LOGFILE="$OUTPUT_DIR/load_test_$(date +%Y%m%d_%H%M%S).log"
echo "📝 Logging to: $LOGFILE"
echo ""

$CMD 2>&1 | tee "$LOGFILE"

EXIT_CODE=${PIPESTATUS[0]}

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Load test completed successfully"
    echo ""
    echo "Results saved to: $OUTPUT_DIR"
    echo "Latest report: $(ls -t $OUTPUT_DIR/load_test_report_*.md | head -1)"
else
    echo "❌ Load test failed with exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi
