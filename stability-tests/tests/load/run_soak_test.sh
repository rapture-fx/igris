#!/bin/bash

# Soak Test Runner - Phase 4.1
# This script runs the 24-hour soak test for memory stability validation

set -e

echo "=========================================="
echo " Schlep-Engine 24-Hour Soak Test Runner  "
echo " Phase 4.1.3 - Memory Stability Testing  "
echo "=========================================="
echo ""

# Configuration
RPS=${RPS:-100}
DURATION=${DURATION:-24h}
API_URL=${API_URL:-http://localhost:8080}
OUTPUT_DIR="tests/load/results"
MEM_CHECK_INTERVAL=${MEM_CHECK_INTERVAL:-5m}

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
echo "  - Target RPS: $RPS (lower rate for stability testing)"
echo "  - Duration: $DURATION"
echo "  - API URL: $API_URL"
echo "  - Memory Check Interval: $MEM_CHECK_INTERVAL"
echo "  - Output Directory: $OUTPUT_DIR"
echo ""

# Warning
echo "⚠️  This test will run for $DURATION"
echo "   It's designed to detect memory leaks and resource exhaustion"
echo "   The test will run in the background and monitor:"
echo "   - Memory usage (heap, stack, goroutines)"
echo "   - Request error rates"
echo "   - Performance degradation over time"
echo ""
read -p "Start soak test? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# Build the soak test
echo "🔨 Building soak test binary..."
cd "$(dirname "$0")"
go build -o soak_test soak_test.go

echo "✅ Build complete"
echo ""

# Run the soak test
echo "🧪 Starting soak test..."
echo "   Duration: $DURATION"
echo "   You can monitor progress in the log file"
echo "   To stop early: Press Ctrl+C or send SIGTERM"
echo ""

# Build command
CMD="./soak_test -rps=$RPS -duration=$DURATION -url=$API_URL -output=$OUTPUT_DIR -mem-check=$MEM_CHECK_INTERVAL"

# Run with output to both console and log file
LOGFILE="$OUTPUT_DIR/soak_test_$(date +%Y%m%d_%H%M%S).log"
echo "📝 Logging to: $LOGFILE"
echo ""

# Suggest running in background for long tests
if [ "$DURATION" = "24h" ]; then
    echo "💡 Tip: For 24h test, consider running in background:"
    echo "   nohup $0 > $LOGFILE 2>&1 &"
    echo "   tail -f $LOGFILE  # to monitor"
    echo ""
fi

$CMD 2>&1 | tee "$LOGFILE"

EXIT_CODE=${PIPESTATUS[0]}

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Soak test completed successfully"
    echo ""
    echo "Results saved to: $OUTPUT_DIR"
    echo "Latest report: $(ls -t $OUTPUT_DIR/soak_test_report_*.md | head -1)"
    echo ""
    echo "📊 Review the memory timeline to check for leaks"
else
    echo "❌ Soak test failed with exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi
