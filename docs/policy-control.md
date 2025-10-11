# Policy Control Guide — Adaptive Orchestration Layer

**Version:** 1.0.0
**Target Audience:** DevOps Engineers, SREs, Platform Engineers
**Last Updated:** 2025-10-10

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Policy Model](#policy-model)
4. [Control Surface API](#control-surface-api)
5. [Policy Management Workflows](#policy-management-workflows)
6. [Safety & Rollback](#safety--rollback)
7. [Monitoring & Observability](#monitoring--observability)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The **Adaptive Orchestration Layer (AOL)** introduces intelligent, telemetry-driven policy management for Schlep-Engine's inference workloads. Policies govern routing, batching, caching, and scheduling decisions, with automatic adaptation based on real-time performance metrics.

### Key Capabilities
- **Dynamic Policy Updates:** Adjust parameters in real-time (<100ms latency)
- **Reinforcement Learning:** Optimizes policies using reward signals from latency and cost
- **Drift Detection:** Automatically rolls back policies that degrade performance
- **External Orchestration:** Control policies via REST API or CLI
- **Deterministic Rollback:** Integrate with Phase 9 checkpoint manager for safe recovery

### When to Use Policy Control
- **Adaptive Scaling:** Automatically adjust batch sizes during traffic spikes
- **Cost Optimization:** Optimize traffic splits to balance cost and performance
- **A/B Testing:** Test policy changes with canary rollouts
- **Incident Response:** Quickly rollback to known-good policies during outages
- **Multi-Region Orchestration:** Coordinate policies across geographic deployments

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Control Surface API (Go)                   │
│              /policy/update  /policy/inspect                │
│              /policy/rollback  /policy/metrics              │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴────────────────┐
        │                                │
┌───────▼────────┐              ┌────────▼────────┐
│ Policy Engine  │◄────────────►│ Feedback Loop   │
│     (Rust)     │              │     (Rust)      │
└───────┬────────┘              └─────────────────┘
        │                                │
        │                        ┌───────▼────────┐
        │                        │ Drift Monitor  │
        │                        │     (Rust)     │
        │                        └───────┬────────┘
        │                                │
        └────────────────┬───────────────┘
                         │
              ┌──────────▼───────────┐
              │ Telemetry Synthesizer│
              │        (Go)          │
              └──────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐      ┌───▼────┐      ┌───▼─────┐
   │  Rust   │      │   Go   │      │ Python  │
   │ Kernel  │      │Gateway │      │   ML    │
   └─────────┘      └────────┘      └─────────┘
```

### Component Responsibilities

| Component | Language | Responsibility |
|-----------|----------|----------------|
| **Control Surface** | Go | Exposes REST API for policy management |
| **Policy Engine** | Rust | Applies adaptive policies to inference workloads |
| **Feedback Loop** | Rust | Optimizes policies using reinforcement learning |
| **Drift Monitor** | Rust | Detects performance anomalies and triggers rollback |
| **Telemetry Synthesizer** | Go | Normalizes telemetry from all services |

---

## Policy Model

### Policy Structure

A **Policy** consists of two main components: **Routing** and **Batching**.

```json
{
  "timestamp": 1696857600000,
  "version": 42,
  "confidence": 0.95,
  "routing": {
    "primary_endpoint": "inference-us-east-1",
    "fallback_endpoint": "inference-us-west-2",
    "traffic_split": 0.85,
    "circuit_breaker_threshold": 10,
    "timeout_ms": 5000
  },
  "batching": {
    "batch_size": 32,
    "max_wait_ms": 10,
    "dynamic_sizing": true,
    "timeout_threshold_ms": 50
  },
  "trigger_metrics": {
    "avg_latency_ms": 120.5,
    "cache_hit_rate": 0.97,
    "error_rate": 0.008,
    "throughput_rps": 450.2
  }
}
```

### Parameter Descriptions

#### Routing Policy

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `primary_endpoint` | string | - | Primary inference endpoint identifier |
| `fallback_endpoint` | string | - | Fallback endpoint for failover |
| `traffic_split` | float | 0.0-1.0 | Fraction of traffic sent to primary (rest to fallback) |
| `circuit_breaker_threshold` | int | 1-100 | Number of failures before circuit opens |
| `timeout_ms` | int | 100-30000 | Request timeout in milliseconds |

#### Batching Policy

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `batch_size` | int | 1-256 | Number of requests per batch |
| `max_wait_ms` | int | 1-1000 | Maximum time to wait for batch to fill |
| `dynamic_sizing` | bool | - | Enable adaptive batch size adjustment |
| `timeout_threshold_ms` | int | 10-500 | Threshold for batch timeout detection |

### Policy Version Management

- **Version 0:** Baseline policy (default at startup)
- **Version N:** Incremented with each policy update
- **History Retention:** Last 100 versions stored for rollback

---

## Control Surface API

### Authentication

All API requests require HMAC-SHA256 authentication via the `Authorization` header:

```bash
Authorization: HMAC-SHA256 <signature>
```

**Production Setup:**
```bash
export SCHLEP_HMAC_SECRET="your-secret-key"
```

### Endpoints

#### POST /policy/update

**Description:** Update the active policy

**Request:**
```json
{
  "routing": {
    "primary_endpoint": "inference-v2",
    "fallback_endpoint": "inference-v1",
    "traffic_split": 0.9,
    "circuit_breaker_threshold": 15,
    "timeout_ms": 4000
  },
  "batching": {
    "batch_size": 64,
    "max_wait_ms": 15,
    "dynamic_sizing": false,
    "timeout_threshold_ms": 60
  },
  "confidence": 0.92
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "version": 43,
  "latency_ms": 87.3,
  "timestamp": 1696857700000
}
```

**Error (400 Bad Request):**
```json
{
  "error": "invalid batch_size: must be between 1 and 256"
}
```

#### GET /policy/inspect

**Description:** Retrieve the current active policy

**Response (200 OK):**
```json
{
  "status": "success",
  "policy": {
    "timestamp": 1696857700000,
    "version": 43,
    "routing": { ... },
    "batching": { ... },
    "confidence": 0.92,
    "trigger_metrics": { ... }
  }
}
```

#### POST /policy/rollback

**Description:** Rollback to a previous policy version

**Request:**
```json
{
  "version": 40
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "rolled_back_to": 40,
  "timestamp": 1696857800000
}
```

**Error (404 Not Found):**
```json
{
  "error": "Policy version 999 not found"
}
```

#### GET /policy/metrics

**Description:** Retrieve policy engine metrics

**Response (200 OK):**
```json
{
  "status": "success",
  "metrics": {
    "total_updates": 152,
    "successful_updates": 148,
    "rejected_updates": 4,
    "rollbacks": 2,
    "avg_confidence": 0.91,
    "last_update_latency_ms": 92.1
  }
}
```

#### GET /health

**Description:** Health check endpoint

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": 1696857900000
}
```

---

## Policy Management Workflows

### Workflow 1: Manual Policy Update

**Use Case:** Adjust batch size to handle traffic spike

```bash
# 1. Inspect current policy
curl -X GET http://localhost:8081/policy/inspect \
  -H "Authorization: HMAC-SHA256 $SIGNATURE"

# 2. Prepare update (increase batch size)
cat > policy_update.json <<EOF
{
  "routing": {
    "primary_endpoint": "inference-primary",
    "fallback_endpoint": "inference-fallback",
    "traffic_split": 0.85,
    "circuit_breaker_threshold": 10,
    "timeout_ms": 5000
  },
  "batching": {
    "batch_size": 96,
    "max_wait_ms": 20,
    "dynamic_sizing": true,
    "timeout_threshold_ms": 70
  },
  "confidence": 0.95
}
EOF

# 3. Apply update
curl -X POST http://localhost:8081/policy/update \
  -H "Authorization: HMAC-SHA256 $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d @policy_update.json

# 4. Verify update
curl -X GET http://localhost:8081/policy/inspect \
  -H "Authorization: HMAC-SHA256 $SIGNATURE"
```

### Workflow 2: Automated Adaptation

**Use Case:** Let the Policy Engine adapt to telemetry automatically

```bash
# Enable adaptive mode in config
{
  "adaptive_policy_engine": {
    "enabled": true,
    "update_interval_ms": 100,
    "confidence_threshold": 0.85
  }
}

# Monitor adaptations via logs
tail -f /var/log/schlep-engine/policy-engine.log | grep "policy_updated"
```

**Expected Log:**
```json
{
  "timestamp": "2025-10-10T14:32:15Z",
  "module": "policy_engine",
  "event": "policy_updated",
  "version": 44,
  "confidence": 0.89,
  "trigger": "high_latency",
  "batch_size_delta": -8
}
```

### Workflow 3: Canary Rollout

**Use Case:** Test new policy with 10% traffic

```bash
# 1. Create canary policy with traffic_split=0.1
cat > canary_policy.json <<EOF
{
  "routing": {
    "primary_endpoint": "inference-new",
    "fallback_endpoint": "inference-stable",
    "traffic_split": 0.1,
    "circuit_breaker_threshold": 5,
    "timeout_ms": 3000
  },
  "batching": {
    "batch_size": 32,
    "max_wait_ms": 10,
    "dynamic_sizing": true,
    "timeout_threshold_ms": 50
  },
  "confidence": 0.95
}
EOF

# 2. Apply canary
curl -X POST http://localhost:8081/policy/update \
  -H "Authorization: HMAC-SHA256 $SIGNATURE" \
  -d @canary_policy.json

# 3. Monitor metrics for 10 minutes
watch -n 60 'curl -s http://localhost:8081/policy/metrics'

# 4. If successful, increase to 50%
# Update traffic_split in canary_policy.json to 0.5 and reapply

# 5. If issues detected, rollback
curl -X POST http://localhost:8081/policy/rollback \
  -H "Authorization: HMAC-SHA256 $SIGNATURE" \
  -d '{"version": 42}'
```

### Workflow 4: Emergency Rollback

**Use Case:** Critical performance degradation

```bash
# Check drift monitor status
curl -s http://localhost:8081/drift/status

# Manual rollback to last known good version
curl -X POST http://localhost:8081/policy/rollback \
  -H "Authorization: HMAC-SHA256 $SIGNATURE" \
  -d '{"version": 40}'

# Verify rollback succeeded
curl -X GET http://localhost:8081/policy/inspect | jq '.policy.version'
```

---

## Safety & Rollback

### Automatic Rollback Triggers

The Drift Monitor automatically triggers rollback if:

1. **Performance Drift >5%:** Latency, cache hit rate, or error rate deviates >5% from baseline
2. **Z-Score Anomaly:** Metric Z-score exceeds 3.0 (statistical outlier)
3. **Error Rate Spike:** Error rate >10% sustained for >30 seconds
4. **Circuit Breaker Trip:** Circuit breaker opens due to cascading failures

### Rollback SLA

- **Detection Latency:** <1 second from anomaly occurrence
- **Rollback Execution:** <2 seconds from trigger
- **Data Integrity:** 100% request replay accuracy via deterministic recovery

### Manual Rollback

```bash
# List available versions
curl -X GET http://localhost:8081/policy/history

# Rollback to specific version
curl -X POST http://localhost:8081/policy/rollback \
  -H "Authorization: HMAC-SHA256 $SIGNATURE" \
  -d '{"version": 35}'
```

### Checkpoint Integration

Policies are automatically checkpointed before each update:

```rust
// Automatic checkpoint before policy update
checkpoint_manager.save_checkpoint(policy_snapshot)?;

// Restore from checkpoint on rollback
let snapshot = checkpoint_manager.load_checkpoint()?;
```

---

## Monitoring & Observability

### Prometheus Metrics

**Policy Engine:**
```
# Total policy updates
schlep_policy_updates_total{status="success"} 148
schlep_policy_updates_total{status="rejected"} 4

# Update latency histogram
schlep_policy_update_latency_ms_bucket{le="50"} 120
schlep_policy_update_latency_ms_bucket{le="100"} 145
schlep_policy_update_latency_ms_bucket{le="200"} 148

# Current confidence score
schlep_policy_confidence_score 0.91
```

**Drift Monitor:**
```
# Drift events
schlep_drift_events_total{severity="low"} 5
schlep_drift_events_total{severity="high"} 2

# Rollbacks triggered
schlep_rollbacks_triggered_total 2

# False positive rate
schlep_drift_false_positive_rate 0.015
```

**Feedback Loop:**
```
# Reward score
schlep_reward_score 0.87

# Optimization iterations
schlep_optimization_iterations_bucket{le="5"} 85
schlep_optimization_iterations_bucket{le="10"} 98
schlep_optimization_iterations_bucket{le="20"} 100

# Convergence rate
schlep_convergence_rate 0.92
```

### Grafana Dashboard Queries

**Policy Update Rate:**
```promql
rate(schlep_policy_updates_total{status="success"}[5m])
```

**P95 Update Latency:**
```promql
histogram_quantile(0.95,
  rate(schlep_policy_update_latency_ms_bucket[5m])
)
```

**Drift Detection Frequency:**
```promql
increase(schlep_drift_events_total[1h])
```

### Structured Logs

**Policy Update:**
```json
{
  "timestamp": "2025-10-10T15:42:10Z",
  "level": "INFO",
  "module": "policy_engine",
  "event": "policy_updated",
  "version": 45,
  "confidence": 0.93,
  "latency_ms": 91.2,
  "trigger_metric": "avg_latency_ms",
  "batch_size_delta": +16
}
```

**Drift Detected:**
```json
{
  "timestamp": "2025-10-10T16:05:32Z",
  "level": "WARN",
  "module": "drift_monitor",
  "event": "drift_detected",
  "drift_percent": 7.2,
  "affected_metrics": ["avg_latency_ms", "error_rate"],
  "z_scores": {"avg_latency_ms": 3.4, "error_rate": 4.1},
  "action": "rollback_triggered"
}
```

---

## Best Practices

### 1. Policy Update Hygiene

✅ **DO:**
- Test policy changes in staging before production
- Use canary rollouts for risky updates (start at 5%)
- Document policy changes with version tags
- Monitor metrics for 15+ minutes after updates
- Set confidence thresholds ≥0.85 for auto-updates

❌ **DON'T:**
- Update policies during peak traffic hours
- Make large parameter changes (>50% delta) at once
- Disable drift monitoring in production
- Ignore rejected update warnings
- Skip validation of external policy inputs

### 2. Confidence Threshold Tuning

| Environment | Recommended Threshold | Rationale |
|-------------|----------------------|-----------|
| **Production** | 0.90-0.95 | High confidence required for stability |
| **Staging** | 0.80-0.85 | Allow more experimentation |
| **Development** | 0.70-0.75 | Aggressive adaptation for testing |

### 3. Drift Threshold Configuration

```json
{
  "drift_monitor": {
    "max_drift_percent": 5.0,      // 5% for production
    "anomaly_threshold": 3.0,       // Z-score threshold
    "auto_rollback": true,
    "min_samples": 10               // Require 10 samples before detection
  }
}
```

### 4. Rollback Strategy

**Pre-Deployment:**
1. Export current policy as backup
2. Document rollback version in runbook
3. Test rollback in staging

**During Incident:**
1. Trigger automatic rollback via Drift Monitor (if enabled)
2. Manual rollback if auto-rollback disabled
3. Disable adaptive updates temporarily
4. Investigate root cause before re-enabling

### 5. Multi-Region Orchestration

For global deployments:

```bash
# Update all regions sequentially with validation
for region in us-east-1 us-west-2 eu-central-1; do
  curl -X POST http://${region}.api:8081/policy/update \
    -d @policy.json

  # Wait 5 minutes and check metrics
  sleep 300

  # Validate success before proceeding
  curl http://${region}.api:8081/policy/metrics | jq '.metrics.successful_updates'
done
```

---

## Troubleshooting

### Issue 1: Policy Updates Rejected

**Symptom:** `rejected_updates` counter increasing

**Diagnosis:**
```bash
# Check rejection reason in logs
grep "policy_update.*rejected" /var/log/schlep-engine/policy-engine.log

# Check confidence scores
curl http://localhost:8081/policy/metrics | jq '.metrics.avg_confidence'
```

**Resolution:**
- Lower `confidence_threshold` if rejections due to low confidence
- Validate telemetry quality (check for stale/missing data)
- Review policy validation rules in code

---

### Issue 2: Excessive Drift Detections

**Symptom:** Rollbacks triggered frequently (>5 per hour)

**Diagnosis:**
```bash
# Check drift history
curl http://localhost:8081/drift/history

# Analyze false positive rate
curl http://localhost:8081/drift/metrics | jq '.false_positive_rate'
```

**Resolution:**
- Increase `max_drift_percent` to 7-10% for volatile workloads
- Increase `min_samples` for more stable detection
- Review baseline policy accuracy

---

### Issue 3: Slow Policy Updates

**Symptom:** `last_update_latency_ms` >200ms

**Diagnosis:**
```bash
# Check update latency distribution
curl http://localhost:8081/policy/metrics | jq '.last_update_latency_ms'

# Profile Rust policy engine
RUST_LOG=debug cargo run --release
```

**Resolution:**
- Reduce `window_size` in Drift Monitor (fewer history samples)
- Optimize checkpoint serialization
- Check for lock contention in policy history

---

### Issue 4: Rollback Failures

**Symptom:** Rollback command returns error

**Diagnosis:**
```bash
# Check if version exists
curl http://localhost:8081/policy/history | jq '.versions'

# Check checkpoint manager status
curl http://localhost:8081/checkpoint/status
```

**Resolution:**
- Verify target version exists in history
- Check checkpoint storage availability
- Manually export/import policy as fallback

---

## CLI Reference (Future Enhancement)

```bash
# Inspect current policy with specific metrics
schlep policy inspect --metrics latency,cost,confidence

# Optimize policy with constraints
schlep policy optimize --target latency<150ms --cost<0.5

# Monitor drift in real-time
schlep drift monitor --threshold 5% --window 60s --alert

# Export policy for backup
schlep policy export --format json > policy_backup_v42.json

# Import policy from file
schlep policy import --file policy_backup_v42.json --validate

# Rollback with confirmation
schlep policy rollback --version 40 --confirm

# View policy change history
schlep policy history --limit 20 --format table
```

---

## Appendix: Configuration Reference

### Complete Configuration Example

```yaml
adaptive_orchestration:
  policy_engine:
    enabled: true
    update_interval_ms: 100
    confidence_threshold: 0.90
    max_batch_size: 128
    min_batch_size: 4
    target_cache_hit_rate: 0.97
    target_latency_ms: 150.0
    enable_checkpoints: true

  feedback_loop:
    enabled: true
    cost_weight: 0.3
    initial_learning_rate: 0.1
    exploration_temperature: 1.0
    temperature_decay: 0.95
    min_temperature: 0.1
    convergence_threshold: 0.01
    max_iterations: 10
    history_window_size: 20

  drift_monitor:
    enabled: true
    max_drift_percent: 5.0
    anomaly_threshold: 3.0
    window_size: 100
    min_samples: 10
    auto_rollback: true
    check_interval_ms: 1000

  telemetry_synthesizer:
    enabled: true
    aggregation_window_ms: 10000
    buffer_size: 1000
    flush_interval_ms: 5000
    schema_version: "1.0.2"

  control_surface:
    enabled: true
    port: 8081
    auth_enabled: true
    hmac_secret: "${SCHLEP_HMAC_SECRET}"
    max_request_size_bytes: 1048576
    rate_limit_rps: 100
```

---

**Document Version:** 1.0.0
**Maintained By:** Schlep-Engine Platform Team
**Support:** https://docs.schlep-engine.io/support
