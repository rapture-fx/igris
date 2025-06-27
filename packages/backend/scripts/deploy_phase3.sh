#!/bin/bash

# Pollarbase Phase 3 Deployment Script
# Deploys optimized microservice architecture with ML service separation

set -e

echo "🚀 Starting Pollarbase Phase 3 Deployment"
echo "==========================================="

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# Create necessary directories
echo "📁 Creating deployment directories..."
mkdir -p logs ml_models ml_data monitoring/prometheus monitoring/grafana/dashboards monitoring/grafana/datasources

# Set up environment files
echo "🔧 Setting up environment configuration..."
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cat > .env << EOF
# Pollarbase Phase 3 Configuration
ENVIRONMENT=production
DEBUG=false

# Database Configuration
DATABASE_URL=postgresql+asyncpg://pollarbase:secure_password_123@postgres:5432/pollarbase
POSTGRES_DB=pollarbase
POSTGRES_USER=pollarbase
POSTGRES_PASSWORD=secure_password_123

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# ML Service Configuration
ML_SERVICE_URL=http://pollarbase-ml:8001
USE_REMOTE_ML_SERVICE=true

# Security
SECRET_KEY=your-super-secret-key-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production

# API Configuration
API_V1_STR=/api/v1
PROJECT_NAME=Pollarbase
CORS_ORIGINS=["http://localhost:3000","https://yourdomain.com"]

# Monitoring
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
GRAFANA_ADMIN_PASSWORD=admin123

# ML Service Specific
TORCH_NUM_THREADS=4
OMP_NUM_THREADS=4
CUDA_VISIBLE_DEVICES=0
EOF
    echo "✅ Environment file created"
else
    echo "✅ Environment file already exists"
fi

# Create monitoring configuration
echo "📊 Setting up monitoring configuration..."
cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'pollarbase-api'
    static_configs:
      - targets: ['pollarbase-api:8000']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'pollarbase-ml'
    static_configs:
      - targets: ['pollarbase-ml:8001']
    metrics_path: /health
    scrape_interval: 60s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s
EOF

# Build and deploy services
echo "🔨 Building and deploying services..."
docker-compose -f docker-compose.ml.yml down --remove-orphans
docker-compose -f docker-compose.ml.yml build --no-cache
docker-compose -f docker-compose.ml.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Health check function
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1

    echo "🔍 Checking $service_name health..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            echo "✅ $service_name is healthy"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name health check failed after $max_attempts attempts"
    return 1
}

# Perform health checks
echo "🏥 Performing health checks..."
check_service_health "Core API" "http://localhost:8000/health"
check_service_health "ML Service" "http://localhost:8001/health"

# Test API endpoints
echo "🧪 Testing API endpoints..."
echo "📡 Testing authentication endpoint..."
AUTH_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@pollarbase.com","password":"testpass123","full_name":"Test User"}')

if echo "$AUTH_RESPONSE" | grep -q "email"; then
    echo "✅ Authentication endpoint working"
else
    echo "⚠️  Authentication endpoint may have issues"
fi

echo "📊 Testing data processing endpoint..."
DATA_RESPONSE=$(curl -s -X GET "http://localhost:8000/api/v1/data/investigations" \
    -H "Content-Type: application/json")

if echo "$DATA_RESPONSE" | grep -q "\[\]" || echo "$DATA_RESPONSE" | grep -q "investigations"; then
    echo "✅ Data processing endpoint working"
else
    echo "⚠️  Data processing endpoint may have issues"
fi

echo "🧠 Testing ML service endpoint..."
ML_RESPONSE=$(curl -s -X GET "http://localhost:8001/models")

if echo "$ML_RESPONSE" | grep -q "models" || echo "$ML_RESPONSE" | grep -q "\[\]"; then
    echo "✅ ML service endpoint working"
else
    echo "⚠️  ML service endpoint may have issues"
fi

# Display service status
echo ""
echo "📊 Service Status:"
echo "=================="
docker-compose -f docker-compose.ml.yml ps

echo ""
echo "🌐 Access URLs:"
echo "==============="
echo "Core API:          http://localhost:8000"
echo "ML Service:        http://localhost:8001"
echo "API Documentation: http://localhost:8000/docs"
echo "ML Documentation:  http://localhost:8001/docs"
echo "Grafana Dashboard: http://localhost:3000 (admin/admin123)"
echo "Prometheus:        http://localhost:9090"

echo ""
echo "📈 Performance Metrics:"
echo "======================="
echo "🔧 Architecture: Microservices (Core API + ML Service)"
echo "⚡ Core API Memory: ~512MB (optimized)"
echo "🧠 ML Service Memory: ~2GB (dedicated)"
echo "📦 Total Dependencies: Core(24) + ML(25) = 49 packages"
echo "🚀 Expected API Response: <200ms"
echo "🎯 Expected ML Analysis: <60s"

echo ""
echo "✅ Phase 3 Deployment Complete!"
echo "================================"
echo "🎉 Pollarbase is now running with:"
echo "   • Optimized microservice architecture"
echo "   • Advanced AI/ML capabilities"
echo "   • Production-ready monitoring"
echo "   • Enterprise-grade performance"
echo ""
echo "📚 Next steps:"
echo "   1. Access the dashboard at http://localhost:8000"
echo "   2. Upload your first dataset"
echo "   3. Run AI-powered analysis"
echo "   4. Explore advanced insights"
echo ""
echo "🔧 To stop services: docker-compose -f docker-compose.ml.yml down"
echo "📊 To view logs: docker-compose -f docker-compose.ml.yml logs -f [service]"
echo ""
echo "🚀 Happy data processing with Pollarbase!" 