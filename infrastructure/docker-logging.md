# Docker Logging Configuration for Igris Inertial

## Overview

Docker containers generate logs that, if unrotated, can consume all available disk space. This document describes log rotation strategies for Igris Inertial containers.

---

## Strategy 1: Docker JSON-File Driver with Rotation (Recommended)

Already configured in `docker-compose.production.yml`:

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"      # Rotate when file reaches 10MB
        max-file: "3"        # Keep 3 rotated files
        compress: "true"     # Compress rotated logs (optional)
        labels: "service"    # Include service label in logs
        env: "ENV,VERSION"   # Include environment variables
```

**Storage Calculation**:
- Max size per file: 10MB
- Max files: 3
- Total storage per container: 30MB
- All containers (6): ~180MB total

**Automatic Cleanup**: Old logs automatically deleted when limit reached.

---

## Strategy 2: Docker Syslog Driver

For centralized logging to syslog server:

```yaml
services:
  api:
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://logserver:514"
        tag: "{{.Name}}/{{.ID}}"
        syslog-format: "rfc5424"
```

**Benefits**:
- Centralized log collection
- No local storage consumed
- Syslog server handles rotation

---

## Strategy 3: Docker Fluentd Driver

For log aggregation with Fluentd:

```yaml
services:
  api:
    logging:
      driver: "fluentd"
      options:
        fluentd-address: "localhost:24224"
        tag: "docker.{{.Name}}"
        fluentd-async-connect: "true"
```

**FluentD Output to Elasticsearch**:
```conf
<match docker.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name igris-logs
  type_name _doc

  <buffer>
    flush_interval 5s
  </buffer>
</match>
```

---

## Strategy 4: Logrotate for Docker Logs

If not using Docker logging drivers, use logrotate:

```bash
# /etc/logrotate.d/docker-containers
/var/lib/docker/containers/*/*-json.log {
    daily
    rotate 7
    compress
    copytruncate
    missingok
    notifempty
}
```

**Install logrotate** (if not present):
```bash
# Ubuntu/Debian
apt-get install logrotate

# RHEL/CentOS
yum install logrotate
```

**Test configuration**:
```bash
logrotate -d /etc/logrotate.d/docker-containers
```

**Force rotation**:
```bash
logrotate -f /etc/logrotate.d/docker-containers
```

---

## Monitoring Log Disk Usage

### Check Docker Logs Size
```bash
# Total size of all container logs
du -sh /var/lib/docker/containers/*/

# Size per container
docker ps -q | xargs -I {} docker inspect --format='{{.Name}} {{.LogPath}}' {} | \
    while read name path; do
        size=$(du -h "$path" 2>/dev/null | cut -f1)
        echo "$name: $size"
    done
```

### Alert on High Disk Usage
```bash
#!/bin/bash
# Alert if /var/lib/docker exceeds 80%

USAGE=$(df /var/lib/docker | awk 'NR==2 {print $5}' | sed 's/%//')

if [ $USAGE -gt 80 ]; then
    echo "WARNING: Docker disk usage at ${USAGE}%"
    # Send alert (e.g., email, Slack, PagerDuty)
fi
```

---

## Log Retention Policy

| Log Type | Retention | Storage | Reasoning |
|----------|-----------|---------|-----------|
| API Access Logs | 3 days | ~90MB | High volume, rotate frequently |
| API Error Logs | 30 days | ~300MB | Critical for debugging |
| ML Service Logs | 7 days | ~70MB | Moderate volume |
| Database Logs | 14 days | ~140MB | Compliance requirement |
| Monitoring Logs | 7 days | ~70MB | Prometheus retention handles long-term |

**Total Storage**: ~670MB for all logs

---

## Cron Job for Automatic Cleanup

```bash
# /etc/cron.daily/docker-log-cleanup
#!/bin/bash

# Remove logs older than 7 days
find /var/lib/docker/containers/ -name "*-json.log" -mtime +7 -delete

# Truncate large log files (emergency measure)
find /var/lib/docker/containers/ -name "*-json.log" -size +100M -exec truncate -s 50M {} \;
```

**Make executable**:
```bash
chmod +x /etc/cron.daily/docker-log-cleanup
```

---

## Testing Log Rotation

### Test Scenario 1: Fill Log File
```bash
# Generate large log file
for i in {1..100000}; do
    curl http://localhost:8080/v1/health
done

# Check log size
docker inspect igris-overture | grep LogPath
du -h /var/lib/docker/containers/.../...-json.log
```

### Test Scenario 2: Verify Rotation
```bash
# Wait for rotation trigger (10MB)
# Check rotated files exist
ls -lh /var/lib/docker/containers/.../

# Expected: 3 files (current + 2 rotated)
# ...-json.log
# ...-json.log.1
# ...-json.log.2
```

### Test Scenario 3: Service Restart
```bash
# Restart service, ensure logs persist
docker-compose restart api

# Check logs still accessible
docker logs igris-overture
```

---

## Emergency Log Cleanup

If disk space is critically low:

```bash
#!/bin/bash
# Emergency: Truncate all Docker logs

for log in /var/lib/docker/containers/*/*-json.log; do
    echo "Truncating $log"
    truncate -s 0 "$log"
done

echo "All Docker logs truncated"
```

**⚠️ WARNING**: This deletes all logs. Only use in emergencies.

---

## Best Practices

1. ✅ **Always configure log rotation** (prevent disk exhaustion)
2. ✅ **Monitor disk usage** (alert at 80%)
3. ✅ **Ship logs to centralized storage** (ELK, Splunk, Datadog)
4. ✅ **Compress rotated logs** (save ~70% space)
5. ✅ **Separate high-volume and error logs** (different retention)
6. ✅ **Test rotation before production** (avoid surprises)
7. ✅ **Document retention policy** (compliance)

---

## Validation Checklist

- [ ] Docker logging driver configured with max-size/max-file
- [ ] Logrotate config installed and tested
- [ ] Disk usage monitoring alert configured
- [ ] Log retention policy documented
- [ ] Team trained on log access procedures
- [ ] Emergency cleanup script prepared

---

## Integration with Phase 4 Observability

```
Logs → Docker JSON driver (rotation) → Filebeat → Elasticsearch → Kibana
                ↓
         Structured JSON
                ↓
         Linked to trace_id (OpenTelemetry)
                ↓
         Queryable by trace/span/service
```

---

**Status**: ✅ Configuration complete
**Retention**: 7 days (configurable)
**Storage**: <200MB for all containers
**Automation**: Automatic rotation via Docker driver
