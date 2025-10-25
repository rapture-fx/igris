# Schlep-Engine Deployment Guide

**Version:** 1.0.0-rc1
**Phase:** 3 - Production Deployment
**Last Updated:** 2025-10-25

This guide covers deploying Schlep-Engine to production environments, including Docker, Kubernetes, and cloud platforms.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker Compose)](#quick-start-docker-compose)
3. [Production Deployment](#production-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Health Checks](#health-checks)
8. [Monitoring & Observability](#monitoring--observability)
9. [Security Checklist](#security-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required

- **Docker:** 20.10+
- **Docker Compose:** 2.0+ (for local deployment)
- **PostgreSQL:** 15+ (for persistence)
- **Redis:** 7+ (for distributed state)

### Optional

- **Kubernetes:** 1.28+ (for production clusters)
- **Prometheus:** For metrics collection
- **Grafana:** For metrics visualization

### API Keys (BYOK Model)

Schlep-Engine uses a Bring-Your-Own-Key (BYOK) model. You'll need:

- **OpenAI API Key** (if using OpenAI providers): `sk-...`
- **Anthropic API Key** (if using Anthropic providers): `sk-ant-...`

---

## Quick Start (Docker Compose)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/schlep-engine.git
cd schlep-engine
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Minimum required changes:**

```bash
# Security (REQUIRED FOR PRODUCTION)
JWT_SECRET=your-strong-random-secret-min-32-chars
VAULT_MASTER_KEY=your-strong-vault-key-min-32-chars
POSTGRES_PASSWORD=your-strong-postgres-password
REDIS_PASSWORD=your-strong-redis-password

# Provider Keys (OPTIONAL - for real API calls)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Provider Mode
PROVIDER_MODE=benchmark  # or "real" if you have API keys
```

### 3. Start Services

```bash
# Start full stack (API + Postgres + Redis)
docker-compose -f docker-compose.production.yml up -d

# Check service health
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f api
```

### 4. Run Migrations

```bash
# Migrations run automatically on container startup
# To run manually:
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U schlep_user -d schlep_engine -f /docker-entrypoint-initdb.d/001_create_optimizer_states.sql
```

### 5. Verify Deployment

```bash
# Check liveness
curl http://localhost:8080/healthz

# Check readiness
curl http://localhost:8080/readyz

# Check detailed health
curl http://localhost:8080/v1/health | jq

# Test inference (benchmark mode)
curl -X POST http://localhost:8080/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 50
  }' | jq
```

---

## Production Deployment

### Architecture Overview

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS
┌──────▼──────────────────────┐
│  Load Balancer / Ingress    │
└──────┬──────────────────────┘
       │
  ┌────▼────┐
  │ API Pod │ (Replicas: 3+)
  │  Port:  │
  │  8080   │
  └────┬────┘
       │
 ┌─────┴─────┐
 │           │
┌▼───────┐ ┌▼─────┐
│Postgres│ │Redis │
│  5432  │ │ 6379 │
└────────┘ └──────┘
```

### Production Configuration

#### 1. Build Production Image

```bash
# Build with multi-stage Dockerfile
docker build -t schlep-engine-api:1.0.0-rc1 .

# Tag for registry
docker tag schlep-engine-api:1.0.0-rc1 your-registry/schlep-engine-api:1.0.0-rc1

# Push to registry
docker push your-registry/schlep-engine-api:1.0.0-rc1
```

#### 2. Environment Configuration

Create production `.env`:

```bash
# Server
ENV=production
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info
LOG_FORMAT=json

# Database (use managed Postgres in production)
DATABASE_URL=postgres://user:pass@postgres.prod.internal:5432/schlep_engine?sslmode=require
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=5

# Redis (use managed Redis in production)
REDIS_URL=redis://:password@redis.prod.internal:6379/0
USE_REDIS=true

# Multi-Tenancy
ENABLE_MULTI_TENANCY=true
REQUIRE_AUTH_FOR_INFERENCE=true
JWT_SECRET=<strong-random-secret>
VAULT_MASTER_KEY=<strong-vault-key>

# Providers
PROVIDER_MODE=real
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Safety
MAX_MONTHLY_COST_USD=1000.00
ENABLE_BUDGET_LIMIT=true
ENABLE_BENCHMARK_FALLBACK=true

# Observability
METRICS_ENABLED=true
TRACING_ENABLED=true
```

#### 3. Run with Docker

```bash
# Production deployment
docker run -d \
  --name schlep-engine-api \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env.production \
  --health-cmd "wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1" \
  --health-interval 30s \
  --health-timeout 10s \
  --health-retries 3 \
  your-registry/schlep-engine-api:1.0.0-rc1
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster 1.28+
- kubectl configured
- Helm 3+ (optional)

### 1. Create Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: schlep-engine
```

```bash
kubectl apply -f namespace.yaml
```

### 2. Create Secrets

```bash
# Create secret for sensitive configuration
kubectl create secret generic schlep-engine-secrets \
  --namespace=schlep-engine \
  --from-literal=jwt-secret='your-strong-jwt-secret' \
  --from-literal=vault-master-key='your-strong-vault-key' \
  --from-literal=postgres-password='your-postgres-password' \
  --from-literal=redis-password='your-redis-password' \
  --from-literal=openai-api-key='sk-...' \
  --from-literal=anthropic-api-key='sk-ant-...'
```

### 3. Create ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: schlep-engine-config
  namespace: schlep-engine
data:
  ENV: "production"
  PORT: "8080"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  PROVIDER_MODE: "real"
  ENABLE_MULTI_TENANCY: "true"
  REQUIRE_AUTH_FOR_INFERENCE: "true"
  USE_REDIS: "true"
  USE_PG_OPTIMIZER_STATE: "true"
  METRICS_ENABLED: "true"
  MAX_MONTHLY_COST_USD: "1000.00"
```

```bash
kubectl apply -f configmap.yaml
```

### 4. Deployment Manifest

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: schlep-engine-api
  namespace: schlep-engine
  labels:
    app: schlep-engine
    version: 1.0.0-rc1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: schlep-engine
  template:
    metadata:
      labels:
        app: schlep-engine
        version: 1.0.0-rc1
    spec:
      containers:
      - name: api
        image: your-registry/schlep-engine-api:1.0.0-rc1
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        envFrom:
        - configMapRef:
            name: schlep-engine-config
        env:
        - name: DATABASE_URL
          value: "postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@postgres:5432/schlep_engine?sslmode=require"
        - name: REDIS_URL
          value: "redis://:$(REDIS_PASSWORD)@redis:6379/0"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: jwt-secret
        - name: VAULT_MASTER_KEY
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: vault-master-key
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: postgres-password
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: redis-password
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: openai-api-key
              optional: true
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: anthropic-api-key
              optional: true
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /startupz
            port: 8080
          initialDelaySeconds: 0
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30
```

```bash
kubectl apply -f deployment.yaml
```

### 5. Service Manifest

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: schlep-engine-api
  namespace: schlep-engine
  labels:
    app: schlep-engine
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: schlep-engine
```

```bash
kubectl apply -f service.yaml
```

### 6. Ingress (Optional)

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: schlep-engine-ingress
  namespace: schlep-engine
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.schlep-engine.example.com
    secretName: schlep-engine-tls
  rules:
  - host: api.schlep-engine.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: schlep-engine-api
            port:
              number: 80
```

```bash
kubectl apply -f ingress.yaml
```

### 7. HorizontalPodAutoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: schlep-engine-hpa
  namespace: schlep-engine
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: schlep-engine-api
  minReplicas: 3
  maxReplicas: 10
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
```

```bash
kubectl apply -f hpa.yaml
```

---

## Environment Configuration

See [.env.example](.env.example) for full configuration reference.

### Critical Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** (multi-tenancy) | - | JWT signing secret (min 32 chars) |
| `VAULT_MASTER_KEY` | **Yes** (multi-tenancy) | - | Encryption key for tenant API keys |
| `DATABASE_URL` | **Yes** (persistence) | - | PostgreSQL connection string |
| `REDIS_URL` | **Yes** (Redis enabled) | - | Redis connection string |
| `OPENAI_API_KEY` | No | - | OpenAI API key (for real mode) |
| `ANTHROPIC_API_KEY` | No | - | Anthropic API key (for real mode) |

---

## Database Setup

### Manual Migration

```bash
# Connect to Postgres
psql $DATABASE_URL

# Run migrations in order
\i migrations/001_create_optimizer_states.sql
\i migrations/002_create_tenant_budgets.sql
\i migrations/003_create_api_keys_table.sql

# Verify tables
\dt
```

### Automatic Migration (Docker)

Migrations are automatically applied on container startup when using `docker-compose.production.yml`.

---

## Health Checks

Schlep-Engine provides Kubernetes-compatible health check endpoints:

### Endpoints

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/healthz` | Liveness probe | Kubernetes liveness check |
| `/readyz` | Readiness probe | Kubernetes readiness check |
| `/startupz` | Startup probe | Kubernetes startup check |
| `/v1/health` | Detailed health | Monitoring dashboards |

### Example Responses

**Liveness** (`/healthz`):
```json
{"status": "alive"}
```

**Readiness** (`/readyz`):
```json
{"status": "ready"}
```

**Detailed Health** (`/v1/health`):
```json
{
  "status": "healthy",
  "version": "1.0.0-rc1",
  "uptime": "2h34m12s",
  "timestamp": "2025-10-25T10:30:00Z",
  "components": {
    "database": {
      "status": "healthy",
      "message": "Database connection healthy",
      "latency": "5ms",
      "details": {
        "open_connections": 5,
        "in_use": 2,
        "idle": 3
      }
    },
    "redis": {
      "status": "healthy",
      "message": "Redis connection healthy",
      "latency": "2ms"
    },
    "application": {
      "status": "healthy",
      "message": "Application running",
      "details": {
        "uptime": "2h34m12s",
        "version": "1.0.0-rc1"
      }
    }
  }
}
```

---

## Monitoring & Observability

### Prometheus Metrics

Metrics are exposed at `/metrics` in Prometheus format.

**Key Metrics:**
- `schlep_infer_requests_total` - Total inference requests
- `schlep_infer_request_duration_seconds` - Request latency histogram
- `schlep_provider_errors_total` - Provider error count
- `schlep_budget_total_usd` - Current budget usage

### Grafana Dashboard

Start Grafana with monitoring profile:

```bash
docker-compose -f docker-compose.production.yml --profile monitoring up -d
```

Access Grafana:
- URL: http://localhost:3000
- Default credentials: admin/admin

### Tracing

Enable distributed tracing:

```bash
TRACING_ENABLED=true
TRACE_SAMPLING_RATE=0.1  # Sample 10% of requests
```

All requests include `X-Trace-ID` header for correlation.

---

## Security Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to strong random value (min 32 chars)
- [ ] Change `VAULT_MASTER_KEY` to strong random value (min 32 chars)
- [ ] Change `POSTGRES_PASSWORD` to strong password
- [ ] Change `REDIS_PASSWORD` to strong password
- [ ] Enable SSL for Postgres (`sslmode=require`)
- [ ] Enable SSL for Redis (TLS)
- [ ] Set `REQUIRE_AUTH_FOR_INFERENCE=true` if using multi-tenancy
- [ ] Review API key permissions (OpenAI/Anthropic)
- [ ] Configure firewall rules (allow only necessary ports)
- [ ] Enable rate limiting
- [ ] Set up log aggregation (CloudWatch, Datadog, etc.)
- [ ] Configure alerting for budget breaches
- [ ] Test disaster recovery procedures
- [ ] Document runbook for incident response

---

## Troubleshooting

### Pods Not Ready

```bash
# Check pod status
kubectl get pods -n schlep-engine

# View pod logs
kubectl logs -n schlep-engine -l app=schlep-engine --tail=100

# Describe pod for events
kubectl describe pod -n schlep-engine <pod-name>
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql $DATABASE_URL -c "SELECT 1"

# Check database service
kubectl get svc -n schlep-engine
```

### Health Check Failures

```bash
# Test health endpoints directly
kubectl port-forward -n schlep-engine svc/schlep-engine-api 8080:80

curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
curl http://localhost:8080/v1/health
```

### High Memory Usage

```bash
# Check pod resource usage
kubectl top pods -n schlep-engine

# Increase memory limits if needed
# Edit deployment.yaml and increase resources.limits.memory
```

### Budget Exceeded Errors

```bash
# Check current budget usage
curl http://localhost:8080/v1/metrics | jq '.provider_metrics'

# Increase budget limit
export MAX_MONTHLY_COST_USD=2000.00
```

---

## Support & Resources

- **Documentation:** [README.md](README.md)
- **Phase 2 Report:** [reports/phase2_completion_summary.md](reports/phase2_completion_summary.md)
- **Database Migrations:** [migrations/README.md](migrations/README.md)
- **Load Testing:** [tests/load/README.md](tests/load/README.md)
- **Issues:** https://github.com/your-org/schlep-engine/issues

---

**Deployment Guide Version:** 1.0
**Last Updated:** 2025-10-25
**Maintainer:** Schlep-Engine Team
