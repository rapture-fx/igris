# Schlep-Engine Dependency Matrix

This document provides a clear overview of dependencies for different deployment scenarios.

## Deployment Scenarios

### 1. Minimal Production (Recommended for API-only)
**Use Case:** Core API functionality without ML/document processing
**File:** `apps/api/requirements-core.txt`
**Package Count:** ~25 packages
**Features:**
- FastAPI core
- PostgreSQL + Redis
- JWT authentication
- Basic data processing
- REST API endpoints

```bash
pip install -r apps/api/requirements-core.txt
```

---

### 2. Standard Production (Most Common)
**Use Case:** Full API with optional ML frameworks
**File:** `apps/api/requirements.txt`
**Package Count:** ~106 packages
**Features:**
- All minimal features
- scikit-learn (always included)
- TensorFlow & PyTorch (optional via env vars)
- Document processing (PDF, DOCX, Excel)
- Cloud storage connectors (AWS, GCS, Azure)
- Monitoring & observability

```bash
# Standard installation
pip install -r apps/api/requirements.txt

# Enable ML frameworks (optional)
export ENABLE_ML_FRAMEWORKS=true
```

---

### 3. ML-Enhanced Production
**Use Case:** Full ML capabilities with TensorFlow/PyTorch
**File:** `apps/api/requirements-ml.txt`
**Package Count:** ~65+ packages
**Features:**
- All standard features
- TensorFlow 2.15.0
- PyTorch 2.1.1
- Transformers
- Advanced NLP capabilities

```bash
pip install -r apps/api/requirements.txt
pip install -r apps/api/requirements-ml.txt
```

---

### 4. Development Environment
**Use Case:** Local development with testing tools
**File:** `apps/api/requirements-dev.txt`
**Features:**
- All production features
- Testing frameworks (pytest, pytest-asyncio)
- Load testing (Locust)
- Performance profiling
- Code quality tools (black, isort, flake8)

```bash
pip install -r apps/api/requirements.txt
pip install -r apps/api/requirements-dev.txt
```

---

## Dependency Files Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| `requirements-core.txt` | Minimal core dependencies | Lightweight API deployment |
| `requirements.txt` | Standard production | Most production deployments |
| `requirements-ml.txt` | ML framework extensions | ML-heavy workloads |
| `requirements-dev.txt` | Development tools | Local development only |
| `requirements-optimized.txt` | Performance-optimized versions | Production optimization |
| `requirements.lock` | Locked versions | Reproducible builds |

---

## Environment Variables for Dependency Control

### ML Framework Control
```bash
# Enable TensorFlow & PyTorch
export ENABLE_ML_FRAMEWORKS=true

# Disable ML frameworks (default)
export ENABLE_ML_FRAMEWORKS=false
```

### Streaming Control
```bash
# Enable real-time streaming (Kafka, Redis)
export ENABLE_STREAM_PRODUCERS=true

# Disable streaming
export ENABLE_STREAM_PRODUCERS=false
```

### Model Serving Control
```bash
# Enable advanced model serving
export ENABLE_MODEL_SERVING=true

# Disable model serving (default)
export ENABLE_MODEL_SERVING=false
```

---

## Commented Dependencies (Removed from Production)

The following dependencies have been intentionally removed and are commented in `requirements.txt` for reference:

### Cloud-Specific SDKs (Removed for cloud-agnostic operation)
- ❌ `supabase==2.0.0` - Replaced with direct PostgreSQL
- ❌ `realtime==1.0.0` - Replaced with Redis pub/sub
- ❌ `google-auth-oauthlib==1.1.0` - Removed for cloud-agnostic operation

### Conflicting Dependencies
- ❌ `hystrix-py` - Replaced with `pybreaker` for circuit breaking

### Billing Integration
- ❌ Lemon Squeezy SDK - Replaced with generic billing endpoints

---

## Docker Deployment Options

### Minimal Container
```dockerfile
FROM python:3.11-slim
COPY requirements-core.txt .
RUN pip install -r requirements-core.txt
```

### Standard Container
```dockerfile
FROM python:3.11-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
```

### ML Container
```dockerfile
FROM python:3.11
COPY requirements.txt requirements-ml.txt .
RUN pip install -r requirements.txt -r requirements-ml.txt
```

---

## Package Size Comparison

| Configuration | Package Count | Install Size | Use Case |
|--------------|---------------|--------------|----------|
| Minimal | ~25 | ~200MB | API-only services |
| Standard | ~106 | ~1.5GB | Production API |
| ML-Enhanced | ~65+ additional | ~3GB | ML workloads |
| Development | +30 tools | +500MB | Local dev |

---

## Dependency Update Policy

1. **Security Updates:** Applied immediately
2. **Minor Updates:** Reviewed monthly
3. **Major Updates:** Reviewed quarterly with testing
4. **Lock File:** Updated after validation

---

## Troubleshooting

### Issue: ML frameworks not loading
**Solution:** Set `ENABLE_ML_FRAMEWORKS=true` and install `requirements-ml.txt`

### Issue: Streaming endpoints unavailable
**Solution:** Set `ENABLE_STREAM_PRODUCERS=true` and ensure Kafka/Redis configured

### Issue: Dependency conflicts
**Solution:** Use `requirements.lock` for reproducible builds

---

*Last Updated: 2025-09-30*
*For questions, see documentation or contact devops@schlep-engine.com*