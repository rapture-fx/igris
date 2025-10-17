# Schlep-engine API-as-a-Service Deployment Guide

## Overview

This guide covers the production deployment of Schlep-engine as an API-as-a-Service product, focusing on reliability, performance, and developer experience.

## Deployment Strategy

### Multi-Environment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development   │    │     Staging     │    │   Production    │
│                 │    │                 │    │                 │
│ • Local API     │    │ • Staging API   │    │ • Production API│
│ • Test Data     │    │ • Test Load     │    │ • Real Traffic  │
│ • Debug Mode    │    │ • Performance   │    │ • High Availability
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Environment-Specific Configurations

#### Development Environment
```bash
# .env.development
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
API_BASE_URL=http://localhost:8000
CACHE_DEFAULT_TTL_SECONDS=300
RATE_LIMIT_PER_MINUTE=1000
```

#### Staging Environment
```bash
# .env.staging
ENVIRONMENT=staging
DEBUG=false
LOG_LEVEL=INFO
API_BASE_URL=https://staging-api.schlep-engine.com
CACHE_DEFAULT_TTL_SECONDS=1800
RATE_LIMIT_PER_MINUTE=300
```

#### Production Environment
```bash
# .env.production
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=WARNING
API_BASE_URL=https://api.schlep-engine.com
CACHE_DEFAULT_TTL_SECONDS=3600
RATE_LIMIT_PER_MINUTE=60
```

## Infrastructure Setup

### 1. Kubernetes Deployment

#### Production Cluster Configuration
```yaml
# infrastructure/kubernetes/production/cluster-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: schlep-engine-config
data:
  ENVIRONMENT: "production"
  LOG_LEVEL: "WARNING"
  API_BASE_URL: "https://api.schlep-engine.com"
  CACHE_DEFAULT_TTL_SECONDS: "3600"
  RATE_LIMIT_PER_MINUTE: "60"
  RATE_LIMIT_PER_HOUR: "1000"
```

#### High-Availability Deployment
```yaml
# infrastructure/kubernetes/production/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: schlep-engine-api
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: schlep-engine-api
  template:
    metadata:
      labels:
        app: schlep-engine-api
    spec:
      containers:
      - name: api
        image: schlep-engine/api:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v1/status/health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/status/health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: redis-url
```

### 2. Load Balancer Configuration

#### Nginx Configuration
```nginx
# infrastructure/nginx/production/nginx.conf
upstream schlep_engine_api {
    least_conn;
    server 10.0.1.10:8000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name api.schlep-engine.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.schlep-engine.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/schlep-engine.crt;
    ssl_certificate_key /etc/ssl/private/schlep-engine.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
    limit_req zone=api burst=10 nodelay;
    
    # API Routes
    location /api/v1/ {
        proxy_pass http://schlep_engine_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # Documentation
    location /docs {
        proxy_pass http://schlep_engine_api;
        proxy_set_header Host $host;
    }
    
    location /redoc {
        proxy_pass http://schlep_engine_api;
        proxy_set_header Host $host;
    }
    
    # Health checks
    location /health {
        proxy_pass http://schlep_engine_api;
        access_log off;
    }
}
```

### 3. Database Setup

#### PostgreSQL Production Configuration
```sql
-- infrastructure/database/production/init.sql
-- Production database setup with high availability

-- Create application user
CREATE USER schlep_engine WITH PASSWORD 'secure_password_here';

-- Create database with proper encoding
CREATE DATABASE schlep_engine_prod
    WITH 
    OWNER = schlep_engine
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE schlep_engine_prod TO schlep_engine;

-- Connect to the database
\c schlep_engine_prod

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set up connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Reload configuration
SELECT pg_reload_conf();
```

### 4. Redis Configuration

#### Redis Production Setup
```bash
# infrastructure/redis/production/redis.conf
# Production Redis configuration

# Network
bind 0.0.0.0
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# General
daemonize yes
supervised systemd
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/redis-server.log
databases 16

# Snapshotting
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Replication
replica-serve-stale-data yes
replica-read-only yes

# Security
requirepass your_redis_password_here

# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Append only file
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

## Monitoring & Observability

### 1. Prometheus Configuration

```yaml
# infrastructure/monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "schlep_engine_rules.yml"

scrape_configs:
  - job_name: 'schlep-engine-api'
    static_configs:
      - targets: ['schlep-engine-api:8000']
    metrics_path: '/api/v1/metrics'
    scrape_interval: 10s
    
  - job_name: 'schlep-engine-database'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'schlep-engine-redis'
    static_configs:
      - targets: ['redis-exporter:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 2. Grafana Dashboards

#### API Performance Dashboard
```json
{
  "dashboard": {
    "title": "Schlep-engine API Performance",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95 - {{endpoint}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

### 3. Alerting Rules

```yaml
# infrastructure/monitoring/prometheus/schlep_engine_rules.yml
groups:
  - name: schlep-engine-api
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"
          
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }} seconds"
          
      - alert: ServiceDown
        expr: up{job="schlep-engine-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "API service is down"
          description: "Schlep-engine API service has been down for more than 1 minute"
```

## Deployment Scripts

### 1. Production Deployment Script

```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

echo "Starting production deployment..."

# Environment variables
export KUBECONFIG=/path/to/production/kubeconfig
export NAMESPACE=production
export IMAGE_TAG=$(git rev-parse --short HEAD)

# Build and push Docker image
echo "Building Docker image..."
docker build -f packages/backend/Dockerfile.api -t schlep-engine/api:$IMAGE_TAG .
docker push schlep-engine/api:$IMAGE_TAG

# Update Kubernetes deployment
echo "Updating Kubernetes deployment..."
kubectl set image deployment/schlep-engine-api api=schlep-engine/api:$IMAGE_TAG -n $NAMESPACE

# Wait for rollout
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/schlep-engine-api -n $NAMESPACE

# Run health checks
echo "Running health checks..."
for i in {1..10}; do
    if curl -f https://api.schlep-engine.com/api/v1/status/health; then
        echo "Health check passed"
        break
    else
        echo "Health check failed, retrying..."
        sleep 10
    fi
done

# Run smoke tests
echo "Running smoke tests..."
python scripts/smoke_tests.py --environment=production

echo "Production deployment completed successfully!"
```

### 2. Database Migration Script

```bash
#!/bin/bash
# scripts/migrate-production.sh

set -e

echo "Starting database migration..."

# Environment variables
export DATABASE_URL="postgresql://user:pass@host:5432/schlep_engine_prod"

# Create backup
echo "Creating database backup..."
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
echo "Running database migrations..."
cd packages/backend
alembic upgrade head

# Verify migration
echo "Verifying migration..."
python -c "
import asyncio
from app.database.connection import engine
from app.database.models import Base

async def verify_migration():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Migration verification successful')

asyncio.run(verify_migration())
"

echo "Database migration completed successfully!"
```

## Scaling Strategy

### 1. Horizontal Pod Autoscaling

```yaml
# infrastructure/kubernetes/production/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: schlep-engine-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: schlep-engine-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### 2. Database Connection Pooling

```python
# packages/backend/app/core/database_pool.py
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

def create_production_engine():
    """Create production database engine with connection pooling"""
    return create_engine(
        settings.DATABASE_URL,
        poolclass=QueuePool,
        pool_size=20,
        max_overflow=30,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False
    )
```

## Security Configuration

### 1. Secrets Management

```yaml
# infrastructure/kubernetes/production/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: schlep-engine-secrets
  namespace: production
type: Opaque
data:
  database-url: <base64-encoded-database-url>
  redis-url: <base64-encoded-redis-url>
  jwt-secret: <base64-encoded-jwt-secret>
  encryption-key: <base64-encoded-encryption-key>
  stripe-api-key: <base64-encoded-stripe-key>
```

### 2. Network Policies

```yaml
# infrastructure/kubernetes/production/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: schlep-engine-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: schlep-engine-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - namespaceSelector:
        matchLabels:
          name: redis
    ports:
    - protocol: TCP
      port: 6379
```

## Quick Start Commands

### Deploy to Production
```bash
# 1. Set up environment
export KUBECONFIG=/path/to/production/kubeconfig

# 2. Deploy infrastructure
kubectl apply -f infrastructure/kubernetes/production/

# 3. Deploy application
./scripts/deploy-production.sh

# 4. Verify deployment
kubectl get pods -n production
curl https://api.schlep-engine.com/api/v1/status/health
```

### Monitor Deployment
```bash
# Check application logs
kubectl logs -f deployment/schlep-engine-api -n production

# Check metrics
curl https://api.schlep-engine.com/api/v1/metrics

# Check API status
curl https://api.schlep-engine.com/api/v1/status/

# Access Grafana dashboard
open https://grafana.schlep-engine.com
```

## Support & Troubleshooting

### Common Issues

1. **High Response Times**
   - Check database connection pool
   - Verify Redis connectivity
   - Monitor CPU/memory usage

2. **Rate Limiting Issues**
   - Review rate limit configuration
   - Check client usage patterns
   - Verify API key permissions

3. **Database Connection Issues**
   - Check connection pool settings
   - Verify database credentials
   - Monitor connection limits

### Emergency Procedures

```bash
# Rollback to previous version
kubectl rollout undo deployment/schlep-engine-api -n production

# Scale down to reduce load
kubectl scale deployment schlep-engine-api --replicas=1 -n production

# Check system resources
kubectl top pods -n production
kubectl describe nodes
```

---

*This deployment guide ensures your Schlep-engine API-as-a-Service is production-ready with enterprise-grade reliability, monitoring, and scalability.* 