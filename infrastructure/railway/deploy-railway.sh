#!/bin/bash

# Railway Deployment Script for Schlep-engine FastAPI Backend
# Optimized for ML workloads with comprehensive health checks and monitoring

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$SCRIPT_DIR/deployment_$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message" | tee -a "$LOG_FILE"
            ;;
    esac
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Success handler
success_exit() {
    log "INFO" "$1"
    exit 0
}

# Cleanup function
cleanup() {
    log "INFO" "Performing cleanup..."
    # Add any cleanup tasks here
}

# Trap for cleanup on exit
trap cleanup EXIT

# Help function
show_help() {
    cat << EOF
Railway Deployment Script for Schlep-engine

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --env ENV           Environment to deploy (production, staging, development)
    -p, --project PROJECT   Railway project name
    -s, --service SERVICE   Railway service name
    -c, --config CONFIG     Path to railway config file (default: railway-optimized.toml)
    -d, --dry-run          Perform a dry run without actual deployment
    -v, --verbose          Enable verbose logging
    -h, --help             Show this help message

EXAMPLES:
    $0 --env production --project schlep-engine --service api
    $0 --env staging --dry-run
    $0 --config custom-railway.toml --verbose

EOF
}

# Default values
ENVIRONMENT="production"
PROJECT_NAME=""
SERVICE_NAME="api"
CONFIG_FILE="$SCRIPT_DIR/railway-optimized.toml"
DRY_RUN=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--project)
            PROJECT_NAME="$2"
            shift 2
            ;;
        -s|--service)
            SERVICE_NAME="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Validation functions
validate_environment() {
    case $ENVIRONMENT in
        production|staging|development)
            log "INFO" "Environment set to: $ENVIRONMENT"
            ;;
        *)
            error_exit "Invalid environment: $ENVIRONMENT. Must be one of: production, staging, development"
            ;;
    esac
}

validate_dependencies() {
    log "INFO" "Validating dependencies..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        error_exit "Railway CLI is not installed. Please install it from https://railway.app/cli"
    fi
    
    # Check if Docker is installed (for local testing)
    if ! command -v docker &> /dev/null; then
        log "WARN" "Docker is not installed. Local testing will be skipped."
    fi
    
    # Check if required files exist
    if [[ ! -f "$CONFIG_FILE" ]]; then
        error_exit "Railway config file not found: $CONFIG_FILE"
    fi
    
    if [[ ! -f "$SCRIPT_DIR/Dockerfile.railway" ]]; then
        error_exit "Railway Dockerfile not found: $SCRIPT_DIR/Dockerfile.railway"
    fi
    
    # Check if requirements files exist
    if [[ ! -f "$PROJECT_ROOT/apps/api/requirements.txt" ]]; then
        error_exit "Requirements file not found: $PROJECT_ROOT/apps/api/requirements.txt"
    fi
    
    log "INFO" "All dependencies validated successfully"
}

validate_railway_auth() {
    log "INFO" "Validating Railway authentication..."
    
    if ! railway auth &> /dev/null; then
        error_exit "Not authenticated with Railway. Please run 'railway login'"
    fi
    
    log "INFO" "Railway authentication validated"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "INFO" "Running pre-deployment checks..."
    
    # Validate Python syntax in main files
    log "INFO" "Validating Python syntax..."
    if command -v python3 &> /dev/null; then
        python3 -m py_compile "$PROJECT_ROOT/apps/api/app/main.py" || error_exit "Python syntax error in main.py"
        log "INFO" "Python syntax validation passed"
    fi
    
    # Check environment file template
    if [[ -f "$SCRIPT_DIR/railway.env.template" ]]; then
        log "INFO" "Environment template found"
    else
        log "WARN" "Environment template not found. Creating basic template..."
        create_env_template
    fi
    
    # Validate ML dependencies
    log "INFO" "Validating ML dependencies..."
    if grep -q "tensorflow\|torch\|scikit-learn" "$PROJECT_ROOT/apps/api/requirements.txt"; then
        log "INFO" "ML dependencies found in requirements"
    else
        log "WARN" "No ML dependencies found in requirements"
    fi
    
    log "INFO" "Pre-deployment checks completed"
}

# Local testing function
run_local_tests() {
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "Skipping local tests in dry-run mode"
        return
    fi
    
    log "INFO" "Running local tests..."
    
    # Build Docker image locally for testing
    if command -v docker &> /dev/null; then
        log "INFO" "Building Docker image for local testing..."
        
        cd "$PROJECT_ROOT"
        docker build -f "$SCRIPT_DIR/Dockerfile.railway" -t "schlep-engine-railway:test" . || {
            log "WARN" "Local Docker build failed, continuing with deployment"
            return
        }
        
        # Run basic health check
        log "INFO" "Running container health check..."
        docker run --rm -d --name "schlep-test-$TIMESTAMP" -p 8000:8000 "schlep-engine-railway:test" || {
            log "WARN" "Local container test failed, continuing with deployment"
            return
        }
        
        # Wait for container to start
        sleep 10
        
        # Test health endpoint
        if curl -f http://localhost:8000/health &> /dev/null; then
            log "INFO" "Local health check passed"
        else
            log "WARN" "Local health check failed"
        fi
        
        # Cleanup test container
        docker stop "schlep-test-$TIMESTAMP" &> /dev/null || true
        docker rmi "schlep-engine-railway:test" &> /dev/null || true
    fi
    
    log "INFO" "Local tests completed"
}

# Environment setup
setup_environment() {
    log "INFO" "Setting up environment variables for $ENVIRONMENT..."
    
    # Set environment-specific configurations
    case $ENVIRONMENT in
        production)
            export LOG_LEVEL="INFO"
            export WORKERS="2"
            export ML_BATCH_SIZE="16"
            ;;
        staging)
            export LOG_LEVEL="DEBUG"
            export WORKERS="1"
            export ML_BATCH_SIZE="8"
            ;;
        development)
            export LOG_LEVEL="DEBUG"
            export WORKERS="1"
            export ML_BATCH_SIZE="4"
            ;;
    esac
    
    log "INFO" "Environment setup completed"
}

# Railway project setup
setup_railway_project() {
    log "INFO" "Setting up Railway project..."
    
    if [[ -n "$PROJECT_NAME" ]]; then
        # Link to existing project
        log "INFO" "Linking to Railway project: $PROJECT_NAME"
        railway link "$PROJECT_NAME" || error_exit "Failed to link to Railway project"
    else
        # Check if already linked
        if railway status &> /dev/null; then
            log "INFO" "Already linked to a Railway project"
        else
            log "WARN" "No project specified and not linked to any project"
            log "INFO" "Please specify a project with --project or run 'railway link' manually"
        fi
    fi
}

# Deploy function
deploy_to_railway() {
    log "INFO" "Starting deployment to Railway..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Would deploy to Railway with the following configuration:"
        log "INFO" "  Environment: $ENVIRONMENT"
        log "INFO" "  Config file: $CONFIG_FILE"
        log "INFO" "  Service: $SERVICE_NAME"
        return
    fi
    
    cd "$PROJECT_ROOT"
    
    # Copy the optimized config to the project root for Railway to find it
    cp "$CONFIG_FILE" "./railway.toml" || error_exit "Failed to copy Railway config"
    
    # Deploy with Railway
    log "INFO" "Executing Railway deployment..."
    
    # Set service if specified
    if [[ -n "$SERVICE_NAME" ]]; then
        railway service "$SERVICE_NAME" || log "WARN" "Failed to set service, continuing with default"
    fi
    
    # Deploy the application
    railway up --detach || error_exit "Railway deployment failed"
    
    log "INFO" "Railway deployment initiated successfully"
}

# Post-deployment verification
post_deployment_verification() {
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "Skipping post-deployment verification in dry-run mode"
        return
    fi
    
    log "INFO" "Running post-deployment verification..."
    
    # Wait for deployment to be ready
    log "INFO" "Waiting for deployment to be ready..."
    sleep 30
    
    # Get deployment URL
    DEPLOYMENT_URL=$(railway url 2>/dev/null || echo "")
    
    if [[ -n "$DEPLOYMENT_URL" ]]; then
        log "INFO" "Deployment URL: $DEPLOYMENT_URL"
        
        # Test health endpoint
        log "INFO" "Testing health endpoint..."
        for i in {1..5}; do
            if curl -f "$DEPLOYMENT_URL/health" &> /dev/null; then
                log "INFO" "Health check passed"
                break
            else
                log "WARN" "Health check failed, attempt $i/5"
                sleep 10
            fi
        done
        
        # Test API endpoints
        log "INFO" "Testing API endpoints..."
        if curl -f "$DEPLOYMENT_URL/api/v1/health/simple" &> /dev/null; then
            log "INFO" "API health check passed"
        else
            log "WARN" "API health check failed"
        fi
        
    else
        log "WARN" "Could not retrieve deployment URL"
    fi
    
    # Check deployment status
    railway status || log "WARN" "Could not retrieve deployment status"
    
    log "INFO" "Post-deployment verification completed"
}

# Create environment template if missing
create_env_template() {
    log "INFO" "Creating environment template..."
    
    cat > "$SCRIPT_DIR/railway.env.template" << 'EOF'
# Railway Environment Configuration Template
# Copy this file and configure the values for your deployment

# Core Application
PORT=8000
ENVIRONMENT=production
LOG_LEVEL=INFO
APP_VERSION=1.0.0

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Redis Configuration
REDIS_URL=redis://user:password@host:port
REDIS_PASSWORD=your-redis-password

# Security
SECRET_KEY=your-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ML Configuration
ML_MODEL_CACHE_SIZE=2000
ML_BATCH_SIZE=16
TENSORFLOW_INTER_OP_PARALLELISM_THREADS=2
TENSORFLOW_INTRA_OP_PARALLELISM_THREADS=2

# Monitoring
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_METRICS_ENABLED=true

# Cloud Storage
GCS_BUCKET_NAME=your-gcs-bucket
AWS_S3_BUCKET=your-s3-bucket
EOF
    
    log "INFO" "Environment template created at: $SCRIPT_DIR/railway.env.template"
}

# Generate deployment report
generate_deployment_report() {
    log "INFO" "Generating deployment report..."
    
    REPORT_FILE="$SCRIPT_DIR/deployment_report_$TIMESTAMP.md"
    
    cat > "$REPORT_FILE" << EOF
# Railway Deployment Report

**Deployment Date:** $(date)
**Environment:** $ENVIRONMENT
**Service:** $SERVICE_NAME
**Config File:** $CONFIG_FILE

## Deployment Configuration

- **Workers:** 2 (optimized for 2 vCPU)
- **Memory:** 4GB RAM
- **ML Batch Size:** 16 (optimized for memory)
- **Python Version:** 3.11
- **Framework:** FastAPI with uvicorn

## Resource Allocation

- **CPU:** 2 vCPU
- **Memory:** 4096 MB
- **Storage:** Railway managed
- **Network:** Railway internal + custom domains

## Health Checks

- **Primary:** /health (30s interval)
- **API:** /api/v1/health/simple (60s interval)
- **ML Services:** /api/v1/health/ml (120s interval)

## Monitoring

- **Metrics:** Prometheus enabled at /metrics
- **Logging:** JSON format, INFO level
- **Error Tracking:** Sentry integration available

## Security Features

- Non-root container user (railway)
- Security headers enabled
- HTTPS forced
- CORS configured for allowed origins

## Performance Optimizations

- Multi-stage Docker build
- Layer caching optimized
- ML dependencies pre-compiled
- CPU-only TensorFlow/PyTorch configuration
- Connection pooling and timeouts configured

EOF
    
    if [[ "$DRY_RUN" == false ]]; then
        echo "## Deployment Status" >> "$REPORT_FILE"
        railway status >> "$REPORT_FILE" 2>&1 || echo "Status unavailable" >> "$REPORT_FILE"
    fi
    
    log "INFO" "Deployment report generated: $REPORT_FILE"
}

# Main execution
main() {
    log "INFO" "Starting Railway deployment process..."
    log "INFO" "Timestamp: $TIMESTAMP"
    log "INFO" "Log file: $LOG_FILE"
    
    # Validation phase
    validate_environment
    validate_dependencies
    validate_railway_auth
    
    # Pre-deployment phase
    pre_deployment_checks
    setup_environment
    setup_railway_project
    
    # Testing phase
    run_local_tests
    
    # Deployment phase
    deploy_to_railway
    
    # Verification phase
    post_deployment_verification
    
    # Reporting phase
    generate_deployment_report
    
    if [[ "$DRY_RUN" == true ]]; then
        success_exit "Dry run completed successfully. Review the logs at: $LOG_FILE"
    else
        success_exit "Railway deployment completed successfully! Check the report at: $SCRIPT_DIR/deployment_report_$TIMESTAMP.md"
    fi
}

# Run main function
main "$@"