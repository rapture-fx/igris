# Production Deployment Runbook

## Schlep Engine - Production Deployment Guide

This comprehensive runbook covers the complete process of deploying Schlep Engine to production, including security, monitoring, and operations procedures.

## Pre-Deployment Checklist

### 1. Infrastructure Requirements

**Minimum Server Specifications:**
- **CPU**: 8 cores (Intel Xeon or AMD Ryzen 7000 series)
- **RAM**: 32GB DDR4
- **Storage**: 500GB NVMe SSD (OS) + 2TB SSD (Data)
- **Network**: 1Gbps connection with low latency
- **OS**: Ubuntu 22.04 LTS or CentOS 8

**Recommended Cloud Providers:**
- **AWS**: EC2 c6i.2xlarge or larger
- **Google Cloud**: n2-standard-8 or larger  
- **Azure**: Standard_D8s_v3 or larger
- **Vultr**: High Performance 8 CPU / 32GB RAM
- **Hetzner**: CPX41 or dedicated server

### 2. Domain & DNS Setup

**Domain Configuration (Cloudflare recommended):**
```
A    schlep-engine.com            → YOUR_SERVER_IP
A    api.schlep-engine.com        → YOUR_SERVER_IP  
A    admin.schlep-engine.com      → YOUR_SERVER_IP
A    docs.schlep-engine.com       → YOUR_SERVER_IP
A    status.schlep-engine.com     → YOUR_SERVER_IP
```

**SSL Certificate Requirements:**
- Wildcard SSL certificate (*.schlep-engine.com)
- Let's Encrypt with auto-renewal configured
- HSTS and security headers enabled

### 3. Environment Preparation

**Required Services:**
- [ ] PostgreSQL 15+ database (managed or self-hosted)
- [ ] Redis 7+ for caching and rate limiting
- [ ] Docker & Docker Compose installed
- [ ] Nginx for reverse proxy and SSL termination
- [ ] Monitoring stack (Prometheus, Grafana, AlertManager)

**Security Hardening:**
- [ ] Firewall configured (UFW or iptables)
- [ ] SSH key-based authentication only
- [ ] Non-root user with sudo access
- [ ] Automatic security updates enabled
- [ ] Fail2ban installed and configured

## Production Deployment Process

### Step 1: Server Initial Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y curl wget git unzip software-properties-common

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create application directory
sudo mkdir -p /opt/schlep-engine
sudo chown $USER:$USER /opt/schlep-engine
```

### Step 2: Application Deployment

```bash
# Clone repository
cd /opt/schlep-engine
git clone https://github.com/your-org/schlep-engine.git .

# Switch to production branch
git checkout production

# Copy production configuration
cp docker-compose.production.yml docker-compose.yml
cp env.production.template .env

# Generate secure secrets
./scripts/generate_production_secrets.py

# Setup SSL certificates
chmod +x ssl-setup.sh
sudo ./ssl-setup.sh

# Start services
docker-compose up -d
```

### Step 3: Environment Configuration

Edit `/opt/schlep-engine/.env` with production values:

```env
# Application
ENVIRONMENT=production
APP_VERSION=2.0.0
DEBUG=false
SECRET_KEY=generate_secure_32_character_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/schlep_engine
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL=3600

# Authentication
JWT_SECRET=generate_secure_jwt_secret
JWT_EXPIRATION=3600
API_KEY_SALT=generate_secure_salt

# OAuth (Configure in respective platforms)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Storage (AWS S3 or compatible)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_BUCKET_NAME=schlep-engine-production
AWS_REGION=us-east-1

# Monitoring
SENTRY_DSN=your_sentry_dsn
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=secure_grafana_password

# Email (SendGrid, Mailgun, etc.)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key

# LemonSqueezy Billing
LEMONSQUEEZY_API_KEY=your_lemonsqueezy_api_key
LEMONSQUEEZY_STORE_ID=your_store_id
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret

# Security
CORS_ORIGINS=https://schlep-engine.com,https://admin.schlep-engine.com
ALLOWED_HOSTS=schlep-engine.com,api.schlep-engine.com,admin.schlep-engine.com
RATE_LIMIT_PER_MINUTE=60
ENCRYPTION_KEY=generate_32_character_encryption_key

# Performance
WORKER_PROCESSES=4
WORKER_CONNECTIONS=1000
CELERY_WORKERS=8
MAX_UPLOAD_SIZE=100MB
```

### Step 4: Database Setup

```bash
# Run database migrations
docker-compose exec api python -m alembic upgrade head

# Create admin user
docker-compose exec api python -c "
from app.auth.user_management import create_admin_user
create_admin_user('admin@schlep-engine.com', 'secure_admin_password')
"

# Seed initial data
docker-compose exec api python scripts/seed_database.py --production
```

### Step 5: SSL & Security Configuration

```bash
# Generate SSL certificates
sudo docker-compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@schlep-engine.com \
  --agree-tos \
  --no-eff-email \
  -d schlep-engine.com \
  -d api.schlep-engine.com \
  -d admin.schlep-engine.com \
  -d docs.schlep-engine.com

# Setup auto-renewal
echo "0 0,12 * * * root docker-compose run --rm certbot renew --quiet && docker-compose restart nginx" | sudo tee -a /etc/crontab

# Configure security headers in Nginx
# (Configuration included in nginx/nginx.conf)
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# API Health
curl -f https://api.schlep-engine.com/health
# Expected: {"status": "healthy", "timestamp": "..."}

# Detailed Health Check
curl -f https://api.schlep-engine.com/api/v1/health/detailed
# Should show all services as healthy

# Database Connection
curl -f https://api.schlep-engine.com/api/v1/admin/system/stats
# Should return system metrics
```

### 2. Functional Testing

```bash
# Test file upload
curl -X POST "https://api.schlep-engine.com/api/v1/data/upload" \
  -H "X-API-Key: test_api_key" \
  -F "file=@test_data.csv" \
  -F "name=Test Upload"

# Test authentication
curl -X POST "https://api.schlep-engine.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@schlep-engine.com", "password": "admin_password"}'

# Test rate limiting
for i in {1..70}; do
  curl -H "X-API-Key: test_key" https://api.schlep-engine.com/api/v1/health
done
# Should return 429 after 60 requests
```

### 3. Performance Validation

```bash
# Load test (using Apache Bench)
ab -n 1000 -c 10 -H "X-API-Key: test_key" https://api.schlep-engine.com/api/v1/health

# Memory usage check
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Disk space monitoring
df -h /opt/schlep-engine
```

## Monitoring & Alerting Setup

### 1. Prometheus Configuration

Edit `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'schlep-engine-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres_exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis_exporter:9121']

  - job_name: 'node'
    static_configs:
      - targets: ['node_exporter:9100']
```

### 2. Alert Rules

Create `monitoring/alert_rules.yml`:

```yaml
groups:
  - name: schlep_engine_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.name }}"

      - alert: DatabaseConnectionFailure
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"

      - alert: APIEndpointDown
        expr: up{job="schlep-engine-api"} == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "API endpoint is down"
```

### 3. Grafana Dashboards

Access Grafana at `https://monitoring.schlep-engine.com` and import dashboards:

**Application Dashboard:**
- API response times and throughput
- Error rates by endpoint
- Authentication success/failure rates
- Data processing job metrics

**Infrastructure Dashboard:**
- CPU, memory, disk usage
- Network I/O
- Database performance
- Redis cache hit rates

## Backup & Recovery

### 1. Automated Backup Setup

```bash
# Create backup script
cat > /opt/schlep-engine/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/schlep-engine"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
docker-compose exec -T postgres pg_dump -U schlep_user schlep_engine | gzip > $BACKUP_DIR/database_$DATE.sql.gz

# Application data backup
tar -czf $BACKUP_DIR/app_data_$DATE.tar.gz /opt/schlep-engine/uploads /opt/schlep-engine/logs

# Configuration backup
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/schlep-engine/.env /opt/schlep-engine/docker-compose.yml

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/ s3://schlep-engine-backups/production/ --recursive --include "*$DATE*"

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
EOF

chmod +x /opt/schlep-engine/scripts/backup.sh

# Schedule daily backups
echo "0 2 * * * /opt/schlep-engine/scripts/backup.sh" | sudo tee -a /etc/crontab
```

### 2. Recovery Procedures

**Database Recovery:**
```bash
# Stop application
docker-compose stop api

# Restore database
gunzip -c /opt/backups/schlep-engine/database_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose exec -T postgres psql -U schlep_user -d schlep_engine

# Start application
docker-compose start api
```

**Full System Recovery:**
```bash
# Restore application data
tar -xzf /opt/backups/schlep-engine/app_data_YYYYMMDD_HHMMSS.tar.gz -C /

# Restore configuration
tar -xzf /opt/backups/schlep-engine/config_YYYYMMDD_HHMMSS.tar.gz -C /

# Restart services
docker-compose down && docker-compose up -d
```

## Security Procedures

### 1. Security Monitoring

```bash
# Monitor failed login attempts
docker-compose logs api | grep "authentication_failed" | tail -20

# Check for unusual API usage patterns
curl -H "X-API-Key: admin_key" https://api.schlep-engine.com/api/v1/security-admin/events

# Monitor rate limit violations
docker-compose logs nginx | grep "429" | tail -20
```

### 2. Incident Response

**Security Breach Response:**
1. **Immediate Actions:**
   ```bash
   # Block suspicious IP
   sudo ufw deny from SUSPICIOUS_IP
   
   # Rotate API keys
   docker-compose exec api python scripts/rotate_api_keys.py --emergency
   
   # Force user logout
   docker-compose exec redis redis-cli FLUSHDB 2
   ```

2. **Investigation:**
   ```bash
   # Check access logs
   docker-compose logs nginx | grep "SUSPICIOUS_IP"
   
   # Audit database access
   docker-compose exec postgres psql -U schlep_user -d schlep_engine -c "
   SELECT * FROM audit_logs WHERE ip_address = 'SUSPICIOUS_IP' ORDER BY timestamp DESC;
   "
   ```

3. **Recovery:**
   ```bash
   # Update security patches
   sudo apt update && sudo apt upgrade -y
   
   # Restart all services
   docker-compose down && docker-compose up -d
   
   # Verify system integrity
   ./scripts/security_audit.sh
   ```

## Performance Optimization

### 1. Database Optimization

```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Analyze query performance
SELECT query, mean_time, calls, total_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Optimize frequently used indexes
REINDEX INDEX CONCURRENTLY idx_investigations_user_id;
REINDEX INDEX CONCURRENTLY idx_jobs_status;
```

### 2. Application Performance Tuning

```bash
# Optimize Docker containers
docker system prune -f
docker image prune -f

# Tune Nginx worker processes
# Edit nginx/nginx.conf:
# worker_processes auto;
# worker_connections 1024;

# Optimize Celery workers
# Edit docker-compose.yml:
# CELERY_WORKERS=8
# CELERY_MAX_TASKS_PER_CHILD=1000
```

### 3. Cache Optimization

```bash
# Monitor Redis memory usage
docker-compose exec redis redis-cli INFO memory

# Optimize cache settings
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Clear cache if needed
docker-compose exec redis redis-cli FLUSHALL
```

## Maintenance Procedures

### 1. Regular Maintenance Schedule

**Daily (Automated):**
- [ ] Health checks and monitoring alerts
- [ ] Automated backups
- [ ] Log rotation
- [ ] Certificate renewal checks

**Weekly (Automated):**
- [ ] Security patches
- [ ] Performance metrics review
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Backup verification

**Monthly (Manual):**
- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Dependency updates
- [ ] Disaster recovery testing

### 2. Update Procedures

**Application Updates:**
```bash
# Create backup before update
./scripts/backup.sh

# Pull latest code
git fetch origin
git checkout v2.1.0  # or latest stable version

# Update dependencies
docker-compose pull

# Run database migrations
docker-compose exec api python -m alembic upgrade head

# Restart services with zero downtime
docker-compose up -d --no-deps api
docker-compose up -d --no-deps worker
```

**System Updates:**
```bash
# Schedule maintenance window
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker
sudo apt install docker-ce docker-ce-cli containerd.io

# Restart if kernel updated
sudo reboot
```

## Troubleshooting Guide

### Common Issues

**1. API Not Responding (502/503 Errors)**
```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs api
docker-compose logs nginx

# Restart services
docker-compose restart api
```

**2. Database Connection Issues**
```bash
# Test database connection
docker-compose exec postgres psql -U schlep_user -d schlep_engine -c "SELECT 1;"

# Check connection pool
docker-compose exec api python -c "
from app.core.database import engine
print(engine.pool.status())
"

# Restart database
docker-compose restart postgres
```

**3. High Memory Usage**
```bash
# Check memory usage by container
docker stats --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Restart high-memory containers
docker-compose restart api worker

# Clear cache
docker-compose exec redis redis-cli FLUSHALL
```

**4. SSL Certificate Issues**
```bash
# Check certificate status
openssl s_client -servername api.schlep-engine.com -connect api.schlep-engine.com:443 -showcerts

# Renew certificates
docker-compose run --rm certbot renew
docker-compose restart nginx
```

## Emergency Contacts & Escalation

**On-Call Rotation:**
- Primary: DevOps Lead
- Secondary: Backend Lead  
- Escalation: CTO

**Critical Alert Response Times:**
- **P0 (System Down)**: 15 minutes
- **P1 (Critical Feature)**: 1 hour
- **P2 (Performance)**: 4 hours
- **P3 (Minor Issues)**: 24 hours

**Emergency Procedures:**
1. Acknowledge alert in monitoring system
2. Join incident channel: #incident-response
3. Follow troubleshooting guide
4. Escalate if not resolved within SLA
5. Document resolution in runbook

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial production runbook |
| 1.1 | 2024-02-01 | Added security procedures |
| 1.2 | 2024-02-15 | Enhanced monitoring setup |

**Last Updated**: 2024-02-15
**Next Review**: 2024-05-15