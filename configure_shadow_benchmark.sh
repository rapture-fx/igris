#!/bin/bash
# Schlep-Engine Shadow Benchmark Configuration Script
# This script configures the environment for live-provider shadow benchmarking

set -e

echo "=========================================="
echo "Schlep-Engine Shadow Benchmark Setup"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✓ Created backup of .env file"

# Check for API keys
echo ""
echo "Checking for API keys..."
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY not set in environment"
    echo "   Please set it with: export OPENAI_API_KEY=sk-..."
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  ANTHROPIC_API_KEY not set in environment"
    echo "   Please set it with: export ANTHROPIC_API_KEY=sk-ant-..."
fi

# Update .env file
echo ""
echo "Updating .env configuration..."

# Update PROVIDER_MODE to real
sed -i.bak 's/^PROVIDER_MODE=.*/PROVIDER_MODE=real/' .env
echo "✓ Set PROVIDER_MODE=real"

# Update OPTIMIZER_MODE to shadow
sed -i.bak 's/^OPTIMIZER_MODE=.*/OPTIMIZER_MODE=shadow/' .env
echo "✓ Set OPTIMIZER_MODE=shadow"

# Update OPTIMIZER_SAMPLE_RATE to 0.1
sed -i.bak 's/^OPTIMIZER_SAMPLE_RATE=.*/OPTIMIZER_SAMPLE_RATE=0.1/' .env
echo "✓ Set OPTIMIZER_SAMPLE_RATE=0.1 (10%)"

# Enable tracing for Jaeger
sed -i.bak 's/^TRACING_ENABLED=.*/TRACING_ENABLED=true/' .env
echo "✓ Set TRACING_ENABLED=true"

# Update API keys if set in environment
if [ -n "$OPENAI_API_KEY" ]; then
    sed -i.bak "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_API_KEY|" .env
    echo "✓ Set OPENAI_API_KEY from environment"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    sed -i.bak "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|" .env
    echo "✓ Set ANTHROPIC_API_KEY from environment"
fi

echo ""
echo "=========================================="
echo "Configuration Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Ensure Docker is running"
echo "2. Start observability stack:"
echo "   cd infra/vps && docker-compose -f docker-compose.monitoring.yml up -d"
echo "3. Start Schlep-Engine API"
echo "4. Run benchmark:"
echo "   python3 benchmarks/shadow_benchmark.py --requests 1000 --output benchmarks/results/shadow_benchmark_v2.json --concurrent --workers 10"
echo ""
echo "Access services:"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3002 (admin/admin123)"
echo "  - Jaeger UI: http://localhost:16686"
echo "  - AlertManager: http://localhost:9093"
echo ""
