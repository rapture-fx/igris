# AlertManager Setup and Configuration Guide

## Overview

This guide covers the deployment, configuration, and management of AlertManager for Schlep-Engine production monitoring. AlertManager handles alert routing, grouping, deduplication, and notifications for our Prometheus-based monitoring stack.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ Prometheus  │─────▶│ AlertManager │─────▶│ Slack/Email  │
│  (Metrics)  │      │  (Routing)   │      │ (Receivers)  │
└─────────────┘      └──────────────┘      └──────────────┘
       │                     │
       │                     │
       ▼                     ▼
┌─────────────┐      ┌──────────────┐
│   Grafana   │      │  PagerDuty   │
│ (Dashboards)│      │  (Optional)  │
└─────────────┘      └──────────────┘
```

## Deployment

### 1. Using Docker Compose

Start the monitoring stack with AlertManager:

```bash
cd /Users/wira/Desktop/schlep-engine
docker-compose -f docker-compose.monitoring.yml up -d
```

This will deploy:
- Prometheus (port 9090)
- AlertManager (port 9093)
- Grafana (port 3002)
- Node Exporter (port 9100)
- cAdvisor (port 8080)

### 2. Verify Deployment

Check AlertManager status:

```bash
curl http://localhost:9093/-/healthy
# Expected: Healthy

# Check AlertManager UI
open http://localhost:9093
```

## Configuration

### Alert Routing Configuration

Location: `/Users/wira/Desktop/schlep-engine/observability/alertmanager.yml`

#### Route Tree Structure

```yaml
route:
  receiver: 'team-notifications'           # Default receiver
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s                         # Wait before first notification
  group_interval: 10s                     # Wait before notifying new alerts
  repeat_interval: 12h                    # Wait before repeat notifications

  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      group_wait: 5s                      # Faster for critical alerts
      repeat_interval: 1h
```

### Receiver Configuration

#### Slack Integration

1. Create a Slack webhook URL:
   - Go to https://api.slack.com/messaging/webhooks
   - Create a new webhook for your workspace
   - Copy the webhook URL

2. Set environment variable:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

3. Update `alertmanager.yml`:

```yaml
receivers:
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#critical-alerts'
        title: '🚨 CRITICAL ALERT'
        send_resolved: true
        color: 'danger'
```

#### Email Integration

```yaml
receivers:
  - name: 'team-notifications'
    email_configs:
      - to: 'team@example.com'
        from: 'alertmanager@schlep-engine.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@schlep-engine.com'
        auth_password: '${SMTP_PASSWORD}'
        headers:
          Subject: 'Schlep-Engine Alert: {{ .GroupLabels.alertname }}'
```

#### PagerDuty Integration (Optional)

```yaml
receivers:
  - name: 'critical-alerts'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ .GroupLabels.alertname }}: {{ .Annotations.summary }}'
```

### Alert Grouping and Deduplication

AlertManager automatically groups alerts by:
- `alertname`: Name of the alert
- `cluster`: Cluster identifier
- `service`: Service name

This prevents notification spam when multiple instances of the same issue occur.

### Inhibition Rules

Inhibition rules suppress certain alerts when others are firing:

```yaml
inhibit_rules:
  # Suppress warning if critical alert for same service
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['service', 'instance']

  # Suppress individual alerts if entire service is down
  - source_match:
      alertname: 'ServiceDown'
    target_match_re:
      alertname: '.*'
    equal: ['service']
```

## Alert Rules

### Production Alert Rules

Location: `/Users/wira/Desktop/schlep-engine/observability/prometheus-rules.yml`

#### 1. Latency Alerts

**HighAPILatency** (P99 > 50ms)
```yaml
- alert: HighAPILatency
  expr: |
    histogram_quantile(0.99,
      sum(rate(http_request_duration_milliseconds_bucket[5m])) by (le)
    ) > 50
  for: 5m
  labels:
    severity: critical
    service: go-gateway
```

**VeryHighAPILatency** (P99 > 1000ms)
```yaml
- alert: VeryHighAPILatency
  expr: |
    histogram_quantile(0.99,
      sum(rate(http_request_duration_milliseconds_bucket[5m])) by (le)
    ) > 1000
  for: 2m
  labels:
    severity: critical
```

#### 2. Error Rate Alerts

**HighAPIErrorRate** (>1%)
```yaml
- alert: HighAPIErrorRate
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[5m]))
      /
      sum(rate(http_requests_total[5m]))
    ) > 0.01
  for: 5m
  labels:
    severity: critical
```

#### 3. Memory Growth Alerts

**MemoryGrowthAlert** (>10% over 30 minutes)
```yaml
- alert: MemoryGrowthAlert
  expr: |
    (
      (
        process_resident_memory_bytes{job="go-gateway"}
        -
        process_resident_memory_bytes{job="go-gateway"} offset 30m
      )
      /
      process_resident_memory_bytes{job="go-gateway"} offset 30m
    ) > 0.10
  for: 5m
```

**RapidMemoryGrowth** (>20% over 15 minutes)
```yaml
- alert: RapidMemoryGrowth
  expr: |
    (
      (
        process_resident_memory_bytes{job="go-gateway"}
        -
        process_resident_memory_bytes{job="go-gateway"} offset 15m
      )
      /
      process_resident_memory_bytes{job="go-gateway"} offset 15m
    ) > 0.20
  for: 2m
  labels:
    severity: critical
```

#### 4. Secret Expiry Alerts

**VaultTokenExpiringSoon** (7 days)
```yaml
- alert: VaultTokenExpiringSoon
  expr: |
    (vault_token_expiry_time_seconds - time()) < (7 * 24 * 60 * 60)
  for: 1h
  labels:
    severity: warning
    service: vault
```

**TLSCertificateExpiringCritical** (7 days)
```yaml
- alert: TLSCertificateExpiringCritical
  expr: |
    (ssl_cert_expiry_seconds - time()) < (7 * 24 * 60 * 60)
  for: 1h
  labels:
    severity: critical
    service: nginx
```

## Alert Management

### Silencing Alerts

Silence alerts during maintenance or known issues:

```bash
# Silence via CLI
amtool silence add alertname=HighAPILatency --duration=2h --comment="Planned maintenance"

# Silence via API
curl -X POST http://localhost:9093/api/v2/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [
      {
        "name": "alertname",
        "value": "HighAPILatency",
        "isRegex": false
      }
    ],
    "startsAt": "2025-01-01T00:00:00Z",
    "endsAt": "2025-01-01T02:00:00Z",
    "createdBy": "ops-team",
    "comment": "Planned maintenance"
  }'
```

### Viewing Active Alerts

```bash
# CLI
amtool alert --alertmanager.url=http://localhost:9093

# API
curl http://localhost:9093/api/v2/alerts

# Web UI
open http://localhost:9093
```

### Testing Alerts

Manually trigger a test alert:

```bash
# Send test alert to AlertManager
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[
    {
      "labels": {
        "alertname": "TestAlert",
        "severity": "warning",
        "service": "test"
      },
      "annotations": {
        "summary": "This is a test alert",
        "description": "Testing AlertManager notification routing"
      }
    }
  ]'
```

## Grafana Integration

### AlertManager Dashboard

Location: `/Users/wira/Desktop/schlep-engine/observability/grafana/dashboards/alerts_dashboard.json`

Features:
- Active alerts count
- Critical vs warning alerts
- Alert timeline
- Alerts by service
- Alert frequency analysis

Access: http://localhost:3002/d/alertmanager-schlep

## Troubleshooting

### AlertManager Not Receiving Alerts

1. Check Prometheus configuration:
```bash
curl http://localhost:9090/api/v1/status/config | jq '.data.yaml' | grep -A 10 alerting
```

2. Verify AlertManager is configured:
```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

3. Check AlertManager logs:
```bash
docker logs schlep_alertmanager
```

### Alerts Not Being Sent to Receivers

1. Check AlertManager configuration:
```bash
amtool config show --alertmanager.url=http://localhost:9093
```

2. Test receiver configuration:
```bash
amtool config routes test --config.file=observability/alertmanager.yml \
  alertname=TestAlert severity=critical service=go-gateway
```

3. Verify webhook URLs are correct:
```bash
echo $SLACK_WEBHOOK_URL
```

### Too Many Notifications

1. Adjust `repeat_interval` in route configuration
2. Review inhibition rules
3. Increase `group_wait` and `group_interval`

## Best Practices

### 1. Alert Fatigue Prevention

- Use appropriate severity levels
- Set reasonable thresholds
- Implement inhibition rules
- Group related alerts
- Use silence for known issues

### 2. On-Call Rotation

- Set up PagerDuty integration for critical alerts
- Route different severities to different channels
- Document escalation procedures

### 3. Alert Hygiene

- Regularly review and tune alert thresholds
- Remove noisy or irrelevant alerts
- Ensure all alerts are actionable
- Document response procedures for each alert

### 4. Testing

- Test alert routing regularly
- Verify all receivers are working
- Conduct fire drills for critical alerts

## Monitoring AlertManager

Monitor AlertManager itself:

```yaml
- alert: AlertManagerDown
  expr: up{job="alertmanager"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "AlertManager is down"
    description: "AlertManager has been down for 1 minute"
```

## Environment-Specific Configuration

### Development

```yaml
global:
  resolve_timeout: 1m
route:
  repeat_interval: 5m  # More frequent for testing
```

### Production

```yaml
global:
  resolve_timeout: 5m
route:
  repeat_interval: 12h  # Less frequent
```

## Additional Resources

- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [amtool CLI Reference](https://github.com/prometheus/alertmanager#amtool)
- [Alert Best Practices](https://prometheus.io/docs/practices/alerting/)

## Support

For issues or questions:
- Check AlertManager logs: `docker logs schlep_alertmanager`
- Review Prometheus logs: `docker logs schlep_prometheus`
- Consult the team in #monitoring-alerts Slack channel
