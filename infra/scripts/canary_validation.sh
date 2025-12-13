#!/bin/bash

# Schlep-Engine Canary Deployment Validation Script
# Phase 5 - Operational Hardening and Pilot Launch
#
# This script validates canary deployment health by querying Prometheus metrics
# and comparing them against success criteria defined in feature_flags.yml
#
# Usage: ./canary_validation.sh [canary_stage]
# Stages: initial (10%), expand (50%), full (100%)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="${API_URL:-http://localhost:8080}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
CANARY_STAGE="${1:-${CANARY_STAGE:-initial}}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
LOG_FILE="${LOG_FILE:-/tmp/canary_validation_$(date +%Y%m%d_%H%M%S).log}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Send Slack notification
send_slack_notification() {
    local status="$1"
    local message="$2"

    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        return 0
    fi

    local color="good"
    [[ "$status" == "error" ]] && color="danger"
    [[ "$status" == "warning" ]] && color="warning"

    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Schlep-Engine Canary Validation - $CANARY_STAGE Stage",
            "text": "$message",
            "footer": "Schlep-Engine Monitoring",
            "ts": $(date +%s)
        }
    ]
}
EOF
    )

    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1
}

# Query Prometheus metric
query_prometheus() {
    local query="$1"
    local url="${PROMETHEUS_URL}/api/v1/query?query=${query}"

    local response=$(curl -s -G --data-urlencode "query=$query" "${PROMETHEUS_URL}/api/v1/query")
    local status=$(echo "$response" | jq -r '.status // "error"')

    if [[ "$status" != "success" ]]; then
        log_error "Prometheus query failed: $query"
        echo "error"
        return 1
    fi

    local value=$(echo "$response" | jq -r '.data.result[0].value[1] // "0"')
    echo "$value"
}

# Validate forecast accuracy drift
validate_forecast_accuracy() {
    log_info "Validating forecast accuracy drift..."

    local threshold
    case "$CANARY_STAGE" in
        initial)
            threshold=10
            ;;
        expand)
            threshold=8
            ;;
        full)
            threshold=5
            ;;
        *)
            threshold=10
            ;;
    esac

    # Query actual drift metric
    local drift=$(query_prometheus 'abs(schlep_cost_forecast_accuracy - avg_over_time(schlep_cost_forecast_accuracy[24h])) * 100')

    if [[ "$drift" == "error" ]]; then
        log_error "Failed to query forecast accuracy drift"
        return 1
    fi

    drift=$(printf "%.2f" "$drift")

    log_info "Forecast accuracy drift: ${drift}% (threshold: <${threshold}%)"

    if (( $(echo "$drift < $threshold" | bc -l) )); then
        log_success "Forecast accuracy drift is within acceptable range"
        return 0
    else
        log_error "Forecast accuracy drift exceeds threshold: ${drift}% >= ${threshold}%"
        return 1
    fi
}

# Validate latency P95
validate_latency() {
    log_info "Validating P95 latency..."

    local threshold
    case "$CANARY_STAGE" in
        initial)
            threshold=1000
            ;;
        expand)
            threshold=800
            ;;
        full)
            threshold=500
            ;;
        *)
            threshold=1000
            ;;
    esac

    # Query P95 latency
    local latency=$(query_prometheus 'histogram_quantile(0.95, rate(schlep_request_duration_ms_bucket[5m]))')

    if [[ "$latency" == "error" ]]; then
        log_error "Failed to query P95 latency"
        return 1
    fi

    latency=$(printf "%.0f" "$latency")

    log_info "P95 latency: ${latency}ms (threshold: <${threshold}ms)"

    if (( latency < threshold )); then
        log_success "P95 latency is within acceptable range"
        return 0
    else
        log_error "P95 latency exceeds threshold: ${latency}ms >= ${threshold}ms"
        return 1
    fi
}

# Validate error rate
validate_error_rate() {
    log_info "Validating error rate..."

    local threshold
    case "$CANARY_STAGE" in
        initial)
            threshold=1.0
            ;;
        expand)
            threshold=0.5
            ;;
        full)
            threshold=0.1
            ;;
        *)
            threshold=1.0
            ;;
    esac

    # Query error rate over last 10 minutes
    local error_rate=$(query_prometheus 'rate(schlep_errors_total[10m]) * 100')

    if [[ "$error_rate" == "error" ]]; then
        log_error "Failed to query error rate"
        return 1
    fi

    error_rate=$(printf "%.2f" "$error_rate")

    log_info "Error rate: ${error_rate}% (threshold: <${threshold}%)"

    if (( $(echo "$error_rate < $threshold" | bc -l) )); then
        log_success "Error rate is within acceptable range"
        return 0
    else
        log_error "Error rate exceeds threshold: ${error_rate}% >= ${threshold}%"
        return 1
    fi
}

# Validate SLA violations
validate_sla_violations() {
    log_info "Validating SLA violations..."

    local threshold
    case "$CANARY_STAGE" in
        initial)
            threshold=2
            ;;
        expand)
            threshold=1
            ;;
        full)
            threshold=0.5
            ;;
        *)
            threshold=2
            ;;
    esac

    # Query SLA violations per hour
    local violations=$(query_prometheus 'rate(schlep_sla_violations_total[1h]) * 3600')

    if [[ "$violations" == "error" ]]; then
        log_error "Failed to query SLA violations"
        return 1
    fi

    violations=$(printf "%.2f" "$violations")

    log_info "SLA violations per hour: ${violations} (threshold: <${threshold})"

    if (( $(echo "$violations < $threshold" | bc -l) )); then
        log_success "SLA violations are within acceptable range"
        return 0
    else
        log_error "SLA violations exceed threshold: ${violations} >= ${threshold}"
        return 1
    fi
}

# Validate Redis latency
validate_redis_latency() {
    log_info "Validating Redis latency..."

    local threshold=50  # 50ms threshold

    local redis_latency=$(query_prometheus 'avg(schlep_redis_latency_ms)')

    if [[ "$redis_latency" == "error" ]]; then
        log_error "Failed to query Redis latency"
        return 1
    fi

    redis_latency=$(printf "%.2f" "$redis_latency")

    log_info "Redis latency: ${redis_latency}ms (threshold: <${threshold}ms)"

    if (( $(echo "$redis_latency < $threshold" | bc -l) )); then
        log_success "Redis latency is within acceptable range"
        return 0
    else
        log_warn "Redis latency is elevated: ${redis_latency}ms >= ${threshold}ms"
        return 0  # Warning, not failure
    fi
}

# Validate Bayesian tuner confidence
validate_bayesian_confidence() {
    log_info "Validating Bayesian tuner confidence..."

    local threshold=0.85

    local confidence=$(query_prometheus 'avg(schlep_bayesian_tuner_confidence)')

    if [[ "$confidence" == "error" ]]; then
        log_warn "Failed to query Bayesian tuner confidence (feature may not be active)"
        return 0
    fi

    confidence=$(printf "%.2f" "$confidence")

    log_info "Bayesian tuner confidence: ${confidence} (threshold: >${threshold})"

    if (( $(echo "$confidence >= $threshold" | bc -l) )); then
        log_success "Bayesian tuner confidence is acceptable"
        return 0
    else
        log_warn "Bayesian tuner confidence is low: ${confidence} < ${threshold}"
        return 0  # Warning, not failure
    fi
}

# Validate API health
validate_api_health() {
    log_info "Validating API health endpoint..."

    local response=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/v1/health")

    if [[ "$response" == "200" ]]; then
        log_success "API health check passed"
        return 0
    else
        log_error "API health check failed with status: $response"
        return 1
    fi
}

# Validate telemetry completeness
validate_telemetry_completeness() {
    log_info "Validating telemetry completeness..."

    local threshold=98.0

    # Check if critical metrics are being reported
    local metrics=(
        "schlep_cost_forecast_accuracy"
        "schlep_redis_latency_ms"
        "schlep_request_duration_ms_bucket"
        "schlep_errors_total"
        "schlep_sla_violations_total"
    )

    local total_metrics=${#metrics[@]}
    local present_metrics=0

    for metric in "${metrics[@]}"; do
        local result=$(query_prometheus "$metric")
        if [[ "$result" != "error" && "$result" != "0" ]]; then
            ((present_metrics++))
        fi
    done

    local completeness=$(echo "scale=2; ($present_metrics / $total_metrics) * 100" | bc)

    log_info "Telemetry completeness: ${completeness}% (threshold: >${threshold}%)"

    if (( $(echo "$completeness >= $threshold" | bc -l) )); then
        log_success "Telemetry completeness is acceptable"
        return 0
    else
        log_error "Telemetry completeness is too low: ${completeness}% < ${threshold}%"
        return 1
    fi
}

# Main validation function
run_validation() {
    log_info "==================================================================="
    log_info "Starting Canary Validation - Stage: $CANARY_STAGE"
    log_info "==================================================================="
    log_info "API URL: $API_URL"
    log_info "Prometheus URL: $PROMETHEUS_URL"
    log_info "Timestamp: $(date)"
    log_info "==================================================================="

    local failures=0
    local warnings=0

    # Critical validations (failure triggers rollback)
    validate_api_health || ((failures++))
    validate_forecast_accuracy || ((failures++))
    validate_latency || ((failures++))
    validate_error_rate || ((failures++))
    validate_sla_violations || ((failures++))
    validate_telemetry_completeness || ((failures++))

    # Non-critical validations (warnings only)
    validate_redis_latency || ((warnings++))
    validate_bayesian_confidence || ((warnings++))

    log_info "==================================================================="
    log_info "Validation Summary"
    log_info "==================================================================="
    log_info "Failures: $failures"
    log_info "Warnings: $warnings"
    log_info "==================================================================="

    if (( failures > 0 )); then
        log_error "CANARY VALIDATION FAILED - Rollback recommended"
        send_slack_notification "error" "Canary validation FAILED for stage '$CANARY_STAGE' with $failures critical failures and $warnings warnings. ROLLBACK RECOMMENDED."
        return 1
    elif (( warnings > 0 )); then
        log_warn "CANARY VALIDATION PASSED with warnings"
        send_slack_notification "warning" "Canary validation PASSED for stage '$CANARY_STAGE' with $warnings warnings."
        return 0
    else
        log_success "CANARY VALIDATION PASSED - All checks successful"
        send_slack_notification "good" "Canary validation PASSED for stage '$CANARY_STAGE'. All checks successful!"
        return 0
    fi
}

# Continuous monitoring mode
monitor_continuous() {
    local interval="${VALIDATION_INTERVAL:-21600}"  # Default: 6 hours

    log_info "Starting continuous monitoring mode (interval: ${interval}s)"

    while true; do
        run_validation
        local result=$?

        if (( result != 0 )); then
            log_error "Validation failed. Check logs for details."
        fi

        log_info "Next validation in ${interval} seconds..."
        sleep "$interval"
    done
}

# Usage information
usage() {
    cat <<EOF
Usage: $0 [OPTIONS] [CANARY_STAGE]

Validate canary deployment health for Schlep-Engine

OPTIONS:
    -c, --continuous    Run in continuous monitoring mode
    -h, --help          Show this help message

CANARY_STAGE:
    initial             Initial canary stage (10% traffic)
    expand              Expanded canary stage (50% traffic)
    full                Full rollout stage (100% traffic)

ENVIRONMENT VARIABLES:
    API_URL             Base URL for Schlep-Engine API (default: http://localhost:8080)
    PROMETHEUS_URL      Prometheus server URL (default: http://localhost:9090)
    CANARY_STAGE        Canary deployment stage
    SLACK_WEBHOOK_URL   Slack webhook URL for notifications
    VALIDATION_INTERVAL Interval between validations in continuous mode (default: 21600s / 6h)

EXAMPLES:
    # Run validation for initial stage
    $0 initial

    # Run in continuous monitoring mode
    $0 --continuous expand

    # Use custom API URL
    API_URL=https://staging.igris-inertial.com $0 full

EOF
    exit 0
}

# Parse command line arguments
CONTINUOUS_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--continuous)
            CONTINUOUS_MODE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        initial|expand|full)
            CANARY_STAGE="$1"
            shift
            ;;
        *)
            log_error "Unknown argument: $1"
            usage
            ;;
    esac
done

# Main execution
if [[ "$CONTINUOUS_MODE" == true ]]; then
    monitor_continuous
else
    run_validation
    exit $?
fi
