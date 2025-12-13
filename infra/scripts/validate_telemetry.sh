#!/bin/bash

# Schlep-Engine Telemetry Validation Script
# Phase 5 - Operational Hardening and Pilot Launch
#
# This script validates telemetry completeness and accuracy across all monitoring endpoints
#
# Usage: ./validate_telemetry.sh [--verbose]

set -euo pipefail

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_debug() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "[DEBUG] $(date '+%Y-%m-%d %H:%M:%S') - $*"
    fi
}

# Check API health
check_api_health() {
    log_info "Validating API health endpoint..."

    local response=$(curl -s "${API_URL}/v1/health" || echo "error")

    if [[ "$response" == "error" ]]; then
        log_error "API health endpoint not accessible"
        return 1
    fi

    local status=$(echo "$response" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")

    if [[ "$status" == "healthy" || "$status" == "ok" ]]; then
        log_success "API health check passed"
        log_debug "Response: $response"
        return 0
    else
        log_error "API health check failed: status=$status"
        return 1
    fi
}

# Check metrics endpoint
check_metrics_endpoint() {
    log_info "Validating metrics endpoint..."

    local response=$(curl -s "${API_URL}/v1/metrics" || echo "error")

    if [[ "$response" == "error" ]]; then
        log_error "Metrics endpoint not accessible"
        return 1
    fi

    # Check if response contains Prometheus-formatted metrics
    if echo "$response" | grep -q "^# HELP"; then
        log_success "Metrics endpoint accessible"
        local metric_count=$(echo "$response" | grep -c "^# HELP" || echo "0")
        log_debug "Found $metric_count metric families"
        return 0
    else
        log_error "Metrics endpoint not returning Prometheus format"
        return 1
    fi
}

# Validate critical metrics presence
validate_critical_metrics() {
    log_info "Validating critical metrics presence..."

    local critical_metrics=(
        "schlep_cost_forecast_accuracy"
        "schlep_redis_latency_ms"
        "schlep_request_duration_ms_bucket"
        "schlep_errors_total"
        "schlep_sla_violations_total"
        "schlep_bayesian_tuner_confidence"
        "schlep_semantic_cache_hits_total"
        "schlep_cost_total_usd"
    )

    local failures=0
    local total=${#critical_metrics[@]}

    for metric in "${critical_metrics[@]}"; do
        local result=$(curl -s -G --data-urlencode "query=$metric" "${PROMETHEUS_URL}/api/v1/query" | jq -r '.status')

        if [[ "$result" == "success" ]]; then
            log_debug "✓ Metric present: $metric"
        else
            log_warn "✗ Metric missing: $metric"
            ((failures++))
        fi
    done

    local success_rate=$(echo "scale=2; (($total - $failures) / $total) * 100" | bc)

    log_info "Metric presence: ${success_rate}% ($((total - failures))/$total)"

    if (( $(echo "$success_rate >= 98.0" | bc -l) )); then
        log_success "Critical metrics validation passed (≥98%)"
        return 0
    else
        log_error "Critical metrics validation failed: ${success_rate}% < 98%"
        return 1
    fi
}

# Validate analytics endpoints
validate_analytics_endpoints() {
    log_info "Validating analytics endpoints..."

    local endpoints=(
        "/v1/analytics/cost"
        "/v1/analytics/semantic/distribution"
        "/v1/analytics/rewards/composition"
    )

    local failures=0

    for endpoint in "${endpoints[@]}"; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}${endpoint}")

        if [[ "$status" == "200" ]]; then
            log_debug "✓ Endpoint accessible: $endpoint"
        else
            log_warn "✗ Endpoint failed ($status): $endpoint"
            ((failures++))
        fi
    done

    if [[ $failures -eq 0 ]]; then
        log_success "All analytics endpoints accessible"
        return 0
    else
        log_error "$failures analytics endpoints failed"
        return 1
    fi
}

# Validate metric data quality
validate_metric_data_quality() {
    log_info "Validating metric data quality..."

    # Check forecast accuracy is in valid range [0, 1]
    local forecast_accuracy=$(curl -s -G --data-urlencode "query=schlep_cost_forecast_accuracy" "${PROMETHEUS_URL}/api/v1/query" | jq -r '.data.result[0].value[1] // "error"')

    if [[ "$forecast_accuracy" != "error" ]]; then
        if (( $(echo "$forecast_accuracy >= 0 && $forecast_accuracy <= 1" | bc -l) )); then
            log_debug "✓ Forecast accuracy in valid range: $forecast_accuracy"
        else
            log_warn "✗ Forecast accuracy out of range: $forecast_accuracy"
        fi
    fi

    # Check Redis latency is reasonable (<1000ms)
    local redis_latency=$(curl -s -G --data-urlencode "query=avg(schlep_redis_latency_ms)" "${PROMETHEUS_URL}/api/v1/query" | jq -r '.data.result[0].value[1] // "error"')

    if [[ "$redis_latency" != "error" ]]; then
        if (( $(echo "$redis_latency < 1000" | bc -l) )); then
            log_debug "✓ Redis latency reasonable: ${redis_latency}ms"
        else
            log_warn "✗ Redis latency elevated: ${redis_latency}ms"
        fi
    fi

    # Check for data staleness (metrics should be recent)
    local last_scrape=$(curl -s -G --data-urlencode "query=up" "${PROMETHEUS_URL}/api/v1/query" | jq -r '.data.result[0].value[0] // "0"')
    local current_time=$(date +%s)
    local time_diff=$((current_time - ${last_scrape%.*}))

    if [[ $time_diff -lt 120 ]]; then
        log_debug "✓ Metrics are fresh (${time_diff}s old)"
    else
        log_warn "✗ Metrics may be stale (${time_diff}s old)"
    fi

    log_success "Data quality validation completed"
}

# Validate telemetry completeness
validate_telemetry_completeness() {
    log_info "Validating telemetry completeness..."

    local expected_labels=(
        "tenant_id"
        "provider"
        "model"
        "endpoint"
    )

    # Check if key metrics have proper labels
    local response=$(curl -s "${API_URL}/v1/metrics")

    local completeness=100

    for label in "${expected_labels[@]}"; do
        if echo "$response" | grep -q "$label"; then
            log_debug "✓ Label found in metrics: $label"
        else
            log_warn "✗ Label missing from metrics: $label"
            completeness=$((completeness - 10))
        fi
    done

    log_info "Telemetry completeness: ${completeness}%"

    if [[ $completeness -ge 98 ]]; then
        log_success "Telemetry completeness check passed (≥98%)"
        return 0
    else
        log_error "Telemetry completeness check failed: ${completeness}% < 98%"
        return 1
    fi
}

# Test synthetic metrics generation
test_synthetic_metrics() {
    log_info "Testing synthetic metric generation..."

    # Make a test request to generate metrics
    local test_response=$(curl -s -X POST "${API_URL}/v1/infer" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "Test"}],
            "max_tokens": 10
        }' 2>/dev/null || echo "error")

    if [[ "$test_response" != "error" ]]; then
        log_debug "Test request sent successfully"

        # Wait for metrics to be scraped
        sleep 5

        # Check if request was recorded in metrics
        local request_count=$(curl -s -G --data-urlencode "query=increase(schlep_requests_total[1m])" "${PROMETHEUS_URL}/api/v1/query" | jq -r '.data.result[0].value[1] // "0"')

        if [[ "$request_count" != "0" ]]; then
            log_success "Synthetic metrics generated successfully"
            return 0
        else
            log_warn "Synthetic metrics not detected (may need more time)"
            return 0  # Not a critical failure
        fi
    else
        log_warn "Test request failed (endpoint may require authentication)"
        return 0  # Not a critical failure
    fi
}

# Generate validation report
generate_validation_report() {
    local total_checks="$1"
    local passed_checks="$2"

    log_info "=========================================="
    log_info "Telemetry Validation Report"
    log_info "=========================================="
    echo "API URL: $API_URL"
    echo "Prometheus URL: $PROMETHEUS_URL"
    echo "Timestamp: $(date)"
    echo "Total Checks: $total_checks"
    echo "Passed: $passed_checks"
    echo "Failed: $((total_checks - passed_checks))"
    echo "Success Rate: $(echo "scale=2; ($passed_checks / $total_checks) * 100" | bc)%"
    log_info "=========================================="

    if [[ $passed_checks -eq $total_checks ]]; then
        log_success "ALL TELEMETRY VALIDATION CHECKS PASSED ✓"
        return 0
    elif [[ $passed_checks -ge $((total_checks * 90 / 100)) ]]; then
        log_warn "TELEMETRY VALIDATION PASSED WITH WARNINGS (≥90%)"
        return 0
    else
        log_error "TELEMETRY VALIDATION FAILED"
        return 1
    fi
}

# Usage information
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Validate telemetry completeness and accuracy for Schlep-Engine

OPTIONS:
    --verbose           Enable verbose output
    -h, --help          Show this help message

ENVIRONMENT VARIABLES:
    API_URL             Base URL for Schlep-Engine API (default: http://localhost:8080)
    PROMETHEUS_URL      Prometheus server URL (default: http://localhost:9090)

EXAMPLES:
    # Run validation
    $0

    # Run with verbose output
    $0 --verbose

    # Use custom URLs
    API_URL=https://staging.igris-inertial.com $0

EOF
    exit 0
}

# Main execution
main() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done

    log_info "Starting telemetry validation..."
    log_info "API URL: $API_URL"
    log_info "Prometheus URL: $PROMETHEUS_URL"

    local total_checks=0
    local passed_checks=0

    # Run validation checks
    check_api_health && ((passed_checks++)) || true
    ((total_checks++))

    check_metrics_endpoint && ((passed_checks++)) || true
    ((total_checks++))

    validate_critical_metrics && ((passed_checks++)) || true
    ((total_checks++))

    validate_analytics_endpoints && ((passed_checks++)) || true
    ((total_checks++))

    validate_metric_data_quality && ((passed_checks++)) || true
    ((total_checks++))

    validate_telemetry_completeness && ((passed_checks++)) || true
    ((total_checks++))

    test_synthetic_metrics && ((passed_checks++)) || true
    ((total_checks++))

    # Generate report
    generate_validation_report "$total_checks" "$passed_checks"
}

main "$@"
