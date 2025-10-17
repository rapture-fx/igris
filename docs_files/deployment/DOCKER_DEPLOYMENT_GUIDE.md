# Docker Deployment Guide

## Schlep Engine - Containerized Deployment

This guide covers deploying Schlep Engine using Docker containers across different environments (development, staging, production) with best practices for security, scalability, and monitoring.

## Overview

Schlep Engine uses a multi-container architecture with the following services:

```
┌─────────────────────────────────────────────────────────────┐
│                    Schlep Engine Stack                      │
├─────────────────────────────────────────────────────────────┤
│  Load Balancer (Nginx)                                     │
├─────────────────────────────────────────────────────────────┤
│  Web Services                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Landing     │ │ Admin       │ │ Docs        │           │
│  │ :3000       │ │ :3001       │ │ :3002       │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│  API Services                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ API Server  │ │ ML Workers  │ │ Celery      │           │
│  │ :8000       │ │ :8001       │ │ Workers     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│  Data Services                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ PostgreSQL  │ │ Redis       │ │ MinIO       │           │
│  │ :5432       │ │ :6379       │ │ :9000       │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│  Monitoring                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Prometheus  │ │ Grafana     │ │ AlertManager│           │
│  │ :9090       │ │ :3000       │ │ :9093       │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Docker Setup

### Prerequisites

**Docker Requirements:**
- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 8GB RAM available to Docker
- 50GB disk space for images and volumes

**System Requirements:**
```bash
# Check Docker version
docker --version
docker-compose --version

# Check available resources
docker system info | grep -E "Total Memory|CPUs"

# Check disk space
docker system df
```

### Installation

#### Docker Engine Installation

**Ubuntu/Debian:**
```bash
# Update package index
sudo apt update

# Install packages to allow apt to use repository over HTTPS
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up stable repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

**CentOS/RHEL:**
```bash
# Install required packages
sudo yum install -y yum-utils

# Set up Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker Engine
sudo yum install -y docker-ce docker-ce-cli containerd.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**macOS:**
```bash
# Install Docker Desktop
brew install --cask docker

# Or download from https://www.docker.com/products/docker-desktop
```

**Windows:**
```powershell
# Install Docker Desktop
# Download from https://www.docker.com/products/docker-desktop
# Enable WSL2 integration
```

## Environment-Specific Configurations

### Development Environment

**docker-compose.dev.yml:**
```yaml
version: '3.8'

services:
  # Database
  postgres:
    image: postgres:15-alpine
    container_name: schlep-postgres-dev
    environment:
      POSTGRES_DB: schlep_engine_dev
      POSTGRES_USER: schlep_user
      POSTGRES_PASSWORD: schlep_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U schlep_user -d schlep_engine_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    container_name: schlep-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data_dev:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    container_name: schlep-minio-dev
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data_dev:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # Mailhog (Development email server)
  mailhog:
    image: mailhog/mailhog:latest
    container_name: schlep-mailhog-dev
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI

  # API Server
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
      target: development
    container_name: schlep-api-dev
    environment:
      - ENVIRONMENT=development
      - DATABASE_URL=postgresql://schlep_user:schlep_pass@postgres:5432/schlep_engine_dev
      - REDIS_URL=redis://redis:6379/0
    ports:
      - "8000:8000"
    volumes:
      - ./apps/api:/app
      - ./uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Celery Worker
  worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
      target: development
    container_name: schlep-worker-dev
    environment:
      - ENVIRONMENT=development
      - DATABASE_URL=postgresql://schlep_user:schlep_pass@postgres:5432/schlep_engine_dev
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./apps/api:/app
      - ./uploads:/app/uploads
    depends_on:
      - postgres
      - redis
    command: celery -A app.core.celery_app worker --loglevel=debug --concurrency=2

volumes:
  postgres_data_dev:
  redis_data_dev:
  minio_data_dev:

networks:
  default:
    name: schlep-dev-network
```

**Starting Development Environment:**
```bash
# Clone repository
git clone https://github.com/your-org/schlep-engine.git
cd schlep-engine

# Copy development environment
cp .env.development.template .env

# Start services
docker-compose -f docker-compose.dev.yml up -d

# Check service status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f api

# Setup database
docker-compose -f docker-compose.dev.yml exec api python -m alembic upgrade head
```

### Staging Environment

**docker-compose.staging.yml:**
```yaml
version: '3.8'

services:
  # Nginx Load Balancer
  nginx:
    image: nginx:alpine
    container_name: schlep-nginx-staging
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.staging.conf:/etc/nginx/nginx.conf
      - ./nginx/sites-enabled:/etc/nginx/sites-enabled
      - ./ssl/certs:/etc/nginx/ssl
    depends_on:
      - api
      - web-admin
      - web-docs
    restart: unless-stopped

  # Database (PostgreSQL)
  postgres:
    image: postgres:15-alpine
    container_name: schlep-postgres-staging
    environment:
      POSTGRES_DB: ${DATABASE_NAME}
      POSTGRES_USER: ${DATABASE_USER}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data_staging:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USER} -d ${DATABASE_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    container_name: schlep-redis-staging
    volumes:
      - redis_data_staging:/data
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Server
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
      target: production
    container_name: schlep-api-staging
    environment:
      - ENVIRONMENT=staging
      - DATABASE_URL=postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@postgres:5432/${DATABASE_NAME}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    env_file:
      - .env.staging
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Web Admin
  web-admin:
    build:
      context: ./apps/web-admin
      dockerfile: Dockerfile
      target: production
    container_name: schlep-web-admin-staging
    environment:
      - NODE_ENV=staging
      - NEXT_PUBLIC_API_URL=https://staging-api.schlep-engine.com
    restart: unless-stopped

  # Web Docs
  web-docs:
    build:
      context: ./apps/web-docs
      dockerfile: Dockerfile
      target: production
    container_name: schlep-web-docs-staging
    environment:
      - NODE_ENV=staging
      - NEXT_PUBLIC_API_URL=https://staging-api.schlep-engine.com
    restart: unless-stopped

  # Celery Worker
  worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
      target: production
    container_name: schlep-worker-staging
    environment:
      - ENVIRONMENT=staging
      - DATABASE_URL=postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@postgres:5432/${DATABASE_NAME}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    env_file:
      - .env.staging
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    command: celery -A app.core.celery_app worker --loglevel=info --concurrency=4

  # Monitoring - Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: schlep-prometheus-staging
    volumes:
      - ./monitoring/prometheus.staging.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data_staging:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    restart: unless-stopped

  # Monitoring - Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: schlep-grafana-staging
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    volumes:
      - grafana_data_staging:/var/lib/grafana
      - ./monitoring/grafana_dashboards.json:/etc/grafana/provisioning/dashboards/dashboards.json
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  postgres_data_staging:
  redis_data_staging:
  prometheus_data_staging:
  grafana_data_staging:

networks:
  default:
    name: schlep-staging-network
```

### Production Environment

**docker-compose.production.yml:**
```yaml
version: '3.8'

services:
  # Nginx Load Balancer with SSL
  nginx:
    image: nginx:alpine
    container_name: schlep-nginx-prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/sites-enabled:/etc/nginx/sites-enabled:ro
      - ./ssl/certs:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - api
      - web-admin
      - web-docs
      - web-landing
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3

  # API Server (Multiple instances for load balancing)
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.production
      target: production
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    env_file:
      - .env.production
    volumes:
      - ./uploads:/app/uploads:rw
      - ./logs/api:/app/logs:rw
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # ML Workers (Dedicated for ML processing)
  ml-worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.ml
      target: ml-production
    environment:
      - ENVIRONMENT=production
      - WORKER_TYPE=ml
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    env_file:
      - .env.production
    volumes:
      - ./uploads:/app/uploads:rw
      - ./logs/ml:/app/logs:rw
      - ./ml_models:/app/ml_models:rw
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    command: celery -A app.core.celery_app worker --loglevel=info --concurrency=4 -Q ml_tasks

  # Data Processing Workers
  data-worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.production
      target: production
    environment:
      - ENVIRONMENT=production
      - WORKER_TYPE=data
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    env_file:
      - .env.production
    volumes:
      - ./uploads:/app/uploads:rw
      - ./logs/data:/app/logs:rw
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 4
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
    command: celery -A app.core.celery_app worker --loglevel=info --concurrency=6 -Q data_tasks

  # Web Applications
  web-admin:
    build:
      context: ./apps/web-admin
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${API_BASE_URL}
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 512M

  web-docs:
    build:
      context: ./apps/web-docs
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${API_BASE_URL}
    restart: unless-stopped
    deploy:
      replicas: 2

  web-landing:
    build:
      context: ./apps/web-landing
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${API_BASE_URL}
    restart: unless-stopped
    deploy:
      replicas: 2

  # Monitoring Stack
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:

networks:
  default:
    name: schlep-production-network
    driver: bridge
```

## Docker Image Optimization

### Multi-Stage Dockerfiles

**API Dockerfile (apps/api/Dockerfile):**
```dockerfile
# Multi-stage build for Python API
FROM python:3.11-slim as base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements*.txt ./

# Development stage
FROM base as development
RUN pip install -r requirements-dev.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production dependencies stage
FROM base as prod-deps
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM prod-deps as production
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production command
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]

# ML-specific stage
FROM production as ml-production
RUN pip install --no-cache-dir -r requirements-ml.txt
# Install additional ML dependencies
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
CMD ["celery", "-A", "app.core.celery_app", "worker", "--loglevel=info", "--concurrency=2", "-Q", "ml_tasks"]
```

**Frontend Dockerfile (apps/web-admin/Dockerfile):**
```dockerfile
# Multi-stage build for Next.js
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM node:18-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

### Image Optimization Best Practices

**1. Layer Optimization:**
```dockerfile
# Bad - Creates many layers
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y wget
RUN apt-get install -y git

# Good - Single layer
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*
```

**2. Use .dockerignore:**
```
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env.local
.env.development
.env.staging
coverage
.nyc_output
*.log
dist
.cache
```

**3. Security Scanning:**
```bash
# Scan for vulnerabilities
docker scout cves schlep-engine:api-latest

# Use Trivy for security scanning
trivy image schlep-engine:api-latest

# Use Snyk for dependency scanning
snyk container test schlep-engine:api-latest
```

## Deployment Commands

### Quick Deployment Scripts

**deploy.sh:**
```bash
#!/bin/bash

set -e

# Configuration
ENVIRONMENT=${1:-staging}
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
ENV_FILE=".env.${ENVIRONMENT}"

echo "Deploying Schlep Engine to ${ENVIRONMENT} environment..."

# Validate environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: Environment file $ENV_FILE not found"
    exit 1
fi

# Load environment variables
set -a
source "$ENV_FILE"
set +a

# Create backup before deployment
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "Creating backup before deployment..."
    ./scripts/backup_database.sh
fi

# Pull latest images
echo "Pulling latest images..."
docker-compose -f "$COMPOSE_FILE" pull

# Build custom images
echo "Building custom images..."
docker-compose -f "$COMPOSE_FILE" build --no-cache

# Stop existing services
echo "Stopping existing services..."
docker-compose -f "$COMPOSE_FILE" down

# Start database and wait for it to be ready
echo "Starting database services..."
docker-compose -f "$COMPOSE_FILE" up -d postgres redis

# Wait for database to be ready
echo "Waiting for database to be ready..."
timeout 60 bash -c 'until docker-compose -f '"$COMPOSE_FILE"' exec postgres pg_isready -U ${DATABASE_USER} -d ${DATABASE_NAME}; do sleep 2; done'

# Run database migrations
echo "Running database migrations..."
docker-compose -f "$COMPOSE_FILE" run --rm api python -m alembic upgrade head

# Start all services
echo "Starting all services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Verify deployment
echo "Verifying deployment..."
sleep 30
./scripts/health_check.sh "$ENVIRONMENT"

echo "Deployment completed successfully!"
```

**health_check.sh:**
```bash
#!/bin/bash

ENVIRONMENT=${1:-staging}

case $ENVIRONMENT in
    "development")
        BASE_URL="http://localhost:8000"
        ;;
    "staging")
        BASE_URL="https://staging-api.schlep-engine.com"
        ;;
    "production")
        BASE_URL="https://api.schlep-engine.com"
        ;;
esac

echo "Running health checks for $ENVIRONMENT environment..."

# API Health Check
echo "Checking API health..."
if curl -f "$BASE_URL/health" > /dev/null 2>&1; then
    echo "✅ API is healthy"
else
    echo "❌ API health check failed"
    exit 1
fi

# Database Health Check
echo "Checking database health..."
if curl -f "$BASE_URL/api/v1/health/detailed" > /dev/null 2>&1; then
    echo "✅ Database is healthy"
else
    echo "❌ Database health check failed"
    exit 1
fi

# Service-specific checks
docker-compose -f "docker-compose.${ENVIRONMENT}.yml" ps --format table

echo "All health checks passed! 🎉"
```

### Zero-Downtime Deployment

**rolling_update.sh:**
```bash
#!/bin/bash

COMPOSE_FILE="docker-compose.production.yml"

echo "Starting rolling update..."

# Update API servers one by one
for i in {1..3}; do
    echo "Updating API server $i..."
    docker-compose -f "$COMPOSE_FILE" stop api
    docker-compose -f "$COMPOSE_FILE" rm -f api
    docker-compose -f "$COMPOSE_FILE" up -d api
    
    # Wait for health check
    sleep 30
    if ! curl -f http://localhost:8000/health; then
        echo "Health check failed for API server $i"
        exit 1
    fi
    
    echo "API server $i updated successfully"
done

# Update workers
echo "Updating workers..."
docker-compose -f "$COMPOSE_FILE" stop worker ml-worker data-worker
docker-compose -f "$COMPOSE_FILE" up -d worker ml-worker data-worker

echo "Rolling update completed!"
```

## Monitoring and Logging

### Container Monitoring Setup

**Docker Stats Monitoring:**
```bash
# Monitor container resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

# Monitor specific service
docker-compose -f docker-compose.production.yml logs -f api

# Export container metrics
docker run -d \
  --name cadvisor \
  --volume=/:/rootfs:ro \
  --volume=/var/run:/var/run:ro \
  --volume=/sys:/sys:ro \
  --volume=/var/lib/docker/:/var/lib/docker:ro \
  --publish=8080:8080 \
  gcr.io/cadvisor/cadvisor:latest
```

**Log Management:**
```yaml
# docker-compose.yml logging configuration
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "200m"
        max-file: "10"
        labels: "service=api,environment=production"

  # Centralized logging with ELK stack
  elasticsearch:
    image: elasticsearch:7.17.9
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: logstash:7.17.9
    volumes:
      - ./monitoring/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:7.17.9
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
```

### Automated Backups

**backup_containers.sh:**
```bash
#!/bin/bash

BACKUP_DIR="/opt/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Backing up database..."
docker-compose exec -T postgres pg_dump -U ${DATABASE_USER} ${DATABASE_NAME} | gzip > "$BACKUP_DIR/database.sql.gz"

# Backup volumes
echo "Backing up volumes..."
docker run --rm -v postgres_data:/source -v "$BACKUP_DIR":/backup alpine tar czf /backup/postgres_data.tar.gz -C /source .
docker run --rm -v redis_data:/source -v "$BACKUP_DIR":/backup alpine tar czf /backup/redis_data.tar.gz -C /source .

# Backup application data
echo "Backing up application data..."
tar czf "$BACKUP_DIR/uploads.tar.gz" uploads/
tar czf "$BACKUP_DIR/logs.tar.gz" logs/

# Upload to cloud storage (AWS S3)
if [[ -n "$AWS_S3_BACKUP_BUCKET" ]]; then
    aws s3 sync "$BACKUP_DIR" "s3://$AWS_S3_BACKUP_BUCKET/$(date +%Y-%m-%d)/"
fi

echo "Backup completed: $BACKUP_DIR"
```

## Security Best Practices

### Container Security

**1. Use Non-Root Users:**
```dockerfile
# Create non-root user
RUN useradd --create-home --shell /bin/bash app
USER app
```

**2. Minimize Attack Surface:**
```dockerfile
# Use minimal base images
FROM python:3.11-slim

# Remove unnecessary packages
RUN apt-get purge -y curl wget && apt-get autoremove -y
```

**3. Secrets Management:**
```yaml
# Use Docker secrets for production
secrets:
  database_password:
    external: true
  api_secret_key:
    external: true

services:
  api:
    secrets:
      - database_password
      - api_secret_key
```

**4. Network Security:**
```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access

services:
  api:
    networks:
      - frontend
      - backend
  
  postgres:
    networks:
      - backend  # Only internal access
```

### Security Scanning

**Docker Bench Security:**
```bash
# Run Docker security benchmark
docker run -it --net host --pid host --userns host --cap-add audit_control \
    -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
    -v /etc:/etc:ro \
    -v /usr/bin/containerd:/usr/bin/containerd:ro \
    -v /usr/bin/runc:/usr/bin/runc:ro \
    -v /usr/lib/systemd:/usr/lib/systemd:ro \
    -v /var/lib:/var/lib:ro \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    --label docker_bench_security \
    docker/docker-bench-security
```

## Troubleshooting

### Common Issues

**1. Container Won't Start:**
```bash
# Check container logs
docker-compose logs service_name

# Check resource usage
docker system df
docker system prune -f

# Verify configuration
docker-compose config
```

**2. Database Connection Issues:**
```bash
# Test database connectivity
docker-compose exec api python -c "
from app.core.database import engine
print('Database connected:', engine.url)
"

# Check database logs
docker-compose logs postgres
```

**3. Memory Issues:**
```bash
# Check memory usage
docker stats --no-stream

# Increase memory limits
# Edit docker-compose.yml:
services:
  api:
    deploy:
      resources:
        limits:
          memory: 4G
```

**4. Networking Issues:**
```bash
# Check network connectivity
docker network ls
docker network inspect schlep-production-network

# Test service-to-service communication
docker-compose exec api curl http://postgres:5432
```

### Performance Optimization

**Resource Limits:**
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

**Health Checks:**
```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

---

## Quick Reference

### Essential Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f service_name

# Scale services
docker-compose up -d --scale api=3

# Update services
docker-compose pull && docker-compose up -d

# Backup data
./scripts/backup_containers.sh

# Health check
./scripts/health_check.sh production
```

### Service URLs

- **API**: http://localhost:8000
- **Admin**: http://localhost:3001  
- **Docs**: http://localhost:3002
- **Monitoring**: http://localhost:9090 (Prometheus)
- **Grafana**: http://localhost:3000

---

**Last Updated**: January 15, 2024  
**Version**: 1.0.0