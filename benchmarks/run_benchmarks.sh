#!/bin/bash
set -e

echo "🚀 Schlep-Engine Hybrid Architecture Benchmark Suite"
echo "===================================================="
echo ""

# Configuration
CONCURRENCY=${CONCURRENCY:-100}
DURATION=${DURATION:-10}
OUTPUT_DIR="benchmarks/results"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if services are running
echo "⏳ Checking if services are running..."
if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "❌ Go Gateway not running on localhost:8080"
    echo "   Please start services first:"
    echo "   docker-compose -f PROTOTYPE_HYBRID_ARCHITECTURE.yml up"
    exit 1
fi

echo "✅ Services are ready"
echo ""

# Build benchmark suite
echo "🔨 Building benchmark suite..."
cd benchmarks
go mod download
go build -o bin/load_test load_test.go
go build -o bin/generate_report generate_report.go
cd ..

echo "✅ Build complete"
echo ""

# Run benchmarks
echo "📊 Running benchmarks..."
echo "   Concurrency: $CONCURRENCY"
echo "   Duration: ${DURATION}s per endpoint"
echo ""

./benchmarks/bin/load_test \
    -c "$CONCURRENCY" \
    -d "$DURATION" \
    -o "$OUTPUT_DIR/results.json"

echo ""
echo "✅ Benchmarks complete"
echo ""

# Generate report
echo "📝 Generating report..."
./benchmarks/bin/generate_report \
    -i "$OUTPUT_DIR/results.json" \
    -o "$OUTPUT_DIR/REPORT.md"

echo "✅ Report generated"
echo ""

# Display summary
echo "📊 Benchmark Summary"
echo "===================="
echo ""

if command -v jq &> /dev/null; then
    # Pretty print key metrics if jq is available
    echo "Key Metrics:"
    jq -r '
        .endpoints | to_entries[] |
        "  \(.key): P99=\(.value.latency.p99_ms)ms, RPS=\(.value.throughput.requests_per_second | floor)"
    ' "$OUTPUT_DIR/results.json"

    echo ""
    echo "Validation Tests:"
    jq -r '
        "  Memory Leak: \(if .validation_results.memory_leak_test.passed then "✅ PASSED" else "❌ FAILED" end)",
        "  gRPC Recovery: \(if .validation_results.grpc_recovery_test.passed then "✅ PASSED" else "❌ FAILED" end)",
        "  Horizontal Scaling: \(if .validation_results.horizontal_scaling.passed then "✅ PASSED" else "❌ FAILED" end)"
    ' "$OUTPUT_DIR/results.json"
else
    echo "Install 'jq' for formatted output"
    echo "Results saved to: $OUTPUT_DIR/results.json"
fi

echo ""
echo "📁 Files Generated:"
echo "   - $OUTPUT_DIR/results.json (machine-readable)"
echo "   - $OUTPUT_DIR/REPORT.md (human-readable)"
echo ""
echo "✅ Benchmark suite completed successfully!"
