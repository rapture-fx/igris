# Docker Image Rebuild Instructions

## Overview
After resolving critical dependency conflicts, Docker images need to be rebuilt to incorporate the fixed dependencies.

## Fixed Dependency Issues

### 1. PyTorch Integration for RL System
- **Issue**: stable-baselines3 requires PyTorch but it was missing from requirements
- **Fix**: Added proper PyTorch dependencies to `requirements-rl.txt`
- **Platform Notes**: 
  - Apple Silicon: Use `--index-url https://download.pytorch.org/whl/cpu`
  - CUDA Systems: Use `--index-url https://download.pytorch.org/whl/cu118`

### 2. Resolved Version Conflicts
- **requests**: Updated from 2.22.0/2.32.4 conflict to 2.32.3
- **urllib3**: Updated from 1.25.6/1.26.18 conflict to 2.2.2  
- **certifi**: Updated to >=2025.4.26 for security
- **idna**: Updated to >=3.7 for compatibility

### 3. Removed Conflicting Dependencies
- **hystrix-py**: Removed due to irreconcilable conflicts with newer requests/urllib3
- **Replacement**: Using `pybreaker==0.7.0` for circuit breaking functionality

## Rebuild Commands

### 1. Base API Image
```bash
cd /Users/wira/Desktop/schlep-engine/apps/api

# Clear Docker build cache
docker builder prune -f

# Rebuild base image
docker build -t schlep-engine-api:latest \
  --no-cache \
  --build-arg REQUIREMENTS_FILE=requirements.txt \
  .
```

### 2. ML Service Image  
```bash
# Rebuild ML image with updated dependencies
docker build -t schlep-engine-ml:latest \
  --no-cache \
  --build-arg REQUIREMENTS_FILE=requirements-ml.txt \
  -f Dockerfile.ml \
  .
```

### 3. RL Service Image
```bash
# Special handling for PyTorch installation
docker build -t schlep-engine-rl:latest \
  --no-cache \
  --build-arg TORCH_INDEX_URL="https://download.pytorch.org/whl/cpu" \
  --build-arg REQUIREMENTS_FILE=requirements-rl.txt \
  -f Dockerfile.rl \
  .
```

### 4. Multi-architecture Build (if needed)
```bash
# For deployment across different platforms
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t schlep-engine-api:latest \
  --push \
  .
```

## Docker Compose Updates

If using docker-compose, update your services:

```yaml
services:
  api:
    image: schlep-engine-api:latest
    build:
      context: .
      args:
        REQUIREMENTS_FILE: requirements.txt
    environment:
      - TORCH_AVAILABLE=false
      
  ml-service:
    image: schlep-engine-ml:latest  
    build:
      context: .
      dockerfile: Dockerfile.ml
      args:
        REQUIREMENTS_FILE: requirements-ml.txt
        
  rl-service:
    image: schlep-engine-rl:latest
    build:
      context: .
      dockerfile: Dockerfile.rl  
      args:
        REQUIREMENTS_FILE: requirements-rl.txt
        TORCH_INDEX_URL: "https://download.pytorch.org/whl/cpu"
```

## Dockerfile Updates Required

### Base Dockerfile Updates
```dockerfile
# Add argument for requirements file
ARG REQUIREMENTS_FILE=requirements.txt

# Update pip before installing
RUN pip install --upgrade pip setuptools wheel

# Install dependencies with proper error handling
COPY ${REQUIREMENTS_FILE} .
RUN pip install --no-cache-dir -r ${REQUIREMENTS_FILE} || \
    (echo "Dependency installation failed" && exit 1)
```

### RL Dockerfile Additions
```dockerfile
# RL-specific Dockerfile
FROM python:3.11-slim

ARG REQUIREMENTS_FILE=requirements-rl.txt
ARG TORCH_INDEX_URL="https://download.pytorch.org/whl/cpu"

# Install PyTorch first with correct index
RUN pip install --upgrade pip
RUN pip install torch torchvision torchaudio --index-url ${TORCH_INDEX_URL}

# Then install other requirements
COPY ${REQUIREMENTS_FILE} .
RUN pip install --no-cache-dir -r ${REQUIREMENTS_FILE}
```

## Validation Commands

### 1. Validate Container Dependencies
```bash
# Test container can start and import critical modules
docker run --rm schlep-engine-api:latest python -c "
import fastapi, pydantic, sqlalchemy, redis, requests
print('✅ Core dependencies OK')
"

# Test RL container
docker run --rm schlep-engine-rl:latest python -c "
import torch, stable_baselines3, gymnasium  
print('✅ RL dependencies OK')
print(f'PyTorch version: {torch.__version__}')
"
```

### 2. Run Validation Script in Container
```bash
docker run --rm schlep-engine-api:latest python validate_dependencies.py --skip-rl
```

## Image Tagging Strategy

Use semantic versioning for dependency fixes:

```bash
# Tag with fix version
docker tag schlep-engine-api:latest schlep-engine-api:v1.2.1-deps-fix
docker tag schlep-engine-rl:latest schlep-engine-rl:v1.2.1-pytorch-fix

# Push to registry
docker push schlep-engine-api:v1.2.1-deps-fix  
docker push schlep-engine-rl:v1.2.1-pytorch-fix
```

## Rollback Plan

If issues occur after rebuild:

```bash
# Rollback to previous working images
docker tag schlep-engine-api:v1.2.0 schlep-engine-api:latest
docker tag schlep-engine-rl:v1.2.0 schlep-engine-rl:latest

# Restart services
docker-compose down
docker-compose up -d
```

## Security Considerations

- Updated `certifi` to latest version for SSL/TLS security
- Removed `hystrix-py` which had known vulnerabilities
- All network dependencies use compatible, secure versions
- Consider regular security scans: `docker scout cves schlep-engine-api:latest`

## Performance Monitoring

After rebuild, monitor:
- Container startup times
- Memory usage patterns  
- Dependency loading performance
- ML/RL model initialization times

Use the validation script to establish baseline performance metrics.