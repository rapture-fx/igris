#!/bin/bash
# Verify that the system is ready for shadow benchmarking

echo "=========================================="
echo "Shadow Benchmark Readiness Check"
echo "=========================================="
echo ""

READY=true

# Check 1: Docker
echo "🐋 Checking Docker..."
if docker ps >/dev/null 2>&1; then
    echo "   ✅ Docker is running"
else
    echo "   ❌ Docker is not running or not accessible"
    echo "      Please start Docker Desktop"
    READY=false
fi
echo ""

# Check 2: Docker Compose Files
echo "📁 Checking configuration files..."
if [ -f "infra/vps/docker-compose.monitoring.yml" ]; then
    echo "   ✅ Monitoring compose file exists"
else
    echo "   ❌ Monitoring compose file not found"
    READY=false
fi

if [ -f "infra/vps/observability/prometheus.yml" ]; then
    echo "   ✅ Prometheus config exists"
else
    echo "   ❌ Prometheus config not found"
    READY=false
fi
echo ""

# Check 3: Environment Variables
echo "🔑 Checking API keys..."
if [ -n "$OPENAI_API_KEY" ]; then
    echo "   ✅ OPENAI_API_KEY is set (${OPENAI_API_KEY:0:10}...)"
else
    echo "   ⚠️  OPENAI_API_KEY not set in environment"
    echo "      Run: export OPENAI_API_KEY=sk-..."
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "   ✅ ANTHROPIC_API_KEY is set (${ANTHROPIC_API_KEY:0:10}...)"
else
    echo "   ⚠️  ANTHROPIC_API_KEY not set in environment"
    echo "      Run: export ANTHROPIC_API_KEY=sk-ant-..."
fi
echo ""

# Check 4: .env file
echo "⚙️  Checking .env configuration..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"

    PROVIDER_MODE=$(grep "^PROVIDER_MODE=" .env | cut -d'=' -f2)
    OPTIMIZER_MODE=$(grep "^OPTIMIZER_MODE=" .env | cut -d'=' -f2)
    SAMPLE_RATE=$(grep "^OPTIMIZER_SAMPLE_RATE=" .env | cut -d'=' -f2)

    echo "   Current settings:"
    echo "     - PROVIDER_MODE: $PROVIDER_MODE"
    echo "     - OPTIMIZER_MODE: $OPTIMIZER_MODE"
    echo "     - OPTIMIZER_SAMPLE_RATE: $SAMPLE_RATE"

    if [ "$PROVIDER_MODE" != "real" ]; then
        echo "   ⚠️  PROVIDER_MODE should be 'real' for live testing"
        echo "      Run ./configure_shadow_benchmark.sh to update"
    fi

    if [ "$OPTIMIZER_MODE" != "shadow" ]; then
        echo "   ⚠️  OPTIMIZER_MODE should be 'shadow' for comparison"
        echo "      Run ./configure_shadow_benchmark.sh to update"
    fi

    if [ "$SAMPLE_RATE" != "0.1" ]; then
        echo "   ⚠️  OPTIMIZER_SAMPLE_RATE should be 0.1 (10%)"
        echo "      Run ./configure_shadow_benchmark.sh to update"
    fi
else
    echo "   ❌ .env file not found"
    READY=false
fi
echo ""

# Check 5: Docker Network
echo "🌐 Checking Docker network..."
if docker network ls | grep -q schlep-engine; then
    echo "   ✅ Docker network 'schlep-engine' exists"
else
    echo "   ⚠️  Docker network 'schlep-engine' not found"
    echo "      Will be created automatically"
fi
echo ""

# Check 6: Observability Services
echo "📊 Checking observability services..."
cd infra/vps 2>/dev/null

if docker-compose -f docker-compose.monitoring.yml ps 2>/dev/null | grep -q "Up"; then
    echo "   ✅ Some monitoring services are running"

    # Check individual services
    for service in prometheus grafana-metrics jaeger alertmanager; do
        if docker-compose -f docker-compose.monitoring.yml ps $service 2>/dev/null | grep -q "Up"; then
            echo "      ✅ $service is running"
        else
            echo "      ❌ $service is not running"
            echo "         Run: docker-compose -f docker-compose.monitoring.yml up -d"
        fi
    done
else
    echo "   ⚠️  Monitoring services are not running"
    echo "      Run: cd infra/vps && docker-compose -f docker-compose.monitoring.yml up -d"
fi

cd - >/dev/null 2>&1
echo ""

# Check 7: Schlep-Engine API
echo "🚀 Checking Schlep-Engine API..."
if curl -s http://localhost:8081/v1/health >/dev/null 2>&1; then
    echo "   ✅ API is running and healthy"
    API_RESPONSE=$(curl -s http://localhost:8081/v1/health)
    echo "      Response: $API_RESPONSE"
else
    echo "   ❌ API is not accessible at http://localhost:8081"
    echo "      Start it with: go run cmd/server/main.go"
    READY=false
fi
echo ""

# Check 8: Python and Dependencies
echo "🐍 Checking Python environment..."
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version)
    echo "   ✅ Python 3 is installed: $PYTHON_VERSION"

    if python3 -c "import requests" 2>/dev/null; then
        echo "   ✅ requests library is available"
    else
        echo "   ⚠️  requests library not found"
        echo "      Install with: pip3 install requests"
    fi
else
    echo "   ❌ Python 3 is not installed"
    READY=false
fi
echo ""

# Check 9: Benchmark Scripts
echo "📝 Checking benchmark scripts..."
if [ -f "benchmarks/shadow_benchmark.py" ]; then
    echo "   ✅ Shadow benchmark script exists"
else
    echo "   ❌ Shadow benchmark script not found"
    READY=false
fi

if [ -f "benchmarks/generate_report.py" ]; then
    echo "   ✅ Report generator script exists"
else
    echo "   ❌ Report generator script not found"
    READY=false
fi

# Create results directory if it doesn't exist
if [ ! -d "benchmarks/results" ]; then
    mkdir -p benchmarks/results
    echo "   ✅ Created benchmarks/results directory"
fi
echo ""

# Summary
echo "=========================================="
if [ "$READY" = true ]; then
    echo "✅ SYSTEM READY FOR BENCHMARKING!"
    echo "=========================================="
    echo ""
    echo "Next step: Run the benchmark"
    echo ""
    echo "  python3 benchmarks/shadow_benchmark.py \\"
    echo "    --requests 1000 \\"
    echo "    --output benchmarks/results/shadow_benchmark_v2.json \\"
    echo "    --concurrent \\"
    echo "    --workers 10"
    echo ""
else
    echo "⚠️  SYSTEM NOT READY"
    echo "=========================================="
    echo ""
    echo "Please fix the issues above before running the benchmark."
    echo ""
    echo "Quick fixes:"
    echo "  1. Start Docker Desktop"
    echo "  2. Run: ./configure_shadow_benchmark.sh"
    echo "  3. Run: cd infra/vps && docker-compose -f docker-compose.monitoring.yml up -d"
    echo "  4. Run: go run cmd/server/main.go"
    echo ""
fi
