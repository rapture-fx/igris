# Legacy Backend Audit Report

**Date:** 2025-10-17
**Phase:** Post-Phase 11 (Benchmark Provider Integration)
**Auditor:** Claude Code
**Scope:** Analysis of legacy backend components under `/web/apps/`

---

## Executive Summary

This audit analyzed four legacy backend components in `/web/apps/` to determine their relevance to the current Phase 11 architecture, which is centered on:
- Go-based API: `/cmd/schlep-api`
- Rust optimizer: `/rust-core/` with FFI integration
- Simplified Python ML adapter: `/adapters/python/python_ml/`

**Key Finding:** All four audited components (`backend`, `go-gateway`, `python-ml-service`, `web-docs`) are **UNUSED** by the current production architecture and can be safely archived or deleted.

---

## Audit Methodology

1. **Code Reference Analysis**: Searched for imports/references in active Go code (`/cmd`, `/internal`) and Rust code
2. **Module Dependency Check**: Examined `go.mod` for module dependencies
3. **CI/CD Analysis**: Reviewed GitHub Actions workflows and Docker Compose files
4. **Workspace Analysis**: Checked `pnpm-workspace.yaml` for frontend workspace inclusion
5. **Comparative Analysis**: Compared legacy components with active replacements

---

## Detailed Findings

### 1. web/apps/backend (FastAPI Backend)

**Path:** `/web/apps/backend/`

**Technology Stack:**
- FastAPI (Python)
- Alembic migrations
- PostgreSQL with SQLAlchemy

**Key Files:**
```
web/apps/backend/
├── app/
│   ├── database/ml_lifecycle_models.py
│   └── services/
│       ├── ml_lifecycle_service.py
│       └── ml_deployment_service.py
└── alembic/
    └── versions/007_add_ml_lifecycle_management.py
```

**Analysis:**
- **No references** found in `/cmd` or `/internal` Go code
- **Not imported** by any active Go modules
- **Not referenced** in CI/CD workflows (no GitHub Actions)
- **Not included** in Docker Compose production configs
- Appears to be an early FastAPI prototype for ML lifecycle management

**Status:** ❌ **UNUSED**

**Reason:** FastAPI backend was replaced by Go-based `/cmd/schlep-api`. ML lifecycle functionality (if needed) has been migrated to the Go architecture.

**Recommendation:** **DELETE** - No active dependencies detected.

---

### 2. web/apps/go-gateway

**Path:** `/web/apps/go-gateway/`

**Technology Stack:**
- Go 1.21
- Fiber web framework
- PostgreSQL (GORM)
- Redis
- Prometheus metrics
- Rust FFI support

**Module Name:** `github.com/schlep-engine/gateway`

**Key Features:**
```go
// From web/apps/go-gateway/cmd/api/main.go (295 lines)
- JWT authentication
- Rate limiting middleware
- Comprehensive logging
- Database connection pooling
- Redis caching
- Rust FFI integration
- ML service gRPC client
- Health checks & metrics
```

**Analysis:**
- **No references** found in active codebase (`/cmd`, `/internal`)
- **Different module** than production (`github.com/schlep-engine/gateway` vs. `github.com/schlep-engine/schlep-engine`)
- **Stale CI workflow**: `.github/workflows/go-gateway-ci.yml` references non-existent `go_gateway/` directory (with underscore)
- **Docker Compose confusion**: `infra/vps/docker-compose.production.yml` references a `go-gateway` service, but **context paths don't match**:
  ```yaml
  # References docker/go-gateway/Dockerfile which doesn't exist
  build:
    context: .
    dockerfile: docker/go-gateway/Dockerfile  # ❌ NOT FOUND
  ```
- Production API is now `/cmd/schlep-api` (96 lines, much simpler)

**Comparative Analysis:**

| Feature | go-gateway (Legacy) | schlep-api (Current) |
|---------|---------------------|---------------------|
| Lines of Code | 295 | 96 |
| Module | gateway | schlep-engine |
| Database | GORM + PostgreSQL | Not in main.go |
| Redis | Yes | Not in main.go |
| Focus | Full-featured gateway | Lightweight inference API |

**Status:** ❌ **DEPRECATED**

**Reason:** Replaced by `/cmd/schlep-api`. The legacy gateway had comprehensive features (DB, Redis, auth) that were either migrated to the new architecture or deemed unnecessary for the simplified inference-focused API.

**Recommendation:** **ARCHIVE** - Contains architectural patterns that may be reference-worthy, but not actively used.

---

### 3. web/apps/python-ml-service

**Path:** `/web/apps/python-ml-service/`

**Technology Stack:**
- Python gRPC server
- Protocol Buffers
- JWT authentication
- Model management

**Key Features:**
```python
# From web/apps/python-ml-service/service/server.py
- BatchPredict support
- Model loading/unloading
- GetModelInfo endpoint
- Health checks with detailed metrics
- Authentication interceptor
- Server reflection
```

**Proto Definition:** `/web/apps/python-ml-service/proto/ml_service.proto`
- 6 RPC methods (Predict, BatchPredict, HealthCheck, GetModelInfo, LoadModel, UnloadModel)
- Complex message types with metadata and timeouts

**Analysis:**
- **Active ML client exists** in `/internal/ml/client.go`, but it uses **different proto**:
  ```go
  import pb "github.com/schlep-engine/schlep-engine/proto"
  ```
- **Proto files differ**:
  - **Active proto**: `/adapters/python/python_ml/proto/ml_service.proto` (simplified: 2 RPCs - Predict, HealthCheck)
  - **Legacy proto**: `/web/apps/python-ml-service/proto/ml_service.proto` (full-featured: 6 RPCs)
- **Docker references exist** in `infra/vps/docker-compose.production.yml`, but build context is:
  ```yaml
  build:
    context: ./python_ml  # ❌ NOT /web/apps/python-ml-service
  ```
- The production config expects `/infra/vps/python_ml/` (which doesn't exist), not this legacy service

**Replacement:** `/adapters/python/python_ml/` is the **active, simplified** Python ML service

**Status:** ❌ **DEPRECATED**

**Reason:** Superseded by simplified ML adapter in `/adapters/python/python_ml/`. The legacy version had more features (batch predict, model management) that were deemed unnecessary for Phase 11's streamlined inference requirements.

**Recommendation:** **ARCHIVE** - The BatchPredict and model management patterns may be useful for future phases, but current architecture doesn't need them.

---

### 4. web/apps/web-docs

**Path:** `/web/apps/web-docs/`

**Technology Stack:**
- Next.js 14
- React 18.2
- Tailwind CSS
- TypeScript

**Package Name:** `@schlep-engine/web-docs`

**Content:**
```
web/apps/web-docs/src/app/
├── sdks/ (Go, Python, Rust, Java, CLI, etc.)
├── introduction/ (Quickstart, API Keys, Pricing)
├── changelog/ (v2.1.0, v2.2.0, v2.3.0)
└── security/overview/
```

**Analysis:**
- **Not included** in `/web/pnpm-workspace.yaml`:
  ```yaml
  packages:
    - 'apps/web-landing'  # Only this is active
    - 'packages/*'
  ```
- **No CI/CD workflows** referencing web-docs
- **Not referenced** in Docker configs
- **Dependencies outdated** (Next.js 14.0.0, could be newer)
- **Has node_modules** and `.next` build artifacts (730 MB+)

**Purpose:** Documentation site for Schlep-Engine API, SDKs, and changelogs

**Status:** ❌ **UNUSED**

**Reason:** Not part of active workspace. Documentation may have been moved elsewhere or is being served differently.

**Recommendation:** **EVALUATE CONTENT, THEN ARCHIVE**
- Check if documentation content should be migrated to current docs location
- The SDK documentation pages may contain valuable API reference material
- Once content is reviewed/migrated, the Next.js app can be deleted

---

## Infrastructure References Analysis

### GitHub Actions Workflows

**Stale CI File Found:**
- `.github/workflows/go-gateway-ci.yml` references `go_gateway/` (with underscore)
- This directory **does not exist** (should be `go-gateway` with hyphen, but even that is unused)

**Recommendation:** Delete `.github/workflows/go-gateway-ci.yml`

### Docker Compose Files

**Misleading References in Production Compose:**

File: `infra/vps/docker-compose.production.yml`

```yaml
# Lines 5-8: go-gateway service references non-existent Dockerfile
go-gateway:
  build:
    context: .
    dockerfile: docker/go-gateway/Dockerfile  # ❌ Does not exist

# Lines 99-103: python-ml service references non-existent directory
python-ml:
  build:
    context: ./python_ml  # ❌ Does not exist (should be adapters/python/python_ml?)
    dockerfile: Dockerfile.production
```

**Issue:** These services are defined in production compose but their build contexts don't exist. This suggests:
1. The production docker-compose is **outdated** and not actually used for deployments
2. OR there are missing directories that should exist in `/infra/vps/`

**Recommendation:**
- Update `infra/vps/docker-compose.production.yml` to use correct paths:
  - Remove `go-gateway` service (replaced by active API)
  - Fix `python-ml` to reference `/adapters/python/python_ml/`
- OR delete the entire production compose if not in use

---

## Summary Table

| Component | Path | Status | Active Replacement | Action |
|-----------|------|--------|-------------------|---------|
| **backend** | `web/apps/backend` | ❌ Unused | `/cmd/schlep-api` | **DELETE** |
| **go-gateway** | `web/apps/go-gateway` | ⚠️ Deprecated | `/cmd/schlep-api` | **ARCHIVE** |
| **python-ml-service** | `web/apps/python-ml-service` | ⚠️ Deprecated | `/adapters/python/python_ml/` | **ARCHIVE** |
| **web-docs** | `web/apps/web-docs` | ❌ Unused | Unknown/Migrated | **EVALUATE → ARCHIVE** |

---

## Risk Assessment

### Low Risk (Safe to Delete Immediately)
- ✅ `web/apps/backend` - No references, superseded by Go API
- ✅ `.github/workflows/go-gateway-ci.yml` - References non-existent directory

### Medium Risk (Archive for Reference)
- ⚠️ `web/apps/go-gateway` - Contains useful architectural patterns (auth, rate limiting, caching)
- ⚠️ `web/apps/python-ml-service` - BatchPredict and model management may be needed in future

### Requires Content Review
- 📋 `web/apps/web-docs` - May contain valuable SDK documentation and API reference material

---

## Recommended Action Plan

### Phase 1: Immediate Deletion (Safe)
```bash
# Delete FastAPI backend (no dependencies)
rm -rf web/apps/backend/

# Delete stale CI workflow
rm .github/workflows/go-gateway-ci.yml
```

### Phase 2: Content Review
```bash
# Review web-docs content before archival
# 1. Check if SDK docs exist elsewhere
# 2. Extract any unique documentation
# 3. Archive to docs/archive/web-docs-archive-2025-10-17/
```

### Phase 3: Archival
```bash
# Create archive directory
mkdir -p docs/archive/phase-11-cleanup/

# Move deprecated services to archive
mv web/apps/go-gateway docs/archive/phase-11-cleanup/
mv web/apps/python-ml-service docs/archive/phase-11-cleanup/
mv web/apps/web-docs docs/archive/phase-11-cleanup/

# Update git
git rm -rf web/apps/backend
git rm .github/workflows/go-gateway-ci.yml
git add docs/archive/phase-11-cleanup/
git commit -m "Archive legacy backend components post-Phase 11"
```

### Phase 4: Infrastructure Cleanup
```bash
# Fix or remove outdated docker-compose references
# Edit infra/vps/docker-compose.production.yml:
# - Remove go-gateway service definition
# - Fix python-ml context path to adapters/python/python_ml/
```

---

## Dependencies and Considerations

### No Blocking Dependencies Found
- ✅ No active Go code imports these components
- ✅ No workspace references in pnpm-workspace.yaml
- ✅ No production CI/CD workflows depend on them
- ✅ No current Docker builds reference these paths correctly

### Potential Use Cases for Archived Code
1. **go-gateway patterns**: If future phases need comprehensive auth, rate limiting, or caching middleware, the legacy gateway has well-structured examples
2. **python-ml-service features**: If batch prediction or dynamic model loading becomes a requirement, the legacy service has production-ready implementations
3. **web-docs content**: API documentation and SDK guides may need to be referenced when building new documentation

---

## Conclusion

All four audited components (`backend`, `go-gateway`, `python-ml-service`, `web-docs`) are **no longer part of the active Phase 11 architecture**. They represent earlier iterations of Schlep-Engine that have been replaced by:

- **Go-based inference API** (`/cmd/schlep-api`) - simpler, focused on inference
- **Rust optimizer integration** (`/rust-core/`) - high-performance ML operations
- **Simplified Python ML adapter** (`/adapters/python/python_ml/`) - lightweight gRPC service

### Safe to Proceed
These components can be safely archived or deleted without impacting current functionality. Archiving is recommended over deletion to preserve architectural reference material for future development phases.

---

**Next Steps:** Review and execute the recommended action plan, starting with Phase 1 (immediate safe deletions).
