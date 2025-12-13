#!/bin/bash

# Kubernetes Staging Deployment Script for Schlep-engine
# This script deploys the staging environment to Kubernetes

set -e

echo "🚀 Deploying Schlep-engine to Kubernetes Staging Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
NAMESPACE="schlep-staging"
KUSTOMIZE_DIR="kubernetes/staging"
DOCKER_REGISTRY="your-registry.com"
IMAGE_TAG="staging"

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if ! command -v kubectl >/dev/null 2>&1; then
        missing_deps+=("kubectl")
    fi
    
    if ! command -v kustomize >/dev/null 2>&1; then
        missing_deps+=("kustomize")
    fi
    
    if ! command -v docker >/dev/null 2>&1; then
        missing_deps+=("docker")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_status "Please install the missing dependencies and run this script again."
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubectl configuration."
        exit 1
    fi
    
    print_success "All prerequisites are available"
}

# Function to build and push Docker images
build_and_push_images() {
    print_status "Building and pushing Docker images..."
    
    # Build backend image
    print_status "Building backend image..."
    docker build -t $DOCKER_REGISTRY/igris-inertial/backend:$IMAGE_TAG .
    
    # Push backend image
    print_status "Pushing backend image..."
    docker push $DOCKER_REGISTRY/igris-inertial/backend:$IMAGE_TAG
    
    print_success "Docker images built and pushed successfully"
}

# Function to create namespace
create_namespace() {
    print_status "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
        print_status "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace $NAMESPACE
        print_success "Namespace $NAMESPACE created"
    fi
}

# Function to apply Kubernetes resources
apply_k8s_resources() {
    print_status "Applying Kubernetes resources..."
    
    # Apply resources using kustomize
    print_status "Applying resources with kustomize..."
    kustomize build $KUSTOMIZE_DIR | kubectl apply -f -
    
    print_success "Kubernetes resources applied successfully"
}

# Function to wait for deployments
wait_for_deployments() {
    print_status "Waiting for deployments to be ready..."
    
    local deployments=(
        "staging-backend"
        "staging-celery-worker"
        "staging-celery-beat"
        "staging-postgresql"
        "staging-redis"
        "staging-prometheus"
        "staging-grafana"
        "staging-alertmanager"
    )
    
    for deployment in "${deployments[@]}"; do
        print_status "Waiting for deployment: $deployment"
        kubectl rollout status deployment/$deployment -n $NAMESPACE --timeout=300s
        print_success "Deployment $deployment is ready"
    done
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgresql -n $NAMESPACE --timeout=300s
    
    # Run migrations using a job
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: staging-migrations
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: migrations
        image: $DOCKER_REGISTRY/igris-inertial/backend:$IMAGE_TAG
        command: ["alembic", "upgrade", "head"]
        env:
        - name: STAGING_DB_HOST
          value: "staging-postgresql"
        - name: STAGING_DB_PORT
          value: "5432"
        - name: STAGING_DB_NAME
          value: "igris_overture_staging"
        - name: STAGING_DB_USER
          value: "schlep_staging"
        - name: STAGING_DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: schlep-staging-secrets
              key: STAGING_DB_PASSWORD
      restartPolicy: Never
  backoffLimit: 3
EOF
    
    # Wait for migration job to complete
    print_status "Waiting for migrations to complete..."
    kubectl wait --for=condition=complete job/staging-migrations -n $NAMESPACE --timeout=600s
    
    # Clean up migration job
    kubectl delete job staging-migrations -n $NAMESPACE
    
    print_success "Database migrations completed successfully"
}

# Function to perform health checks
perform_health_checks() {
    print_status "Performing health checks..."
    
    # Get service URLs
    local backend_url=$(kubectl get service staging-backend -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [ -z "$backend_url" ]; then
        backend_url="localhost:8000"
    fi
    
    # Health check endpoints
    local health_endpoints=(
        "/api/v1/health/simple"
        "/api/v1/health/database"
        "/api/v1/health/redis"
        "/api/v1/health/storage"
        "/api/v1/health/celery"
    )
    
    for endpoint in "${health_endpoints[@]}"; do
        print_status "Checking health endpoint: $endpoint"
        if curl -f "http://$backend_url$endpoint" >/dev/null 2>&1; then
            print_success "Health check passed: $endpoint"
        else
            print_error "Health check failed: $endpoint"
            return 1
        fi
    done
    
    print_success "All health checks passed"
}

# Function to display deployment information
display_deployment_info() {
    echo ""
    echo "🎉 Kubernetes Staging Deployment Complete!"
    echo ""
    echo "📋 Deployment Information:"
    echo "  Namespace: $NAMESPACE"
    echo "  Image Tag: $IMAGE_TAG"
    echo "  Registry: $DOCKER_REGISTRY"
    echo ""
    echo "🌐 Service URLs:"
    echo "  - Backend API: http://staging.igris-inertial.com"
    echo "  - API Documentation: http://staging.igris-inertial.com/docs"
    echo "  - Health Check: http://staging.igris-inertial.com/api/v1/health"
    echo "  - Metrics: http://staging.igris-inertial.com/api/v1/metrics"
    echo "  - Prometheus: http://monitoring.staging.igris-inertial.com/prometheus"
    echo "  - Grafana: http://monitoring.staging.igris-inertial.com/grafana (admin/admin)"
    echo "  - AlertManager: http://monitoring.staging.igris-inertial.com/alertmanager"
    echo ""
    echo "🔧 Useful Commands:"
    echo "  - View pods: kubectl get pods -n $NAMESPACE"
    echo "  - View services: kubectl get services -n $NAMESPACE"
    echo "  - View logs: kubectl logs -f deployment/staging-backend -n $NAMESPACE"
    echo "  - Port forward: kubectl port-forward service/staging-backend 8000:8000 -n $NAMESPACE"
    echo "  - Delete deployment: kubectl delete namespace $NAMESPACE"
    echo ""
    echo "📊 Monitoring:"
    echo "  - Prometheus: http://monitoring.staging.igris-inertial.com/prometheus"
    echo "  - Grafana: http://monitoring.staging.igris-inertial.com/grafana"
    echo "  - AlertManager: http://monitoring.staging.igris-inertial.com/alertmanager"
    echo ""
}

# Function to cleanup on failure
cleanup_on_failure() {
    print_error "Deployment failed. Cleaning up..."
    
    # Delete namespace to clean up all resources
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    
    print_warning "Cleanup completed. Please check the logs and try again."
}

# Main deployment function
main() {
    echo "🚀 Starting Kubernetes Staging Deployment..."
    echo ""
    
    # Set up error handling
    trap cleanup_on_failure ERR
    
    # Check prerequisites
    check_prerequisites
    
    # Create namespace
    create_namespace
    
    # Build and push images
    build_and_push_images
    
    # Apply Kubernetes resources
    apply_k8s_resources
    
    # Wait for deployments
    wait_for_deployments
    
    # Run database migrations
    run_migrations
    
    # Perform health checks
    perform_health_checks
    
    # Display deployment information
    display_deployment_info
    
    # Remove error handler
    trap - ERR
    
    print_success "Kubernetes staging deployment completed successfully!"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -n, --namespace     Kubernetes namespace (default: schlep-staging)"
    echo "  -t, --tag           Docker image tag (default: staging)"
    echo "  -r, --registry      Docker registry (default: your-registry.com)"
    echo "  --skip-build        Skip building and pushing Docker images"
    echo "  --skip-migrations   Skip running database migrations"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Deploy with default settings"
    echo "  $0 -n my-staging -t v1.0.0           # Deploy with custom namespace and tag"
    echo "  $0 --skip-build --skip-migrations    # Deploy without building images or migrations"
}

# Parse command line arguments
SKIP_BUILD=false
SKIP_MIGRATIONS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function
main "$@" 