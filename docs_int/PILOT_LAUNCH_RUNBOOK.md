# Schlep-Engine Phase 5: Pilot Launch Runbook

**Version:** 1.0.0
**Date:** January 2026
**Target Completion:** 2026-01-20
**Status:** Ready for Deployment

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Week 0: Deploy Staging & Canary Rollout](#week-0-deploy-staging--canary-rollout)
4. [Week 1: Monitor & Validate Telemetry](#week-1-monitor--validate-telemetry)
5. [Week 2: Public Pilot Launch](#week-2-public-pilot-launch)
6. [Week 3: Billing Activation](#week-3-billing-activation)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Rollback Procedures](#rollback-procedures)
9. [Success Criteria](#success-criteria)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This runbook guides the deployment and launch of Schlep-Engine from staging to production pilot, following a structured 4-week rollout plan with continuous validation.

### Objectives

- Deploy staging environment on Hetzner CX31 VPS
- Execute 48-hour canary validation with live telemetry
- Launch controlled pilot with first 10 tenants (Founder's Plan)
- Activate billing and pricing visibility
- Achieve ≥99.9% uptime with <1% error rate

### Timeline

| Week | Phase | Activities |
|------|-------|------------|
| Week 0 | Staging Deployment | Deploy to Hetzner, start canary (10% → 50% → 100%) |
| Week 1 | Validation | Monitor metrics, validate telemetry, fix issues |
| Week 2 | Pilot Launch | Onboard first 10 Founder's Plan tenants |
| Week 3 | Billing | Activate Stripe/Polar, enable pricing page |

---

## Prerequisites

### Infrastructure

- [x] Hetzner CX31 VPS provisioned (8GB RAM, 2vCPU, 80GB SSD)
- [x] DNS configured for `staging.schlep-engine.com`
- [x] SSL certificates ready (Let's Encrypt)
- [x] Firewall rules configured
- [x] Monitoring stack deployed (Prometheus, Grafana, AlertManager)

### Environment Variables

Create `/infra/deploy/.env.staging` with:

```bash
# Core
ENVIRONMENT=staging
VERSION=v1.0.0-staging

# Database
POSTGRES_DB=schlep_engine_staging
POSTGRES_USER=schlep_user
POSTGRES_PASSWORD=<strong-password>

# Redis
REDIS_PASSWORD=<strong-password>

# Secrets
JWT_SECRET=<jwt-secret>
SECRET_KEY=<secret-key>

# LLM Providers
OPENAI_API_KEY=<openai-key>
ANTHROPIC_API_KEY=<anthropic-key>
GOOGLE_API_KEY=<google-key>

# Monitoring
GRAFANA_PASSWORD=<grafana-password>
SLACK_WEBHOOK_URL=<slack-webhook>

# SSL
LETSENCRYPT_EMAIL=admin@schlep-engine.com

# Canary
CANARY_STAGE=initial
CANARY_PERCENTAGE=10
```

### Access Requirements

- SSH access to Hetzner VPS
- GitHub repository access
- Slack workspace for alerts
- Stripe/Polar account credentials
- DNS management access

---

## Week 0: Deploy Staging & Canary Rollout

### Day 0: VPS Setup

**Duration:** 2 hours

#### 1. Initial VPS Configuration

```bash
# SSH into Hetzner VPS
ssh root@staging.schlep-engine.com

# Run VPS setup script
cd /opt
git clone https://github.com/yourusername/schlep-engine.git
cd schlep-engine/infra/scripts
chmod +x setup_vps.sh
./setup_vps.sh
```

**Expected Output:**
- Docker & Docker Compose installed
- Firewall configured
- System optimizations applied
- Monitoring tools installed

**Validation:**
```bash
docker --version
docker-compose --version
ufw status
free -h  # Check swap is enabled
```

#### 2. Deploy Application

```bash
# From local machine
cd /path/to/schlep-engine

# Create environment file
cp infra/deploy/.env.example infra/deploy/.env.staging
# Edit .env.staging with actual values

# Deploy to staging
./infra/scripts/deploy_staging.sh --canary-stage initial

# Monitor deployment
ssh root@staging.schlep-engine.com 'cd /opt/schlep-engine && docker-compose -f infra/deploy/staging_compose.yml logs -f'
```

**Validation Checklist:**
- [x] All containers running (`docker-compose ps`)
- [x] API health check passes (`curl http://localhost:8080/v1/health`)
- [x] Prometheus scraping metrics (`curl http://localhost:9091/-/healthy`)
- [x] Grafana accessible (`curl http://localhost:3001/api/health`)

### Day 1-2: Canary Initial (10% Traffic)

**Duration:** 24 hours

#### 1. Start Canary Validation

```bash
# On VPS
cd /opt/schlep-engine
./canary_validation.sh initial
```

**Monitor:**
- Forecast accuracy drift: <10%
- Latency P95: <1000ms
- Error rate: <1%
- SLA violations: <2/hour

#### 2. Continuous Monitoring

```bash
# Run validation every 6 hours
./canary_validation.sh --continuous initial &
```

**Access Grafana:**
- URL: `http://staging.schlep-engine.com:3001`
- Username: `admin`
- Password: `<from .env>`
- Dashboard: "Tenant Health Monitoring - Phase 5"

**Key Metrics to Watch:**
- `schlep_cost_forecast_accuracy`: Should be ≥90%
- `schlep_redis_latency_ms`: Should be <50ms
- `schlep_bayesian_tuner_confidence`: Should be ≥0.85
- `schlep_sla_violations_total`: Should be minimal

#### 3. Alert Drift Check

```bash
# Create baseline
./alert_drift_check.sh --baseline

# Check drift
./alert_drift_check.sh
```

**Success Criteria:**
- Zero rollback triggers for 24h
- All canary validation checks pass
- Telemetry completeness ≥98%

### Day 3-4: Canary Expand (50% Traffic)

**Duration:** 24 hours

#### 1. Expand Canary

```bash
# Update canary stage
./deploy_staging.sh --canary-stage expand
```

**Monitor:**
- Forecast accuracy drift: <8%
- Latency P95: <800ms
- Error rate: <0.5%
- SLA violations: <1/hour

#### 2. Run Telemetry Validation

```bash
./validate_telemetry.sh --verbose
```

**Expected Output:**
```
[SUCCESS] ALL TELEMETRY VALIDATION CHECKS PASSED ✓
Total Checks: 7
Passed: 7
Failed: 0
Success Rate: 100.00%
```

**If Validation Fails:**
- Check `infra/scripts/validate_telemetry.sh` output for specific failures
- Review Prometheus targets: `http://staging.schlep-engine.com:9091/targets`
- Check API logs: `docker-compose logs api`

### Day 5-6: Canary Full (100% Traffic)

**Duration:** 48 hours

#### 1. Full Rollout

```bash
./deploy_staging.sh --canary-stage full
```

**Monitor:**
- Forecast accuracy drift: <5%
- Latency P95: <500ms
- Error rate: <0.1%
- SLA violations: <0.5/hour

#### 2. Extended Stability Test

Run for minimum 48 hours with:
- Continuous canary validation
- Alert drift monitoring
- Telemetry completeness checks
- Manual smoke tests every 12 hours

**Smoke Test Checklist:**
```bash
# Test inference endpoint
curl -X POST http://staging.schlep-engine.com:8080/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello, test"}],
    "max_tokens": 50
  }'

# Check cost analytics
curl http://staging.schlep-engine.com:8080/v1/analytics/cost

# Check semantic routing distribution
curl http://staging.schlep-engine.com:8080/v1/analytics/semantic/distribution

# Verify metrics endpoint
curl http://staging.schlep-engine.com:8080/v1/metrics | grep schlep_
```

---

## Week 1: Monitor & Validate Telemetry

### Day 7-9: Stability Monitoring

**Objectives:**
- Validate 72h+ uptime
- Ensure zero critical incidents
- Verify alert accuracy

#### Daily Tasks

**Morning (9 AM):**
```bash
# Health check
./canary_validation.sh full

# Alert drift check
./alert_drift_check.sh --report

# Check Grafana dashboards
# - Tenant Health Monitoring
# - Cost Tracking
# - Alert Dashboard
```

**Afternoon (2 PM):**
```bash
# Telemetry validation
./validate_telemetry.sh

# Review error logs
docker-compose logs --tail=100 api | grep ERROR

# Check database performance
docker exec schlep-postgres-staging psql -U schlep_user -d schlep_engine_staging -c "
SELECT COUNT(*) as total_tenants FROM tenants;
SELECT COUNT(*) as total_requests FROM requests WHERE created_at > NOW() - INTERVAL '1 day';
"
```

**Evening (8 PM):**
```bash
# Final health check
curl -sf http://staging.schlep-engine.com:8080/v1/health

# Review daily metrics report in Grafana
# - Total requests
# - Cost efficiency
# - Error rates
# - Cache hit rates
```

### Day 10-13: Issue Resolution

**Priority Issues to Address:**

1. **Performance Issues**
   - P95 latency >500ms consistently
   - Redis latency spikes
   - Database connection pool exhaustion

2. **Telemetry Gaps**
   - Missing metrics
   - Stale data
   - Incomplete labels

3. **Alert Noise**
   - False positive rate >2%
   - Alert fatigue
   - Misconfigured thresholds

**Issue Resolution Template:**

```markdown
## Issue: [Title]

**Severity:** Critical | High | Medium | Low
**Detected:** [Timestamp]
**Component:** [API | Database | Redis | Monitoring]

### Symptoms
- [Describe what was observed]

### Root Cause
- [Analysis of underlying problem]

### Fix Applied
- [Actions taken]

### Validation
- [How fix was verified]

### Prevention
- [Steps to prevent recurrence]
```

---

## Week 2: Public Pilot Launch

### Day 14: Pre-Launch Checklist

**Infrastructure:**
- [x] 7+ days of stable uptime
- [x] All telemetry validation passing
- [x] Alert drift <5%
- [x] Forecast accuracy ≥90%
- [x] Error rate <0.1%

**Application:**
- [x] All feature flags enabled
- [x] Pricing page live
- [x] Early access modal functional
- [x] Email templates ready
- [x] Documentation complete

**Business:**
- [x] Support Slack channel created
- [x] Onboarding process defined
- [x] Support escalation path clear
- [x] Legal terms updated

### Day 15: Soft Launch (First 3 Tenants)

#### 1. Invite First Tenants

**Email Template:**

```
Subject: You're Invited: Schlep-Engine Founder's Plan (Limited to 10)

Hi [Name],

You're one of the first 10 founders invited to join Schlep-Engine at our exclusive Founder's Plan pricing.

🎯 What you get:
- 5M tokens/month
- Semantic routing (90%+ accuracy)
- Bayesian ML optimization
- Adaptive governance
- Real-time observability
- Priority support

💰 Founder's Pricing: $299/month (lifetime guarantee)

👉 Claim your spot: https://staging.schlep-engine.com/pricing

14-day free trial • No credit card required

Questions? Reply to this email or join our Slack: [invite link]

Best,
Schlep-Engine Team
```

#### 2. Onboarding Process

**For each tenant:**

1. **Account Creation**
   ```bash
   # Create tenant via API or admin dashboard
   curl -X POST http://staging.schlep-engine.com:8080/v1/tenants \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Acme Corp",
       "email": "admin@acme.com",
       "plan": "founders",
       "api_key_prefix": "sk-acme"
     }'
   ```

2. **Send Welcome Email** with:
   - API key
   - Documentation link
   - SDK installation instructions
   - Support contact info

3. **Schedule Onboarding Call** (30 min)
   - Product walkthrough
   - Technical integration help
   - Answer questions

4. **Monitor First Week**
   - Track usage in Grafana
   - Check for errors
   - Gather feedback

### Day 16-20: Gradual Expansion (10 Total Tenants)

**Pacing:**
- Day 16: Invite tenants 4-5
- Day 17: Invite tenants 6-7
- Day 18: Invite tenants 8-9
- Day 20: Invite tenant 10

**Daily Monitoring:**
```bash
# Check tenant health
curl http://staging.schlep-engine.com:8080/v1/admin/tenants | jq '.[] | {name, requests_24h, cost_24h, errors_24h}'

# Grafana: "Tenant Health Monitoring" dashboard
# - Review per-tenant metrics
# - Identify anomalies
# - Track feature adoption
```

**Success Metrics:**
- All 10 tenants onboarded
- Average >100 requests/day per tenant
- Zero critical support tickets
- NPS score ≥8/10

---

## Week 3: Billing Activation

### Day 21: Billing Integration

#### 1. Stripe/Polar Setup

**Stripe Configuration:**
```bash
# Set Stripe keys in environment
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Create products
# - Starter: $199/month
# - Founder's Plan: $299/month
# - Pro: $499/month
# - Enterprise: Contact sales
```

**Webhook Setup:**
```bash
# Configure Stripe webhook
Endpoint: https://staging.schlep-engine.com/v1/webhooks/stripe
Events:
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed
```

#### 2. Update Pricing Page

Pricing page already updated with:
- 4 tiers (Starter, Founder's, Pro, Enterprise)
- Features and capabilities per tier
- FAQ section
- Early access modal integration

#### 3. Test Billing Flow

```bash
# Test subscription creation
# Use Stripe test mode first
STRIPE_SECRET_KEY=sk_test_... node test/billing_test.js

# Verify:
# - Subscription created
# - Webhook received
# - Tenant upgraded
# - Usage tracking enabled
```

### Day 22-27: Billing Soft Launch

#### 1. Enable Billing for Trial Tenants

**Email Template (14-day trial ending):**

```
Subject: Your Schlep-Engine Trial is Ending - Lock in Founder's Pricing

Hi [Name],

Your 14-day trial ends in 3 days. You've made great progress:
- [X] requests processed
- $[X] in cost savings
- [X]% semantic routing accuracy

🎉 Lock in Founder's Plan pricing: $299/month (lifetime guarantee)

Only 2 spots left at this price!

👉 Upgrade now: https://staging.schlep-engine.com/billing

Questions? Let's chat: [support email]

Thanks,
Schlep-Engine Team
```

#### 2. Payment Collection

**Process:**
1. Tenant enters payment info
2. Stripe creates subscription
3. Webhook updates tenant status
4. Confirmation email sent
5. Invoice generated

**Monitor:**
```bash
# Check subscription status
curl http://staging.schlep-engine.com:8080/v1/admin/billing \
  | jq '.subscriptions[] | {tenant, plan, status, mrr}'

# Track MRR
# Founder's Plan: 10 tenants × $299 = $2,990 MRR
```

### Day 28: Week 3 Retrospective

**Metrics Review:**
- MRR achieved: $______
- Paid conversion rate: __%
- Churn rate: __%
- Support ticket volume: ___

**What Went Well:**
- [List 3-5 items]

**What Needs Improvement:**
- [List 3-5 items]

**Action Items:**
- [List next steps]

---

## Monitoring & Alerts

### Critical Alerts

| Alert | Threshold | Action |
|-------|-----------|--------|
| API Down | 3 consecutive failures | Immediate investigation + restart |
| P95 Latency High | >1000ms for 10min | Check database & Redis, scale if needed |
| Error Rate High | >1% for 15min | Review logs, identify root cause |
| SLA Violation Spike | >5/hour | Check provider status, adjust routing |
| Forecast Drift High | >10% for 30min | Review model, check data quality |
| Redis Down | Connection failures | Restart Redis, check persistence |
| Database Connection Pool | >90% utilized | Increase pool size or scale |

### Monitoring Dashboards

**Grafana Dashboards:**
1. **Tenant Health Monitoring** (`/infra/monitoring/grafana/dashboard_tenant_health.json`)
   - Overall health score
   - Per-tenant metrics
   - SLA compliance
   - Cost tracking

2. **Cost Tracking** (`/infra/observability/grafana/dashboards/cost_tracking_dashboard.json`)
   - Hourly cost projection
   - Monthly burn rate
   - Provider distribution
   - Cost optimization opportunities

3. **Alerts Dashboard** (`/infra/observability/grafana/dashboards/alerts_dashboard.json`)
   - Active alerts
   - Alert history
   - False positive tracking
   - Alert noise reduction metrics

**Prometheus Queries:**

```promql
# Forecast accuracy
avg(schlep_cost_forecast_accuracy) * 100

# P95 latency
histogram_quantile(0.95, rate(schlep_request_duration_ms_bucket[5m]))

# Error rate
rate(schlep_errors_total[5m]) * 100

# SLA violations per hour
rate(schlep_sla_violations_total[1h]) * 3600

# Cache hit rate
sum(rate(schlep_semantic_cache_hits_total[5m])) /
sum(rate(schlep_semantic_cache_requests_total[5m])) * 100

# Redis latency
avg(schlep_redis_latency_ms)

# Alert noise reduction
(sum(increase(schlep_alerts_suppressed_total[24h])) /
sum(increase(ALERTS_total[24h]))) * 100
```

### Daily Monitoring Routine

**Morning (9 AM):**
- [ ] Check Grafana "Tenant Health" dashboard
- [ ] Review overnight alerts in Slack
- [ ] Run canary validation script
- [ ] Check error logs for anomalies

**Afternoon (2 PM):**
- [ ] Review cost analytics
- [ ] Check tenant usage patterns
- [ ] Verify telemetry completeness
- [ ] Update status page if needed

**Evening (8 PM):**
- [ ] Final health check
- [ ] Review daily KPIs
- [ ] Prepare for next day
- [ ] Escalate any pending issues

---

## Rollback Procedures

### When to Rollback

**Immediate Rollback Triggers:**
- API down for >5 minutes
- Error rate >5%
- Data corruption detected
- Security breach suspected

**Planned Rollback Triggers:**
- Canary validation fails for 2+ consecutive runs
- Critical bug affecting >50% of tenants
- Performance degradation >50%

### Rollback Execution

#### 1. Automatic Rollback (Canary Failures)

```bash
# Canary validation script automatically triggers rollback
# if metrics exceed thresholds

# Manual trigger if needed
./deploy_staging.sh --rollback
```

#### 2. Manual Rollback

```bash
# SSH to VPS
ssh root@staging.schlep-engine.com

# Navigate to deployment directory
cd /opt/schlep-engine

# Stop current containers
docker-compose -f infra/deploy/staging_compose.yml down

# Restore from backup
cp -r backup/previous/* .

# Start containers with previous version
docker-compose -f infra/deploy/staging_compose.yml up -d

# Verify rollback
curl -sf http://localhost:8080/v1/health
./canary_validation.sh full
```

#### 3. Database Rollback

```bash
# Restore PostgreSQL backup
docker exec schlep-postgres-staging psql -U schlep_user -d schlep_engine_staging < /backups/postgres_YYYYMMDD_HHMMSS.sql

# Restore Redis snapshot
docker cp /opt/schlep-engine/backups/redis_YYYYMMDD_HHMMSS.rdb schlep-redis-staging:/data/dump.rdb
docker restart schlep-redis-staging
```

### Post-Rollback Actions

1. **Notify Stakeholders**
   - Slack alert with reason
   - Email to affected tenants
   - Update status page

2. **Investigate Root Cause**
   - Review logs
   - Analyze metrics
   - Identify bug/issue

3. **Create Hotfix**
   - Fix critical issue
   - Test thoroughly
   - Prepare new deployment

4. **Re-deploy**
   - Follow standard deployment process
   - Monitor closely
   - Validate success

---

## Success Criteria

### Technical Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | ≥99.9% | Prometheus `up` metric |
| Error Rate | <1% | `rate(schlep_errors_total[5m])` |
| P95 Latency | <500ms | `histogram_quantile(0.95, ...)` |
| Forecast Accuracy | ≥90% | `avg(schlep_cost_forecast_accuracy)` |
| Telemetry Completeness | ≥98% | Validation script output |
| Alert False Positive Rate | <2% | Alert drift check report |
| Alert Noise Reduction | ≥60% | `schlep_alerts_suppressed_total` |
| Cache Hit Rate | ≥70% | Semantic cache metrics |
| Bayesian Confidence | ≥0.85 | `schlep_bayesian_tuner_confidence` |

### Business Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Founder's Plan Tenants | 10 | Admin dashboard |
| Paid Conversion Rate | ≥70% | Billing dashboard |
| Churn Rate | <5% | Subscription analytics |
| NPS Score | ≥8/10 | Survey results |
| Average Requests/Tenant/Day | ≥100 | Usage analytics |
| Support Ticket Volume | <5/week | Support system |
| MRR (Month 1) | $2,990 | Stripe/Polar dashboard |
| Customer Satisfaction | ≥4.5/5 | Post-onboarding survey |

### Phase 5 Completion Checklist

- [ ] Staging deployed and stable for 7+ days
- [ ] All 10 Founder's Plan tenants onboarded
- [ ] Billing system fully operational
- [ ] All technical success criteria met
- [ ] All business success criteria met
- [ ] Documentation complete and published
- [ ] Support processes established
- [ ] Monitoring and alerts fine-tuned
- [ ] Runbook validated through practice
- [ ] Team trained on operations

---

## Troubleshooting

### Common Issues

#### 1. High Latency

**Symptoms:**
- P95 latency >1000ms
- User complaints about slow responses

**Diagnosis:**
```bash
# Check database performance
docker exec schlep-postgres-staging psql -U schlep_user -d schlep_engine_staging -c "
SELECT query, calls, total_time/calls as avg_time
FROM pg_stat_statements
ORDER BY avg_time DESC
LIMIT 10;
"

# Check Redis latency
redis-cli -h localhost -p 6379 --latency-history

# Check network latency to providers
ping api.openai.com
ping api.anthropic.com
```

**Solutions:**
- Add database indexes
- Increase connection pool size
- Optimize slow queries
- Enable Redis persistence
- Scale to larger VPS

#### 2. High Error Rate

**Symptoms:**
- Error rate >1%
- Failed requests

**Diagnosis:**
```bash
# Check error logs
docker-compose logs api | grep ERROR | tail -50

# Check specific error types
curl http://localhost:8080/v1/metrics | grep schlep_errors_total

# Review Prometheus alerts
curl http://localhost:9091/api/v1/alerts | jq '.data.alerts[] | select(.state=="firing")'
```

**Solutions:**
- Review and fix application bugs
- Check provider API status
- Verify API keys are valid
- Increase rate limits
- Add retry logic with exponential backoff

#### 3. Telemetry Gaps

**Symptoms:**
- Missing metrics in Prometheus
- Stale data in Grafana

**Diagnosis:**
```bash
# Check Prometheus targets
curl http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# Run telemetry validation
./validate_telemetry.sh --verbose

# Check scrape interval
grep scrape_interval /opt/schlep-engine/infra/monitoring/prometheus.yml
```

**Solutions:**
- Restart Prometheus
- Fix metric exposition endpoints
- Verify network connectivity
- Check Prometheus configuration
- Ensure metrics have correct labels

#### 4. Database Connection Pool Exhausted

**Symptoms:**
- "connection pool exhausted" errors
- Slow database queries

**Diagnosis:**
```bash
# Check active connections
docker exec schlep-postgres-staging psql -U schlep_user -d schlep_engine_staging -c "
SELECT count(*) as connections,
       state
FROM pg_stat_activity
GROUP BY state;
"

# Check pool configuration
env | grep DB_MAX_CONNECTIONS
```

**Solutions:**
```bash
# Increase pool size in .env
DB_MAX_CONNECTIONS=100
DB_MAX_IDLE_CONNECTIONS=20

# Restart API
docker-compose restart api

# Or scale database
# Consider upgrading to CPX41 (16GB RAM) if persistent
```

#### 5. Alert Fatigue

**Symptoms:**
- Too many alerts
- High false positive rate

**Diagnosis:**
```bash
# Check alert volume
./alert_drift_check.sh --report

# Review false positive rate
curl http://localhost:9091/api/v1/alerts | jq '.data.alerts | length'
```

**Solutions:**
- Adjust alert thresholds
- Increase evaluation intervals
- Add alert suppression rules
- Group related alerts
- Review and disable noisy alerts

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| On-Call Engineer | [Name] | [Phone/Slack] |
| DevOps Lead | [Name] | [Phone/Slack] |
| Product Manager | [Name] | [Phone/Slack] |
| Customer Success | [Name] | [Phone/Slack] |

## Escalation Path

1. **Level 1:** On-Call Engineer (immediate)
2. **Level 2:** DevOps Lead (within 30 min)
3. **Level 3:** Engineering Manager (within 1 hour)
4. **Level 4:** CTO (critical incidents only)

---

## Appendix

### Useful Commands

```bash
# Check all container health
docker-compose -f infra/deploy/staging_compose.yml ps

# View logs for specific container
docker-compose logs -f api

# Restart specific service
docker-compose restart api

# Check disk usage
df -h

# Check memory usage
free -h

# Check network connections
netstat -tuln

# Check system load
htop

# Check Docker resource usage
docker stats

# Backup database manually
docker exec schlep-postgres-staging pg_dumpall -U schlep_user > backup_$(date +%Y%m%d).sql

# Restore database manually
docker exec -i schlep-postgres-staging psql -U schlep_user < backup_20260115.sql
```

### Configuration Files Reference

| File | Purpose |
|------|---------|
| `infra/deploy/staging_compose.yml` | Staging Docker Compose configuration |
| `infra/deploy/feature_flags.yml` | Feature flag configuration |
| `infra/monitoring/prometheus.yml` | Prometheus configuration |
| `infra/monitoring/grafana/dashboard_tenant_health.json` | Tenant health dashboard |
| `infra/scripts/deploy_staging.sh` | Deployment automation |
| `infra/scripts/canary_validation.sh` | Canary validation |
| `infra/scripts/alert_drift_check.sh` | Alert drift monitoring |
| `infra/scripts/validate_telemetry.sh` | Telemetry validation |

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-09
**Next Review:** 2026-01-20 (Post-launch)
