#!/bin/bash

################################################################################
# Cost Report Generator for Schlep-Engine
#
# Generates comprehensive cost reports from Prometheus metrics including:
# - Daily/weekly/monthly cost summaries
# - Cost breakdown by runtime (Rust vs Python)
# - Cost efficiency metrics
# - Historical trends
# - Export to CSV/JSON
#
# Usage:
#   ./generate_cost_report.sh [period] [format]
#
#   period: daily, weekly, monthly (default: daily)
#   format: json, csv, text (default: text)
#
# Examples:
#   ./generate_cost_report.sh daily json
#   ./generate_cost_report.sh monthly csv
#   ./generate_cost_report.sh weekly text
################################################################################

set -euo pipefail

# Configuration
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
REPORT_DIR="${REPORT_DIR:-./reports/cost}"
PERIOD="${1:-daily}"
FORMAT="${2:-text}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create report directory
mkdir -p "$REPORT_DIR"

# Determine time range based on period
case "$PERIOD" in
    daily)
        TIME_RANGE="24h"
        REPORT_TITLE="Daily Cost Report"
        ;;
    weekly)
        TIME_RANGE="7d"
        REPORT_TITLE="Weekly Cost Report"
        ;;
    monthly)
        TIME_RANGE="30d"
        REPORT_TITLE="Monthly Cost Report"
        ;;
    *)
        log_error "Invalid period: $PERIOD. Use: daily, weekly, or monthly"
        exit 1
        ;;
esac

log_info "Generating $REPORT_TITLE..."
log_info "Querying Prometheus at: $PROMETHEUS_URL"

# Query Prometheus for cost metrics
query_prometheus() {
    local query="$1"
    local result

    result=$(curl -s --data-urlencode "query=$query" \
        "${PROMETHEUS_URL}/api/v1/query" | jq -r '.data.result')

    echo "$result"
}

# Calculate total cost
log_info "Calculating total cost..."
TOTAL_COST_QUERY="sum(increase(inference_cost_usd_total[${TIME_RANGE}]))"
TOTAL_COST=$(query_prometheus "$TOTAL_COST_QUERY" | jq -r '.[0].value[1] // 0')

# Calculate cost by runtime
log_info "Calculating cost by runtime..."
RUST_COST_QUERY="sum(increase(inference_cost_usd_total{runtime=\"rust\"}[${TIME_RANGE}]))"
PYTHON_COST_QUERY="sum(increase(inference_cost_usd_total{runtime=\"python\"}[${TIME_RANGE}]))"

RUST_COST=$(query_prometheus "$RUST_COST_QUERY" | jq -r '.[0].value[1] // 0')
PYTHON_COST=$(query_prometheus "$PYTHON_COST_QUERY" | jq -r '.[0].value[1] // 0')

# Calculate inference counts
log_info "Calculating inference counts..."
TOTAL_INFERENCES_QUERY="sum(increase(inference_requests_total[${TIME_RANGE}]))"
RUST_INFERENCES_QUERY="sum(increase(inference_requests_total{runtime=\"rust\"}[${TIME_RANGE}]))"
PYTHON_INFERENCES_QUERY="sum(increase(inference_requests_total{runtime=\"python\"}[${TIME_RANGE}]))"

TOTAL_INFERENCES=$(query_prometheus "$TOTAL_INFERENCES_QUERY" | jq -r '.[0].value[1] // 0')
RUST_INFERENCES=$(query_prometheus "$RUST_INFERENCES_QUERY" | jq -r '.[0].value[1] // 0')
PYTHON_INFERENCES=$(query_prometheus "$PYTHON_INFERENCES_QUERY" | jq -r '.[0].value[1] // 0')

# Calculate cost per 1000 inferences
if (( $(echo "$TOTAL_INFERENCES > 0" | bc -l) )); then
    COST_PER_1K=$(echo "scale=6; ($TOTAL_COST / $TOTAL_INFERENCES) * 1000" | bc)
else
    COST_PER_1K=0
fi

if (( $(echo "$RUST_INFERENCES > 0" | bc -l) )); then
    RUST_COST_PER_1K=$(echo "scale=6; ($RUST_COST / $RUST_INFERENCES) * 1000" | bc)
else
    RUST_COST_PER_1K=0
fi

if (( $(echo "$PYTHON_INFERENCES > 0" | bc -l) )); then
    PYTHON_COST_PER_1K=$(echo "scale=6; ($PYTHON_COST / $PYTHON_INFERENCES) * 1000" | bc)
else
    PYTHON_COST_PER_1K=0
fi

# Calculate cost efficiency (inferences per dollar)
if (( $(echo "$TOTAL_COST > 0" | bc -l) )); then
    EFFICIENCY=$(echo "scale=0; $TOTAL_INFERENCES / $TOTAL_COST" | bc)
else
    EFFICIENCY=0
fi

# Calculate average latency
log_info "Calculating average latencies..."
AVG_LATENCY_QUERY="avg(rate(inference_duration_seconds_sum[${TIME_RANGE}]) / rate(inference_duration_seconds_count[${TIME_RANGE}])) * 1000"
RUST_LATENCY_QUERY="avg(rate(inference_duration_seconds_sum{runtime=\"rust\"}[${TIME_RANGE}]) / rate(inference_duration_seconds_count{runtime=\"rust\"}[${TIME_RANGE}])) * 1000"
PYTHON_LATENCY_QUERY="avg(rate(inference_duration_seconds_sum{runtime=\"python\"}[${TIME_RANGE}]) / rate(inference_duration_seconds_count{runtime=\"python\"}[${TIME_RANGE}])) * 1000"

AVG_LATENCY=$(query_prometheus "$AVG_LATENCY_QUERY" | jq -r '.[0].value[1] // 0')
RUST_LATENCY=$(query_prometheus "$RUST_LATENCY_QUERY" | jq -r '.[0].value[1] // 0')
PYTHON_LATENCY=$(query_prometheus "$PYTHON_LATENCY_QUERY" | jq -r '.[0].value[1] // 0')

# Generate report based on format
case "$FORMAT" in
    text)
        REPORT_FILE="$REPORT_DIR/cost_report_${PERIOD}_${TIMESTAMP}.txt"

        cat > "$REPORT_FILE" <<EOF
================================================================================
$REPORT_TITLE
Generated: $(date)
Period: Last ${TIME_RANGE}
================================================================================

COST SUMMARY
------------
Total Cost:                  \$$TOTAL_COST
  - Rust Runtime:            \$$RUST_COST
  - Python Runtime:          \$$PYTHON_COST

Cost per 1,000 Inferences:   \$$COST_PER_1K
  - Rust:                    \$$RUST_COST_PER_1K
  - Python:                  \$$PYTHON_COST_PER_1K

Cost Efficiency:             $EFFICIENCY inferences/dollar

INFERENCE VOLUME
----------------
Total Inferences:            $(printf "%.0f" "$TOTAL_INFERENCES")
  - Rust:                    $(printf "%.0f" "$RUST_INFERENCES") ($(echo "scale=1; $RUST_INFERENCES / $TOTAL_INFERENCES * 100" | bc)%)
  - Python:                  $(printf "%.0f" "$PYTHON_INFERENCES") ($(echo "scale=1; $PYTHON_INFERENCES / $TOTAL_INFERENCES * 100" | bc)%)

PERFORMANCE METRICS
-------------------
Average Latency:             $(printf "%.2f" "$AVG_LATENCY") ms
  - Rust:                    $(printf "%.2f" "$RUST_LATENCY") ms
  - Python:                  $(printf "%.2f" "$PYTHON_LATENCY") ms

COST COMPARISON
---------------
Rust vs Python Cost Ratio:   $(echo "scale=2; $RUST_COST / $PYTHON_COST" | bc)x
Python costs $(echo "scale=1; ($PYTHON_COST / $RUST_COST - 1) * 100" | bc)% more than Rust

PROJECTIONS
-----------
EOF

        if [ "$PERIOD" == "daily" ]; then
            MONTHLY_PROJECTION=$(echo "scale=2; $TOTAL_COST * 30" | bc)
            ANNUAL_PROJECTION=$(echo "scale=2; $TOTAL_COST * 365" | bc)
            echo "Monthly Projection:          \$$MONTHLY_PROJECTION" >> "$REPORT_FILE"
            echo "Annual Projection:           \$$ANNUAL_PROJECTION" >> "$REPORT_FILE"
        elif [ "$PERIOD" == "weekly" ]; then
            MONTHLY_PROJECTION=$(echo "scale=2; $TOTAL_COST * 4.3" | bc)
            echo "Monthly Projection:          \$$MONTHLY_PROJECTION" >> "$REPORT_FILE"
        fi

        cat >> "$REPORT_FILE" <<EOF

================================================================================
Report saved to: $REPORT_FILE
================================================================================
EOF

        log_info "Report generated: $REPORT_FILE"
        cat "$REPORT_FILE"
        ;;

    json)
        REPORT_FILE="$REPORT_DIR/cost_report_${PERIOD}_${TIMESTAMP}.json"

        cat > "$REPORT_FILE" <<EOF
{
  "report_metadata": {
    "title": "$REPORT_TITLE",
    "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "period": "$PERIOD",
    "time_range": "$TIME_RANGE"
  },
  "cost_summary": {
    "total_cost_usd": $TOTAL_COST,
    "rust_cost_usd": $RUST_COST,
    "python_cost_usd": $PYTHON_COST,
    "cost_per_1k_inferences": $COST_PER_1K,
    "rust_cost_per_1k": $RUST_COST_PER_1K,
    "python_cost_per_1k": $PYTHON_COST_PER_1K,
    "cost_efficiency_inferences_per_dollar": $EFFICIENCY
  },
  "inference_volume": {
    "total_inferences": $TOTAL_INFERENCES,
    "rust_inferences": $RUST_INFERENCES,
    "python_inferences": $PYTHON_INFERENCES,
    "rust_percentage": $(echo "scale=2; $RUST_INFERENCES / $TOTAL_INFERENCES * 100" | bc),
    "python_percentage": $(echo "scale=2; $PYTHON_INFERENCES / $TOTAL_INFERENCES * 100" | bc)
  },
  "performance_metrics": {
    "avg_latency_ms": $AVG_LATENCY,
    "rust_latency_ms": $RUST_LATENCY,
    "python_latency_ms": $PYTHON_LATENCY
  },
  "cost_comparison": {
    "rust_vs_python_ratio": $(echo "scale=4; $RUST_COST / $PYTHON_COST" | bc),
    "python_cost_premium_percent": $(echo "scale=2; ($PYTHON_COST / $RUST_COST - 1) * 100" | bc)
  }
}
EOF

        log_info "Report generated: $REPORT_FILE"
        cat "$REPORT_FILE" | jq '.'
        ;;

    csv)
        REPORT_FILE="$REPORT_DIR/cost_report_${PERIOD}_${TIMESTAMP}.csv"

        cat > "$REPORT_FILE" <<EOF
Metric,Total,Rust,Python,Unit
Total Cost,$TOTAL_COST,$RUST_COST,$PYTHON_COST,USD
Cost per 1K Inferences,$COST_PER_1K,$RUST_COST_PER_1K,$PYTHON_COST_PER_1K,USD
Inferences,$TOTAL_INFERENCES,$RUST_INFERENCES,$PYTHON_INFERENCES,count
Average Latency,$AVG_LATENCY,$RUST_LATENCY,$PYTHON_LATENCY,ms
Cost Efficiency,$EFFICIENCY,,,inferences/USD
EOF

        log_info "Report generated: $REPORT_FILE"
        cat "$REPORT_FILE"
        ;;

    *)
        log_error "Invalid format: $FORMAT. Use: text, json, or csv"
        exit 1
        ;;
esac

log_info "Cost report generation complete!"
log_info "Report saved to: $REPORT_FILE"
