#!/bin/bash

set -euo pipefail

# Production Deployment Script for Schlep-Engine
# Usage: ./scripts/deploy-production.sh

echo "🚀 Schlep-Engine Production Deployment"
echo "========================================"

# Environment validation
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy config/production.env.example to .env and fill in values"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Validate required environment variables
validate_env() {
    local var=$1
    local err_msg=${2:-"Environment variable $1 is required"}
    
    if [ -z "${!var}" ]; then
        echo "❌ Error: $err_msg"
        exit 1
    fi
}

echo "🔍 Validating environment variables..."
validate_env "JWT_SECRET"
validate_env "POSTGRES_PASSWORD" "PostgreSQL password is required"
validate_env "REDIS_PASSWORD" "Redis password is required"
validate_env "GRAFANA_PASSWORD" "Grafana password is required"

# Check if Docker and Docker Compose are available
check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Error: Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Error: Docker Compose is not installed"
        exit 1
    fi
    
    echo "✅ Dependencies found"
}

# Create necessary directories
create_directories() {
    echo "📁 Creating directories..."
    
    mkdir -p logs/ml
    mkdir -p models
    mkdir -p monitoring/prometheus
    mkdir -p monitoring/grafana/dashboards
    mkdir -p monitoring/grafana/datasources
    mkdir -p postgres
    mkdir -p redis
    mkdir -p nginx/ssl
    
    echo "✅ Directories created"
}

# Generate secure secrets if not present
generate_secrets() {
    echo "🔐 Checking for secure secrets..."
    
    if [ -z "${JWT_SECRET}" ] || [ "${JWT_SECRET}" = "your-secret-key-change-in-production" ]; then
        echo "⚠️  JWT_SECRET not set properly in .env"
        echo "Generating new JWT_SECRET..."
        
        NEW_JWT_SECRET=$(openssl rand -base64 64)
        sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=${NEW_JWT_SECRET}|g" .env
        echo "✅ New JWT_SECRET generated and saved"
        
        echo "🔑 JWT_SECRET: ${NEW_JWT_SECRET}"
        echo "Please save this securely!"
    fi
    
    if [ -z "${API_KEY_MASTER}" ] || [ "${API_KEY_MASTER}" = "your-api-key-change-in-production" ]; then
        echo "⚠️  API_KEY_MASTER not set properly in .env"
        echo "Generating new API_KEY_MASTER..."
        
        NEW_API_KEY=$(openssl rand -hex 32)
        sed -i.bak "s|API_KEY_MASTER=.*|API_KEY_MASTER=${NEW_API_KEY}|g" .env
        echo "✅ New API_KEY_MASTER generated and saved"
        
        echo "🔑 API_KEY_MASTER: ${NEW_API_KEY}"
        echo "Please save this securely!"
    fi
}

# Setup SSL certificates (self-signed for demo, replace with proper certs in production)
setup_ssl() {
    echo "🔐 Setting up SSL certificates..."
    
    if [ ! -f "nginx/ssl/server.crt" ] || [ ! -f "nginx/ssl/server.key" ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/server.key \
            -out nginx/ssl/server.crt \
            -subj "/C=US/ST=State/L=City/O=Schlep-Engine/CN=localhost"
        
        echo "⚠️  Generated self-signed certificates (for demo only)"
        echo "Replace with proper certificates in production"
    else
        echo "✅ SSL certificates already exist"
    fi
    
    chmod 600 nginx/ssl/server.key
}

# Deploy services
deploy_services() {
    echo "🚀 Deploying services..."
    
    # Stop existing services
    docker-compose -f docker-compose.production.yml --env-file .env down || true
    
    # Pull latest images
    echo "📥 Pulling images..."
    docker-compose -f docker-compose.production.yml --env-file .env pull
    
    # Build custom images
    echo "🔨 Building images..."
    docker-compose -f docker-compose.production.yml --env-file .env build
    
    # Start services
    echo "🚀 Starting services..."
    docker-compose -f docker-compose.production.yml --env-file .env up -d
    
    echo "✅ Services deployed"
}

# Wait for services to be healthy
wait_for_services() {
    echo "⏳ Waiting for services to be healthy..."
    
    # Wait for PostgreSQL
    echo "🗄️  Waiting for PostgreSQL..."
    until docker exec schlep_postgres_prod pg_isready -U schlep_user -d igris_overture_prod; do
        echo "PostgreSQL not ready yet..."
        sleep 2
    done
    echo "✅ PostgreSQL is ready"
    
    # Wait for Redis
    echo "💾 Waiting for Redis..."
    until docker exec schlep_redis_prod redis-cli ping; do
        echo "Redis not ready yet..."
        sleep 2
    done
    echo "✅ Redis is ready"
    
    # Wait for ML Service
    echo "🧠 Waiting for ML Service..."
    until docker exec schlep_ml_prod python -c "
import grpc
import ml_service_pb2
import ml_service_pb2_grpc
channel = grpc.insecure_channel('localhost:50051')
stub = ml_service_pb2_grpc.MLServiceStub(channel)
response = stub.HealthCheck(ml_service_pb2.HealthCheckRequest(), timeout=5)
print('ML Service ready')
    "; do
        echo "ML Service not ready yet..."
        sleep 3
    done
    echo "✅ ML Service is ready"
    
    # Wait for Go Gateway
    echo "🌉 Waiting for Go Gateway..."
    until curl -f http://localhost:8080/health > /dev/null 2>&1; do
        echo "Go Gateway not ready yet..."
        sleep 3
    done
    echo "✅ Go Gateway is ready"
}

# Run health checks
health_checks() {
    echo "🏥 Running health checks..."
    
    # Check Go Gateway
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Go Gateway: Healthy"
    else
        echo "❌ Go Gateway: Unhealthy"
        return 1
    fi
    
    # Check ML Service
    if docker exec schlep_ml_prod python -c "
import grpc
import ml_service_pb2
import ml_service_pb2_grpc
channel = grpc.insecure_channel('localhost:50051')
stub = ml_service_pb2_grpc.MLServiceStub(channel)
response = stub.HealthCheck(ml_service_pb2.HealthCheckRequest(), timeout=5)
print('healthy' in response.status.lower())
    " > /dev/null 2>&1; then
        echo "✅ ML Service: Healthy"
    else
        echo "❌ ML Service: Unhealthy"
        return 1
    fi
    
    # Check Prometheus
    if curl -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
        echo "✅ Prometheus: Healthy"
    else
        echo "❌ Prometheus: Unhealthy"
        return 1
    fi
    
    # Check Grafana
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Grafana: Healthy"
    else
        echo "❌ Grafana: Unhealthy"
        return 1
    fi
    
    echo "🎉 All services are healthy!"
}

# Show status
show_status() {
    echo ""
    echo "📊 Service Status:"
    echo "=================="
    docker-compose -f docker-compose.production.yml --env-file .env ps
    
    echo ""
    echo "📡 Service URLs:"
    echo "================"
    echo "• Go Gateway API:  http://localhost:8080"
    echo "• Prometheus:      http://localhost:9090"
    echo "• Grafana:         http://localhost:3001 (admin/${GRAFANA_PASSWORD})"
    echo "• Jaeger:          http://localhost:16686"
    
    echo ""
    echo "🧪 Test Commands:"
    echo "=================="
    echo "• Health check:   curl http://localhost:8080/health"
    echo "• ML Predict:     curl -X POST http://localhost:8080/ml/predict -H 'Content-Type: application/json' -d '{\"features\":[1,2,3,4,5],\"model_id\":\"default\"}'"
    
    echo ""
    echo "📚 Management Commands:"
    echo "======================"
    echo "• View logs:       docker-compose -f docker-compose.production.yml logs -f go-gateway"
    echo "• Stop services:  docker-compose -f docker-compose.production.yml down"
    echo "• Restart:        docker-compose -f docker-compose.production.yml restart go-gateway"
}

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    docker-compose -f docker-compose.production.yml down || true
    echo "✅ Cleanup complete"
}

# Set up error handling
trap cleanup ERR

# Main deployment flow
main() {
    check_dependencies
    create_directories
    generate_secrets
    setup_ssl
    deploy_services
    wait_for_services
    
    # Run health checks
    if health_checks; then
        show_status
        echo ""
        echo "🎉 Schlep-Engine deployed successfully!"
        echo ""
        echo "📋 Next Steps:"
        echo "1. Configure Grafana dashboards"
        echo "2. Set up alerting rules"
        echo "3. Configure external monitoring"
        echo "4. Test API endpoints"
        echo ""
        echo "🔐 Security Reminder:"
        echo "• Replace self-signed SSL certificates with proper ones"
        echo "• Schedule regular secret rotation"
        echo "• Set up proper backup procedures"
        echo "• Configure firewall rules"
    else
        echo ""
        echo "❌ Deployment failed - some services are unhealthy"
        echo "Check the logs with: docker-compose -f docker-compose.production.yml logs"
        exit 1
    fi
}

# Run main function
main
