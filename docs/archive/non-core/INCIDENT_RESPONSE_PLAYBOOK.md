# Igris Inertial Incident Response Playbook

**Version**: 1.0
**Last Updated**: 2025-01-21
**Owner**: Platform Engineering Team

## Table of Contents

1. [Severity Levels](#severity-levels)
2. [Critical Incidents](#critical-incidents)
3. [Common Issues & Resolution](#common-issues--resolution)
4. [Rollback Procedures](#rollback-procedures)
5. [Communication Templates](#communication-templates)
6. [Post-Incident Review](#post-incident-review)

---

## Severity Levels

### SEV-1 (Critical) - Immediate Response Required
- **Definition**: Complete API outage or customer applications breaking
- **Response Time**: < 5 minutes
- **Examples**:
  - 5xx error rate > 50%
  - Complete API unresponsive (all requests failing)
  - Database unavailable
  - Rust FFI panic causing crashes

### SEV-2 (High) - Urgent Response
- **Definition**: Significant degradation affecting multiple customers
- **Response Time**: < 15 minutes
- **Examples**:
  - 5xx error rate 5-50%
  - P95 latency > 10 seconds
  - One provider completely down (but failover working)
  - Memory leak causing OOM warnings

### SEV-3 (Medium) - Standard Response
- **Definition**: Minor degradation or potential issues
- **Response Time**: < 1 hour
- **Examples**:
  - 5xx error rate 1-5%
  - P95 latency 5-10 seconds
  - Circuit breaker stuck open
  - Budget breach affecting single tenant

### SEV-4 (Low) - Planned Response
- **Definition**: Monitoring alerts or informational issues
- **Response Time**: Next business day
- **Examples**:
  - Cache hit rate degraded
  - Minor cost increase
  - Non-critical metrics trending poorly

---

## Critical Incidents

### Incident 1: Complete API Outage

**Symptoms**:
- `/healthz` returning 500 or no response
- All inference requests failing
- No successful requests for > 2 minutes

**Immediate Actions** (First 5 minutes):

```bash
# 1. Verify outage
curl http://api.igris-inertial.com/healthz
curl http://api.igris-inertial.com/v1/infer -X POST \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}],"max_tokens":10}'

# 2. Check if pods are running (Kubernetes)
kubectl get pods -n production -l app=igris-overture

# 3. Check recent logs
kubectl logs deployment/igris-overture --tail=100 -n production

# 4. Check database connectivity
kubectl exec -it deployment/igris-overture -- psql $DATABASE_URL -c "SELECT 1"

# 5. If database down, check status
kubectl get pods -n production -l app=postgresql
```

**Resolution Steps**:

1. **Database Issue**:
   ```bash
   # Restart database pod
   kubectl rollout restart statefulset/postgresql -n production
   kubectl rollout status statefulset/postgresql -n production
   ```

2. **API Crash**:
   ```bash
   # Check for panic in logs
   kubectl logs deployment/igris-overture --tail=500 | grep -i "panic\|fatal\|error"

   # Restart API deployment
   kubectl rollout restart deployment/igris-overture -n production
   ```

3. **Configuration Issue**:
   ```bash
   # Check environment variables
   kubectl get deployment igris-overture -o yaml | grep -A 20 "env:"

   # Verify secrets
   kubectl get secret igris-inertial-secrets -o yaml
   ```

4. **If all else fails - ROLLBACK**:
   ```bash
   # See "Rollback Procedures" section below
   kubectl rollout undo deployment/igris-overture -n production
   ```

**Communication**:
- Immediately notify: #incidents Slack channel
- Page: On-call engineer via PagerDuty
- Status page: Update within 5 minutes

---

### Incident 2: High 5xx Error Rate

**Symptoms**:
- Prometheus alert: `HighServerErrorRate` firing
- 5xx error rate > 5%
- Some requests succeeding, but many failing

**Immediate Actions**:

```bash
# 1. Check error rate
curl http://api.igris-inertial.com/metrics | grep "http_requests_total{status=\"5"

# 2. Check provider health
curl http://api.igris-inertial.com/v1/providers/stats

# 3. Recent deployment?
kubectl rollout history deployment/igris-overture -n production

# 4. Check logs for specific errors
kubectl logs deployment/igris-overture --tail=200 | grep -i "5[0-9][0-9]"
```

**Common Causes & Fixes**:

1. **Provider API Down**:
   ```bash
   # Check which provider is failing
   curl http://api.igris-inertial.com/v1/providers/stats | jq

   # If OpenAI down, verify API key is valid
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"

   # Circuit breaker should auto-recover, but can force:
   # (if endpoint exists)
   curl -X POST http://api.igris-inertial.com/v1/circuit-breaker/reset
   ```

2. **Database Query Timeout**:
   ```bash
   # Check database performance
   kubectl exec -it deployment/igris-overture -- \
     psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

   # Check for slow queries
   kubectl exec -it deployment/igris-overture -- \
     psql $DATABASE_URL -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';"

   # Kill long-running queries if necessary
   # kubectl exec -it deployment/igris-overture -- \
   #   psql $DATABASE_URL -c "SELECT pg_terminate_backend(PID);"
   ```

3. **Memory/Resource Exhaustion**:
   ```bash
   # Check resource usage
   kubectl top pods -n production -l app=igris-overture

   # Check for OOM kills
   kubectl describe pod -n production -l app=igris-overture | grep -i oom

   # Scale up if needed
   kubectl scale deployment/igris-overture --replicas=5 -n production
   ```

4. **Recent Bad Deployment**:
   ```bash
   # Rollback to previous version
   kubectl rollout undo deployment/igris-overture -n production
   kubectl rollout status deployment/igris-overture -n production
   ```

---

### Incident 3: Rust FFI Panic / Crash

**Symptoms**:
- API pods restarting frequently
- Logs show "panic" or "FFI" errors
- Optimizer-related failures

**Immediate Actions**:

```bash
# 1. Check for panics in logs
kubectl logs deployment/igris-overture --tail=500 | grep -i "panic\|ffi\|rust"

# 2. Check crash loop
kubectl get pods -n production -l app=igris-overture

# 3. Check optimizer mode
kubectl get deployment igris-overture -o yaml | grep OPTIMIZER_MODE
```

**Resolution**:

1. **Disable Rust Optimizer (Immediate Mitigation)**:
   ```bash
   # Switch to Go-only mode
   kubectl set env deployment/igris-overture OPTIMIZER_MODE=go-only -n production

   # Restart to apply
   kubectl rollout restart deployment/igris-overture -n production
   ```

2. **Check Core Dumps** (if enabled):
   ```bash
   # SSH into pod
   kubectl exec -it deployment/igris-overture-xxx -- /bin/bash

   # Check for core dumps
   ls -lh /tmp/core.*

   # If core dumps exist, copy for analysis
   kubectl cp production/igris-overture-xxx:/tmp/core.123 ./core.123
   ```

3. **Root Cause Analysis**:
   - Review recent changes to FFI boundary
   - Check for memory safety issues in Rust code
   - Verify CGO compilation flags
   - Test with reduced concurrency

4. **Long-term Fix**:
   - Fix Rust code and add tests
   - Re-enable with `OPTIMIZER_MODE=shadow` first
   - Gradually roll out with `OPTIMIZER_SAMPLE_RATE=0.1`

---

### Incident 4: Streaming Connection Issues

**Symptoms**:
- Broken pipes in logs
- SSE streams hanging or disconnecting
- Clients reporting incomplete responses

**Immediate Actions**:

```bash
# 1. Test streaming endpoint
curl -N -H "Accept: text/event-stream" \
  http://api.igris-inertial.com/v1/infer \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}],"stream":true,"max_tokens":50}'

# 2. Check for connection limits
kubectl describe deployment igris-overture | grep -i "limits\|requests"

# 3. Check ingress/load balancer timeouts
kubectl get ingress igris-inertial-ingress -o yaml | grep timeout
```

**Common Fixes**:

1. **Load Balancer Timeout**:
   ```bash
   # Increase timeout on ingress
   kubectl annotate ingress igris-inertial-ingress \
     nginx.ingress.kubernetes.io/proxy-read-timeout="300" \
     nginx.ingress.kubernetes.io/proxy-send-timeout="300"
   ```

2. **Connection Pool Exhaustion**:
   ```bash
   # Increase connection limits
   kubectl set env deployment/igris-overture \
     MAX_CONNECTIONS=500 \
     -n production
   ```

3. **Reverse Proxy Issues**:
   - Check if reverse proxy is buffering SSE
   - Ensure X-Accel-Buffering is disabled

---

## Rollback Procedures

### Automatic Rollback (Recommended)

```bash
# Run automated rollback script
cd /path/to/igris-inertial
./stability-tests/scripts/rollback_automation.sh
```

The script will:
1. Check API health and metrics
2. Determine if rollback is needed
3. Execute rollback
4. Verify post-rollback health
5. Generate incident report

### Manual Kubernetes Rollback

```bash
# 1. Check rollout history
kubectl rollout history deployment/igris-overture -n production

# 2. Rollback to previous revision
kubectl rollout undo deployment/igris-overture -n production

# 3. Or rollback to specific revision
kubectl rollout undo deployment/igris-overture --to-revision=5 -n production

# 4. Watch rollback progress
kubectl rollout status deployment/igris-overture -n production

# 5. Verify health
curl http://api.igris-inertial.com/healthz
curl http://api.igris-inertial.com/v1/providers/stats
```

### Manual Docker Compose Rollback

```bash
# 1. Stop current deployment
docker-compose down

# 2. Pull previous image tag
docker pull igris-overture:previous

# 3. Update docker-compose.yml to use previous tag

# 4. Start previous version
docker-compose up -d

# 5. Check logs
docker-compose logs -f igris-overture
```

### Feature Flag Rollback (Gradual)

```bash
# Disable problematic features without full rollback
kubectl set env deployment/igris-overture \
  ENABLE_COGNITIVE_ADVISOR=false \
  OPTIMIZER_MODE=go-only \
  -n production

kubectl rollout restart deployment/igris-overture -n production
```

---

## Communication Templates

### SEV-1 Initial Alert

```
🚨 **SEV-1 INCIDENT - Igris Inertial API Outage**

**Status**: Investigating
**Impact**: Complete API outage - all customer requests failing
**Started**: 2025-01-21 14:32 UTC
**Team**: Platform team investigating

**Current Actions**:
- Checking database connectivity
- Reviewing recent deployments
- Preparing rollback if needed

**Updates**: Will provide update in 15 minutes

**Status Page**: https://status.igris-inertial.com
```

### SEV-1 Resolution

```
✅ **SEV-1 RESOLVED - Igris Inertial API Restored**

**Duration**: 14:32 - 14:47 UTC (15 minutes)
**Root Cause**: Database connection pool exhausted
**Resolution**: Increased connection pool size and restarted API pods

**Impact**:
- 15 minutes of complete API unavailability
- Approximately 10,000 failed requests
- No data loss

**Next Steps**:
- Post-incident review scheduled for tomorrow 10am
- Implementing connection pool monitoring alerts
- Updating database scaling policies

**Apologies**: We apologize for the disruption and are working to prevent recurrence.
```

### Customer Communication (Breach)

```
Subject: Igris Inertial Service Disruption - [Date]

Dear Valued Customer,

We experienced a service disruption today from 14:32-14:47 UTC that affected API availability. During this time, requests to our API returned errors.

**What Happened**:
Our database connection pool reached capacity, preventing new API requests from being processed.

**Impact to You**:
- 15 minutes of API unavailability
- Requests during this window returned 5xx errors
- No data loss or security impact

**What We've Done**:
- Immediately increased connection pool capacity
- Implemented additional monitoring
- Conducted full system health verification

**What's Next**:
- Comprehensive post-incident review
- Infrastructure capacity planning updates
- Enhanced monitoring and alerting

We sincerely apologize for any inconvenience. If you have questions, please contact support@igris-inertial.com.

Best regards,
Igris Inertial Platform Team
```

---

## Post-Incident Review

### Required Within 48 Hours

1. **Incident Timeline**
   - First detection
   - Key decision points
   - Resolution time

2. **Root Cause Analysis**
   - What triggered the incident?
   - Why wasn't it caught earlier?
   - What made it worse?

3. **Impact Assessment**
   - Number of affected requests
   - Customer impact (quantify)
   - Financial impact
   - Reputation impact

4. **Action Items** (with owners and deadlines)
   - Immediate fixes
   - Short-term improvements (< 1 week)
   - Long-term improvements (< 1 month)
   - Monitoring/alerting enhancements

5. **What Went Well**
   - Fast detection
   - Effective communication
   - Quick resolution

6. **What Could Be Improved**
   - Earlier detection
   - Faster diagnosis
   - Better documentation

### Post-Incident Review Template

```markdown
# Post-Incident Review: [Incident Name]

**Date**: [Date of Incident]
**Severity**: SEV-X
**Duration**: [Start] - [End] ([Total Minutes])
**Incident Commander**: [Name]

## Executive Summary
[2-3 sentences describing what happened and impact]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| 14:32 | Alert fired: HighServerErrorRate |
| 14:35 | On-call engineer acknowledged |
| 14:40 | Root cause identified: DB pool exhausted |
| 14:43 | Fix applied: Increased pool size |
| 14:47 | Service restored, monitoring |

## Root Cause
[Detailed explanation of the underlying cause]

## Impact
- Failed Requests: ~10,000
- Affected Customers: ~50
- Revenue Impact: ~$500
- Duration: 15 minutes

## Detection
- **How Detected**: Prometheus alert
- **Time to Detect**: 2 minutes after start
- **Could we detect earlier?**: Yes - add connection pool metrics

## Response
- **Time to Acknowledge**: 3 minutes
- **Time to Resolve**: 15 minutes total
- **Was response effective?**: Yes
- **What delayed resolution?**: Needed to identify which pod had issue

## Action Items

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| Add connection pool monitoring | Alice | 2025-01-23 | ✅ Done |
| Increase pool size permanently | Bob | 2025-01-22 | ✅ Done |
| Update runbook with this scenario | Charlie | 2025-01-25 | 🔄 In Progress |
| Implement auto-scaling for DB connections | Alice | 2025-02-01 | 📅 Planned |

## Lessons Learned
1. **What went well**: Fast detection via alerts, clear rollback procedure
2. **What could improve**: Need better connection pool visibility
3. **Preventable?**: Yes - with proper capacity planning

## Follow-up
- Review in 1 week: Check if action items are effective
- Review in 1 month: Verify no recurrence
```

---

## Escalation Paths

### On-Call Rotation
1. **Primary On-Call**: Check PagerDuty schedule
2. **Secondary On-Call**: Check PagerDuty schedule
3. **Engineering Manager**: [Name/Contact]
4. **CTO**: [Name/Contact] (SEV-1 only)

### External Escalation
- **Provider Issues**: Contact provider support immediately
- **Infrastructure**: Contact cloud provider support
- **Security**: Escalate to security team

---

## Quick Reference

### Health Check URLs
```bash
curl http://api.igris-inertial.com/healthz    # Liveness
curl http://api.igris-inertial.com/readyz     # Readiness
curl http://api.igris-inertial.com/metrics    # Prometheus metrics
curl http://api.igris-inertial.com/v1/providers/stats  # Provider health
```

### Key Metrics to Check
```bash
# Error rate
curl -s http://api.igris-inertial.com/metrics | grep 'http_requests_total{status="5'

# Latency
curl -s http://api.igris-inertial.com/metrics | grep 'http_request_duration'

# Memory
curl -s http://api.igris-inertial.com/metrics | grep 'process_resident_memory'

# Circuit breaker
curl -s http://api.igris-inertial.com/metrics | grep 'circuit_breaker'
```

### Important Log Searches
```bash
# Recent errors
kubectl logs deployment/igris-overture --tail=100 | grep -i error

# Panics
kubectl logs deployment/igris-overture --tail=500 | grep -i panic

# 5xx responses
kubectl logs deployment/igris-overture --tail=100 | grep '"status":5'

# Specific trace ID
kubectl logs deployment/igris-overture | grep 'trace-id-12345'
```

---

**End of Incident Response Playbook**

*For updates or questions, contact: platform-team@igris-inertial.com*
