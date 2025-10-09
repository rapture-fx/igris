# Cost-Per-Inference Tracking Guide

## Overview

This guide covers the comprehensive cost tracking system for Schlep-Engine ML inference operations. The system tracks costs across Rust FFI and Python ML service runtimes, providing detailed breakdowns, trends, and projections.

## Architecture

```
┌─────────────────┐
│   Go Gateway    │
│                 │
│ ┌─────────────┐ │
│ │ Cost Tracker│ │──▶ Prometheus Metrics
│ └─────────────┘ │
│                 │
│  Rust FFI  │  Python ML
└─────────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐      ┌──────────────┐
│   Prometheus    │─────▶│   Grafana    │      │ Cost Reports │
│   (Metrics)     │      │ (Dashboard)  │      │   (CLI)      │
└─────────────────┘      └──────────────┘      └──────────────┘
```

## Cost Model

### Cost Constants

Defined in `/Users/wira/Desktop/schlep-engine/go_gateway/internal/metrics/cost_tracker.go`:

```go
// Rust runtime costs (per inference)
RustCPUCostPerSecond = 0.000001  // $0.000001/sec compute
RustMemoryCostPerMB  = 0.0000001 // $0.0000001/MB/sec

// Python runtime costs (per inference)
PythonCPUCostPerSecond = 0.000002  // $0.000002/sec compute (2x Rust)
PythonMemoryCostPerMB  = 0.0000002 // $0.0000002/MB/sec (2x Rust)

// GPU costs (if applicable)
GPUCostPerSecond = 0.00001 // $0.00001/sec GPU compute
```

### Cost Calculation

#### CPU-Based Inference

```
Total Cost = (Duration × CPU Cost Rate) + (Memory × Duration × Memory Cost Rate)
```

Example for Rust inference (10ms, 100MB):
```
CPU Cost    = 0.010s × $0.000001/s = $0.00000001
Memory Cost = 100MB × 0.010s × $0.0000001/MB/s = $0.0000001
Total Cost  = $0.00000011
```

#### GPU-Based Inference

```
Total Cost = GPU Duration × GPU Cost Rate
```

Example for GPU inference (10ms):
```
GPU Cost = 0.010s × $0.00001/s = $0.0000001
```

## Metrics Exposed

### Counter Metrics

**inference_cost_usd_total**
- Description: Total inference cost in USD
- Labels: `runtime`, `endpoint`, `model`
- Usage: Calculate total costs over time

```promql
# Total cost in last hour
sum(increase(inference_cost_usd_total[1h]))

# Cost by runtime
sum(increase(inference_cost_usd_total[1h])) by (runtime)
```

**inference_requests_total**
- Description: Total number of inference requests
- Labels: `runtime`, `endpoint`, `model`
- Usage: Calculate request volume

```promql
# Total requests in last hour
sum(increase(inference_requests_total[1h]))
```

**inference_compute_seconds_total**
- Description: Total compute time in seconds
- Labels: `runtime`, `endpoint`, `model`
- Usage: Track compute resource usage

```promql
# Total compute time
sum(increase(inference_compute_seconds_total[1h]))
```

**inference_cost_by_component_usd_total**
- Description: Cost breakdown by component
- Labels: `runtime`, `component` (cpu, memory, gpu)
- Usage: Analyze cost distribution

```promql
# Cost breakdown
sum(increase(inference_cost_by_component_usd_total[1h])) by (component)
```

### Summary Metrics

**inference_duration_seconds**
- Description: Inference duration distribution
- Labels: `runtime`, `endpoint`, `model`
- Quantiles: 0.5, 0.9, 0.99

```promql
# P99 latency
inference_duration_seconds{quantile="0.99"}
```

**inference_memory_bytes**
- Description: Memory usage distribution
- Labels: `runtime`, `endpoint`, `model`
- Quantiles: 0.5, 0.9, 0.99

```promql
# P99 memory usage
inference_memory_bytes{quantile="0.99"}
```

### Histogram Metrics

**inference_cost_usd**
- Description: Cost distribution per inference
- Labels: `runtime`, `endpoint`, `model`
- Buckets: 0.000001, 0.000005, 0.00001, 0.00005, 0.0001, 0.0005, 0.001

```promql
# Average cost per inference
rate(inference_cost_usd_sum[5m]) / rate(inference_cost_usd_count[5m])
```

## Cost Tracking Rules

Location: `/Users/wira/Desktop/schlep-engine/observability/cost-rules.yml`

### Recording Rules

**inference:cost_per_1k:rate5m**
```promql
(
  rate(inference_cost_usd_total[5m])
  /
  rate(inference_requests_total[5m])
) * 1000
```
Calculates cost per 1,000 inferences in real-time.

**inference:cost_usd_hourly:projection**
```promql
rate(inference_cost_usd_total[15m]) * 3600
```
Projects hourly cost based on recent trend.

**inference:cost_usd_daily:projection**
```promql
rate(inference_cost_usd_total[1h]) * 86400
```
Projects daily cost based on hourly rate.

**inference:efficiency_per_dollar:rate5m**
```promql
(
  rate(inference_requests_total[5m])
  /
  rate(inference_cost_usd_total[5m])
)
```
Measures cost efficiency (inferences per dollar).

**inference:rust_vs_python_cost_ratio:rate5m**
```promql
(
  sum(rate(inference_cost_usd_total{runtime="rust"}[5m]))
  /
  sum(rate(inference_cost_usd_total{runtime="python"}[5m]))
)
```
Compares Rust vs Python costs.

## Implementation in Go Gateway

### Initializing Cost Tracker

```go
import "your-module/internal/metrics"

// Initialize cost tracker
costTracker := metrics.NewCostTracker(true) // true = enable detailed tracking
```

### Tracking Rust FFI Inference

```go
start := time.Now()

// Perform Rust FFI inference
result := rustFFI.DoInference(data)

// Track cost
durationMs := time.Since(start).Milliseconds()
memoryBytes := int64(result.MemoryUsed)

costTracker.TrackRustInference(
    "/api/v1/predict",  // endpoint
    "rust-model-v1",    // model
    durationMs,
    memoryBytes,
)
```

### Tracking Python ML Service Inference

```go
start := time.Now()

// Call Python ML service via gRPC
response, err := mlClient.Predict(ctx, request)

// Track cost
durationMs := time.Since(start).Milliseconds()
memoryBytes := int64(response.MemoryUsed)

costTracker.TrackPythonInference(
    "/api/v1/ml/predict",  // endpoint
    "python-model-v1",     // model
    durationMs,
    memoryBytes,
)
```

### Tracking GPU Inference

```go
start := time.Now()

// Perform GPU inference
result := gpuRuntime.Predict(data)

// Track cost
durationMs := time.Since(start).Milliseconds()
gpuTimeMs := result.GpuComputeTimeMs
memoryBytes := int64(result.MemoryUsed)

costTracker.TrackGPUInference(
    "rust",                // runtime
    "/api/v1/gpu/predict", // endpoint
    "gpu-model-v1",        // model
    durationMs,
    gpuTimeMs,
    memoryBytes,
)
```

## Grafana Dashboard

Location: `/Users/wira/Desktop/schlep-engine/observability/grafana/dashboards/cost_tracking_dashboard.json`

### Key Panels

1. **Hourly Cost Projection**
   - Shows projected hourly cost based on recent trends
   - Thresholds: Yellow at $5/hr, Red at $10/hr

2. **Daily Cost Projection**
   - Extrapolates daily cost from hourly rate
   - Thresholds: Yellow at $150/day, Red at $300/day

3. **Cost per 1,000 Inferences**
   - Key efficiency metric
   - Compare across runtimes

4. **Hourly Cost by Runtime**
   - Time series showing Rust vs Python costs
   - Includes mean, last, and max values

5. **Cost Distribution by Runtime**
   - Donut chart showing percentage breakdown
   - Helps identify optimization opportunities

6. **Cost Efficiency**
   - Inferences per dollar metric
   - Higher is better

7. **Rust vs Python Cost Ratio**
   - Gauge showing cost comparison
   - Target: <0.5 (Rust should be <50% of Python cost)

8. **Top 10 Costly Endpoints**
   - Table of endpoints sorted by cost
   - Helps identify optimization targets

### Accessing Dashboard

```bash
# Open Grafana
open http://localhost:3002

# Navigate to: Dashboards → Cost-Per-Inference Dashboard
# Or direct link: http://localhost:3002/d/cost-tracking-schlep
```

## Cost Reporting

### Using the Cost Report Script

Location: `/Users/wira/Desktop/schlep-engine/tools/scripts/generate_cost_report.sh`

#### Generate Daily Report (Text)

```bash
./tools/scripts/generate_cost_report.sh daily text
```

Output:
```
================================================================================
Daily Cost Report
Generated: Wed Oct  9 15:30:00 UTC 2025
Period: Last 24h
================================================================================

COST SUMMARY
------------
Total Cost:                  $0.12
  - Rust Runtime:            $0.05
  - Python Runtime:          $0.07

Cost per 1,000 Inferences:   $0.0024
  - Rust:                    $0.001
  - Python:                  $0.0035

Cost Efficiency:             41667 inferences/dollar

INFERENCE VOLUME
----------------
Total Inferences:            50000
  - Rust:                    30000 (60.0%)
  - Python:                  20000 (40.0%)

PERFORMANCE METRICS
-------------------
Average Latency:             15.5 ms
  - Rust:                    12.0 ms
  - Python:                  20.5 ms

COST COMPARISON
---------------
Rust vs Python Cost Ratio:   0.71x
Python costs 40.0% more than Rust

PROJECTIONS
-----------
Monthly Projection:          $3.60
Annual Projection:           $43.80
================================================================================
```

#### Generate Weekly Report (JSON)

```bash
./tools/scripts/generate_cost_report.sh weekly json
```

Output:
```json
{
  "report_metadata": {
    "title": "Weekly Cost Report",
    "generated_at": "2025-10-09T15:30:00Z",
    "period": "weekly",
    "time_range": "7d"
  },
  "cost_summary": {
    "total_cost_usd": 0.84,
    "rust_cost_usd": 0.35,
    "python_cost_usd": 0.49,
    "cost_per_1k_inferences": 0.0024,
    "rust_cost_per_1k": 0.001,
    "python_cost_per_1k": 0.0035,
    "cost_efficiency_inferences_per_dollar": 41667
  },
  "inference_volume": {
    "total_inferences": 350000,
    "rust_inferences": 210000,
    "python_inferences": 140000,
    "rust_percentage": 60.00,
    "python_percentage": 40.00
  },
  "performance_metrics": {
    "avg_latency_ms": 15.5,
    "rust_latency_ms": 12.0,
    "python_latency_ms": 20.5
  },
  "cost_comparison": {
    "rust_vs_python_ratio": 0.7143,
    "python_cost_premium_percent": 40.00
  }
}
```

#### Generate Monthly Report (CSV)

```bash
./tools/scripts/generate_cost_report.sh monthly csv
```

Output:
```csv
Metric,Total,Rust,Python,Unit
Total Cost,3.6,1.5,2.1,USD
Cost per 1K Inferences,0.0024,0.001,0.0035,USD
Inferences,1500000,900000,600000,count
Average Latency,15.5,12.0,20.5,ms
Cost Efficiency,41667,,,inferences/USD
```

### Automated Reporting

Set up cron jobs for regular reports:

```bash
# Daily report at 9 AM
0 9 * * * /Users/wira/Desktop/schlep-engine/tools/scripts/generate_cost_report.sh daily json >> /var/log/schlep-cost-reports.log

# Weekly report on Mondays
0 9 * * 1 /Users/wira/Desktop/schlep-engine/tools/scripts/generate_cost_report.sh weekly json | mail -s "Weekly Cost Report" team@example.com

# Monthly report on 1st of month
0 9 1 * * /Users/wira/Desktop/schlep-engine/tools/scripts/generate_cost_report.sh monthly csv > /reports/monthly/cost_$(date +%Y%m).csv
```

## Cost Alerts

Location: `/Users/wira/Desktop/schlep-engine/observability/prometheus-rules.yml`

### HighInferenceCost

Triggers when costs exceed $10/hour for 2 hours:

```yaml
- alert: HighInferenceCost
  expr: |
    rate(inference_cost_usd_total[1h]) > 10
  for: 2h
  labels:
    severity: warning
    service: ml-inference
  annotations:
    summary: "High inference cost detected"
    description: "Inference costs are {{ $value }} USD/hour. Review usage patterns."
```

### InferenceCostSpike

Triggers when costs double compared to 1 hour ago:

```yaml
- alert: InferenceCostSpike
  expr: |
    (
      rate(inference_cost_usd_total[15m])
      /
      rate(inference_cost_usd_total[15m] offset 1h)
    ) > 2
  for: 15m
  labels:
    severity: critical
    service: ml-inference
  annotations:
    summary: "Inference cost spike detected"
    description: "Inference costs have increased by {{ $value }}x compared to 1 hour ago."
```

## Cost Optimization Strategies

### 1. Runtime Selection

Use Rust FFI for:
- High-volume, low-latency operations
- Simple transformations
- When cost is critical

Use Python ML for:
- Complex ML models
- When flexibility is needed
- When latency is less critical

### 2. Caching

Implement aggressive caching for:
- Repeated inference requests
- Static model predictions
- Feature preprocessing results

### 3. Batch Processing

Process multiple inferences in batches:
- Amortize fixed costs
- Improve GPU utilization
- Reduce per-inference overhead

### 4. Model Optimization

- Use quantized models (INT8 vs FP32)
- Implement model pruning
- Optimize input preprocessing

### 5. Auto-Scaling

Configure worker pools based on:
- Time of day patterns
- Cost efficiency thresholds
- SLA requirements

## Monitoring Best Practices

### 1. Set Budget Alerts

Define monthly budget and set alerts at:
- 50% of budget (warning)
- 75% of budget (critical)
- 90% of budget (emergency)

### 2. Track Cost Trends

Monitor weekly trends to identify:
- Cost growth patterns
- Seasonal variations
- Anomalies

### 3. Cost Attribution

Track costs by:
- Customer/tenant
- Endpoint
- Model
- Time of day

### 4. Regular Reviews

Schedule monthly reviews to:
- Analyze cost reports
- Identify optimization opportunities
- Adjust cost constants if needed
- Validate projections

## Troubleshooting

### Metrics Not Appearing

1. Check Go Gateway is emitting metrics:
```bash
curl http://localhost:8080/metrics | grep inference_cost
```

2. Verify Prometheus is scraping:
```bash
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="go-gateway")'
```

3. Check recording rules:
```bash
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name=="cost_recording_rules")'
```

### Incorrect Cost Calculations

1. Verify cost constants in `cost_tracker.go`
2. Check memory and duration measurements
3. Review runtime labels (rust vs python)

### Dashboard Not Loading

1. Import dashboard JSON manually in Grafana
2. Verify Prometheus datasource is configured
3. Check Grafana logs for errors

## API Reference

### Cost Tracker Methods

```go
// Create new cost tracker
func NewCostTracker(enableDetailedTracking bool) *CostTracker

// Track generic inference
func (ct *CostTracker) TrackInference(metrics InferenceCostMetrics)

// Track Rust FFI inference
func (ct *CostTracker) TrackRustInference(endpoint, model string, durationMs, memoryBytes int64)

// Track Python ML inference
func (ct *CostTracker) TrackPythonInference(endpoint, model string, durationMs, memoryBytes int64)

// Track GPU inference
func (ct *CostTracker) TrackGPUInference(runtime, endpoint, model string, durationMs, gpuTimeMs, memoryBytes int64)

// Get cost estimate
func GetCostEstimate(runtime string, durationMs, memoryMB int64, isGPU bool) float64

// Get Rust vs Python cost ratio
func GetRustVsPythonCostRatio(durationMs, memoryMB int64) float64

// Get monthly projection
func GetMonthlyCostProjection(hourlyRate float64) float64

// Get cost per 1000 inferences
func GetCostPer1000Inferences(totalCost float64, requestCount int64) float64
```

## Additional Resources

- [Prometheus Recording Rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
- [Cost Optimization Guide](../OPTIMIZATION_PATCHES.md)

## Support

For issues or questions:
- Check cost metrics: `curl http://localhost:8080/metrics | grep inference_cost`
- Review cost reports in `./reports/cost/`
- Consult the team in #cost-tracking Slack channel
