# Legacy Python Backend Removal Report

**Date:** October 5, 2025
**Phase:** Step 1 - Legacy Code Identification & Removal Plan
**Status:** 🔴 CRITICAL - 867MB of deprecated FastAPI code identified

---

## Executive Summary

The audit identified **867MB** of legacy FastAPI backend code in `./apps/api/` (100,679+ lines of Python) that must be removed as part of the hybrid architecture migration. This legacy monolith is superseded by the Go Gateway + Rust Core + Python ML architecture.

### Scope of Removal

| Component | Path | Size | Status |
|-----------|------|------|--------|
| **Legacy FastAPI Backend** | `./apps/api/` | 867MB | 🔴 REMOVE |
| **Duplicate Backend (packages)** | `./packages/backend/` | TBD | 🔴 REMOVE |
| **Legacy Backend (apps)** | `./apps/backend/` | TBD | 🔴 REMOVE |
| **Python ML Service** | `./apps/python-ml-service/` | <10MB | ✅ KEEP |
| **Go Gateway** | `./go_gateway/` | <5MB | ✅ KEEP |
| **Rust Kernel** | `./rust_kernel/` | <10MB | ✅ KEEP |

---

## 1. Legacy FastAPI Backend Analysis

### 1.1 Directory Structure

```
./apps/api/ (867MB, 100,679+ lines)
├── app/
│   ├── api/              # API endpoints (deprecated)
│   ├── auth/             # 19+ auth files (redundant)
│   ├── ingestion/        # Data ingestion (migrated to Go)
│   ├── hybrid_kernels/   # Rust bridge (duplicate of go_gateway)
│   ├── ml/               # ML ops (superseded by python-ml-service)
│   ├── models/           # Data models (SQLAlchemy)
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   ├── middleware/       # FastAPI middleware
│   ├── security/         # Security modules
│   ├── streaming/        # Real-time processing
│   └── validation/       # Input validation
├── alembic/              # Database migrations
├── tests/                # Test suite (1,363+ files claimed)
├── venv/                 # Virtual environment (huge)
├── rust_compute_kernels/ # Duplicate Rust code
└── working_server.py     # FastAPI entry point (uvicorn)
```

### 1.2 Key Files Identified

**Entry Points (REMOVE):**
- `./apps/api/working_server.py` - FastAPI uvicorn server
- `./apps/api/app/main.py` - FastAPI application (missing, likely in subdirectory)

**Authentication System (19+ files - REMOVE):**
- `./apps/api/app/auth/unified_auth_service.py`
- `./apps/api/app/auth/enhanced_security_system.py`
- `./apps/api/app/auth/oauth_service.py`
- `./apps/api/app/auth/api_key_manager.py`
- `./apps/api/app/auth/enhanced_authentication.py`
- (+ 14 more overlapping implementations)

**Data Ingestion (REMOVE - migrated to Go):**
- `./apps/api/app/ingestion/unified_api.py`
- `./apps/api/app/ingestion/stream_gateway.py`
- `./apps/api/app/ingestion/batch_rest.py`

**Hybrid Kernels (REMOVE - duplicate):**
- `./apps/api/app/hybrid_kernels/rust_bridge.py` (duplicate of go_gateway FFI)
- `./apps/api/app/hybrid_kernels/ml_adapters.py`

**ML Modules (REMOVE - superseded by python-ml-service):**
- `./apps/api/app/ml/` (entire directory)
- `./apps/api/app/models/mlops.py`
- `./apps/api/app/models/automated_retraining.py`
- `./apps/api/app/services/ai_engine.py`
- `./apps/api/app/services/training_pipeline_service.py`

**Rust Compute Kernels (REMOVE - duplicate of rust_kernel/):**
- `./apps/api/rust_compute_kernels/` (entire directory)
- This is a duplicate implementation, superseded by `./rust_kernel/`

### 1.3 Docker Compose References

**Files referencing legacy backend:**

1. **docker-compose.yml** (line 54-99)
   ```yaml
   backend:
     build:
       context: ./apps/api  # ← REMOVE
     container_name: schlep_backend
     ports:
       - "3001:8000"  # ← Conflicts with Go Gateway :8080
   ```

2. **docker-compose.production.yml**
   ```yaml
   backend:
     build:
       context: ./apps/api  # ← REMOVE
   ```

3. **docker-compose.staging.yml**
   ```yaml
   backend:
     build:
       context: ./apps/api  # ← REMOVE
   ```

**Action Required:** Remove all `backend` service definitions referencing `./apps/api`

---

## 2. Duplicate Backend Directories

### 2.1 apps/backend/ vs apps/api/

**Finding:** Two separate backend directories exist:
- `./apps/api/` (867MB) - Main FastAPI application
- `./apps/backend/` (size TBD) - Appears to be duplicate or older version

**Investigation Needed:**
```bash
find ./apps/backend -type f -name "*.py" | wc -l
du -sh ./apps/backend
```

**Preliminary Assessment:** Likely a duplicate that should be removed

### 2.2 packages/backend/

**Finding:** Third backend directory in packages
- `./packages/backend/` - Purpose unclear

**Action:** Investigate and remove if redundant

---

## 3. What to KEEP

### 3.1 Python ML Service (CRITICAL - DO NOT REMOVE)

```
./apps/python-ml-service/
├── service/
│   └── server.py          # ✅ KEEP - gRPC ML server (377 lines)
├── orchestration/
│   └── training_orchestrator.py  # ✅ KEEP
├── proto/                 # ✅ KEEP - Protobuf definitions
└── Dockerfile             # ✅ KEEP
```

**Verification:** This is the ONLY Python service that should remain active.

**Dependencies:**
- No dependencies on `./apps/api/`
- Standalone gRPC service
- Used by Go Gateway via gRPC client

### 3.2 Test Files Worth Preserving

**Challenge:** 1,363+ test files exist, mostly for legacy FastAPI

**Recommendation:**
1. Archive integration tests that verify expected behavior
2. Move to `./archive/legacy-tests/` for reference
3. Rewrite critical tests for Go Gateway endpoints

**DO NOT blindly delete all tests** - extract business logic validation first

---

## 4. Database Migration Concerns

### 4.1 Alembic Migrations

**Path:** `./apps/api/alembic/`

**Risk:** Database schema migrations may be required for production data

**Action Required BEFORE removal:**
1. ✅ Backup current database schema
2. ✅ Export alembic migration history
3. ✅ Verify Go Gateway uses same PostgreSQL schema
4. ✅ Create migration path if schema diverged

**Command:**
```bash
# Export schema
pg_dump -h localhost -U schlep_user --schema-only schlep_engine > schema_backup.sql

# List alembic revisions
cd ./apps/api && alembic history
```

### 4.2 Data Models

**Path:** `./apps/api/app/models/`

**Risk:** SQLAlchemy models define database schema

**Question:** Does Go Gateway have equivalent database layer?

**Finding from audit:** No database models visible in `go_gateway/`

**CRITICAL ACTION:**
- If Go Gateway needs database access, extract SQLAlchemy models to shared library
- OR reimplement in Go using GORM/sqlx
- Do NOT remove models until Go has database access

---

## 5. Cross-Dependency Analysis

### 5.1 SDK Dependencies

**Finding:** SDKs in `./packages/` likely import from `apps.api`

**Test:**
```bash
grep -r "from apps.api\|import apps.api" ./packages/ --include="*.py"
```

**Risk:** Removing `./apps/api/` will break SDK imports

**Action:**
1. Update SDK imports to target Go Gateway REST API
2. Remove Python SDK dependencies on FastAPI internals
3. Regenerate SDKs from OpenAPI spec (once Go Gateway provides one)

### 5.2 Internal Cross-References

**Test:**
```bash
grep -r "from apps.api" ./apps --include="*.py"
```

**Finding:** No results (Python ML service is independent)

**Conclusion:** `./apps/python-ml-service/` has no dependencies on legacy backend ✅

---

## 6. Security & Secrets Audit

### 6.1 Secrets in Legacy Code

**Risk:** Hardcoded secrets, API keys, or credentials in `./apps/api/`

**Required Scan:**
```bash
# Scan for secrets before deletion
grep -r "password\|secret\|api_key" ./apps/api/app --include="*.py" | grep -v "test\|example"
```

**Action:** Extract any production secrets to vault/env vars BEFORE deletion

### 6.2 OAuth Configuration

**Path:** `./apps/api/app/auth/oauth_service.py`

**Risk:** OAuth client configurations may be needed

**Action:**
1. Extract OAuth provider configs (Google, GitHub)
2. Port to Go Gateway auth middleware
3. Do NOT lose OAuth client IDs/secrets

---

## 7. Removal Strategy

### 7.1 Safe Removal Process

**CRITICAL:** Do NOT execute `rm -rf ./apps/api` without preparation

**Step-by-Step Process:**

#### Step 1: Create Archive (BEFORE deletion)
```bash
# Archive to separate location
mkdir -p ./archive/legacy-fastapi-backend
cp -r ./apps/api ./archive/legacy-fastapi-backend/
tar -czf ./archive/legacy-fastapi-backend-$(date +%Y%m%d).tar.gz ./apps/api/
```

#### Step 2: Extract Critical Components
```bash
# Database migrations
cp -r ./apps/api/alembic ./migration-archive/

# Important configs
cp ./apps/api/.env.example ./configs/legacy-env-reference.txt
cp ./apps/api/requirements.txt ./configs/legacy-requirements.txt

# Test suite (for reference)
cp -r ./apps/api/tests ./archive/legacy-tests/
```

#### Step 3: Update Docker Compose Files
```bash
# Remove backend service from:
# - docker-compose.yml
# - docker-compose.production.yml
# - docker-compose.staging.yml
```

#### Step 4: Verify ML Service Still Works
```bash
# Test Python ML service independently
docker-compose -f docker-compose.hybrid.yml up python-ml
```

#### Step 5: Remove Legacy Backend
```bash
# Only after Steps 1-4 complete
rm -rf ./apps/api/
```

#### Step 6: Clean Up Duplicate Directories
```bash
# Investigate and remove if redundant
rm -rf ./apps/backend/
rm -rf ./packages/backend/
```

### 7.2 Rollback Plan

**If removal causes issues:**

```bash
# Restore from archive
tar -xzf ./archive/legacy-fastapi-backend-$(date +%Y%m%d).tar.gz
mv ./apps/api ./apps/api-restored
```

**Git Safety:**
```bash
# Create checkpoint BEFORE removal
git checkout -b pre-legacy-removal
git add -A
git commit -m "Checkpoint before legacy backend removal"

# Create removal branch
git checkout -b remove-legacy-fastapi
# Execute removal
# Test thoroughly
# Only merge to main after validation
```

---

## 8. Validation Checklist

**Before removing legacy backend, verify:**

- [ ] Archive created and compressed
- [ ] Database migrations extracted
- [ ] OAuth configs ported to Go Gateway
- [ ] Critical test cases documented
- [ ] No SDK dependencies on `apps.api`
- [ ] Python ML service tested independently
- [ ] Docker compose files updated
- [ ] Environment variables migrated
- [ ] No hardcoded secrets lost
- [ ] Git checkpoint created
- [ ] Team notified of removal

**After removal, verify:**

- [ ] Go Gateway starts successfully
- [ ] Python ML service starts successfully
- [ ] Rust kernel loads in Go Gateway
- [ ] gRPC communication works (Go → Python)
- [ ] Database connection works (if Go uses it)
- [ ] Redis connection works
- [ ] Health checks pass
- [ ] Basic API requests succeed
- [ ] No import errors in remaining code
- [ ] Docker builds successfully

---

## 9. Estimated Impact

### 9.1 Disk Space Recovered

| Component | Size | Recovery |
|-----------|------|----------|
| ./apps/api/ | 867MB | 100% |
| ./apps/api/venv/ | ~600MB | 100% |
| ./apps/backend/ | TBD | 100% |
| ./packages/backend/ | TBD | 100% |
| **Total Estimated** | **~1GB** | **100%** |

### 9.2 Code Reduction

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Python LOC | 155,876+ | ~2,000 | 98.7% |
| Services | 5 (FastAPI, Go, Rust, Python ML, legacy backend) | 3 (Go, Rust, Python ML) | 40% |
| Docker services | 10+ | 8 | 20% |
| Python dependencies | 200+ | ~20 | 90% |

### 9.3 Maintenance Burden Reduction

**Before:**
- 2 Python backends (FastAPI + Python ML)
- Conflicting auth systems (19+ files)
- Duplicate Rust kernels
- Multiple docker-compose files
- Unclear service ownership

**After:**
- 1 Python service (ML only)
- Single auth system (Go Gateway JWT)
- Single Rust kernel
- Consolidated docker-compose
- Clear service boundaries

---

## 10. Next Steps

### 10.1 Immediate Actions (This Sprint)

1. **Execute Archive Process** (1 hour)
   - Create compressed archive of `./apps/api/`
   - Store in `./archive/` with timestamp
   - Verify archive integrity

2. **Extract Database Migrations** (2 hours)
   - Export alembic migration history
   - Backup PostgreSQL schema
   - Document schema version

3. **Port OAuth Configs** (4 hours)
   - Extract Google/GitHub OAuth client IDs
   - Implement JWT middleware in Go Gateway (see Step 2)
   - Test OAuth flow

4. **Update Docker Compose** (2 hours)
   - Remove `backend` service from all compose files
   - Consolidate into single `docker-compose.production.yml`
   - Verify services still communicate

5. **Test ML Service Independence** (2 hours)
   - Start Python ML service standalone
   - Verify gRPC server responds
   - Test prediction endpoint from Go Gateway

### 10.2 Execution Timeline

| Task | Duration | Blocker? |
|------|----------|----------|
| Create archive | 1 hour | No |
| Extract migrations | 2 hours | No |
| Port OAuth configs | 4 hours | **YES** - blocks removal |
| Update docker-compose | 2 hours | No |
| Test ML service | 2 hours | **YES** - blocks removal |
| Remove ./apps/api/ | 30 min | Requires all above |
| Validate post-removal | 4 hours | Critical |
| **Total** | **15.5 hours** | **~2 days** |

### 10.3 Dependencies for Step 2 (Security Implementation)

**Removal blocked by:**
- JWT middleware implementation (Go Gateway)
- OAuth provider configuration
- Secrets migration from .env to vault

**Recommendation:** Execute Step 1 archive/extraction tasks now, defer actual removal until Step 2 (security) is complete.

---

## 11. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Lost database migrations | 🔴 CRITICAL | Archive alembic/ before removal |
| Broken SDKs | 🔴 CRITICAL | Update SDK imports, regenerate from OpenAPI |
| Lost OAuth configs | 🟡 HIGH | Extract to environment variables |
| Test coverage loss | 🟡 HIGH | Archive tests, document critical flows |
| Rollback difficulty | 🟡 HIGH | Git checkpoint + tar archive |
| Lost business logic | 🟢 MEDIUM | Code review before removal |
| Secrets exposure | 🟢 MEDIUM | Scan for hardcoded secrets |

---

## 12. Conclusion

**Status:** READY for controlled removal

**Blockers:**
1. OAuth configuration extraction
2. JWT middleware implementation (Step 2)
3. Database migration verification

**Recommendation:**
1. ✅ Execute archive process NOW (non-destructive)
2. ✅ Extract migrations NOW (non-destructive)
3. ⏸️ DEFER actual removal until Step 2 (Security) complete
4. ✅ Use archived code as reference during Go Gateway development

**Next Report:** `SECURITY_FIX_SUMMARY.md` (Step 2)

---

**Report Generated:** October 5, 2025
**Audit Reference:** [CTO_TECHNICAL_AUDIT_REPORT.md](CTO_TECHNICAL_AUDIT_REPORT.md)
**Status:** ⏸️ PAUSED - Awaiting security implementation before removal execution
