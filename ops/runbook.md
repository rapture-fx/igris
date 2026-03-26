# Igris Inertial — Alert Runbook

## APIDown

**Trigger:** API unreachable for > 1 minute
**Severity:** Critical

1. SSH to VPS, run `docker compose -f docker-compose.production.yml -f docker-compose.monitoring.yml ps api`
2. Check logs: `docker logs igris-overture --tail 100`
3. If container exited: `docker compose ... up -d api`
4. If OOM: increase memory limits or restart host
5. Escalate if not resolved in 10 minutes

---

## HighAPIErrorRate

**Trigger:** 5xx rate > 5% for 2 minutes
**Severity:** Critical

1. Check recent deployment: `git log --oneline -5`
2. Review error logs: `docker logs igris-overture --tail 200 | grep -i error`
3. Check DB health: `docker exec igris-postgres pg_isready`
4. Check cache: `docker exec igris-dragonfly redis-cli -a $REDIS_PASSWORD ping`
5. Rollback if errors started after deploy: `git revert HEAD && deploy`

---

## BillingWebhookFailure

**Trigger:** > 3 billing webhook failures in 10 minutes
**Severity:** Critical

1. Check `POLAR_WEBHOOK_SECRET` is correct in `.env.production`
2. Review API logs for webhook handler errors
3. Verify Polar dashboard for webhook delivery failures
4. Check network connectivity to Polar endpoints
5. Manually replay failed webhooks from Polar dashboard if needed

---

## InstallSuccessDrop

**Trigger:** Runtime install success rate < 80% for 5 minutes
**Severity:** Warning

1. Check `RUNTIME_BINARY_VERSION` in `.env.production` matches latest release
2. Verify GitHub Releases are accessible: `curl -I $RUNTIME_BINARIES_URL`
3. Check download handler logs: `docker logs igris-overture | grep -i runtime`
4. If release missing, publish new release tag or revert `RUNTIME_BINARY_VERSION`

---

## DiskSpaceCritical

**Trigger:** Root filesystem < 10% free
**Severity:** Critical

1. Check usage: `df -h /` and `du -sh /var/lib/docker/*`
2. Prune unused Docker resources: `docker system prune -f`
3. Rotate/delete old logs: check `/var/log` and container log volumes
4. Prune old DB backups in `/home/wira/igris/ops/backups/`
5. If < 5% free, immediately expand disk or delete large files
