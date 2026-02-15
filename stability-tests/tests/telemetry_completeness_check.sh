#!/bin/bash
#
# Igris Inertial Telemetry Completeness Check
# Validates presence of all required Prometheus metrics
#
# Usage: ./telemetry_completeness_check.sh [METRICS_URL]
# Example: ./telemetry_completeness_check.sh http://localhost:8080/metrics
#

set -e

METRICS_URL="${1:-http://localhost:8080/metrics}"
OUTPUT_DIR="tests/results"
OUTPUT_FILE="$OUTPUT_DIR/metrics_coverage_report.json"

mkdir -p "$OUTPUT_DIR"

echo "========================================="
echo "Telemetry Completeness Check"
echo "========================================="
echo "Metrics URL: $METRICS_URL"
echo "========================================="
echo

# Define required Igris-specific metrics
REQUIRED_METRICS=(
    "igris_routing_latency_seconds"
    "igris_provider_latency_seconds"
    "igris_provider_requests_total"
    "igris_telemetry_recorded_total"
    "igris_telemetry_errors_total"
    "igris_telemetry_dropped_total"
    "igris_circuit_breaker_state"
)

# Phase 1: Cost visibility metrics
PHASE1_COST_METRICS=(
    "igris_estimated_cost_usd_total"
    "igris_forecast_requests_total"
    "igris_provider_cost_ratio"
    "igris_cost_per_token"
    "igris_request_cost_usd"
    "igris_cost_forecast_accuracy"
)

# Also check for standard metrics that should be present
STANDARD_METRICS=(
    "http_requests_total"
    "http_request_duration_seconds"
    "infer_requests_total"
    "infer_request_latency_ms"
)

echo "[1/4] Fetching metrics from $METRICS_URL..."
METRICS_CONTENT=$(curl -s "$METRICS_URL" 2>&1)

if [ $? -ne 0 ]; then
    echo "✗ FAIL: Could not fetch metrics from $METRICS_URL"
    echo "Error: $METRICS_CONTENT"
    echo "{ \"status\": \"FAIL\", \"error\": \"Could not fetch metrics endpoint\" }" > "$OUTPUT_FILE"
    exit 1
fi

if [ -z "$METRICS_CONTENT" ]; then
    echo "✗ FAIL: Metrics endpoint returned empty response"
    echo "{ \"status\": \"FAIL\", \"error\": \"Empty metrics response\" }" > "$OUTPUT_FILE"
    exit 1
fi

echo "✓ Successfully fetched metrics ($(echo "$METRICS_CONTENT" | wc -l) lines)"
echo

# Check for required Igris metrics
echo "[2/4] Checking required Igris-specific metrics..."
MISSING_SCHLEP_METRICS=()
PRESENT_SCHLEP_METRICS=()

for metric in "${REQUIRED_METRICS[@]}"; do
    if echo "$METRICS_CONTENT" | grep -q "^${metric}"; then
        echo "  ✓ $metric"
        PRESENT_SCHLEP_METRICS+=("$metric")
    else
        echo "  ✗ MISSING: $metric"
        MISSING_SCHLEP_METRICS+=("$metric")
    fi
done

echo
echo "Igris metrics found: ${#PRESENT_SCHLEP_METRICS[@]}/${#REQUIRED_METRICS[@]}"

# Check for Phase 1 cost metrics
echo
echo "[2.5/4] Checking Phase 1 cost metrics..."
MISSING_COST_METRICS=()
PRESENT_COST_METRICS=()

for metric in "${PHASE1_COST_METRICS[@]}"; do
    if echo "$METRICS_CONTENT" | grep -q "^${metric}"; then
        echo "  ✓ $metric"
        PRESENT_COST_METRICS+=("$metric")
    else
        echo "  ⚠ MISSING: $metric (Phase 1 feature)"
        MISSING_COST_METRICS+=("$metric")
    fi
done

echo
echo "Phase 1 cost metrics found: ${#PRESENT_COST_METRICS[@]}/${#PHASE1_COST_METRICS[@]}"

# Check for standard metrics
echo
echo "[3/4] Checking standard infrastructure metrics..."
MISSING_STANDARD_METRICS=()
PRESENT_STANDARD_METRICS=()

for metric in "${STANDARD_METRICS[@]}"; do
    if echo "$METRICS_CONTENT" | grep -q "^${metric}"; then
        echo "  ✓ $metric"
        PRESENT_STANDARD_METRICS+=("$metric")
    else
        echo "  ⚠ MISSING: $metric (optional but recommended)"
        MISSING_STANDARD_METRICS+=("$metric")
    fi
done

echo
echo "Standard metrics found: ${#PRESENT_STANDARD_METRICS[@]}/${#STANDARD_METRICS[@]}"

# Additional metrics discovery
echo
echo "[4/4] Discovering additional metrics..."
TOTAL_METRICS=$(echo "$METRICS_CONTENT" | grep -E "^[a-z_]+ " | wc -l)
echo "Total metrics exposed: $TOTAL_METRICS"

# Check for specific metric types
HAS_HISTOGRAM=$(echo "$METRICS_CONTENT" | grep -c "_bucket{" || true)
HAS_GAUGE=$(echo "$METRICS_CONTENT" | grep -c "gauge" || true)
HAS_COUNTER=$(echo "$METRICS_CONTENT" | grep -c "counter" || true)

echo "Histogram metrics: $HAS_HISTOGRAM"
echo "Gauge metrics: $HAS_GAUGE"
echo "Counter metrics: $HAS_COUNTER"

# Determine overall status
PASS_FAIL="PASS"
STATUS_MESSAGE="All required metrics present"
RECOMMENDATIONS=()

if [ ${#MISSING_SCHLEP_METRICS[@]} -gt 0 ]; then
    PASS_FAIL="FAIL"
    STATUS_MESSAGE="Missing critical Igris-specific metrics"
    RECOMMENDATIONS+=("Implement missing Igris-specific metrics: ${MISSING_SCHLEP_METRICS[*]}")
    RECOMMENDATIONS+=("Review internal/observability/metrics.go for metric definitions")
fi

if [ ${#MISSING_STANDARD_METRICS[@]} -gt 0 ]; then
    if [ "$PASS_FAIL" != "FAIL" ]; then
        PASS_FAIL="WARN"
        STATUS_MESSAGE="Missing recommended standard metrics"
    fi
    RECOMMENDATIONS+=("Consider adding standard metrics: ${MISSING_STANDARD_METRICS[*]}")
fi

if [ ${#MISSING_COST_METRICS[@]} -gt 0 ]; then
    RECOMMENDATIONS+=("Phase 1 cost metrics missing: ${MISSING_COST_METRICS[*]}")
    RECOMMENDATIONS+=("Ensure CostForecastMiddleware is enabled in HTTP server")
fi

if [ "$TOTAL_METRICS" -lt 10 ]; then
    if [ "$PASS_FAIL" != "FAIL" ]; then
        PASS_FAIL="WARN"
    fi
    RECOMMENDATIONS+=("Total metrics count is low ($TOTAL_METRICS). Consider adding more observability.")
fi

# Generate JSON report
echo
echo "Generating JSON report..."

cat > "$OUTPUT_FILE" <<EOF
{
  "module_id": "telemetry_completeness_check",
  "status": "$STATUS_MESSAGE",
  "pass_fail": "$PASS_FAIL",
  "metrics_url": "$METRICS_URL",
  "total_metrics_exposed": $TOTAL_METRICS,
  "required_igris_metrics": {
    "total": ${#REQUIRED_METRICS[@]},
    "present": ${#PRESENT_SCHLEP_METRICS[@]},
    "missing": ${#MISSING_SCHLEP_METRICS[@]},
    "missing_list": $(printf '%s\n' "${MISSING_SCHLEP_METRICS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
  },
  "standard_metrics": {
    "total": ${#STANDARD_METRICS[@]},
    "present": ${#PRESENT_STANDARD_METRICS[@]},
    "missing": ${#MISSING_STANDARD_METRICS[@]},
    "missing_list": $(printf '%s\n' "${MISSING_STANDARD_METRICS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
  },
  "metric_types": {
    "histogram_count": $HAS_HISTOGRAM,
    "gauge_count": $HAS_GAUGE,
    "counter_count": $HAS_COUNTER
  },
  "recommendations": $(printf '%s\n' "${RECOMMENDATIONS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Pretty print summary
echo
echo "========================================="
echo "TELEMETRY COMPLETENESS SUMMARY"
echo "========================================="
echo "Status: $PASS_FAIL"
echo "Message: $STATUS_MESSAGE"
echo
echo "Required Igris Metrics:"
echo "  Present: ${#PRESENT_SCHLEP_METRICS[@]}/${#REQUIRED_METRICS[@]}"
if [ ${#MISSING_SCHLEP_METRICS[@]} -gt 0 ]; then
    echo "  Missing: ${MISSING_SCHLEP_METRICS[*]}"
fi
echo
echo "Standard Metrics:"
echo "  Present: ${#PRESENT_STANDARD_METRICS[@]}/${#STANDARD_METRICS[@]}"
if [ ${#MISSING_STANDARD_METRICS[@]} -gt 0 ]; then
    echo "  Missing: ${MISSING_STANDARD_METRICS[*]}"
fi
echo
echo "Total Metrics Exposed: $TOTAL_METRICS"

if [ ${#RECOMMENDATIONS[@]} -gt 0 ]; then
    echo
    echo "Recommendations:"
    for rec in "${RECOMMENDATIONS[@]}"; do
        echo "  - $rec"
    done
fi

echo
echo "Report saved to: $OUTPUT_FILE"
echo "========================================="

# Exit with error if failed
if [ "$PASS_FAIL" == "FAIL" ]; then
    exit 1
fi

exit 0
