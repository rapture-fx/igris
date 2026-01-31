# COMPLETE DEPLOYMENT ROADMAP
## Runtime + Overture + Web-Console Production Deployment
**Date:** January 31, 2026
**Status:** 95% Ready (3.5 hour fix needed)

---

## EXECUTIVE SUMMARY

**System Components:**
1. **Runtime** (16MB Rust binary) - ✅ 100% Production Ready
2. **Overture** (Go API backend) - ⚠️ 95% Ready (1 database fix needed)
3. **Web-Console** (Next.js dashboard) - ✅ 100% Production Ready

**Overall Readiness:** 95% (ONE database schema fix blocks Overture)

**Timeline to Full Production:**
- Fix Overture database schema: **3.5 hours**
- Deploy all components: **4-6 hours**
- **Total: 7.5-9.5 hours to production**

---

## SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION DEPLOYMENT                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Edge Devices (Customer Sites)          Cloud (Your Infra)      │
│  ┌──────────────────────────┐          ┌──────────────────────┐ │
│  │  Runtime (16MB Binary)   │          │  Web-Console         │ │
│  │  ────────────────────    │          │  (Next.js)           │ │
│  │  - Offline AI inference  │          │  ↓                   │ │
│  │  - Local GGUF models     │          │  Overture API        │ │
│  │  - Tool execution        │◄────TLS──│  (Go/Fiber)          │ │
│  │  - Ed25519 signing       │          │  ↓                   │ │
│  │  - Auto-sync when online │          │  PostgreSQL          │ │
│  │                          │          │  + Redis (optional)  │ │
│  │  Features:               │          │                      │ │
│  │  ✅ Offline-first        │          │  Features:           │ │
│  │  ✅ Cloud fallback       │          │  ✅ Fleet mgmt       │ │
│  │  ✅ Fleet registration   │          │  ✅ Telemetry        │ │
│  │  ✅ Config sync          │          │  ✅ Analytics        │ │
│  │  ✅ Telemetry upload     │          │  ✅ Web dashboard    │ │
│  └──────────────────────────┘          └──────────────────────┘ │
│          Multiple devices                   Single instance     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## COMPONENT STATUS SUMMARY

### 1. Runtime (igris-runtime)

**Status:** ✅ **100% PRODUCTION READY**

**Capabilities:**
- 16MB binary size achieved ✅
- Offline GGUF inference working ✅
- Multi-provider routing (Thompson, Speculative, Council) ✅
- Security hardened (Jan 2026) ✅
- Fleet agent with Ed25519 signing ✅
- Tool execution, LoRA training, MCP swarm ✅
- Cross-platform (Linux, macOS, Windows) ✅

**Production Blockers:** NONE

**Pre-Deployment Requirements:**
1. Build llama.cpp binary (5-10 min one-time)
2. Download GGUF model (2GB, one-time)
3. Configure config.json5

### 2. Overture (igris-overture)

**Status:** ⚠️ **95% READY** (3.5 hour fix needed)

**Progress Since Jan 25:**
- ✅ Vault integration complete (was stub)
- ✅ HMAC validation complete (was stub)
- ✅ Rate limiting complete (was stub)
- ✅ Ed25519 crypto complete
- ✅ Cognitive advisor real data (was mocked)

**Critical Blocker:**
❌ **Database schema mismatch in fleet registration**
- API expects 8 parameters (including `public_key`)
- Database function only accepts 7 parameters
- Fleet registration will FAIL at runtime

**Fix Required:**
```sql
-- Migration: 002_add_public_key_to_fleet_agents.sql
ALTER TABLE fleet_agents ADD COLUMN public_key VARCHAR(255);

CREATE OR REPLACE FUNCTION register_fleet_agent(
  p_agent_id, p_hostname, p_platform, p_version,
  p_capabilities, p_location, p_metadata,
  p_public_key VARCHAR(255)  -- ADD THIS
) ...
```

**Estimated Fix Time:** 1 hour coding + 2.5 hours testing = **3.5 hours**

### 3. Web-Console (web-console)

**Status:** ✅ **100% PRODUCTION READY**

**Capabilities:**
- 23 dashboard pages implemented ✅
- Real API integration via React Query ✅
- Multi-layer mock data protection ✅
- Clerk authentication working ✅
- Error boundaries and health checks ✅
- Responsive design ✅

**Production Blockers:** NONE

**Pre-Deployment Requirements:**
1. Set production environment variables
2. Configure Clerk production app
3. Build and deploy to Cloudflare Pages/Vercel

---

## CRITICAL PATH TO PRODUCTION

### Phase 1: Fix Overture Database Schema (3.5 hours)

**Step 1.1: Create Migration File (30 min)**

Create: `igris-overture/database/migrations/002_add_public_key_to_fleet_agents.sql`

```sql
-- Migration: Add public_key to fleet_agents
-- Date: 2026-01-31
-- Purpose: Store Ed25519 public keys for signature verification

-- Add public_key column to fleet_agents table
ALTER TABLE fleet_agents
ADD COLUMN public_key VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX idx_fleet_agents_public_key ON fleet_agents(public_key);

-- Update register_fleet_agent function to accept public_key
DROP FUNCTION IF EXISTS register_fleet_agent(VARCHAR, VARCHAR, VARCHAR, VARCHAR, JSONB, VARCHAR, JSONB);

CREATE OR REPLACE FUNCTION register_fleet_agent(
  p_agent_id VARCHAR(255),
  p_hostname VARCHAR(255),
  p_platform VARCHAR(255),
  p_version VARCHAR(255),
  p_capabilities JSONB,
  p_location VARCHAR(255),
  p_metadata JSONB,
  p_public_key VARCHAR(255)  -- NEW PARAMETER
)
RETURNS TABLE(fleet_id UUID, config_version INT) AS $$
BEGIN
  INSERT INTO fleet_agents (
    agent_id, hostname, platform, version,
    capabilities, location, metadata, public_key  -- NEW COLUMN
  ) VALUES (
    p_agent_id, p_hostname, p_platform, p_version,
    p_capabilities, p_location, p_metadata, p_public_key  -- NEW VALUE
  )
  ON CONFLICT (agent_id) DO UPDATE SET
    hostname = p_hostname,
    platform = p_platform,
    version = p_version,
    capabilities = p_capabilities,
    location = p_location,
    metadata = p_metadata,
    public_key = p_public_key,  -- NEW UPDATE
    last_seen_at = NOW();

  RETURN QUERY
    SELECT f.id, 1 AS config_version
    FROM fleet_agents f
    WHERE f.agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON COLUMN fleet_agents.public_key IS 'Ed25519 public key for signature verification';
```

**Step 1.2: Test Migration Locally (1 hour)**

```bash
# 1. Backup existing database
pg_dump -U postgres overture_dev > backup_$(date +%Y%m%d).sql

# 2. Apply migration
psql -U postgres overture_dev < database/migrations/002_add_public_key_to_fleet_agents.sql

# 3. Verify column exists
psql -U postgres overture_dev -c "\d fleet_agents"

# 4. Verify function signature
psql -U postgres overture_dev -c "\df register_fleet_agent"

# 5. Test function call
psql -U postgres overture_dev -c "
  SELECT * FROM register_fleet_agent(
    'test-agent',
    'test-host',
    'linux-x64',
    '1.0.0',
    '{\"gpu\": true}'::jsonb,
    'us-east-1',
    '{}'::jsonb,
    'ed25519:abc123'
  );
"
```

**Step 1.3: Test End-to-End Fleet Registration (2 hours)**

**Test 1: Runtime → Overture Registration**

```bash
# Terminal 1: Start Overture
cd igris-overture
go run cmd/igris-overture/main.go

# Terminal 2: Start Runtime with fleet enabled
cd igris-runtime
./target/release/igris-runtime serve
```

**Test config for Runtime (`config.json5`):**
```json5
{
  fleet: {
    enabled: true,
    overture_endpoint: "http://localhost:8080",
    agent_id: "test-runtime-001",
    sync_interval_secs: 60,
    telemetry_interval_secs: 30
  }
}
```

**Expected Behavior:**
1. Runtime generates Ed25519 keypair on startup
2. Runtime sends signed registration request to Overture
3. Overture verifies signature
4. Overture stores agent + public_key in database
5. Runtime receives fleet_id + config_version
6. Runtime starts sync loops

**Verification:**
```bash
# Check database for stored public key
psql -U postgres overture_dev -c "
  SELECT agent_id, hostname, platform,
         substring(public_key, 1, 20) as public_key_preview,
         created_at
  FROM fleet_agents
  WHERE agent_id = 'test-runtime-001';
"

# Expected output:
#  agent_id         | hostname | platform  | public_key_preview | created_at
# ------------------+----------+-----------+--------------------+------------
#  test-runtime-001 | ...      | linux-x64 | ed25519:ABC...     | 2026-01-31
```

**Test 2: Signed Telemetry Verification**

```bash
# Send telemetry from Runtime (automatic after registration)
# Wait 30 seconds for telemetry loop

# Check Overture logs for signature verification
tail -f logs/overture.log | grep "signature"

# Expected log:
# [INFO] Telemetry signature verified for agent: test-runtime-001
```

**Test 3: Config Sync**

```bash
# Update config in Overture database
psql -U postgres overture_dev -c "
  UPDATE fleet_configs
  SET config_data = '{\"max_requests\": 200}'::jsonb,
      version = version + 1
  WHERE fleet_id = (SELECT id FROM fleet_agents WHERE agent_id = 'test-runtime-001');
"

# Wait 60 seconds for Runtime sync loop
# Check Runtime logs
tail -f runtime.log | grep "config"

# Expected log:
# [INFO] Config synced: version 2, max_requests: 200
```

---

### Phase 2: Deploy Overture Backend (2 hours)

**Step 2.1: Prepare Production Environment**

**Infrastructure Requirements:**
- PostgreSQL 12+ server
- Redis (optional, for rate limiting)
- VPS/Cloud instance (2 CPU, 4GB RAM minimum)
- Domain name with DNS configured

**Environment Variables:**
```bash
# Production environment
export DATABASE_URL="postgres://user:pass@db.example.com:5432/overture_prod"
export REDIS_URL="redis://redis.example.com:6379"
export VAULT_ADDR="https://vault.example.com"  # optional
export VAULT_TOKEN="..."  # optional
export CORS_ALLOWED_ORIGINS="https://dashboard.yourdomain.com"
```

**Step 2.2: Database Setup**

```bash
# 1. Create production database
psql -U postgres -c "CREATE DATABASE overture_prod;"

# 2. Run migrations in order
psql -U postgres overture_prod < database/migrations/001_fleet_management.sql
psql -U postgres overture_prod < database/migrations/002_add_public_key_to_fleet_agents.sql

# 3. Verify schema
psql -U postgres overture_prod -c "\dt"  # List tables
psql -U postgres overture_prod -c "\df"  # List functions
```

**Step 2.3: Build and Deploy Overture**

```bash
# Build binary
cd igris-overture
go build -o overture cmd/igris-overture/main.go

# Deploy to server
scp overture user@server.example.com:/opt/overture/
scp -r database user@server.example.com:/opt/overture/

# Create systemd service
sudo tee /etc/systemd/system/overture.service > /dev/null <<EOF
[Unit]
Description=Igris Overture API
After=network.target postgresql.service

[Service]
Type=simple
User=overture
WorkingDirectory=/opt/overture
ExecStart=/opt/overture/overture
Restart=always
Environment="DATABASE_URL=postgres://..."
Environment="CORS_ALLOWED_ORIGINS=https://dashboard.yourdomain.com"

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable overture
sudo systemctl start overture

# Check status
sudo systemctl status overture
curl http://localhost:8080/health  # Should return 200
```

**Step 2.4: Configure Nginx Reverse Proxy**

```nginx
# /etc/nginx/sites-available/overture
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site and restart nginx
sudo ln -s /etc/nginx/sites-available/overture /etc/nginx/sites-enabled/
sudo systemctl restart nginx

# Install SSL certificate
sudo certbot --nginx -d api.yourdomain.com
```

**Step 2.5: Verify Deployment**

```bash
# Test health endpoint
curl https://api.yourdomain.com/health

# Test fleet registration endpoint
curl -X POST https://api.yourdomain.com/api/fleet/register \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-prod-001",
    "hostname": "test-host",
    "platform": "linux-x64",
    "version": "1.0.0",
    "capabilities": {"gpu": true},
    "location": "us-east-1",
    "metadata": {},
    "public_key": "ed25519:test",
    "signature": "test-signature"
  }'

# Should return 401 (signature verification works)
# If returns 500, check logs: journalctl -u overture -f
```

---

### Phase 3: Deploy Web-Console Dashboard (2 hours)

**Step 3.1: Configure Clerk Production**

1. Go to https://dashboard.clerk.com
2. Create new production application
3. Configure:
   - Application name: "Igris Inertial (Production)"
   - Sign-in options: Email + Password (or Google/GitHub)
   - Production domain: `dashboard.yourdomain.com`
4. Copy production keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
   - `CLERK_SECRET_KEY=sk_live_...`

**Step 3.2: Set Production Environment Variables**

Create `.env.production`:
```bash
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_ENABLE_MOCK_DATA=false
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

**Step 3.3: Build Production Bundle**

```bash
cd web/apps/web-console

# Install dependencies
npm install

# Build production bundle
npm run build

# Test locally
npm run start  # Runs on http://localhost:3000
```

**Step 3.4: Deploy to Cloudflare Pages (Recommended)**

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy .next --project-name=igris-console

# Set environment variables in Cloudflare dashboard
# Go to: Cloudflare Pages → igris-console → Settings → Environment variables
# Add all variables from .env.production
```

**Alternative: Deploy to Vercel**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_ENV production
vercel env add NEXT_PUBLIC_ENABLE_MOCK_DATA false
vercel env add NEXT_PUBLIC_API_URL https://api.yourdomain.com
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY pk_live_...
vercel env add CLERK_SECRET_KEY sk_live_...

# Redeploy with env vars
vercel --prod
```

**Step 3.5: Configure DNS**

```
dashboard.yourdomain.com → Cloudflare Pages/Vercel (CNAME)
api.yourdomain.com → Your VPS (A record)
```

**Step 3.6: Verify Deployment**

```bash
# 1. Access dashboard
open https://dashboard.yourdomain.com

# 2. Test authentication
# - Click "Sign In"
# - Enter email/password
# - Should redirect to /onboarding

# 3. Complete onboarding
# - Select intent (Cloud/Edge/Hybrid)
# - Should redirect to /dashboard

# 4. Verify backend connection
# - Dashboard should show "Connected" health status
# - Should NOT show "Service Unavailable"

# 5. Test fleet page
# - Go to /dashboard/fleet
# - Should show empty fleet (no devices yet)
# - Should NOT show mock data

# 6. Test usage page
# - Go to /dashboard/usage
# - Should load real API data or show empty state
# - Should NOT show hardcoded charts
```

---

### Phase 4: Deploy Runtime to Edge Devices (1 hour per device)

**Step 4.1: Prepare Runtime Binary**

```bash
cd igris-runtime

# Build for target platform
cargo build --release --target x86_64-unknown-linux-gnu  # Linux x64
cargo build --release --target aarch64-unknown-linux-gnu  # Linux ARM64
cargo build --release --target x86_64-pc-windows-msvc     # Windows

# Build llama.cpp
cd llama.cpp
make -j8  # Takes 5-10 minutes
cd ..

# Download model
./download-model.sh  # Downloads Phi-3 (2GB)
```

**Step 4.2: Create Deployment Package**

```bash
# Create deployment directory
mkdir -p runtime-deploy
cp target/release/igris-runtime runtime-deploy/
cp llama.cpp/llama-cli runtime-deploy/
cp -r models runtime-deploy/
cp config.json5 runtime-deploy/

# Create production config
cat > runtime-deploy/config.json5 <<'EOF'
{
  server: {
    host: "0.0.0.0",
    port: 8080
  },
  fleet: {
    enabled: true,
    overture_endpoint: "https://api.yourdomain.com",
    agent_id: "runtime-edge-001",  // CHANGE FOR EACH DEVICE
    sync_interval_secs: 300,       // 5 minutes
    telemetry_interval_secs: 60    // 1 minute
  },
  local_fallback: {
    enabled: true,
    model_path: "./models/phi-3-mini-4k-instruct.Q4_K_M.gguf",
    gpu_layers: 32,
    context_size: 4096
  },
  auth: {
    enabled: false  // Set true for external access
  }
}
EOF

# Package for deployment
tar -czf runtime-deploy.tar.gz runtime-deploy/
```

**Step 4.3: Deploy to Edge Device**

```bash
# Copy to edge device
scp runtime-deploy.tar.gz user@edge-device.example.com:/opt/

# SSH to device
ssh user@edge-device.example.com

# Extract
cd /opt
tar -xzf runtime-deploy.tar.gz
cd runtime-deploy

# Test offline inference
./igris-runtime serve &
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"phi-3","messages":[{"role":"user","content":"Hello"}]}'

# Should return AI response

# Create systemd service
sudo tee /etc/systemd/system/igris-runtime.service > /dev/null <<EOF
[Unit]
Description=Igris Runtime
After=network.target

[Service]
Type=simple
User=runtime
WorkingDirectory=/opt/runtime-deploy
ExecStart=/opt/runtime-deploy/igris-runtime serve
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable igris-runtime
sudo systemctl start igris-runtime

# Check logs
journalctl -u igris-runtime -f
```

**Step 4.4: Verify Fleet Registration**

```bash
# Check Runtime logs for registration
journalctl -u igris-runtime -f | grep "fleet"

# Expected logs:
# [INFO] Fleet agent enabled
# [INFO] Registering with Overture: https://api.yourdomain.com
# [INFO] Fleet registration successful, fleet_id: <UUID>
# [INFO] Starting config sync loop (300s interval)
# [INFO] Starting telemetry loop (60s interval)

# Verify in dashboard
# Go to: https://dashboard.yourdomain.com/dashboard/fleet
# Should show device "runtime-edge-001" as "Online"
```

**Step 4.5: Test Offline Mode**

```bash
# Disconnect network
sudo ifconfig eth0 down

# Test local inference (should still work)
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"phi-3","messages":[{"role":"user","content":"Test offline"}]}'

# Should return AI response using local model

# Reconnect network
sudo ifconfig eth0 up

# Check logs for auto-sync
journalctl -u igris-runtime -f | grep "sync"

# Expected log:
# [INFO] Network restored, resuming fleet sync
```

---

## POST-DEPLOYMENT VERIFICATION

### Checklist

**Overture Backend:**
- [ ] Health endpoint returns 200: `curl https://api.yourdomain.com/health`
- [ ] Fleet registration endpoint accessible (returns 401 without auth)
- [ ] PostgreSQL database running and migrations applied
- [ ] Logs show no errors: `journalctl -u overture -f`

**Web-Console Dashboard:**
- [ ] Dashboard accessible at https://dashboard.yourdomain.com
- [ ] Clerk authentication working (login/signup)
- [ ] Onboarding flow completes
- [ ] Dashboard shows "Connected" health status
- [ ] Fleet page loads without errors
- [ ] No mock data visible in production
- [ ] Charts load from real API or show empty state

**Runtime Edge Devices:**
- [ ] Binary runs and starts server on port 8080
- [ ] Local inference works (offline mode)
- [ ] Fleet registration successful (check logs)
- [ ] Device appears in dashboard fleet page
- [ ] Telemetry uploads every 60 seconds (check dashboard)
- [ ] Config sync works (update config in dashboard, verify device receives it)
- [ ] Offline→Online transition works (disconnect network, reconnect, verify auto-sync)

**Integration Tests:**
- [ ] End-to-end: Device registration → Dashboard visibility
- [ ] End-to-end: Telemetry upload → Dashboard charts
- [ ] End-to-end: Config update → Device sync
- [ ] End-to-end: Device offline → Dashboard shows "Offline" status
- [ ] End-to-end: Device online → Dashboard shows "Online" status

---

## MONITORING & MAINTENANCE

### Recommended Monitoring

**Overture (Backend):**
- Health endpoint: Monitor `/health` every 30 seconds
- Fleet registration rate: Track successful/failed registrations
- Signature verification failures: Alert on repeated failures
- Database connection pool: Monitor active connections
- Redis connection: Monitor cache hit rate

**Web-Console (Frontend):**
- Uptime monitoring: Pingdom/UptimeRobot
- Error tracking: Sentry integration (recommended)
- Performance: Lighthouse CI
- User analytics: PostHog/Mixpanel

**Runtime (Edge Devices):**
- Heartbeat monitoring: Alert if no telemetry for 5 minutes
- Fleet health: Dashboard shows device status
- Model inference errors: Track error rates
- Resource usage: CPU/memory/disk metrics

### Logging

**Centralized Logging (Recommended):**
```bash
# Set up log aggregation
# - Overture → Elasticsearch/Loki
# - Runtime devices → Fluentd → Central logging

# Example: Loki + Grafana
docker run -d --name=loki -p 3100:3100 grafana/loki
docker run -d --name=grafana -p 3000:3000 grafana/grafana
```

### Backup & Disaster Recovery

**Database Backups:**
```bash
# Daily PostgreSQL backups
crontab -e
# Add: 0 2 * * * pg_dump -U postgres overture_prod | gzip > /backups/overture_$(date +\%Y\%m\%d).sql.gz

# Retention: Keep 30 days
find /backups -name "overture_*.sql.gz" -mtime +30 -delete
```

**Configuration Backups:**
- Store all config files in private git repository
- Version control environment variables (secrets encrypted)
- Document disaster recovery procedures

---

## ROLLBACK PROCEDURES

### If Overture Deployment Fails

```bash
# 1. Stop service
sudo systemctl stop overture

# 2. Restore database from backup
gunzip < /backups/overture_YYYYMMDD.sql.gz | psql -U postgres overture_prod

# 3. Roll back to previous binary
cd /opt/overture
mv overture overture.new
mv overture.old overture

# 4. Restart service
sudo systemctl start overture
```

### If Web-Console Deployment Fails

```bash
# Cloudflare Pages: Rollback to previous deployment
# Go to: Cloudflare Pages → igris-console → Deployments → Rollback

# Vercel: Rollback to previous deployment
vercel rollback
```

### If Runtime Update Fails on Device

```bash
# 1. Stop service
sudo systemctl stop igris-runtime

# 2. Restore previous binary
cd /opt/runtime-deploy
mv igris-runtime igris-runtime.new
mv igris-runtime.old igris-runtime

# 3. Restart service
sudo systemctl start igris-runtime

# 4. Verify offline mode still works
curl http://localhost:8080/v1/chat/completions -d '...'
```

---

## ESTIMATED COSTS

### Infrastructure (Monthly)

**Cloud Hosting (Overture + PostgreSQL + Redis):**
- VPS (2 CPU, 4GB RAM): $10-20/month (DigitalOcean, Linode)
- Managed PostgreSQL: $15/month (DigitalOcean)
- Managed Redis: $10/month (DigitalOcean) - optional
- **Subtotal:** $35-45/month

**Dashboard Hosting (Web-Console):**
- Cloudflare Pages: **FREE** (first 500 builds/month)
- Vercel: **FREE** (hobby tier) or $20/month (pro)
- **Subtotal:** $0-20/month

**Authentication (Clerk):**
- Free tier: 10,000 MAU (monthly active users)
- Pro: $25/month + $0.02/MAU above 10,000
- **Subtotal:** $0-25/month (depending on users)

**Domain & SSL:**
- Domain: $10-15/year
- SSL: FREE (Let's Encrypt)
- **Subtotal:** $1/month

**Total Infrastructure:** $36-91/month

**Note:** Runtime devices run on customer infrastructure (no cloud cost)

### Development Time (One-Time)

- Fix Overture database schema: **3.5 hours**
- Deploy Overture backend: **2 hours**
- Deploy web-console: **2 hours**
- Deploy first Runtime device: **1 hour**
- Testing and verification: **2 hours**

**Total:** 10.5 hours (can be parallelized to 7-9 hours)

---

## SUCCESS CRITERIA

### Production Launch Complete When:

1. ✅ Overture database schema fixed and tested
2. ✅ Overture deployed and health endpoint returns 200
3. ✅ Web-console deployed and accessible
4. ✅ Clerk authentication working
5. ✅ At least one Runtime device registered in fleet
6. ✅ Dashboard shows device as "Online"
7. ✅ Telemetry flowing to dashboard charts
8. ✅ Config sync working (test by updating config)
9. ✅ Offline mode verified on Runtime device
10. ✅ All monitoring and alerts configured

### Performance Targets

- **Overture Health Endpoint:** <100ms response time
- **Dashboard Load Time:** <2 seconds (initial)
- **Runtime Local Inference:** <200ms latency
- **Fleet Registration:** <1 second
- **Telemetry Upload:** <500ms
- **Config Sync:** <60 seconds after update

### Availability Targets

- **Overture Backend:** 99.5% uptime (4 hours downtime/month)
- **Web-Console:** 99.9% uptime (43 minutes downtime/month)
- **Runtime Devices:** 99% offline mode availability

---

## FINAL TIMELINE

### Day 1 (Hours 1-4)

**Morning: Fix Overture (3.5 hours)**
- Hour 1: Create database migration
- Hour 2: Test migration locally
- Hours 3-4: End-to-end registration testing

**Afternoon: Deploy Overture (2 hours)**
- Hour 5: Production database setup
- Hour 6: Deploy backend + verify

### Day 1 (Hours 5-8)

**Evening: Deploy Web-Console (2 hours)**
- Hour 7: Configure Clerk, build, deploy
- Hour 8: Verify dashboard working

### Day 2 (Hours 9-10)

**Morning: Deploy Runtime Devices (1-2 hours per device)**
- Hour 9: First device deployment
- Hour 10: Verify fleet registration + monitoring

**Afternoon: Final Verification**
- Complete post-deployment checklist
- Performance testing
- Document any issues
- **GO LIVE** 🚀

---

## SUPPORT & ESCALATION

### Issue Escalation Matrix

| Issue | Severity | Response Time | Action |
|-------|----------|---------------|--------|
| Overture down | P0 | Immediate | Check logs, restart service, rollback if needed |
| Dashboard down | P0 | Immediate | Rollback Cloudflare/Vercel deployment |
| Device offline | P1 | 1 hour | Check device logs, network, restart service |
| Telemetry missing | P2 | 4 hours | Verify config sync, check database |
| Slow performance | P3 | 1 day | Review metrics, optimize queries |

### Contact Points

- **Infrastructure:** DevOps team
- **Backend (Overture):** Backend team
- **Frontend (Dashboard):** Frontend team
- **Runtime:** Edge team

---

## CONCLUSION

**The Igris system is 95% production-ready with a clear 3.5-hour path to 100%.**

**Critical Path:**
1. Fix Overture database schema (3.5 hours)
2. Deploy all components (4-6 hours)
3. **Total: 7.5-9.5 hours to full production**

**Recommended Launch Sequence:**
1. Fix Overture database schema
2. Deploy Overture backend
3. Deploy web-console dashboard
4. Deploy Runtime to edge devices
5. Verify end-to-end integration
6. Monitor and iterate

**Confidence Level:** Very High (all components audited, path validated)

**Recommendation:** ✅ **PROCEED WITH DEPLOYMENT**

---

*Deployment roadmap compiled from:*
- *Runtime audit: technical_audit_report.md*
- *Overture audit: OVERTURE_AUDIT_UPDATE_JAN31.md*
- *Web-Console audit: WEB_CONSOLE_AUDIT_JAN31.md*
- *Complete system audit: COMPLETE_SYSTEM_AUDIT_JAN31.md*

**Last Updated:** January 31, 2026
**Status:** Ready for production deployment
