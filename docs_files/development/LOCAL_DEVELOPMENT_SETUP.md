# Local Development Setup Guide

## Schlep Engine - Development Environment Setup

This guide will help you set up a complete local development environment for Schlep Engine, including all services, debugging tools, and development workflows.

## Prerequisites

### System Requirements

**Minimum Specifications:**
- **CPU**: 4 cores (Intel i5 or AMD Ryzen 5)
- **RAM**: 16GB
- **Storage**: 50GB free space (SSD recommended)
- **OS**: macOS 11+, Ubuntu 20.04+, or Windows 11 with WSL2

**Required Software:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (v4.0+)
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.9+)
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/) (recommended)

### Development Tools Installation

#### macOS Setup
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install development tools
brew install git python@3.11 node docker
brew install --cask docker visual-studio-code

# Install Python package manager
pip3 install pipenv poetry

# Install Node package manager
npm install -g pnpm yarn
```

#### Ubuntu/Debian Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install development tools
sudo apt install -y git python3 python3-pip nodejs npm curl wget

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install package managers
npm install -g pnpm yarn
pip3 install pipenv poetry
```

#### Windows (WSL2) Setup
```bash
# Install Windows Subsystem for Linux
wsl --install

# In WSL2, follow Ubuntu setup above
# Install Docker Desktop for Windows
# Enable WSL2 integration in Docker Desktop settings
```

## Project Setup

### 1. Clone Repository

```bash
# Clone the main repository
git clone https://github.com/your-org/schlep-engine.git
cd schlep-engine

# Setup git hooks (optional but recommended)
git config core.hooksPath .githooks
chmod +x .githooks/*
```

### 2. Environment Configuration

```bash
# Copy development environment template
cp .env.development.template .env

# Copy API-specific environment
cd apps/api
cp env.development.template .env

# Generate development secrets
python scripts/generate_secrets.py --development
```

### 3. Development Environment Variables

Edit `.env` in the project root:

```env
# Development Environment
NODE_ENV=development
ENVIRONMENT=development
DEBUG=true

# Database (uses Docker PostgreSQL)
DATABASE_URL=postgresql://schlep_user:schlep_pass@localhost:5432/schlep_engine_dev
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=schlep_user
DATABASE_PASSWORD=schlep_pass
DATABASE_NAME=schlep_engine_dev

# Redis (uses Docker Redis)
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379

# API Configuration
API_PORT=8000
API_HOST=0.0.0.0
SECRET_KEY=dev_secret_key_change_in_production
JWT_SECRET=dev_jwt_secret_change_in_production

# Storage (Local development)
STORAGE_TYPE=local
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=100MB

# Authentication (Development OAuth apps)
GOOGLE_CLIENT_ID=your_dev_google_client_id
GOOGLE_CLIENT_SECRET=your_dev_google_client_secret
GITHUB_CLIENT_ID=your_dev_github_client_id
GITHUB_CLIENT_SECRET=your_dev_github_client_secret

# Email (Development - uses Mailhog)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=dev@schlep-engine.local

# Monitoring (Development)
SENTRY_DSN=  # Leave empty for development
PROMETHEUS_ENABLED=true
LOG_LEVEL=DEBUG

# LemonSqueezy (Development/Sandbox)
LEMONSQUEEZY_API_KEY=your_dev_api_key
LEMONSQUEEZY_STORE_ID=your_dev_store_id
LEMONSQUEEZY_WEBHOOK_SECRET=dev_webhook_secret

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_WEBHOOKS=true
ENABLE_ML_PIPELINE=true
ENABLE_ADVANCED_AI=true
```

Edit `apps/api/.env`:

```env
# API-specific development settings
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# CORS for development
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Database connections
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10

# Cache settings
REDIS_CACHE_TTL=300  # 5 minutes for faster development

# Security (relaxed for development)
CSRF_ENABLED=false
RATE_LIMIT_PER_MINUTE=1000  # Higher limit for development

# Performance (optimized for development)
WORKER_PROCESSES=2
CELERY_WORKERS=2
```

## Development Services Setup

### 1. Start Infrastructure Services

```bash
# Start database, Redis, and other infrastructure
docker-compose -f docker-compose.dev.yml up -d postgres redis mailhog

# Verify services are running
docker-compose ps

# Expected output:
# postgres    - Up, healthy
# redis       - Up, healthy  
# mailhog     - Up, accessible at http://localhost:8025
```

### 2. Database Setup

```bash
# Navigate to API directory
cd apps/api

# Install Python dependencies
pip install -r requirements-dev.txt

# Run database migrations
python -m alembic upgrade head

# Create development admin user
python -c "
from app.auth.user_management import create_admin_user
create_admin_user('admin@dev.local', 'admin123', is_superuser=True)
print('Admin user created: admin@dev.local / admin123')
"

# Seed development data
python scripts/seed_database.py --development

# Verify database setup
python -c "
from app.core.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM users'))
    print(f'Users in database: {result.scalar()}')
"
```

### 3. Start Development Servers

#### Option A: Start All Services (Recommended)
```bash
# From project root
./start-dev-server.sh

# This script starts:
# - API server (port 8000)
# - Web admin (port 3001) 
# - Web docs (port 3002)
# - Web landing (port 3000)
# - Celery workers
```

#### Option B: Start Services Individually

**API Server:**
```bash
cd apps/api

# Install dependencies
pip install -r requirements-dev.txt

# Start development server with hot reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug

# Alternative: Use the development script
python -m app.main
```

**Web Admin Dashboard:**
```bash
cd apps/web-admin

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Server will start at http://localhost:3002
```

**Web API Console:**
```bash
cd apps/web-console

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Server will start at http://localhost:3004
```

**Web Documentation:**
```bash
cd apps/web-docs

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Server will start at http://localhost:3005
```

**Web Landing Page:**
```bash
cd apps/web-landing

# Install dependencies
npm install

# Start development server
npm run dev

# Server will start at http://localhost:3000
```

**Background Workers:**
```bash
cd apps/api

# Start Celery worker for background tasks
celery -A app.core.celery_app worker --loglevel=debug --concurrency=2

# Start Celery beat for scheduled tasks (optional)
celery -A app.core.celery_app beat --loglevel=debug
```

## Development Workflow

### 1. Code Organization

```
schlep-engine/
├── apps/
│   ├── api/                 # FastAPI backend
│   │   ├── app/
│   │   │   ├── api/v1/     # API endpoints
│   │   │   ├── auth/       # Authentication
│   │   │   ├── core/       # Core functionality
│   │   │   ├── database/   # Database models
│   │   │   └── services/   # Business logic
│   │   ├── tests/          # API tests
│   │   └── scripts/        # Utility scripts
│   ├── web-admin/          # Admin dashboard (Next.js)
│   ├── web-console/        # API console (Next.js)
│   ├── web-docs/           # Documentation site (Next.js)
│   └── web-landing/        # Landing page (Next.js)
├── docs/                   # Documentation
├── infrastructure/         # Deployment configs
├── packages/              # Shared packages
└── tools/                 # Development tools
```

### 2. API Development

**Adding New Endpoints:**

1. Create endpoint file:
```python
# apps/api/app/api/v1/new_feature.py
from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user

router = APIRouter()

@router.post("/new-endpoint")
async def new_endpoint(
    request: RequestModel,
    user: User = Depends(get_current_user)
):
    # Implementation
    return {"status": "success"}
```

2. Register router:
```python
# apps/api/app/main.py
from app.api.v1 import new_feature

app.include_router(
    new_feature.router, 
    prefix="/api/v1/new-feature", 
    tags=["New Feature"]
)
```

3. Add tests:
```python
# apps/api/tests/test_new_feature.py
def test_new_endpoint(client, auth_headers):
    response = client.post(
        "/api/v1/new-feature/new-endpoint",
        json={"test": "data"},
        headers=auth_headers
    )
    assert response.status_code == 200
```

**Database Migrations:**
```bash
# Create new migration
cd apps/api
python -m alembic revision --autogenerate -m "Add new feature table"

# Review generated migration file
# Edit alembic/versions/xxx_add_new_feature_table.py if needed

# Apply migration
python -m alembic upgrade head
```

### 3. Frontend Development

**Adding New Pages:**

1. Create page component:
```tsx
// apps/web-admin/src/app/new-feature/page.tsx
export default function NewFeaturePage() {
  return (
    <div>
      <h1>New Feature</h1>
      {/* Component implementation */}
    </div>
  );
}
```

2. Add navigation:
```tsx
// apps/web-admin/src/components/ui/Sidebar.tsx
const navigationItems = [
  // ... existing items
  {
    name: 'New Feature',
    href: '/new-feature',
    icon: NewFeatureIcon
  }
];
```

**API Integration:**
```tsx
// apps/web-admin/src/lib/api.ts
export const newFeatureAPI = {
  async getData() {
    const response = await fetch('/api/v1/new-feature/data', {
      headers: {
        'X-API-Key': getApiKey(),
      },
    });
    return response.json();
  }
};
```

### 4. Testing

**Running Tests:**
```bash
# API tests
cd apps/api
pytest tests/ -v

# Frontend tests
cd apps/web-admin
pnpm test

# Integration tests
cd apps/api
pytest tests/integration/ -v

# Load tests
pytest tests/load_test.py -v
```

**Test Configuration:**
```python
# apps/api/pytest.ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --strict-markers
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow tests
    api: API tests
```

**Writing Tests:**
```python
# apps/api/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"X-API-Key": "test_api_key"}

# Example test
def test_upload_file(client, auth_headers):
    with open("test_data.csv", "rb") as f:
        response = client.post(
            "/api/v1/data/upload",
            headers=auth_headers,
            files={"file": ("test.csv", f, "text/csv")},
            data={"name": "Test Dataset"}
        )
    assert response.status_code == 200
    assert "investigation_id" in response.json()["data"]
```

## Development Tools & Debugging

### 1. VS Code Setup

**Recommended Extensions:**
```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.debugpy",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.docker",
    "charliermarsh.ruff"
  ]
}
```

**Development Settings:**
```json
// .vscode/settings.json
{
  "python.defaultInterpreterPath": "./apps/api/venv/bin/python",
  "python.formatting.provider": "black",
  "python.linting.enabled": true,
  "python.linting.ruffEnabled": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "auto"
}
```

**Debug Configuration:**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/apps/api/app/main.py",
      "cwd": "${workspaceFolder}/apps/api",
      "env": {
        "ENVIRONMENT": "development"
      },
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Tests",
      "type": "python",
      "request": "launch",
      "module": "pytest",
      "args": ["tests/", "-v"],
      "cwd": "${workspaceFolder}/apps/api",
      "console": "integratedTerminal"
    }
  ]
}
```

### 2. API Development Tools

**Interactive API Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI Spec: http://localhost:8000/openapi.json

**Database Tools:**
```bash
# Database shell
cd apps/api
python -c "
from app.core.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    # Interactive Python shell with database connection
    import code
    code.interact(local=locals())
"

# PostgreSQL shell
docker-compose exec postgres psql -U schlep_user -d schlep_engine_dev
```

**Redis Tools:**
```bash
# Redis CLI
docker-compose exec redis redis-cli

# Monitor Redis commands
docker-compose exec redis redis-cli MONITOR

# Check Redis memory usage
docker-compose exec redis redis-cli INFO memory
```

### 3. Email Testing

**Mailhog (Development Email Server):**
- Web Interface: http://localhost:8025
- SMTP: localhost:1025

**Testing Email Functionality:**
```python
# apps/api/scripts/test_email.py
from app.services.email_service import send_email

send_email(
    to="test@example.com",
    subject="Test Email",
    body="This is a test email from development environment"
)
```

### 4. Performance Monitoring

**Development Metrics:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

**Custom Development Dashboard:**
```python
# apps/api/app/api/v1/dev_tools.py (development only)
from fastapi import APIRouter

router = APIRouter()

@router.get("/dev/metrics")
async def dev_metrics():
    return {
        "database_connections": get_db_pool_status(),
        "redis_connections": get_redis_status(),
        "memory_usage": get_memory_usage(),
        "request_count": get_request_count()
    }
```

## Common Development Tasks

### 1. Adding New Dependencies

**Python Dependencies:**
```bash
cd apps/api

# Add to requirements-dev.txt
echo "new-package==1.0.0" >> requirements-dev.txt

# Install
pip install -r requirements-dev.txt

# For production dependencies
echo "new-package==1.0.0" >> requirements.txt
```

**Node.js Dependencies:**
```bash
cd apps/web-admin

# Add dependency
pnpm add new-package

# Add dev dependency
pnpm add -D new-dev-package

# Update all dependencies
pnpm update
```

### 2. Database Tasks

**Reset Development Database:**
```bash
cd apps/api

# Drop and recreate database
docker-compose exec postgres psql -U schlep_user -c "DROP DATABASE schlep_engine_dev;"
docker-compose exec postgres psql -U schlep_user -c "CREATE DATABASE schlep_engine_dev;"

# Run migrations
python -m alembic upgrade head

# Seed data
python scripts/seed_database.py --development
```

**Database Schema Changes:**
```bash
# After modifying models in app/database/models.py
python -m alembic revision --autogenerate -m "Description of changes"

# Review the generated migration
# Edit if necessary, then apply
python -m alembic upgrade head
```

### 3. Code Quality

**Pre-commit Hooks:**
```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run on all files
pre-commit run --all-files
```

**Linting and Formatting:**
```bash
cd apps/api

# Format code
black .
isort .

# Lint code
ruff check .
mypy .

# Frontend
cd apps/web-admin
pnpm lint
pnpm format
```

## Troubleshooting

### Common Issues

**1. Port Already in Use:**
```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
uvicorn app.main:app --port 8001
```

**2. Database Connection Error:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

**3. Permission Errors (macOS/Linux):**
```bash
# Fix file permissions
chmod +x scripts/*.sh

# Fix Docker permissions
sudo usermod -aG docker $USER
newgrp docker
```

**4. Node.js Module Issues:**
```bash
# Clear Node modules and reinstall
cd apps/web-admin
rm -rf node_modules package-lock.json
pnpm install
```

**5. Python Environment Issues:**
```bash
cd apps/api

# Recreate virtual environment
rm -rf venv
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements-dev.txt
```

### Debug Logging

**API Debug Logging:**
```python
# apps/api/app/core/logging_config.py
import logging

# Enable debug logging in development
if os.getenv("ENVIRONMENT") == "development":
    logging.getLogger("uvicorn").setLevel(logging.DEBUG)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
```

**Frontend Debug Logging:**
```tsx
// Enable debug logging
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}
```

## Development Best Practices

### 1. Code Style

**Python (PEP 8 + Black):**
```python
# Good
def process_data(
    data: List[Dict[str, Any]], 
    config: ProcessingConfig
) -> ProcessedResult:
    """Process data according to configuration."""
    return ProcessedResult(data=processed_data)

# Use type hints
from typing import List, Dict, Any, Optional

def get_user(user_id: int) -> Optional[User]:
    return User.get_by_id(user_id)
```

**TypeScript:**
```tsx
// Use proper typing
interface UserData {
  id: number;
  name: string;
  email: string;
}

const UserComponent: React.FC<{ user: UserData }> = ({ user }) => {
  return <div>{user.name}</div>;
};
```

### 2. Testing Guidelines

**Test Structure:**
```python
def test_feature_description():
    # Arrange
    user = create_test_user()
    data = {"test": "data"}
    
    # Act
    result = process_feature(user, data)
    
    # Assert
    assert result.success is True
    assert result.data["processed"] is True
```

### 3. Git Workflow

**Branch Naming:**
```bash
# Feature branches
git checkout -b feature/add-new-endpoint
git checkout -b fix/authentication-bug
git checkout -b docs/update-api-guide

# Commit messages
git commit -m "feat: add user authentication endpoint"
git commit -m "fix: resolve database connection issue"
git commit -m "docs: update API documentation"
```

### 4. Environment Management

**Environment Isolation:**
```bash
# Always use virtual environments
python -m venv venv
source venv/bin/activate

# Use environment-specific configs
cp .env.development.template .env
# Edit .env with development-specific values
```

---

## Quick Reference

### Development URLs
- API: http://localhost:8000
- Landing Page: http://localhost:3000
- Admin Dashboard: http://localhost:3002
- API Console: http://localhost:3004
- Documentation: http://localhost:3005
- Mailhog: http://localhost:8025
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

### Common Commands
```bash
# Start all services
./start-dev-server.sh

# API only
cd apps/api && uvicorn app.main:app --reload

# Frontend only
cd apps/web-admin && pnpm dev

# Run tests
cd apps/api && pytest tests/ -v

# Database reset
docker-compose restart postgres && python -m alembic upgrade head
```

### Useful Scripts
- `./start-dev-server.sh` - Start all development services
- `./scripts/setup_dev_environment.py` - Initial development setup
- `./scripts/reset_dev_database.sh` - Reset development database
- `./scripts/generate_test_data.py` - Generate test data

---

**Last Updated**: January 15, 2024  
**Version**: 1.0.0