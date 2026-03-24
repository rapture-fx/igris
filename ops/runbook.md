# Igris Inertial — Production Operations Runbook

**Last updated:** 2026-03-24
**Product:** Igris Inertial (Overture API + Console)
**VPS user:** `wira` — no sudo required for Docker commands
**VPS project path:** `/home/wira/igris`

---

## Table of Contents

1. [Accessing Grafana](#1-accessing-grafana)
2. [Checking Prometheus Targets](#2-checking-prometheus-targets)
3. [Alert Response Playbooks](#3-alert-response-playbooks)
   - [APIDown](#apidown)
   - [BillingWebhookFailure](#billingwebhookfailure)
   - [HighAPIErrorRate](#highapierrorrate)
   - [InstallSuccessDrop](#installsuccessdrop)
   - [DiskSpaceCritical](#diskspacecritical)
4. [Silencing an Alert](#4-silencing-an-alert)
5. [Restarting the Monitoring Stack](#5-restarting-the-monitoring-stack)
6. [Common Maintenance Tasks](#6-common-maintenance-tasks)

---

## 1. Accessing Grafana

**Direct VPS access:**
```
http://<VPS_IP>:3001
```

**If a DNS record is configured:**
```
https://grafana.igrisinertial.com
```

Default credentials are set via `GRAFANA_ADMIN_PASSWORD` in the `.env` file on the VPS.
Never use the default password in production.

**To find the VPS IP:**
```bash
# From your local machine
ssh wira@<VPS_IP> "curl -s ifconfig.me"
```

**Dashboard:** "API Health" is provisioned automatically at startup.
Navigate to Dashboards > Igris Inertial > API Health.

---

## 2. Checking Prometheus Targets

**Via Prometheus UI:**
```
http://<VPS_IP>:9090/targets
```

All targets should show state `UP`. Expected targets:
- `api:8080` — Igris Overture Go API
- `node-exporter:9100` — Host metrics
- `prometheus:9090` — Self-monitoring
- `alertmanager:9093` — Alertmanager self-monitoring

**Via CLI (on VPS):**
```bash
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | grep -E '"health"|"job"'
```

**If a target is DOWN:**
1. Check that the service container is running: `docker compose -f docker-compose.production.yml ps`
2. Verify both compose files share the same `igris-network`: `docker network inspect igris-network`
3. Test connectivity from Prometheus container:
   ```bash
   docker exec igris-prometheus wget -qO- http://api:8080/metrics | head -5
   ```

---

## 3. Alert Response Playbooks

---

### APIDown

**Severity:** Critical
**Definition:** `up{job="api"} == 0` for 1 minute

The Prometheus scrape of `/metrics` on `api:8080` has been failing for at least 1 minute.
This means the API container is either crashed, unresponsive, or unreachable.

**Step 1 — Check container status:**
```bash
cd /home/wira/igris
docker compose -f docker-compose.production.yml ps api
```

**Step 2 — Check recent logs:**
```bash
docker compose -f docker-compose.production.yml logs --tail=100 api
```

**Step 3 — If container is stopped/crashed, restart it:**
```bash
docker compose -f docker-compose.production.yml up -d --force-recreate api
```

**Step 4 — Verify it comes up:**
```bash
docker compose -f docker-compose.production.yml ps api
curl -s http://localhost:8080/healthz
```

**Step 5 — If it keeps crashing, check for:**
- Out-of-memory: `docker stats igris-overture`
- DB connection failure: look for `Failed to connect to database` in logs
- Missing env vars: `docker compose -f docker-compose.production.yml config`

**Step 6 — If networking is the problem:**
```bash
# Verify api container is on igris-network
docker network inspect igris-network | grep igris-overture
# If missing, bring down and up to re-attach
docker compose -f docker-compose.production.yml -f docker-compose.monitoring.yml down
docker compose -f docker-compose.production.yml -f docker-compose.monitoring.yml up -d
```

---

### BillingWebhookFailure

**Severity:** Critical
**Definition:** `increase(billing_webhook_failures_total[5m]) > 0`

One or more Polar.sh billing webhook events failed to process. This could mean:
- Subscription activations are not being recorded
- License keys are not being generated
- Tenant tier upgrades/downgrades are not being applied

**Step 1 — Check API logs for webhook errors:**
```bash
cd /home/wira/igris
docker compose -f docker-compose.production.yml logs --tail=200 api | grep -i webhook
```

**Step 2 — Common causes and fixes:**

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid signature` | `POLAR_WEBHOOK_SECRET` mismatch | Verify secret matches Polar dashboard |
| `Handler failed` + DB error | Database connection issue | Check DB is running: `docker compose ps postgres` |
| `Failed to read body` | Network/proxy issue | Check Caddy/nginx logs |

**Step 3 — Test webhook signature verification:**
Polar provides a webhook event log in their dashboard at `polar.sh/dashboard > Webhooks`.
Compare the secret shown there with `POLAR_WEBHOOK_SECRET` in `.env`.

**Step 4 — Re-send a failed webhook:**
In the Polar dashboard, navigate to the failed webhook event and click "Resend".

**Step 5 — Manual recovery if subscription was lost:**
If a customer paid but their tier was not updated:
```bash
# Connect to postgres and update manually
docker exec -it igris-postgres psql -U igris_user -d igris_overture -c \
  "UPDATE tenants SET tier='horizon', subscription_status='active' WHERE tenant_email='customer@example.com';"
```

---

### HighAPIErrorRate

**Severity:** Warning
**Definition:** 5xx rate > 1% of total traffic over 5 minutes

**Step 1 — Identify which endpoints are failing:**
```bash
docker compose -f docker-compose.production.yml logs --tail=500 api | grep '"status":5'
```

Or check Grafana: Dashboard > API Health > "5xx Error Rate" panel.

**Step 2 — Check for database issues:**
```bash
docker compose -f docker-compose.production.yml logs postgres | tail -50
docker exec igris-postgres pg_isready -U igris_user
```

**Step 3 — Check for Redis/Dragonfly issues:**
```bash
docker compose -f docker-compose.production.yml logs cache | tail -50
```

**Step 4 — Check for resource exhaustion:**
```bash
docker stats --no-stream
```

**Step 5 — Roll back if a bad deployment caused this:**
```bash
cd /home/wira/igris
git log --oneline -5  # Find the last good commit
git checkout <good-commit>
docker compose -f docker-compose.production.yml build api
docker compose -f docker-compose.production.yml up -d --force-recreate api
```

---

### InstallSuccessDrop

**Severity:** Warning
**Definition:** Install completion rate < 80% over 30 minutes (when there is active traffic)

The `GET /v1/runtime/install` endpoint is returning errors for more than 20% of requests.

**Step 1 — Check what errors are being returned:**
```bash
docker compose -f docker-compose.production.yml logs api | grep "install\|runtime\|binary" | tail -50
```

**Step 2 — Check if binaries exist on the host:**
```bash
ls -lah /opt/igris-binaries/
ls -lah /opt/igris-binaries/linux-amd64/
ls -lah /opt/igris-binaries/linux-arm64/
ls -lah /opt/igris-binaries/macos-arm64/
```

**Step 3 — Verify the volume mount is working:**
```bash
docker exec igris-overture ls /opt/igris-binaries/
```

**Step 4 — If binaries are missing, restore from backup or rebuild:**
```bash
# Copy binaries from build system or backup
scp build-server:/builds/igris-runtime-linux-x64.tar.gz /opt/igris-binaries/linux-amd64/
```

**Step 5 — Test the endpoint manually:**
```bash
curl -v "http://localhost:8080/v1/runtime/install?platform=linux-amd64" -o /dev/null
```

**Step 6 — Check disk space** (binary streaming requires write-through):
```bash
df -h /opt/igris-binaries
```

---

### DiskSpaceCritical

**Severity:** Critical
**Definition:** Root filesystem has less than 15% free space

**Step 1 — Find what is consuming space:**
```bash
df -h
du -sh /var/lib/docker/* | sort -rh | head -20
du -sh /home/wira/igris/* | sort -rh | head -20
```

**Step 2 — Clean up Docker resources:**
```bash
# Remove stopped containers, dangling images, unused networks
docker system prune -f

# Remove unused volumes (CAUTION: only removes volumes not attached to any container)
docker volume prune -f

# Remove old images specifically
docker image prune -a --filter "until=72h" -f
```

**Step 3 — Clean up old logs:**
```bash
# Docker container logs (json-file driver, max 10MB per file, 3 files per container)
# These are already capped by docker-compose.production.yml logging config.
# If needed, truncate manually:
truncate -s 0 /var/lib/docker/containers/<container-id>/<container-id>-json.log
```

**Step 4 — Clean up PostgreSQL WAL if DB is the culprit:**
```bash
# Check postgres volume size
docker system df -v | grep postgres

# If WAL is large, connect and checkpoint
docker exec -it igris-postgres psql -U igris_user -d igris_overture -c "CHECKPOINT;"
```

**Step 5 — Check Prometheus storage:**
Prometheus is configured with `--storage.tsdb.retention.time=30d`.
If disk is critically full, reduce retention temporarily:
```bash
# Edit docker-compose.monitoring.yml to reduce retention, then reload
docker compose -f docker-compose.monitoring.yml up -d --force-recreate prometheus
```

---

## 4. Silencing an Alert

**Via AlertManager UI** (most straightforward):
```
http://<VPS_IP>:9093
```
1. Find the firing alert
2. Click "Silence"
3. Set duration (e.g., 2h for maintenance windows)
4. Add a comment with your name and reason

**Via AlertManager API:**
```bash
# Silence all alerts with alertname=DiskSpaceCritical for 2 hours
curl -s -X POST http://localhost:9093/api/v2/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [{"name": "alertname", "value": "DiskSpaceCritical", "isRegex": false}],
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "endsAt": "'$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)'",
    "comment": "Planned maintenance - disk cleanup in progress",
    "createdBy": "ops"
  }'
```

**To list active silences:**
```bash
curl -s http://localhost:9093/api/v2/silences | python3 -m json.tool
```

**To delete a silence:**
```bash
curl -s -X DELETE http://localhost:9093/api/v2/silences/<silence-id>
```

---

## 5. Restarting the Monitoring Stack

**Full restart (Prometheus, Grafana, AlertManager, node-exporter):**
```bash
cd /home/wira/igris
docker compose -f docker-compose.production.yml -f docker-compose.monitoring.yml \
  restart prometheus grafana alertmanager node-exporter
```

**Hard restart (force recreate):**
```bash
docker compose -f docker-compose.production.yml -f docker-compose.monitoring.yml \
  up -d --force-recreate prometheus grafana alertmanager node-exporter
```

**Restart only Prometheus (e.g., after config change):**
```bash
docker compose -f docker-compose.monitoring.yml up -d --force-recreate prometheus
```

**Reload Prometheus config without restart:**
```bash
curl -s -X POST http://localhost:9090/-/reload
```
Note: requires `--web.enable-lifecycle` flag (already set in docker-compose.monitoring.yml).

**Reload AlertManager config without restart:**
```bash
curl -s -X POST http://localhost:9093/-/reload
```

**Check monitoring stack health:**
```bash
docker compose -f docker-compose.monitoring.yml ps
curl -s http://localhost:9090/-/healthy  # Prometheus
curl -s http://localhost:3001/api/health  # Grafana (port 3001)
curl -s http://localhost:9093/-/healthy  # AlertManager
curl -s http://localhost:9100/metrics | head -3  # node-exporter
```

---

## 6. Common Maintenance Tasks

### Deploy API update
```bash
cd /home/wira/igris
git pull origin main
docker compose -f docker-compose.production.yml build api
docker compose -f docker-compose.production.yml up -d --force-recreate api
```

### Deploy console update
```bash
cd /home/wira/igris
git pull origin main
docker compose -f docker-compose.production.yml build console
docker compose -f docker-compose.production.yml up -d --force-recreate console
```

### View live API logs
```bash
docker compose -f docker-compose.production.yml logs -f api
```

### Check current Prometheus alert state
```bash
curl -s http://localhost:9090/api/v1/alerts | python3 -m json.tool
```

### Backup Grafana dashboards
```bash
# Dashboards are file-provisioned from monitoring/grafana/dashboards/
# They are already version-controlled in git. No separate backup needed.
```

### Rotate Grafana admin password
```bash
# Update .env file
vi /home/wira/igris/.env  # Change GRAFANA_ADMIN_PASSWORD

# Restart Grafana to pick up new env var
docker compose -f docker-compose.monitoring.yml up -d --force-recreate grafana
```

### Check Prometheus disk usage
```bash
docker volume inspect igris_prometheus_monitoring_data
# Or check from inside:
docker exec igris-prometheus du -sh /prometheus
```
