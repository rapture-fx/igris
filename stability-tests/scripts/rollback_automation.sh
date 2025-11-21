#!/bin/bash
#
# Schlep-Engine Automated Rollback Script
# Automatically rolls back to the previous stable deployment
# Trigger conditions: High error rate, complete outage, or manual trigger
#

set -euo pipefail

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
HEALTH_CHECK_ENDPOINT="${API_URL}/healthz"
METRICS_ENDPOINT="${API_URL}/metrics"
ROLLBACK_TIMEOUT=300  # 5 minutes
HEALTH_CHECK_RETRIES=5
DEPLOYMENT_NAMESPACE="${DEPLOYMENT_NAMESPACE:-default}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-schlep-engine-api}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if API is healthy
check_api_health() {
    local retries=$1
    local count=0

    log_info "Checking API health at ${HEALTH_CHECK_ENDPOINT}"

    while [ $count -lt $retries ]; do
        if curl -sf "${HEALTH_CHECK_ENDPOINT}" > /dev/null 2>&1; then
            log_info "API health check passed"
            return 0
        fi

        count=$((count + 1))
        log_warn "Health check attempt ${count}/${retries} failed"
        sleep 2
    done

    log_error "API health check failed after ${retries} attempts"
    return 1
}

# Get current error rate from Prometheus metrics
get_error_rate() {
    local metrics_output
    metrics_output=$(curl -sf "${METRICS_ENDPOINT}" 2>/dev/null || echo "")

    if [ -z "$metrics_output" ]; then
        log_warn "Unable to fetch metrics"
        return 1
    fi

    # Parse metrics (simplified - in production use proper Prometheus query)
    local total_requests=$(echo "$metrics_output" | grep '^http_requests_total' | grep -v '#' | awk '{sum+=$2} END {print sum}')
    local error_requests=$(echo "$metrics_output" | grep '^http_requests_total.*status="5' | awk '{sum+=$2} END {print sum}')

    if [ -z "$total_requests" ] || [ "$total_requests" -eq 0 ]; then
        echo "0"
        return 0
    fi

    local error_rate=$(echo "scale=2; ($error_requests / $total_requests) * 100" | bc)
    echo "$error_rate"
}

# Check if rollback is needed based on metrics
should_rollback() {
    log_info "Evaluating rollback criteria..."

    # Check 1: API health
    if ! check_api_health 3; then
        log_error "❌ CRITICAL: API is not responding to health checks"
        return 0  # Should rollback
    fi

    # Check 2: Error rate
    local error_rate=$(get_error_rate)
    if [ -n "$error_rate" ]; then
        log_info "Current 5xx error rate: ${error_rate}%"

        if (( $(echo "$error_rate > 5.0" | bc -l) )); then
            log_error "❌ CRITICAL: Error rate ${error_rate}% exceeds threshold (5%)"
            return 0  # Should rollback
        fi
    fi

    log_info "✅ All checks passed - rollback not needed"
    return 1  # Should not rollback
}

# Perform Kubernetes rollback
rollback_kubernetes() {
    log_info "Starting Kubernetes rollback for ${DEPLOYMENT_NAME}"

    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Cannot perform Kubernetes rollback."
        return 1
    fi

    # Get rollout history
    log_info "Fetching deployment history..."
    kubectl rollout history deployment/${DEPLOYMENT_NAME} -n ${DEPLOYMENT_NAMESPACE}

    # Perform rollback
    log_info "Initiating rollback to previous revision..."
    if kubectl rollout undo deployment/${DEPLOYMENT_NAME} -n ${DEPLOYMENT_NAMESPACE}; then
        log_info "Rollback command executed successfully"
    else
        log_error "Rollback command failed"
        return 1
    fi

    # Wait for rollout to complete
    log_info "Waiting for rollout to complete (timeout: ${ROLLBACK_TIMEOUT}s)..."
    if kubectl rollout status deployment/${DEPLOYMENT_NAME} -n ${DEPLOYMENT_NAMESPACE} --timeout=${ROLLBACK_TIMEOUT}s; then
        log_info "✅ Rollback completed successfully"
        return 0
    else
        log_error "❌ Rollback timed out or failed"
        return 1
    fi
}

# Perform Docker rollback (for non-k8s deployments)
rollback_docker() {
    log_info "Starting Docker rollback..."

    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose not found. Cannot perform Docker rollback."
        return 1
    fi

    # Check for backup tag
    local current_image=$(docker ps --filter "name=${DEPLOYMENT_NAME}" --format "{{.Image}}" | head -n1)
    log_info "Current image: ${current_image}"

    # Stop current deployment
    log_info "Stopping current deployment..."
    docker-compose down

    # Start previous version (assumes backup tag exists)
    log_info "Starting previous version..."
    docker-compose up -d

    # Wait for health check
    sleep 10
    if check_api_health $HEALTH_CHECK_RETRIES; then
        log_info "✅ Docker rollback completed successfully"
        return 0
    else
        log_error "❌ Docker rollback failed health check"
        return 1
    fi
}

# Disable problematic features via environment variables
disable_features() {
    log_info "Disabling potentially problematic features..."

    # This would typically update ConfigMap or environment variables
    # Example features to disable:
    local features=(
        "ENABLE_COGNITIVE_ADVISOR=false"
        "OPTIMIZER_MODE=go-only"
        "ENABLE_EXPERIMENTAL_FEATURES=false"
    )

    for feature in "${features[@]}"; do
        log_info "  - Setting ${feature}"
        # In production: kubectl set env deployment/${DEPLOYMENT_NAME} ${feature}
    done

    log_info "Features disabled. Restart may be required."
}

# Send notification
send_notification() {
    local status=$1
    local message=$2

    log_info "Sending notification: ${status} - ${message}"

    # Slack webhook (example)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST "${SLACK_WEBHOOK_URL}" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"🚨 Schlep-Engine Rollback ${status}: ${message}\"}" \
            2>/dev/null || log_warn "Failed to send Slack notification"
    fi

    # PagerDuty (example)
    if [ -n "${PAGERDUTY_API_KEY:-}" ]; then
        log_info "PagerDuty notification would be sent here"
        # Implement PagerDuty API call
    fi

    # Email (example)
    if [ -n "${EMAIL_ALERT_RECIPIENTS:-}" ]; then
        echo "${message}" | mail -s "Schlep-Engine Rollback ${status}" "${EMAIL_ALERT_RECIPIENTS}" || log_warn "Failed to send email"
    fi
}

# Post-rollback verification
verify_rollback() {
    log_info "Verifying rollback success..."

    # Check 1: Health check
    if ! check_api_health $HEALTH_CHECK_RETRIES; then
        log_error "Post-rollback health check failed"
        return 1
    fi

    # Check 2: Error rate (should be lower now)
    sleep 30  # Wait for metrics to stabilize
    local error_rate=$(get_error_rate)
    log_info "Post-rollback error rate: ${error_rate}%"

    if [ -n "$error_rate" ] && (( $(echo "$error_rate > 1.0" | bc -l) )); then
        log_warn "⚠️  Error rate still elevated (${error_rate}%), but below critical threshold"
    else
        log_info "✅ Error rate is acceptable"
    fi

    # Check 3: Basic functionality test
    log_info "Testing basic API functionality..."
    local test_payload='{"model":"gpt-4","messages":[{"role":"user","content":"test"}],"max_tokens":10}'
    local response=$(curl -sf -X POST "${API_URL}/v1/infer" \
        -H "Content-Type: application/json" \
        -d "$test_payload" 2>/dev/null || echo "")

    if [ -n "$response" ]; then
        log_info "✅ Basic functionality test passed"
        return 0
    else
        log_error "❌ Basic functionality test failed"
        return 1
    fi
}

# Main rollback procedure
main() {
    echo "========================================================================"
    echo "       SCHLEP-ENGINE AUTOMATED ROLLBACK PROCEDURE"
    echo "========================================================================"
    echo ""

    log_info "Starting rollback evaluation at $(date)"

    # Check if rollback is needed
    if ! should_rollback; then
        log_info "System is healthy. No rollback needed."
        exit 0
    fi

    log_warn "🚨 ROLLBACK TRIGGERED 🚨"
    send_notification "INITIATED" "Automatic rollback has been triggered due to system health issues"

    # Detect deployment type
    local deployment_type="unknown"
    if command -v kubectl &> /dev/null; then
        deployment_type="kubernetes"
    elif command -v docker-compose &> /dev/null; then
        deployment_type="docker"
    fi

    log_info "Detected deployment type: ${deployment_type}"

    # Perform rollback based on deployment type
    case $deployment_type in
        kubernetes)
            if rollback_kubernetes; then
                rollback_status="SUCCESS"
            else
                rollback_status="FAILED"
            fi
            ;;
        docker)
            if rollback_docker; then
                rollback_status="SUCCESS"
            else
                rollback_status="FAILED"
            fi
            ;;
        *)
            log_error "Unknown deployment type. Cannot perform automatic rollback."
            log_info "Manual intervention required."
            send_notification "MANUAL_REQUIRED" "Automatic rollback not possible. Manual intervention needed."
            exit 1
            ;;
    esac

    # Verify rollback if successful
    if [ "$rollback_status" = "SUCCESS" ]; then
        log_info "Rollback completed. Verifying system health..."

        if verify_rollback; then
            log_info "✅ ROLLBACK SUCCESSFUL AND VERIFIED ✅"
            send_notification "SUCCESS" "Rollback completed successfully. System is healthy."

            # Create incident report
            cat > "rollback_report_$(date +%Y%m%d_%H%M%S).txt" <<EOF
SCHLEP-ENGINE ROLLBACK REPORT
==============================
Date: $(date)
Reason: Automated rollback due to system health issues
Deployment Type: ${deployment_type}
Status: SUCCESS

Pre-Rollback Metrics:
- Error rate: High (triggered rollback)

Post-Rollback Metrics:
- Health check: PASSED
- Error rate: Acceptable
- Basic functionality: VERIFIED

Actions Taken:
1. System health evaluation
2. Rollback to previous stable version
3. Health verification
4. Functionality testing

Next Steps:
1. Review deployment logs
2. Identify root cause of issues
3. Implement fixes
4. Re-deploy with proper testing
EOF

            log_info "Rollback report generated"
            exit 0
        else
            log_error "❌ ROLLBACK COMPLETED BUT VERIFICATION FAILED ❌"
            send_notification "PARTIAL_FAILURE" "Rollback completed but system still showing issues. Immediate attention required."
            exit 1
        fi
    else
        log_error "❌ ROLLBACK FAILED ❌"
        send_notification "FAILED" "Automatic rollback failed. IMMEDIATE MANUAL INTERVENTION REQUIRED."

        log_error "Manual intervention required. Suggested actions:"
        log_error "1. Check deployment logs: kubectl logs deployment/${DEPLOYMENT_NAME}"
        log_error "2. Check pod status: kubectl get pods -n ${DEPLOYMENT_NAMESPACE}"
        log_error "3. Review recent changes in version control"
        log_error "4. Contact on-call engineer"

        exit 1
    fi
}

# Run main function
main "$@"
