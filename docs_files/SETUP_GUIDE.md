# 🚀 Schlep-engine Setup Guide

## 📋 Prerequisites

### System Requirements

- **Node.js**: >= 18.0.0
- **Python**: >= 3.11
- **pnpm**: >= 8.0.0
- **Docker**: >= 20.10 (for containerized deployment)
- **PostgreSQL**: >= 13
- **Redis**: >= 6.0

### Development Environment

```bash
# Check versions
node --version
python --version
pnpm --version
docker --version
```

---

## 🏗️ Quick Start (5 minutes)

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/wiramahendra/Schlep-engine.git
cd Schlep-engine

# Install dependencies
pnpm install

# Install Python dependencies
cd apps/api && pip install -r requirements.txt && cd ../..
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/schlep_engine
REDIS_URL=redis://localhost:6379/0

# Authentication
JWT_SECRET_KEY=your-super-secret-jwt-key-minimum-32-characters
ENCRYPTION_KEY=your-encryption-key-exactly-32-characters

# Optional: OAuth (for social login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 3. Database Setup

```bash
# Start PostgreSQL and Redis (using Docker)
docker-compose up -d postgres redis

# Run database migrations
cd apps/api
alembic upgrade head
cd ../..
```

### 4. Start Development Servers

```bash
# Start all services
pnpm dev

# Or start individually:
pnpm dev:backend    # API server (port 8000)
pnpm dev:admin      # Admin dashboard (port 3000)
pnpm dev:landing    # Landing page (port 3001)
pnpm dev:docs       # Documentation (port 3002)
```

### 5. Verify Installation

- **API Health Check**: http://localhost:8000/health
- **API Documentation**: http://localhost:8000/docs
- **Admin Dashboard**: http://localhost:3000
- **Landing Page**: http://localhost:3001

---

## 🛠️ Detailed Setup

### Database Configuration

#### PostgreSQL Setup

**Option 1: Docker (Recommended for development)**
```bash
# Using docker-compose
docker-compose up -d postgres

# Or standalone Docker
docker run --name schlep-postgres \
  -e POSTGRES_DB=schlep_engine \
  -e POSTGRES_USER=schlep_user \
  -e POSTGRES_PASSWORD=schlep_password \
  -p 5432:5432 -d postgres:15
```

**Option 2: Local Installation**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Create database
createdb schlep_engine
```

#### Redis Setup

**Docker:**
```bash
docker run --name schlep-redis -p 6379:6379 -d redis:7-alpine
```

**Local Installation:**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
```

### Environment Configuration

#### Complete .env Template

```bash
# ===================================
# DATABASE CONFIGURATION
# ===================================
DATABASE_URL=postgresql://schlep_user:schlep_password@localhost:5432/schlep_engine
REDIS_URL=redis://localhost:6379/0

# ===================================
# AUTHENTICATION & SECURITY
# ===================================
JWT_SECRET_KEY=your-super-secret-jwt-key-minimum-32-characters-long
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
ENCRYPTION_KEY=your-encryption-key-exactly-32-chars

# ===================================
# OAUTH CONFIGURATION
# ===================================
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/oauth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/v1/auth/oauth/github/callback

# ===================================
# CLOUD STORAGE (Optional)
# ===================================
CLOUD_STORAGE_PROVIDER=gcs  # or 's3'
CLOUD_STORAGE_BUCKET_NAME=your-bucket-name
GCS_CREDENTIALS_PATH=/path/to/service-account.json
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# ===================================
# EMAIL CONFIGURATION (Optional)
# ===================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# ===================================
# MONITORING & LOGGING
# ===================================
ENVIRONMENT=development  # or production
LOG_LEVEL=INFO
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENABLED=false

# ===================================
# API CONFIGURATION
# ===================================
API_V1_PREFIX=/api/v1
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001","http://localhost:3002"]
MAX_UPLOAD_SIZE=100MB
```

### OAuth Setup

#### Google OAuth Configuration

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create/Select Project**
3. **Enable Google+ API**
4. **Create OAuth 2.0 Credentials**:
   - **Application type**: Web application
   - **Authorized origins**: `http://localhost:8000`
   - **Redirect URIs**: `http://localhost:8000/api/v1/auth/oauth/google/callback`

#### GitHub OAuth Configuration

1. **Go to GitHub Settings**: https://github.com/settings/developers
2. **New OAuth App**:
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:8000/api/v1/auth/oauth/github/callback`

---

## 🐳 Docker Deployment

### Development with Docker

```bash
# Build and start all services
docker-compose up --build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f api
```

### Production Docker Setup

```dockerfile
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile.prod
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/schlep_engine
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    ports:
      - "8000:8000"

  frontend:
    build:
      context: .
      dockerfile: apps/web-admin/Dockerfile.prod
    ports:
      - "3000:3000"

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: schlep_engine
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 🧪 Testing Setup

### Test Environment Setup

```bash
# Install test dependencies
pnpm install

# Setup test database
createdb schlep_engine_test

# Set test environment variables
export DATABASE_URL=postgresql://localhost/schlep_engine_test
export ENVIRONMENT=testing
```

### Running Tests

```bash
# All tests
pnpm test

# API tests
cd apps/api && pytest

# Frontend tests
pnpm --filter @schlep-engine/web-admin test

# E2E tests
pnpm test:oauth
```

### OAuth Testing Setup

```bash
# Install Cypress
pnpm install cypress --save-dev

# Setup OAuth mock providers
export ENABLE_OAUTH_TESTING=true
export ENABLE_MOCK_OAUTH=true

# Run OAuth tests
pnpm test:oauth:open  # Interactive
pnpm test:oauth       # Headless
```

---

## 🔧 Development Tools

### Code Quality Tools

```bash
# Linting
pnpm lint

# Type checking
pnpm type-check

# Security scanning
pnpm security:scan

# Dependency audit
pnpm deps:audit
```

### Database Tools

```bash
# Create migration
cd apps/api
alembic revision --autogenerate -m "Add new feature"

# Apply migrations
alembic upgrade head

# Reset database
alembic downgrade base
alembic upgrade head
```

### Monitoring Setup

#### Prometheus & Grafana (Optional)

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana: http://localhost:3001
# Default credentials: admin/admin
```

---

## 🚀 Production Deployment

### Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Security scanning passed

### Deployment Options

#### Option 1: Traditional Server

```bash
# Build production assets
pnpm build

# Start production server
pnpm start
```

#### Option 2: Kubernetes

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: schlep-engine-api
spec:
  replicas: 3
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
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: schlep-engine-secrets
              key: database-url
```

#### Option 3: Cloud Platforms

**Vercel (Frontend):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Railway/Render (Backend):**
- Connect GitHub repository
- Set environment variables
- Deploy automatically

---

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Reset PostgreSQL
sudo systemctl restart postgresql
```

#### Dependencies Issues
```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install

# Python dependencies
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

#### OAuth Issues
```bash
# Verify OAuth URLs in provider settings
# Check environment variables
# Ensure callback URLs match exactly
```

### Getting Help

- 📖 [API Documentation](./API_DOCUMENTATION.md)
- 🔐 [Security Guide](./SECURITY.md)
- 🏗️ [Architecture Guide](./ARCHITECTURE.md)
- 🐛 [GitHub Issues](https://github.com/wiramahendra/Schlep-engine/issues)
- 💬 [Discord Community](https://discord.gg/schlep-engine)

---

## 📋 Next Steps

After successful setup:

1. **Explore the API**: Visit http://localhost:8000/docs
2. **Try OAuth**: Test Google/GitHub login
3. **Upload Data**: Use the admin dashboard
4. **Run ML Pipeline**: Start with sample data
5. **Check Monitoring**: View system metrics

---

*Last Updated: January 2024*
*Setup Guide Version: 1.0.0*