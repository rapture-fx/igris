#!/bin/bash
# Setup script for Schlep-Engine Hybrid ML Pipeline

set -e

echo "=============================================="
echo "Schlep-Engine Hybrid ML Pipeline Setup"
echo "=============================================="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.9+"
    exit 1
fi
echo "✓ Python 3 found"

# Check Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed."
    echo "Install with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi
echo "✓ Rust found"

# Check Docker (optional)
if command -v docker &> /dev/null; then
    echo "✓ Docker found"
    DOCKER_AVAILABLE=true
else
    echo "⚠️  Docker not found (optional for monitoring stack)"
    DOCKER_AVAILABLE=false
fi

# Install Python dependencies
echo -e "\n${YELLOW}Installing Python dependencies...${NC}"
pip install -r requirements-hybrid-ml.txt

# Build Rust kernels
echo -e "\n${YELLOW}Building Rust compute kernels...${NC}"
cd apps/api/rust_compute_kernels
cargo build --release --features "fast-csv,parallel-agg,string-ops"
echo -e "${GREEN}✓ Rust kernels built successfully${NC}"
cd ../../..

# Copy Rust library to Python path (platform-specific)
echo -e "\n${YELLOW}Setting up Rust-Python bridge...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LIB_EXT="dylib"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    LIB_EXT="so"
else
    # Windows
    LIB_EXT="dll"
fi

RUST_LIB="apps/api/rust_compute_kernels/target/release/libschlep_compute_kernels.${LIB_EXT}"
if [ -f "$RUST_LIB" ]; then
    echo "✓ Found Rust library: $RUST_LIB"
else
    echo "⚠️  Warning: Rust library not found at $RUST_LIB"
fi

# Setup NATS JetStream (if Docker available)
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo -e "\n${YELLOW}Starting NATS JetStream...${NC}"
    docker run -d --name nats-jetstream \
        -p 4222:4222 \
        -p 8222:8222 \
        nats:latest -js
    echo -e "${GREEN}✓ NATS JetStream started on ports 4222 (client) and 8222 (monitoring)${NC}"
else
    echo -e "\n⚠️  Skipping NATS setup (Docker not available)"
    echo "To install NATS manually, visit: https://docs.nats.io/running-a-nats-service/introduction/installation"
fi

# Setup monitoring stack (if Docker available)
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo -e "\n${YELLOW}Starting monitoring stack (Prometheus + Grafana)...${NC}"

    # Start Prometheus
    docker run -d --name prometheus \
        -p 9090:9090 \
        -v $(pwd)/infrastructure/monitoring/prometheus:/etc/prometheus \
        prom/prometheus:latest \
        --config.file=/etc/prometheus/hybrid_ml_metrics.yml

    # Start Grafana
    docker run -d --name grafana \
        -p 3000:3000 \
        -v $(pwd)/infrastructure/monitoring/grafana:/etc/grafana/provisioning \
        grafana/grafana:latest

    echo -e "${GREEN}✓ Monitoring stack started${NC}"
    echo "  - Prometheus: http://localhost:9090"
    echo "  - Grafana: http://localhost:3000 (admin/admin)"
else
    echo -e "\n⚠️  Skipping monitoring setup (Docker not available)"
fi

# Create .env file if it doesn't exist
if [ ! -f "apps/api/.env" ]; then
    echo -e "\n${YELLOW}Creating .env configuration...${NC}"
    cat > apps/api/.env << EOF
# Hybrid ML Pipeline Configuration

# Streaming
ENABLE_STREAM_PRODUCERS=true
NATS_URL=nats://localhost:4222
ZEROMQ_FALLBACK=true

# ML Frameworks
ML_FRAMEWORK_ENFORCEMENT_ENABLED=true
SUPPORTED_FRAMEWORKS=sklearn,tensorflow,pytorch,huggingface

# Memory
RUST_KERNEL_MAX_MEMORY_GB=10
ARROW_IPC_BUFFER_SIZE_MB=100

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
GRAFANA_ENABLED=true
GRAFANA_PORT=3000

# FastAPI
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
EOF
    echo -e "${GREEN}✓ Created .env configuration${NC}"
fi

# Final instructions
echo -e "\n${GREEN}=============================================="
echo "Setup Complete!"
echo "==============================================${NC}"

echo -e "\nTo start the hybrid ML pipeline:"
echo "  1. Start FastAPI backend:"
echo "     cd apps/api && uvicorn app.main:app --reload"
echo ""
echo "  2. Access endpoints:"
echo "     - API: http://localhost:8000"
echo "     - Docs: http://localhost:8000/docs"
echo "     - Metrics: http://localhost:8000/metrics"

if [ "$DOCKER_AVAILABLE" = true ]; then
    echo ""
    echo "  3. Access monitoring:"
    echo "     - Prometheus: http://localhost:9090"
    echo "     - Grafana: http://localhost:3000"
    echo "     - NATS: http://localhost:8222"
fi

echo -e "\n📚 See HYBRID_ML_PIPELINE_GUIDE.md for detailed usage"
echo -e "📝 Example code: examples/hybrid_ml_pipeline_usage.py\n"
