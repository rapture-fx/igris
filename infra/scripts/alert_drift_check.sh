#!/bin/bash

# Schlep-Engine Alert Drift Check Script
# Phase 5 - Operational Hardening and Pilot Launch
#
# This script monitors alert firing patterns and detects anomalies:
# - Compares live alerts vs expected alert patterns
# - Detects alert drift (unexpected alerts, missing expected alerts)
# - Identifies false positives and alert fatigue patterns
# - Validates alert noise reduction effectiveness
#
# Usage: ./alert_drift_check.sh [--baseline] [--report]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"
BASELINE_FILE="${BASELINE_FILE:-${SCRIPT_DIR}/alert_baseline.json}"
REPORT_FILE="${REPORT_FILE:-/tmp/alert_drift_report_$(date +%Y%m%d_%H%M%S).json}"
LOG_FILE="${LOG_FILE:-/tmp/alert_drift_$(date +%Y%m%d_%H%M%S).log}"
DRIFT_THRESHOLD="${DRIFT_THRESHOLD:-5.0}"  # 5% drift threshold
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_debug() {
    echo -e "${PURPLE}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    for cmd in curl jq bc; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_error "Please install: sudo apt-get install curl jq bc"
        exit 1
    fi
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
            "title": "Schlep-Engine Alert Drift Detection",
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

# Query Prometheus for alert metrics
query_prometheus() {
    local query="$1"
    local response=$(curl -s -G --data-urlencode "query=$query" "${PROMETHEUS_URL}/api/v1/query")
    local status=$(echo "$response" | jq -r '.status // "error"')

    if [[ "$status" != "success" ]]; then
        log_debug "Prometheus query failed: $query"
        echo "[]"
        return 1
    fi

    echo "$response" | jq -r '.data.result'
}

# Get active alerts from AlertManager
get_active_alerts() {
    local response=$(curl -s "${ALERTMANAGER_URL}/api/v2/alerts?active=true&silenced=false&inhibited=false")

    if [[ -z "$response" ]]; then
        log_error "Failed to fetch active alerts from AlertManager"
        echo "[]"
        return 1
    fi

    echo "$response"
}

# Get alert firing history from Prometheus
get_alert_history() {
    local lookback="${1:-24h}"

    # Expected alerts from Phase 3-5
    local expected_alerts=(
        "RedisLatencySpike"
        "SLADegradation"
        "ForecastDriftHigh"
        "ProviderErrorRateSpike"
        "BayesianTunerLowConfidence"
        "SemanticRoutingCacheMiss"
        "CostBudgetExceeded"
        "DatabaseConnectionPoolExhausted"
    )

    local alert_data="{"

    for alert_name in "${expected_alerts[@]}"; do
        local query="ALERTS{alertname=\"$alert_name\"}[${lookback}]"
        local result=$(query_prometheus "$query")

        local count=$(echo "$result" | jq 'length')
        alert_data+="\"$alert_name\":$count,"
    done

    # Remove trailing comma and close JSON
    alert_data="${alert_data%,}}"

    echo "$alert_data"
}

# Calculate alert statistics
calculate_alert_stats() {
    local history="$1"

    local total_alerts=0
    local unique_alerts=0

    for count in $(echo "$history" | jq -r '.[]'); do
        total_alerts=$((total_alerts + count))
        if [[ $count -gt 0 ]]; then
            unique_alerts=$((unique_alerts + 1))
        fi
    done

    echo "{\"total\":$total_alerts,\"unique\":$unique_alerts}"
}

# Create baseline from current alert patterns
create_baseline() {
    log_info "Creating alert baseline from last 7 days of data..."

    local history=$(get_alert_history "7d")
    local stats=$(calculate_alert_stats "$history")
    local active_alerts=$(get_active_alerts)

    local baseline=$(cat <<EOF
{
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "lookback_period": "7d",
    "alert_history": $history,
    "statistics": $stats,
    "active_alerts_sample": $(echo "$active_alerts" | jq '[.[0:5]]'),
    "thresholds": {
        "drift_threshold_percent": $DRIFT_THRESHOLD,
        "max_false_positive_rate": 2.0,
        "min_alert_noise_reduction": 60.0
    }
}
EOF
    )

    echo "$baseline" | jq '.' > "$BASELINE_FILE"
    log_success "Baseline created and saved to: $BASELINE_FILE"

    echo "$baseline" | jq '.'
}

# Load baseline
load_baseline() {
    if [[ ! -f "$BASELINE_FILE" ]]; then
        log_error "Baseline file not found: $BASELINE_FILE"
        log_error "Run with --baseline to create a baseline first"
        exit 1
    fi

    cat "$BASELINE_FILE"
}

# Compare current alerts vs baseline
compare_with_baseline() {
    local baseline="$1"
    local current_history=$(get_alert_history "24h")
    local current_stats=$(calculate_alert_stats "$current_history")

    local baseline_total=$(echo "$baseline" | jq -r '.statistics.total')
    local current_total=$(echo "$current_stats" | jq -r '.total')

    # Calculate drift percentage
    local drift=0
    if [[ $baseline_total -gt 0 ]]; then
        drift=$(echo "scale=2; (($current_total - $baseline_total) / $baseline_total) * 100" | bc)
    fi

    log_info "Baseline total alerts (7d): $baseline_total"
    log_info "Current total alerts (24h normalized): $current_total"
    log_info "Drift: ${drift}%"

    # Detect unexpected alerts (alerts not in baseline)
    local unexpected_alerts=()
    for alert_name in $(echo "$current_history" | jq -r 'keys[]'); do
        local baseline_count=$(echo "$baseline" | jq -r ".alert_history[\"$alert_name\"] // 0")
        local current_count=$(echo "$current_history" | jq -r ".[\"$alert_name\"]")

        if [[ $baseline_count -eq 0 && $current_count -gt 0 ]]; then
            unexpected_alerts+=("$alert_name")
            log_warn "Unexpected alert detected: $alert_name (fired $current_count times)"
        fi
    done

    # Detect missing expected alerts (alerts in baseline but not firing)
    local missing_alerts=()
    for alert_name in $(echo "$baseline" | jq -r '.alert_history | keys[]'); do
        local baseline_count=$(echo "$baseline" | jq -r ".alert_history[\"$alert_name\"]")
        local current_count=$(echo "$current_history" | jq -r ".[\"$alert_name\"] // 0")

        if [[ $baseline_count -gt 0 && $current_count -eq 0 ]]; then
            missing_alerts+=("$alert_name")
            log_debug "Expected alert not firing: $alert_name"
        fi
    done

    # Generate drift report
    local report=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "drift_analysis": {
        "baseline_total_alerts": $baseline_total,
        "current_total_alerts": $current_total,
        "drift_percent": $drift,
        "drift_threshold": $DRIFT_THRESHOLD,
        "drift_exceeded": $(echo "$drift > $DRIFT_THRESHOLD" | bc -l)
    },
    "unexpected_alerts": $(printf '%s\n' "${unexpected_alerts[@]}" | jq -R . | jq -s .),
    "missing_alerts": $(printf '%s\n' "${missing_alerts[@]}" | jq -R . | jq -s .),
    "alert_history": $current_history,
    "statistics": $current_stats
}
EOF
    )

    echo "$report"
}

# Calculate alert noise reduction
calculate_noise_reduction() {
    log_info "Calculating alert noise reduction effectiveness..."

    # Query total alerts fired before noise reduction (simulated baseline)
    local pre_reduction=$(query_prometheus 'sum(increase(ALERTS_total[24h]))')
    pre_reduction=$(echo "$pre_reduction" | jq -r '.[0].value[1] // "0"')

    # Query alerts suppressed by noise reduction system
    local suppressed=$(query_prometheus 'sum(increase(schlep_alerts_suppressed_total[24h]))')
    suppressed=$(echo "$suppressed" | jq -r '.[0].value[1] // "0"')

    local reduction=0
    if (( $(echo "$pre_reduction > 0" | bc -l) )); then
        reduction=$(echo "scale=2; ($suppressed / $pre_reduction) * 100" | bc)
    fi

    log_info "Alerts suppressed: $suppressed"
    log_info "Alert noise reduction: ${reduction}%"

    if (( $(echo "$reduction >= 60.0" | bc -l) )); then
        log_success "Alert noise reduction target achieved (≥60%)"
    else
        log_warn "Alert noise reduction below target: ${reduction}% < 60%"
    fi

    echo "$reduction"
}

# Calculate false positive rate
calculate_false_positive_rate() {
    log_info "Calculating alert false positive rate..."

    # Query total alerts
    local total_alerts=$(query_prometheus 'sum(increase(ALERTS_total[24h]))')
    total_alerts=$(echo "$total_alerts" | jq -r '.[0].value[1] // "0"')

    # Query confirmed false positives (would need manual tagging in production)
    # For now, estimate based on alert aggregation ratio
    local false_positives=$(query_prometheus 'sum(increase(schlep_alert_false_positive_total[24h]))')
    false_positives=$(echo "$false_positives" | jq -r '.[0].value[1] // "0"')

    local fp_rate=0
    if (( $(echo "$total_alerts > 0" | bc -l) )); then
        fp_rate=$(echo "scale=2; ($false_positives / $total_alerts) * 100" | bc)
    fi

    log_info "False positive rate: ${fp_rate}%"

    if (( $(echo "$fp_rate < 2.0" | bc -l) )); then
        log_success "False positive rate within acceptable range (<2%)"
    else
        log_warn "False positive rate elevated: ${fp_rate}% >= 2%"
    fi

    echo "$fp_rate"
}

# Generate comprehensive report
generate_report() {
    local baseline="$1"
    local drift_analysis="$2"

    log_info "Generating comprehensive drift report..."

    local noise_reduction=$(calculate_noise_reduction)
    local fp_rate=$(calculate_false_positive_rate)
    local active_alerts=$(get_active_alerts)

    local report=$(cat <<EOF
{
    "report_metadata": {
        "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "prometheus_url": "$PROMETHEUS_URL",
        "alertmanager_url": "$ALERTMANAGER_URL",
        "baseline_file": "$BASELINE_FILE"
    },
    "drift_analysis": $(echo "$drift_analysis" | jq '.drift_analysis'),
    "unexpected_alerts": $(echo "$drift_analysis" | jq '.unexpected_alerts'),
    "missing_alerts": $(echo "$drift_analysis" | jq '.missing_alerts'),
    "noise_reduction": {
        "reduction_percent": $noise_reduction,
        "target_percent": 60.0,
        "target_met": $(echo "$noise_reduction >= 60.0" | bc -l)
    },
    "false_positive_rate": {
        "rate_percent": $fp_rate,
        "threshold_percent": 2.0,
        "acceptable": $(echo "$fp_rate < 2.0" | bc -l)
    },
    "active_alerts": {
        "count": $(echo "$active_alerts" | jq 'length'),
        "alerts": $(echo "$active_alerts" | jq '[.[] | {name: .labels.alertname, severity: .labels.severity, state: .status.state}]')
    },
    "recommendations": []
}
EOF
    )

    # Add recommendations based on findings
    local recommendations=()

    if (( $(echo "$drift_analysis" | jq -r '.drift_analysis.drift_exceeded') == 1 )); then
        recommendations+=("Alert drift exceeds threshold - investigate alert configuration changes")
    fi

    if (( $(echo "$noise_reduction < 60.0" | bc -l) )); then
        recommendations+=("Alert noise reduction below target - review noise reduction rules")
    fi

    if (( $(echo "$fp_rate >= 2.0" | bc -l) )); then
        recommendations+=("False positive rate elevated - review alert thresholds and conditions")
    fi

    local unexpected_count=$(echo "$drift_analysis" | jq '.unexpected_alerts | length')
    if [[ $unexpected_count -gt 0 ]]; then
        recommendations+=("$unexpected_count unexpected alerts detected - verify alert definitions")
    fi

    # Add recommendations to report
    report=$(echo "$report" | jq --argjson recs "$(printf '%s\n' "${recommendations[@]}" | jq -R . | jq -s .)" '.recommendations = $recs')

    echo "$report" | jq '.' > "$REPORT_FILE"
    log_success "Report generated: $REPORT_FILE"

    echo "$report"
}

# Display summary
display_summary() {
    local report="$1"

    log_info "=========================================="
    log_info "Alert Drift Check Summary"
    log_info "=========================================="

    local drift_percent=$(echo "$report" | jq -r '.drift_analysis.drift_percent')
    local drift_exceeded=$(echo "$report" | jq -r '.drift_analysis.drift_exceeded')
    local noise_reduction=$(echo "$report" | jq -r '.noise_reduction.reduction_percent')
    local fp_rate=$(echo "$report" | jq -r '.false_positive_rate.rate_percent')
    local active_count=$(echo "$report" | jq -r '.active_alerts.count')

    echo -e "Drift: ${drift_percent}% (threshold: ${DRIFT_THRESHOLD}%)"
    echo -e "Noise Reduction: ${noise_reduction}% (target: 60%)"
    echo -e "False Positive Rate: ${fp_rate}% (threshold: 2%)"
    echo -e "Active Alerts: ${active_count}"

    log_info "=========================================="

    # Determine overall status
    local status="success"
    local message="Alert drift check completed successfully"

    if [[ $drift_exceeded == "true" ]]; then
        status="error"
        message="Alert drift exceeded threshold"
    elif (( $(echo "$noise_reduction < 60.0" | bc -l) )) || (( $(echo "$fp_rate >= 2.0" | bc -l) )); then
        status="warning"
        message="Alert drift check completed with warnings"
    fi

    send_slack_notification "$status" "$message: Drift=${drift_percent}%, Noise Reduction=${noise_reduction}%, FP Rate=${fp_rate}%"

    if [[ $status == "error" ]]; then
        return 1
    fi

    return 0
}

# Usage information
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Monitor alert drift and validate alert noise reduction effectiveness

OPTIONS:
    --baseline          Create a new baseline from current alert patterns
    --report            Generate a detailed drift report
    -h, --help          Show this help message

ENVIRONMENT VARIABLES:
    PROMETHEUS_URL          Prometheus server URL (default: http://localhost:9090)
    ALERTMANAGER_URL        AlertManager URL (default: http://localhost:9093)
    BASELINE_FILE           Path to baseline file (default: ./alert_baseline.json)
    DRIFT_THRESHOLD         Drift threshold percentage (default: 5.0)
    SLACK_WEBHOOK_URL       Slack webhook for notifications

EXAMPLES:
    # Create baseline
    $0 --baseline

    # Check drift against baseline
    $0

    # Generate detailed report
    $0 --report

EOF
    exit 0
}

# Main execution
main() {
    check_dependencies

    local mode="check"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --baseline)
                mode="baseline"
                shift
                ;;
            --report)
                mode="report"
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

    case $mode in
        baseline)
            create_baseline
            ;;
        check|report)
            local baseline=$(load_baseline)
            local drift_analysis=$(compare_with_baseline "$baseline")

            if [[ $mode == "report" ]]; then
                local report=$(generate_report "$baseline" "$drift_analysis")
                display_summary "$report"
            else
                echo "$drift_analysis" | jq '.'
                local drift_exceeded=$(echo "$drift_analysis" | jq -r '.drift_analysis.drift_exceeded')
                [[ $drift_exceeded == "true" ]] && exit 1
            fi
            ;;
    esac
}

main "$@"
