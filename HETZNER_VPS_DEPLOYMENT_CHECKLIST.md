# Hetzner VPS Deployment Checklist - Igris Inertial
**Date**: 2026-01-15
**Purpose**: Complete pre-deployment checklist for Hetzner VPS
**Target**: Production-ready deployment of Overture + Runtime

---

## 🛒 Part 1: What to Buy from Hetzner

### Recommended Server Configuration

#### Option A: Single Server Deployment (Budget: ~€50/month)
**Hetzner Product**: CPX41 (Cloud Server)

| Spec | Value | Rationale |
|------|-------|-----------|
| **vCPUs** | 8 vCPUs | Handles Overture (Go) + Runtime (Rust) + PostgreSQL + Dragonfly |
| **RAM** | 16 GB | Postgres (4GB) + Dragonfly (4GB) + Overture (4GB) + Runtime (2GB) + OS (2GB) |
| **Storage** | 240 GB SSD | Database + logs + Docker images |
| **Network** | 20 TB traffic | Sufficient for 10K-50K requests/day |
| **Location** | Nuremberg (nbg1) or Falkenstein (fsn1) | EU data residency, GDPR compliant |
| **Price** | ~€48.90/month | Mid-range for production |

**Purchase Link**: https://www.hetzner.com/cloud#pricing

---

#### Option B: High-Performance Deployment (Recommended: ~€120/month)
**Hetzner Product**: CCX33 (Dedicated vCPU Cloud Server)

| Spec | Value | Rationale |
|------|-------|-----------|
| **vCPUs** | 8 dedicated vCPUs | No noisy neighbors, consistent performance |
| **RAM** | 32 GB | Comfortable headroom for growth |
| **Storage** | 240 GB NVMe SSD | Faster database I/O |
| **Network** | 20 TB traffic | Sufficient for 50K-100K requests/day |
| **Location** | Nuremberg (nbg1) | EU data residency |
| **Price** | ~€116.90/month | Production-grade performance |

**Why dedicated vCPUs?**
- Consistent performance (no CPU steal)
- Predictable latency for Overture routing decisions
- Better for database workloads

---

#### Option C: Distributed Deployment (Advanced: ~€150/month)
**Setup**: 2 servers + load balancer

**Server 1 - Overture + Dragonfly** (CPX31)
- 4 vCPUs, 8 GB RAM, 160 GB SSD
- Price: ~€28.90/month

**Server 2 - PostgreSQL + pgBouncer** (CCX23)
- 4 dedicated vCPUs, 16 GB RAM, 240 GB NVMe SSD
- Price: ~€72.90/month

**Load Balancer** (LB11)
- 20 TB traffic, 5 targets
- Price: ~€5.51/month

**Optional: Runtime Edge Nodes** (CX22)
- 2 vCPUs, 4 GB RAM, 40 GB SSD
- Price: ~€5.83/month per node
- Deploy close to users (US, Asia, etc.)

**Total**: ~€107.31/month (without edge nodes)

---

### Additional Hetzner Services

#### 1. Storage Box (Backups)
**Product**: BX11 Storage Box
- 1 TB storage
- SFTP/Samba/WebDAV access
- Price: ~€3.81/month
- **Use**: Daily PostgreSQL backups, log archival

**Purchase Link**: https://www.hetzner.com/storage/storage-box

#### 2. Floating IP (Recommended)
**Product**: IPv4 Floating IP
- 1 static IPv4 address
- Instant failover capability
- Price: ~€1.19/month
- **Use**: Point DNS to floating IP, migrate between servers without DNS changes

#### 3. Firewall (Included Free)
**Product**: Cloud Firewall
- Free with cloud servers
- Stateful packet filtering
- **Use**: Lock down all ports except 80, 443, 22

#### 4. Snapshot (Optional)
**Product**: Server Snapshots
- Pay per GB (€0.0119/GB/month)
- ~€3-5/month for 240GB server
- **Use**: Pre-deployment snapshot for instant rollback

---

### Total Monthly Cost Estimates

| Deployment Type | Monthly Cost (EUR) | Monthly Cost (USD) |
|----------------|-------------------|-------------------|
| **Budget** (Single CPX41) | €48.90 + €3.81 + €1.19 = **€53.90** | **~$58** |
| **Recommended** (Single CCX33) | €116.90 + €3.81 + €1.19 = **€121.90** | **~$132** |
| **Distributed** (2 servers + LB) | €107.31 + €3.81 + €1.19 = **€112.31** | **~$122** |

**Recommendation for Launch**: Start with **Option B (CCX33)** for consistent performance, upgrade to distributed later if needed.

---

## ✅ Part 2: Pre-Deployment Checklist

### Phase 1: Critical Fixes (MUST COMPLETE BEFORE DEPLOYMENT)

#### 1. Implement Row-Level Security Policies ⚠️ CRITICAL
**Status**: ❌ Not implemented
**Effort**: 2-3 hours
**Location**: `/igris-overture/database/schema.sql`

**Action Items**:
- [ ] Add RLS to all 9 tables
- [ ] Create tenant isolation policies
- [ ] Test with multiple tenants
- [ ] Verify policy enforcement

**SQL Template**:
```sql
-- Apply to ALL tables
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_budgets ON budgets
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant')::text);

-- Repeat for: spending_log, policy_settings, api_keys, semantic_bandit_arms,
-- semantic_bandit_rewards, cognitive_proposals, cognitive_audit_log, audit_events
```

**Testing**:
```bash
# Test RLS enforcement
SET app.current_tenant = 'tenant_A';
SELECT * FROM budgets; -- Should only return tenant_A rows

SET app.current_tenant = 'tenant_B';
SELECT * FROM budgets; -- Should only return tenant_B rows
```

---

#### 2. Fix Thompson Sampling (Beta Distribution) ⚠️ CRITICAL
**Status**: ⚠️ Uses approximation instead of true Beta sampling
**Effort**: 1 hour
**Location**: `/igris-overture/bandit/reward_engine.go:369-390`

**Action Items**:
- [ ] Add `gonum` dependency to `go.mod`
- [ ] Replace `sampleBeta()` function with proper Beta distribution
- [ ] Test routing accuracy
- [ ] Verify Thompson Sampling selects optimal providers

**Code Fix**:
```go
import "gonum.org/v1/gonum/stat/distuv"

func sampleBeta(alpha, beta float64) float64 {
    dist := distuv.Beta{
        Alpha: alpha,
        Beta:  beta,
        Src:   rand.NewSource(uint64(time.Now().UnixNano())),
    }
    return dist.Rand()
}
```

**Testing**:
```bash
# Run bandit tests
cd igris-overture/bandit
go test -v -run TestThompsonSampling
```

---

#### 3. Implement Tier-Based Rate Limiting ⚠️ CRITICAL
**Status**: ❌ Code exists but not configured
**Effort**: 2-3 hours
**Location**: `/igris-overture/middleware/tier_enforcer.go`

**Action Items**:
- [ ] Add tier limits to `config/tier_config.yaml`
- [ ] Load limits in `tier_enforcer.go`
- [ ] Apply correct rate limiter per tenant tier
- [ ] Test with all 4 tiers (Trial, Developer, Growth, Scale)

**Config Template** (`config/tier_config.yaml`):
```yaml
tiers:
  trial:
    requests_per_second: 10
    requests_per_minute: 300
    requests_per_month: 50000
    concurrent_requests: 5
    budget_limit_usd: 10.0

  developer:
    requests_per_second: 10
    requests_per_minute: 300
    requests_per_month: 500000
    concurrent_requests: 5
    budget_limit_usd: 100.0

  growth:
    requests_per_second: 50
    requests_per_minute: 1500
    requests_per_month: 2000000
    concurrent_requests: 50
    budget_limit_usd: 1000.0

  scale:
    requests_per_second: 1000
    requests_per_minute: 60000
    requests_per_month: -1  # Unlimited
    concurrent_requests: 1000
    budget_limit_usd: -1  # Unlimited
```

**Testing**:
```bash
# Test rate limiting for each tier
curl -X POST https://api.igrisinertial.com/v1/chat/completions \
  -H "Authorization: Bearer TRIAL_TENANT_KEY" \
  --rate 20  # Should get 429 after 10 requests
```

---

#### 4. Implement Concurrent Request Limits ⚠️ CRITICAL
**Status**: ❌ Not implemented
**Effort**: 3-4 hours
**Location**: Create `/igris-overture/middleware/concurrent_limiter.go`

**Action Items**:
- [ ] Create concurrent request limiter middleware
- [ ] Track active requests per tenant
- [ ] Enforce tier-specific limits
- [ ] Return 429 when limit exceeded
- [ ] Test with parallel requests

**Implementation** (`middleware/concurrent_limiter.go`):
```go
package middleware

import (
    "sync"
    "github.com/gofiber/fiber/v2"
)

type ConcurrentLimiter struct {
    mu       sync.Mutex
    active   map[string]int  // tenant_id -> active request count
    limits   map[string]int  // tier -> max concurrent requests
}

func NewConcurrentLimiter(limits map[string]int) *ConcurrentLimiter {
    return &ConcurrentLimiter{
        active: make(map[string]int),
        limits: limits,
    }
}

func (cl *ConcurrentLimiter) Middleware() fiber.Handler {
    return func(c *fiber.Ctx) error {
        tenantCtx := GetTenantContext(c)
        tier := tenantCtx.Tier
        tenantID := tenantCtx.TenantID

        if !cl.acquire(tenantID, tier) {
            return c.Status(429).JSON(fiber.Map{
                "error": "Concurrent request limit exceeded",
            })
        }
        defer cl.release(tenantID)

        return c.Next()
    }
}

func (cl *ConcurrentLimiter) acquire(tenantID, tier string) bool {
    cl.mu.Lock()
    defer cl.mu.Unlock()

    maxConcurrent := cl.limits[tier]
    current := cl.active[tenantID]

    if current >= maxConcurrent {
        return false  // Limit exceeded
    }

    cl.active[tenantID]++
    return true
}

func (cl *ConcurrentLimiter) release(tenantID string) {
    cl.mu.Lock()
    defer cl.mu.Unlock()
    cl.active[tenantID]--
}
```

**Testing**:
```bash
# Launch 10 parallel requests (should fail for Trial tier, limit = 5)
for i in {1..10}; do
  curl -X POST https://api.igrisinertial.com/v1/chat/completions \
    -H "Authorization: Bearer TRIAL_TENANT_KEY" &
done
```

---

### Phase 2: Verification & Testing (SHOULD COMPLETE)

#### 5. Verify Budget Enforcement Works ⚠️ NEEDS TESTING
**Status**: ⚠️ Schema exists, enforcement unclear
**Effort**: 1-2 hours

**Action Items**:
- [ ] Read `tier_enforcer.go` line-by-line to verify budget check
- [ ] Create test tenant with $5 budget limit
- [ ] Send requests until budget exhausted
- [ ] Verify 402 response returned
- [ ] Verify budget breach flag set in database

**Testing**:
```bash
# Test budget exhaustion
# 1. Create tenant with $5 limit
curl -X POST https://api.igrisinertial.com/v1/admin/tenants \
  -H "Authorization: Bearer ADMIN_KEY" \
  -d '{"budget_limit_usd": 5.0}'

# 2. Send expensive requests until budget hits $5
for i in {1..100}; do
  curl -X POST https://api.igrisinertial.com/v1/chat/completions \
    -H "Authorization: Bearer TENANT_KEY" \
    -d '{"model":"gpt-4","messages":[...],"max_tokens":1000}'
done

# 3. Verify 402 response
# Expected: {"error": {"code": 402, "message": "Budget exhausted"}}

# 4. Check database
psql -c "SELECT breached, total_spend_usd, budget_limit_usd FROM budgets WHERE tenant_id = 'test_tenant';"
# Expected: breached = TRUE
```

---

#### 6. Verify Gold Code Override Works ❓ UNKNOWN
**Status**: ❓ Mentioned in docs, implementation not verified
**Effort**: 1 hour

**Action Items**:
- [ ] Search codebase for `gold_code` implementation
- [ ] Test gold code bypass of budget limit
- [ ] Test gold code bypass of rate limit
- [ ] If not implemented: Remove from documentation OR implement

**Testing**:
```bash
# Search for gold_code implementation
cd /Users/wira/Desktop/system
grep -r "gold_code" igris-overture/

# If found, test it:
curl -X POST https://api.igrisinertial.com/v1/chat/completions \
  -H "Authorization: Bearer BUDGET_EXHAUSTED_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [...],
    "gold_code": "EMERGENCY_OVERRIDE_123"
  }'
# Expected: Request succeeds despite budget exhaustion
```

---

#### 7. Verify Benchmark Fallback Works ❓ UNKNOWN
**Status**: ❓ Mock providers exist, auto-fallback unclear
**Effort**: 1 hour

**Action Items**:
- [ ] Exhaust tenant budget
- [ ] Send request without gold code
- [ ] Verify automatic routing to mock provider
- [ ] Verify response metadata shows `provider: "benchmark-openai"`
- [ ] If not working: Implement OR remove from docs

**Testing**:
```bash
# Test benchmark fallback
curl -X POST https://api.igrisinertial.com/v1/chat/completions \
  -H "Authorization: Bearer BUDGET_EXHAUSTED_KEY" \
  -d '{"model": "gpt-4", "messages": [...]}'

# Expected response:
# {
#   "metadata": {
#     "provider": "benchmark-openai",
#     "routing_decision": "budget_fallback",
#     "cost_usd": 0.0,
#     "warning": "Budget exhausted. Using simulated benchmark provider."
#   }
# }
```

---

### Phase 3: Database Optimization (RECOMMENDED)

#### 8. Add Missing Database Indexes 📊
**Status**: ⚠️ Basic indexes exist, may need composites
**Effort**: 2-3 hours

**Action Items**:
- [ ] Run `EXPLAIN ANALYZE` on common queries
- [ ] Add composite indexes for hot queries
- [ ] Test query performance before/after
- [ ] Document index strategy

**Common Queries to Index**:
```sql
-- 1. Budget lookup by tenant + month
CREATE INDEX idx_budgets_tenant_month ON budgets(tenant_id, year_month);

-- 2. Spending log aggregation
CREATE INDEX idx_spending_tenant_timestamp ON spending_log(tenant_id, logged_at);

-- 3. Thompson Sampling state lookup
CREATE INDEX idx_bandit_arms_tenant_class ON semantic_bandit_arms(tenant_id, semantic_class);

-- 4. Cognitive proposals by status
CREATE INDEX idx_proposals_tenant_status ON cognitive_proposals(tenant_id, status, generated_at);
```

**Testing**:
```sql
-- Before index
EXPLAIN ANALYZE SELECT SUM(cost_usd) FROM spending_log WHERE tenant_id = 'test' AND logged_at > NOW() - INTERVAL '1 month';
-- Expected: Sequential scan (slow)

-- After index
EXPLAIN ANALYZE SELECT SUM(cost_usd) FROM spending_log WHERE tenant_id = 'test' AND logged_at > NOW() - INTERVAL '1 month';
-- Expected: Index scan (fast)
```

---

#### 9. Set Up Database Migrations 📦
**Status**: ❌ No migration tool configured
**Effort**: 2 hours

**Action Items**:
- [ ] Choose migration tool (golang-migrate recommended)
- [ ] Convert `schema.sql` to numbered migrations
- [ ] Test migration up/down
- [ ] Document migration process

**Recommended Tool**: [golang-migrate](https://github.com/golang-migrate/migrate)

**Setup**:
```bash
# Install migrate CLI
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Create migrations directory
mkdir -p igris-overture/database/migrations

# Create initial migration
migrate create -ext sql -dir igris-overture/database/migrations -seq initial_schema

# Split schema.sql into:
# - 000001_initial_schema.up.sql
# - 000001_initial_schema.down.sql

# Run migration
migrate -path igris-overture/database/migrations -database "postgres://user:pass@localhost:5432/igris?sslmode=disable" up
```

---

#### 10. Tune PostgreSQL Configuration 🔧
**Status**: ⚠️ Default config may not be optimal
**Effort**: 1 hour

**Action Items**:
- [ ] Tune `postgresql.conf` for production
- [ ] Set appropriate `shared_buffers`
- [ ] Configure `max_connections`
- [ ] Enable query logging for debugging
- [ ] Test configuration

**Recommended Settings** (for 16GB RAM server):
```ini
# postgresql.conf
max_connections = 500
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB
```

**Apply Changes**:
```bash
# Edit config
sudo nano /etc/postgresql/16/main/postgresql.conf

# Restart PostgreSQL
sudo systemctl restart postgresql

# Verify settings
psql -c "SHOW shared_buffers;"
psql -c "SHOW max_connections;"
```

---

## 🔒 Part 3: Security Hardening

### 1. SSH Hardening
**Priority**: 🚨 CRITICAL

**Action Items**:
- [ ] Disable root login
- [ ] Disable password authentication
- [ ] Use SSH keys only
- [ ] Change default SSH port (optional)
- [ ] Install fail2ban

**Configuration** (`/etc/ssh/sshd_config`):
```ini
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 22  # Or custom port like 2222
```

**Install fail2ban**:
```bash
sudo apt update
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

### 2. Firewall Configuration
**Priority**: 🚨 CRITICAL

**Action Items**:
- [ ] Enable UFW (Uncomplicated Firewall)
- [ ] Allow only required ports
- [ ] Enable Hetzner Cloud Firewall
- [ ] Block all unnecessary inbound traffic

**UFW Setup**:
```bash
# Enable UFW
sudo ufw enable

# Allow SSH (change port if customized)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block everything else by default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Check status
sudo ufw status verbose
```

**Hetzner Cloud Firewall** (via Hetzner Console):
```yaml
Inbound Rules:
  - Port 22 (SSH): Only from your IP (e.g., 1.2.3.4/32)
  - Port 80 (HTTP): From anywhere (0.0.0.0/0)
  - Port 443 (HTTPS): From anywhere (0.0.0.0/0)

Outbound Rules:
  - Allow all (for API calls to OpenAI, Anthropic, etc.)
```

---

### 3. SSL/TLS Certificates
**Priority**: 🚨 CRITICAL

**Action Items**:
- [ ] Install Certbot (Let's Encrypt)
- [ ] Obtain SSL certificates for your domain
- [ ] Configure automatic renewal
- [ ] Test SSL configuration

**Setup**:
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d api.igrisinertial.com -d www.igrisinertial.com

# Test automatic renewal
sudo certbot renew --dry-run

# Certificates auto-renew via systemd timer
sudo systemctl status certbot.timer
```

---

### 4. Environment Variables Security
**Priority**: 🚨 CRITICAL

**Action Items**:
- [ ] Never commit `.env` files to git
- [ ] Use strong random secrets
- [ ] Rotate secrets regularly
- [ ] Restrict file permissions

**Secure `.env` file**:
```bash
# Create .env with proper permissions
touch /opt/igris/.env
chmod 600 /opt/igris/.env
chown igris:igris /opt/igris/.env
```

**Required Environment Variables**:
```bash
# Database
DATABASE_URL=postgres://igris:STRONG_RANDOM_PASSWORD@localhost:5432/igris?sslmode=require

# Redis/Dragonfly
REDIS_URL=redis://:STRONG_RANDOM_PASSWORD@localhost:6379

# JWT Secret
JWT_SECRET=GENERATE_WITH_openssl_rand_hex_32

# KMS Key ID (for API key encryption)
KMS_KEY_ID=key-abc123

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-observability-backend.com

# Rate Limiting
RATE_LIMIT_REDIS_URL=redis://localhost:6379
```

**Generate Strong Secrets**:
```bash
# JWT Secret
openssl rand -hex 32

# Database Password
openssl rand -base64 32
```

---

### 5. Docker Security
**Priority**: ⚠️ RECOMMENDED

**Action Items**:
- [ ] Run containers as non-root user
- [ ] Use Docker secrets (not env vars for sensitive data)
- [ ] Scan images for vulnerabilities
- [ ] Keep images updated

**docker-compose.yml Security**:
```yaml
services:
  overture:
    image: igris-overture:latest
    user: "1000:1000"  # Non-root user
    read_only: true    # Read-only filesystem
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

---

## 🌐 Part 4: DNS & Domain Setup

### 1. DNS Configuration
**Priority**: 🚨 CRITICAL

**Action Items**:
- [ ] Point domain to Hetzner Floating IP
- [ ] Configure A records
- [ ] Configure AAAA records (IPv6)
- [ ] Set up www redirect

**DNS Records** (example for Cloudflare):
```
Type  Name                    Content              TTL   Proxy
A     api.igrisinertial.com   <FLOATING_IP>        Auto  Proxied
A     @                       <FLOATING_IP>        Auto  Proxied
AAAA  api.igrisinertial.com   <IPv6>               Auto  Proxied
CNAME www                     igrisinertial.com    Auto  Proxied
```

---

### 2. Nginx Configuration
**Priority**: 🚨 CRITICAL

**Action Items**:
- [ ] Install Nginx
- [ ] Configure reverse proxy to Overture
- [ ] Enable HTTPS
- [ ] Configure rate limiting
- [ ] Enable gzip compression

**Nginx Config** (`/etc/nginx/sites-available/igris`):
```nginx
server {
    listen 80;
    server_name api.igrisinertial.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.igrisinertial.com;

    ssl_certificate /etc/letsencrypt/live/api.igrisinertial.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.igrisinertial.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;

    # Proxy to Overture
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:8080/health;
        access_log off;
    }
}
```

---

## 📊 Part 5: Monitoring & Observability

### 1. Prometheus Setup
**Priority**: ⚠️ RECOMMENDED

**Action Items**:
- [ ] Deploy Prometheus container
- [ ] Configure scrape targets (Overture, Runtime, Postgres, Dragonfly)
- [ ] Set up retention policy
- [ ] Configure alerting rules

**docker-compose.yml Addition**:
```yaml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.retention.time=30d'
  ports:
    - "9090:9090"
  restart: unless-stopped

grafana:
  image: grafana/grafana:latest
  volumes:
    - grafana_data:/var/lib/grafana
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=CHANGE_ME
  ports:
    - "3000:3000"
  restart: unless-stopped
```

---

### 2. Logging Setup
**Priority**: ⚠️ RECOMMENDED

**Action Items**:
- [ ] Configure log rotation
- [ ] Set up centralized logging (Loki or similar)
- [ ] Define log retention policy
- [ ] Monitor disk usage

**Log Rotation** (`/etc/logrotate.d/igris`):
```
/var/log/igris/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 igris igris
    sharedscripts
    postrotate
        docker-compose -f /opt/igris/docker-compose.yml restart overture
    endscript
}
```

---

### 3. Alerting Setup
**Priority**: ⚠️ RECOMMENDED

**Action Items**:
- [ ] Configure AlertManager
- [ ] Define alert rules (CPU, memory, disk, errors)
- [ ] Set up notification channels (email, Slack, PagerDuty)
- [ ] Test alerts

**Example Alert Rules** (`prometheus-alerts.yml`):
```yaml
groups:
  - name: igris_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: BudgetExhausted
        expr: tenant_budget_exhausted == 1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Tenant {{ $labels.tenant_id }} budget exhausted"

      - alert: HighCPU
        expr: rate(process_cpu_seconds_total[5m]) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
```

---

## 💾 Part 6: Backup Strategy

### 1. Database Backups
**Priority**: 🚨 CRITICAL

**Action Items**:
- [ ] Set up daily PostgreSQL backups
- [ ] Upload to Hetzner Storage Box
- [ ] Test restoration procedure
- [ ] Automate backup verification

**Backup Script** (`/opt/igris/scripts/backup-db.sh`):
```bash
#!/bin/bash
set -e

BACKUP_DIR="/tmp/igris-backups"
STORAGE_BOX="u123456@u123456.your-storagebox.de:/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
mkdir -p $BACKUP_DIR
pg_dump -h localhost -U igris igris | gzip > $BACKUP_DIR/igris_$DATE.sql.gz

# Upload to Storage Box
scp $BACKUP_DIR/igris_$DATE.sql.gz $STORAGE_BOX/

# Clean local backup
rm $BACKUP_DIR/igris_$DATE.sql.gz

# Keep only last 7 days on Storage Box
ssh u123456@u123456.your-storagebox.de "find /backups -name '*.sql.gz' -mtime +7 -delete"

echo "Backup completed: igris_$DATE.sql.gz"
```

**Cron Job** (daily at 2 AM):
```bash
crontab -e

# Add:
0 2 * * * /opt/igris/scripts/backup-db.sh >> /var/log/igris/backup.log 2>&1
```

---

### 2. Application Backups
**Priority**: ⚠️ RECOMMENDED

**Action Items**:
- [ ] Backup `.env` files (encrypted)
- [ ] Backup docker-compose configurations
- [ ] Backup Nginx configs
- [ ] Store in separate location

---

## 🚀 Part 7: Deployment Procedure

### Pre-Deployment Checklist

**Before you deploy, ensure all these are ✅**:

#### Critical (MUST be done):
- [ ] Row-Level Security policies implemented
- [ ] Thompson Sampling fixed (true Beta distribution)
- [ ] Tier-based rate limiting configured
- [ ] Concurrent request limits implemented
- [ ] SSH hardened (keys only, no root)
- [ ] Firewall configured (UFW + Hetzner Cloud Firewall)
- [ ] SSL/TLS certificates obtained
- [ ] Environment variables secured
- [ ] DNS configured and propagated
- [ ] Database backups automated
- [ ] Strong passwords/secrets generated

#### Recommended:
- [ ] Budget enforcement tested
- [ ] Gold code override verified (or removed from docs)
- [ ] Benchmark fallback verified (or removed from docs)
- [ ] Database indexes optimized
- [ ] PostgreSQL tuned for production
- [ ] Prometheus monitoring deployed
- [ ] Alerting configured
- [ ] Log rotation configured

---

### Deployment Steps

#### 1. Initial Server Setup (Day 1)
```bash
# 1. SSH into new Hetzner server
ssh root@<SERVER_IP>

# 2. Update system
apt update && apt upgrade -y

# 3. Create deployment user
adduser igris
usermod -aG sudo igris
usermod -aG docker igris

# 4. Configure SSH keys
mkdir /home/igris/.ssh
cp ~/.ssh/authorized_keys /home/igris/.ssh/
chown -R igris:igris /home/igris/.ssh
chmod 700 /home/igris/.ssh
chmod 600 /home/igris/.ssh/authorized_keys

# 5. Harden SSH
nano /etc/ssh/sshd_config
# (Apply changes from Security section)
systemctl restart sshd

# 6. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker igris

# 7. Install docker-compose
apt install docker-compose -y
```

---

#### 2. Deploy Application (Day 1-2)
```bash
# 1. Clone repository
cd /opt
git clone https://github.com/your-org/igris-inertial.git igris
cd igris

# 2. Create .env file
cp .env.example .env
nano .env
# (Fill in all production values)

# 3. Build images
docker-compose build

# 4. Initialize database
docker-compose up -d postgres
docker-compose exec postgres psql -U igris -d igris -f /docker-entrypoint-initdb.d/schema.sql

# 5. Run migrations (if set up)
migrate -path database/migrations -database $DATABASE_URL up

# 6. Start all services
docker-compose up -d

# 7. Check logs
docker-compose logs -f overture
docker-compose logs -f runtime

# 8. Test health endpoint
curl http://localhost:8080/health
```

---

#### 3. Post-Deployment Verification
```bash
# 1. Test API endpoints
curl -X POST https://api.igrisinertial.com/v1/chat/completions \
  -H "Authorization: Bearer TEST_KEY" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hello"}]}'

# 2. Verify rate limiting
# (Send 20 requests/sec for Trial tier, should get 429)

# 3. Verify budget enforcement
# (Exhaust budget, should get 402)

# 4. Check monitoring
# - Open Grafana: https://your-server:3000
# - Verify metrics flowing

# 5. Test failover
# - Stop one service, verify others continue

# 6. Load test
ab -n 1000 -c 10 https://api.igrisinertial.com/v1/chat/completions
```

---

## 📋 Final Checklist Summary

### Infrastructure (What to Buy)
- [ ] Hetzner CCX33 server (€116.90/month)
- [ ] Floating IPv4 (€1.19/month)
- [ ] Storage Box BX11 (€3.81/month)
- [ ] **Total**: ~€122/month

### Code Changes (MUST FIX)
- [ ] Row-Level Security policies (2-3 hours)
- [ ] Thompson Sampling Beta distribution (1 hour)
- [ ] Tier-based rate limiting (2-3 hours)
- [ ] Concurrent request limits (3-4 hours)
- [ ] **Total effort**: 8-11 hours

### Security (CRITICAL)
- [ ] SSH hardening
- [ ] Firewall (UFW + Hetzner)
- [ ] SSL/TLS certificates
- [ ] Secure environment variables
- [ ] **Total effort**: 2-3 hours

### Monitoring & Backups (RECOMMENDED)
- [ ] Prometheus + Grafana
- [ ] Daily database backups
- [ ] Alert rules
- [ ] Log rotation
- [ ] **Total effort**: 3-4 hours

---

**Total Pre-Deployment Work**: 13-18 hours
**Total Monthly Cost**: ~€122 (~$132 USD)
**Estimated Go-Live**: 2-3 days after starting fixes

---

**Generated**: 2026-01-15
**Last Updated**: Pre-deployment audit
**Next Steps**: Start with "Critical Fixes" section, then proceed to Security
