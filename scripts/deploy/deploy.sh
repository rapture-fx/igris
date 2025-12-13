#!/bin/bash

# Schlep-engine Deployment Script
# This script automates the deployment of the Schlep-engine application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ENV=${1:-"staging"}
KUBECONFIG=${KUBECONFIG:-"$HOME/.kube/config"}

# Environment-specific configurations
case $DEPLOYMENT_ENV in
  "staging")
    NAMESPACE="igris-inertial-staging"
    DOMAIN="staging.igris-inertial.com"
    API_DOMAIN="api-staging.igris-inertial.com"
    REPLICAS_BACKEND=2
    REPLICAS_FRONTEND=1
    ;;
  "production")
    NAMESPACE="igris-inertial"
    DOMAIN="igris-inertial.com"
    API_DOMAIN="api.igris-inertial.com"
    REPLICAS_BACKEND=3
    REPLICAS_FRONTEND=2
    ;;
  *)
    echo -e "${RED}Error: Invalid environment. Use 'staging' or 'production'${NC}"
    exit 1
    ;;
esac

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        error "docker is not installed"
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "helm is not installed"
        exit 1
    fi
    
    # Check if required environment variables are set
    if [[ -z "$GITHUB_TOKEN" ]]; then
        error "GITHUB_TOKEN environment variable is not set"
        exit 1
    fi
    
    if [[ -z "$GCS_CREDENTIALS" ]]; then
        error "GCS_CREDENTIALS environment variable is not set"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build backend image
    log "Building backend image..."
    docker build -f packages/backend/Dockerfile -t ghcr.io/igris-inertial/backend:latest packages/backend/
    docker tag ghcr.io/igris-inertial/backend:latest ghcr.io/igris-inertial/backend:$DEPLOYMENT_ENV
    
    # Build frontend image
    log "Building frontend image..."
    docker build -f packages/frontend/Dockerfile -t ghcr.io/igris-inertial/frontend:latest packages/frontend/
    docker tag ghcr.io/igris-inertial/frontend:latest ghcr.io/igris-inertial/frontend:$DEPLOYMENT_ENV
    
    success "Docker images built successfully"
}

# Push Docker images
push_images() {
    log "Pushing Docker images to registry..."
    
    # Login to GitHub Container Registry
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin
    
    # Push backend image
    log "Pushing backend image..."
    docker push ghcr.io/igris-inertial/backend:latest
    docker push ghcr.io/igris-inertial/backend:$DEPLOYMENT_ENV
    
    # Push frontend image
    log "Pushing frontend image..."
    docker push ghcr.io/igris-inertial/frontend:latest
    docker push ghcr.io/igris-inertial/frontend:$DEPLOYMENT_ENV
    
    success "Docker images pushed successfully"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run backend tests
    log "Running backend tests..."
    cd packages/backend
    python -m pytest tests/ -v --cov=app --cov-report=xml
    
    # Run frontend tests
    log "Running frontend tests..."
    cd ../frontend
    pnpm test --coverage --watchAll=false
    
    # Run integration tests
    log "Running integration tests..."
    cd ../backend
    python -m pytest tests/integration/ -v
    
    success "All tests passed"
}

# Create Kubernetes namespace
create_namespace() {
    log "Creating Kubernetes namespace: $NAMESPACE"
    
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    success "Namespace created/updated"
}

# Create secrets
create_secrets() {
    log "Creating Kubernetes secrets..."
    
    # Generate secrets if not provided
    if [[ -z "$POSTGRES_PASSWORD" ]]; then
        POSTGRES_PASSWORD=$(openssl rand -base64 32)
    fi
    
    if [[ -z "$SECRET_KEY" ]]; then
        SECRET_KEY=$(openssl rand -base64 64)
    fi
    
    if [[ -z "$JWT_SECRET" ]]; then
        JWT_SECRET=$(openssl rand -base64 64)
    fi
    
    # Create secrets
    kubectl create secret generic igris-inertial-secrets \
        --namespace=$NAMESPACE \
        --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        --from-literal=SECRET_KEY="$SECRET_KEY" \
        --from-literal=JWT_SECRET="$JWT_SECRET" \
        --from-literal=API_KEY_SECRET="$(openssl rand -base64 64)" \
        --from-literal=GCS_CREDENTIALS="$GCS_CREDENTIALS" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    success "Secrets created/updated"
}

# Deploy database
deploy_database() {
    log "Deploying database..."
    
    # Deploy PostgreSQL
    kubectl apply -f infrastructure/kubernetes/postgres.yaml -n $NAMESPACE
    
    # Wait for PostgreSQL to be ready
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    
    # Run database migrations
    log "Running database migrations..."
    kubectl apply -f infrastructure/kubernetes/migrations-job.yaml -n $NAMESPACE
    
    success "Database deployed successfully"
}

# Deploy Redis
deploy_redis() {
    log "Deploying Redis..."
    
    kubectl apply -f infrastructure/kubernetes/redis.yaml -n $NAMESPACE
    
    # Wait for Redis to be ready
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s
    
    success "Redis deployed successfully"
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Update deployment configuration
    sed -i.bak "s/REPLICAS_BACKEND/$REPLICAS_BACKEND/g" infrastructure/kubernetes/deployment.yaml
    sed -i.bak "s/REPLICAS_FRONTEND/$REPLICAS_FRONTEND/g" infrastructure/kubernetes/deployment.yaml
    sed -i.bak "s/DOMAIN/$DOMAIN/g" infrastructure/kubernetes/deployment.yaml
    sed -i.bak "s/API_DOMAIN/$API_DOMAIN/g" infrastructure/kubernetes/deployment.yaml
    sed -i.bak "s/NAMESPACE/$NAMESPACE/g" infrastructure/kubernetes/deployment.yaml
    
    # Apply deployment
    kubectl apply -f infrastructure/kubernetes/deployment.yaml -n $NAMESPACE
    
    # Wait for deployments to be ready
    log "Waiting for backend deployment to be ready..."
    kubectl rollout status deployment/igris-inertial-backend -n $NAMESPACE --timeout=600s
    
    log "Waiting for frontend deployment to be ready..."
    kubectl rollout status deployment/igris-inertial-frontend -n $NAMESPACE --timeout=600s
    
    # Restore original file
    mv infrastructure/kubernetes/deployment.yaml.bak infrastructure/kubernetes/deployment.yaml
    
    success "Application deployed successfully"
}

# Deploy monitoring
deploy_monitoring() {
    log "Deploying monitoring stack..."
    
    # Deploy Prometheus
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace $NAMESPACE \
        --create-namespace \
        --set prometheus.prometheusSpec.retention=7d \
        --set grafana.enabled=true \
        --set grafana.adminPassword="$GRAFANA_PASSWORD"
    
    # Deploy custom monitoring
    kubectl apply -f infrastructure/monitoring/ -n $NAMESPACE
    
    success "Monitoring stack deployed successfully"
}

# Configure ingress
configure_ingress() {
    log "Configuring ingress..."
    
    # Install NGINX Ingress Controller if not exists
    if ! kubectl get namespace ingress-nginx &> /dev/null; then
        helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
        helm repo update
        
        helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
            --namespace ingress-nginx \
            --create-namespace \
            --set controller.replicaCount=2
    fi
    
    # Install cert-manager for SSL certificates
    if ! kubectl get namespace cert-manager &> /dev/null; then
        helm repo add jetstack https://charts.jetstack.io
        helm repo update
        
        helm upgrade --install cert-manager jetstack/cert-manager \
            --namespace cert-manager \
            --create-namespace \
            --set installCRDs=true
    fi
    
    # Apply ingress configuration
    kubectl apply -f infrastructure/kubernetes/ingress.yaml -n $NAMESPACE
    
    success "Ingress configured successfully"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for services to be ready
    sleep 30
    
    # Check backend health
    BACKEND_URL="https://$API_DOMAIN/health"
    log "Checking backend health at $BACKEND_URL"
    
    for i in {1..10}; do
        if curl -f -s "$BACKEND_URL" > /dev/null; then
            success "Backend health check passed"
            break
        else
            warning "Backend health check failed, attempt $i/10"
            sleep 10
        fi
        
        if [ $i -eq 10 ]; then
            error "Backend health check failed after 10 attempts"
            exit 1
        fi
    done
    
    # Check frontend health
    FRONTEND_URL="https://$DOMAIN"
    log "Checking frontend health at $FRONTEND_URL"
    
    for i in {1..10}; do
        if curl -f -s "$FRONTEND_URL" > /dev/null; then
            success "Frontend health check passed"
            break
        else
            warning "Frontend health check failed, attempt $i/10"
            sleep 10
        fi
        
        if [ $i -eq 10 ]; then
            error "Frontend health check failed after 10 attempts"
            exit 1
        fi
    done
    
    success "All health checks passed"
}

# Performance test
performance_test() {
    log "Running performance tests..."
    
    cd "$PROJECT_ROOT/packages/backend"
    
    # Run load tests
    python -m pytest tests/load_test.py -v --html=load-test-report.html
    
    success "Performance tests completed"
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Rollback backend
    kubectl rollout undo deployment/igris-inertial-backend -n $NAMESPACE
    
    # Rollback frontend
    kubectl rollout undo deployment/igris-inertial-frontend -n $NAMESPACE
    
    # Wait for rollback to complete
    kubectl rollout status deployment/igris-inertial-backend -n $NAMESPACE
    kubectl rollout status deployment/igris-inertial-frontend -n $NAMESPACE
    
    success "Rollback completed"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    
    # Remove temporary files
    rm -f infrastructure/kubernetes/deployment.yaml.bak
    
    # Log deployment information
    log "Deployment completed successfully!"
    log "Environment: $DEPLOYMENT_ENV"
    log "Namespace: $NAMESPACE"
    log "Frontend URL: https://$DOMAIN"
    log "API URL: https://$API_DOMAIN"
    log "Grafana URL: https://grafana.$DOMAIN"
}

# Main deployment function
main() {
    log "Starting deployment to $DEPLOYMENT_ENV environment"
    
    # Check if user wants to proceed
    if [[ "$DEPLOYMENT_ENV" == "production" ]]; then
        echo -e "${YELLOW}You are about to deploy to PRODUCTION. Are you sure? (y/N)${NC}"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Execute deployment steps
    check_prerequisites
    run_tests
    build_images
    push_images
    create_namespace
    create_secrets
    deploy_database
    deploy_redis
    deploy_application
    deploy_monitoring
    configure_ingress
    health_check
    performance_test
    cleanup
    
    success "Deployment to $DEPLOYMENT_ENV completed successfully!"
}

# Handle script interruption
trap 'error "Deployment interrupted. Rolling back..."; rollback; exit 1' INT TERM

# Execute main function
main "$@" 