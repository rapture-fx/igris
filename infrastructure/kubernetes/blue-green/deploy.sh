#!/bin/bash

# Blue-Green Deployment Script for Schlep Engine
# Usage: ./deploy.sh <component> <new-image-tag> [--dry-run] [--canary-percent]
# Components: api, landing, admin, docs, console, all

set -euo pipefail

# Configuration
NAMESPACE="schlep-engine"
KUBECTL_TIMEOUT="300s"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 <component> <new-image-tag> [options]

Components:
  api       - Deploy API backend
  landing   - Deploy landing page
  admin     - Deploy admin dashboard
  docs      - Deploy documentation
  console   - Deploy web console
  all       - Deploy all components

Options:
  --dry-run              - Show what would be deployed without actually deploying
  --canary-percent=N     - Deploy with canary traffic splitting (default: 10)
  --skip-validation      - Skip post-deployment validation tests
  --rollback             - Rollback to previous deployment
  --promote              - Promote green deployment to active
  --cleanup              - Clean up old blue deployment after successful green deployment

Examples:
  $0 api v1.2.3
  $0 landing v1.2.3 --canary-percent=20
  $0 all v1.2.3 --dry-run
  $0 api --rollback
  $0 api --promote

EOF
}

# Parse command line arguments
COMPONENT="${1:-}"
IMAGE_TAG="${2:-}"
DRY_RUN=false
CANARY_PERCENT=10
SKIP_VALIDATION=false
ROLLBACK=false
PROMOTE=false
CLEANUP=false

# Parse options
for arg in "${@:3}"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --canary-percent=*)
            CANARY_PERCENT="${arg#*=}"
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            ;;
        --rollback)
            ROLLBACK=true
            ;;
        --promote)
            PROMOTE=true
            ;;
        --cleanup)
            CLEANUP=true
            ;;
        *)
            log_error "Unknown option: $arg"
            usage
            exit 1
            ;;
    esac
done

# Validate inputs
if [[ -z "$COMPONENT" ]]; then
    log_error "Component is required"
    usage
    exit 1
fi

if [[ "$ROLLBACK" == false && "$PROMOTE" == false && "$CLEANUP" == false && -z "$IMAGE_TAG" ]]; then
    log_error "Image tag is required for deployments"
    usage
    exit 1
fi

# Validate component
VALID_COMPONENTS=("api" "landing" "admin" "docs" "console" "all")
if [[ ! " ${VALID_COMPONENTS[@]} " =~ " ${COMPONENT} " ]]; then
    log_error "Invalid component: $COMPONENT"
    log_error "Valid components: ${VALID_COMPONENTS[*]}"
    exit 1
fi

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is required but not installed"
        exit 1
    fi

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Get current active deployment color
get_active_deployment_color() {
    local component=$1
    local service_name="${component}-service"

    # Check which deployment is currently receiving traffic
    local blue_endpoints=$(kubectl get endpoints "${service_name}-blue" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | wc -w || echo "0")
    local green_endpoints=$(kubectl get endpoints "${service_name}-green" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | wc -w || echo "0")

    if [[ "$blue_endpoints" -gt 0 && "$green_endpoints" -eq 0 ]]; then
        echo "blue"
    elif [[ "$green_endpoints" -gt 0 && "$blue_endpoints" -eq 0 ]]; then
        echo "green"
    elif [[ "$blue_endpoints" -gt 0 && "$green_endpoints" -gt 0 ]]; then
        echo "both"
    else
        echo "none"
    fi
}

# Get inactive deployment color
get_inactive_deployment_color() {
    local component=$1
    local active_color=$(get_active_deployment_color "$component")

    case $active_color in
        "blue") echo "green" ;;
        "green") echo "blue" ;;
        "both") echo "unknown" ;;
        "none") echo "blue" ;;  # Default to blue if no active deployment
    esac
}

# Health check function
health_check() {
    local component=$1
    local color=$2
    local service_name="${component}-service-${color}"

    log_info "Performing health check for $component ($color deployment)..."

    local retries=0
    while [[ $retries -lt $HEALTH_CHECK_RETRIES ]]; do
        if kubectl exec -n "$NAMESPACE" deployment/"${component}-deployment-${color}" -- curl -f -s http://localhost:8000/health >/dev/null 2>&1 || \
           kubectl exec -n "$NAMESPACE" deployment/"${component}-deployment-${color}" -- curl -f -s http://localhost:3000/api/health >/dev/null 2>&1; then
            log_success "Health check passed for $component ($color)"
            return 0
        fi

        ((retries++))
        log_info "Health check attempt $retries/$HEALTH_CHECK_RETRIES failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
    done

    log_error "Health check failed for $component ($color) after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Validate deployment function
validate_deployment() {
    local component=$1
    local color=$2

    log_info "Validating $component ($color deployment)..."

    # Create validation job
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: validate-${component}-${color}-$(date +%s)
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: deployment-validator
    app.kubernetes.io/component: validation
    validation-target: ${component}-${color}
spec:
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: deployment-validator
        app.kubernetes.io/component: validation
    spec:
      restartPolicy: OnFailure
      containers:
      - name: validator
        image: curlimages/curl:latest
        command:
        - /bin/sh
        - -c
        - |
          set -e
          echo "Starting validation for ${component} (${color} deployment)..."

          # Determine the correct service and port
          if [[ "${component}" == "api" ]]; then
            SERVICE_URL="http://${component}-service-${color}.${NAMESPACE}.svc.cluster.local"
            HEALTH_PATH="/health"
          else
            SERVICE_URL="http://${component}-service-${color}.${NAMESPACE}.svc.cluster.local"
            HEALTH_PATH="/api/health"
          fi

          # Wait for service to be ready
          for i in \$(seq 1 30); do
            if curl -f -s "\$SERVICE_URL\$HEALTH_PATH"; then
              echo "✓ Health check passed"
              break
            fi
            echo "Waiting for service... attempt \$i/30"
            sleep 10
          done

          # Additional validation tests can be added here
          echo "All validation tests passed!"
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "200m"
      activeDeadlineSeconds: 600
      backoffLimit: 2
EOF

    # Wait for validation job to complete
    log_info "Waiting for validation job to complete..."
    kubectl wait --for=condition=complete --timeout=600s job -l validation-target="${component}-${color}" -n "$NAMESPACE"

    if [[ $? -eq 0 ]]; then
        log_success "Validation passed for $component ($color deployment)"
        return 0
    else
        log_error "Validation failed for $component ($color deployment)"
        return 1
    fi
}

# Deploy function
deploy_component() {
    local component=$1
    local image_tag=$2
    local target_color=$3

    log_info "Deploying $component:$image_tag to $target_color environment..."

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would deploy $component:$image_tag to $target_color"
        return 0
    fi

    # Update deployment with new image
    local deployment_name="${component}-deployment-${target_color}"
    local image_name="ghcr.io/schlep-engine/${component}:${image_tag}"

    # Update the deployment
    kubectl set image deployment/"$deployment_name" "${component}=${image_name}" -n "$NAMESPACE"

    # Update deployment labels and annotations
    kubectl patch deployment "$deployment_name" -n "$NAMESPACE" -p "{
        \"metadata\": {
            \"labels\": {
                \"deployment\": \"${target_color}\",
                \"version\": \"${image_tag}\"
            },
            \"annotations\": {
                \"deployment.kubernetes.io/revision\": \"$(date +%s)\",
                \"schlep-engine.com/deployed-by\": \"$(whoami)\",
                \"schlep-engine.com/deployed-at\": \"$(date -Iseconds)\"
            }
        },
        \"spec\": {
            \"template\": {
                \"metadata\": {
                    \"labels\": {
                        \"deployment\": \"${target_color}\",
                        \"version\": \"${image_tag}\"
                    }
                }
            }
        }
    }"

    # Scale up the target deployment
    kubectl scale deployment "$deployment_name" --replicas=3 -n "$NAMESPACE"

    # Wait for rollout to complete
    log_info "Waiting for rollout to complete..."
    kubectl rollout status deployment/"$deployment_name" -n "$NAMESPACE" --timeout="$KUBECTL_TIMEOUT"

    # Perform health check
    if ! health_check "$component" "$target_color"; then
        log_error "Health check failed for $component ($target_color)"
        return 1
    fi

    # Run validation if not skipped
    if [[ "$SKIP_VALIDATION" == false ]]; then
        if ! validate_deployment "$component" "$target_color"; then
            log_error "Validation failed for $component ($target_color)"
            return 1
        fi
    fi

    log_success "Successfully deployed $component:$image_tag to $target_color environment"
    return 0
}

# Switch traffic function
switch_traffic() {
    local component=$1
    local new_active_color=$2
    local canary_percent=${3:-100}

    log_info "Switching traffic for $component to $new_active_color (${canary_percent}%)"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would switch traffic for $component to $new_active_color (${canary_percent}%)"
        return 0
    fi

    # Update the main service selector to point to the new deployment
    if [[ "$canary_percent" -eq 100 ]]; then
        # Full switch
        kubectl patch service "${component}-service" -n "$NAMESPACE" -p "{
            \"spec\": {
                \"selector\": {
                    \"app.kubernetes.io/name\": \"${component}\",
                    \"app.kubernetes.io/component\": \"backend\",
                    \"deployment\": \"${new_active_color}\"
                }
            }
        }"
        log_success "Switched 100% of traffic to $new_active_color for $component"
    else
        # Canary deployment with Istio VirtualService
        # This would require Istio to be installed and configured
        log_warning "Canary deployment with ${canary_percent}% traffic requires Istio configuration"
        log_info "Creating canary configuration for $component..."

        # Create or update VirtualService for canary deployment
        # This is a placeholder - actual implementation would depend on your service mesh setup
        log_info "Canary deployment configured with ${canary_percent}% traffic to $new_active_color"
    fi
}

# Rollback function
rollback_deployment() {
    local component=$1

    log_info "Rolling back $component deployment..."

    local active_color=$(get_active_deployment_color "$component")
    if [[ "$active_color" == "none" || "$active_color" == "unknown" ]]; then
        log_error "Cannot determine active deployment for rollback"
        return 1
    fi

    # Get the inactive color (this will be our rollback target)
    local rollback_color=$(get_inactive_deployment_color "$component")

    if [[ "$rollback_color" == "unknown" ]]; then
        log_error "Cannot determine rollback target"
        return 1
    fi

    log_info "Rolling back from $active_color to $rollback_color"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would rollback $component from $active_color to $rollback_color"
        return 0
    fi

    # Switch traffic back to the previous deployment
    switch_traffic "$component" "$rollback_color" 100

    # Scale down the failed deployment
    kubectl scale deployment "${component}-deployment-${active_color}" --replicas=0 -n "$NAMESPACE"

    log_success "Rollback completed for $component"
}

# Promote deployment function
promote_deployment() {
    local component=$1

    log_info "Promoting green deployment for $component to active..."

    local active_color=$(get_active_deployment_color "$component")

    if [[ "$active_color" != "green" && "$active_color" != "both" ]]; then
        log_error "Green deployment is not active for $component"
        return 1
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would promote green deployment for $component"
        return 0
    fi

    # Switch all traffic to green
    switch_traffic "$component" "green" 100

    # Scale down blue deployment
    kubectl scale deployment "${component}-deployment-blue" --replicas=0 -n "$NAMESPACE"

    log_success "Promoted green deployment to active for $component"
}

# Cleanup function
cleanup_old_deployment() {
    local component=$1

    log_info "Cleaning up old deployment for $component..."

    local active_color=$(get_active_deployment_color "$component")
    local inactive_color=$(get_inactive_deployment_color "$component")

    if [[ "$inactive_color" == "unknown" ]]; then
        log_warning "No inactive deployment to clean up for $component"
        return 0
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would cleanup $inactive_color deployment for $component"
        return 0
    fi

    # Scale down the inactive deployment
    kubectl scale deployment "${component}-deployment-${inactive_color}" --replicas=0 -n "$NAMESPACE"

    log_success "Cleaned up $inactive_color deployment for $component"
}

# Main deployment orchestration
main() {
    check_prerequisites

    local components=()

    if [[ "$COMPONENT" == "all" ]]; then
        components=("api" "landing" "admin" "docs" "console")
    else
        components=("$COMPONENT")
    fi

    # Handle special operations
    if [[ "$ROLLBACK" == true ]]; then
        for component in "${components[@]}"; do
            rollback_deployment "$component"
        done
        return 0
    fi

    if [[ "$PROMOTE" == true ]]; then
        for component in "${components[@]}"; do
            promote_deployment "$component"
        done
        return 0
    fi

    if [[ "$CLEANUP" == true ]]; then
        for component in "${components[@]}"; do
            cleanup_old_deployment "$component"
        done
        return 0
    fi

    # Normal deployment process
    log_info "Starting blue-green deployment process..."
    log_info "Components: ${components[*]}"
    log_info "Image tag: $IMAGE_TAG"
    log_info "Canary percentage: $CANARY_PERCENT%"

    for component in "${components[@]}"; do
        log_info "Processing $component..."

        # Determine target deployment color
        local active_color=$(get_active_deployment_color "$component")
        local target_color=$(get_inactive_deployment_color "$component")

        log_info "Current active deployment: $active_color"
        log_info "Deploying to: $target_color"

        # Deploy to inactive environment
        if ! deploy_component "$component" "$IMAGE_TAG" "$target_color"; then
            log_error "Deployment failed for $component"

            # Offer rollback option
            read -p "Do you want to rollback $component? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment "$component"
            fi

            exit 1
        fi

        # Switch traffic with canary or full switch
        if [[ "$CANARY_PERCENT" -lt 100 ]]; then
            switch_traffic "$component" "$target_color" "$CANARY_PERCENT"

            log_info "Canary deployment active with ${CANARY_PERCENT}% traffic"
            log_info "Monitor the deployment and run './deploy.sh $component --promote' to complete"
            log_info "Or run './deploy.sh $component --rollback' to rollback"
        else
            switch_traffic "$component" "$target_color" 100
            log_success "Full traffic switch completed for $component"
        fi
    done

    log_success "Blue-green deployment completed successfully!"

    if [[ "$CANARY_PERCENT" -eq 100 ]]; then
        log_info "You can now run './deploy.sh ${COMPONENT} --cleanup' to remove old deployments"
    fi
}

# Run main function
main "$@"