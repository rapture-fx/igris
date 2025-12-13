# GitHub Actions Migration Notice

**Date:** October 4, 2025
**Status:** FastAPI Removal Complete - CI/CD Pipelines Need Updates

---

## ⚠️ Action Required

The following GitHub Actions workflows reference the **legacy FastAPI service** which has been **removed** from the codebase (October 2025). These workflows need to be updated to use the **Go Gateway** instead.

---

## Affected Workflows

### 1. **docker-build.yml**
**Issue:** References `apps/api/Dockerfile` (removed)
**Action:** Update to build Go Gateway (`go_gateway/Dockerfile`)

```yaml
# OLD (FastAPI)
file: ./apps/api/Dockerfile

# NEW (Go Gateway)
file: ./go_gateway/Dockerfile
```

---

### 2. **blue-green-deployment.yml**
**Issue:** References `apps/api/Dockerfile` (removed)
**Action:** Update to deploy Go Gateway containers

```yaml
# OLD (FastAPI)
dockerfile: apps/api/Dockerfile

# NEW (Go Gateway)
dockerfile: go_gateway/Dockerfile
```

---

### 3. **deploy-production.yml**
**Issue:** References `apps/api/Dockerfile.production` (removed)
**Action:** Update to use Go Gateway production build

```yaml
# OLD (FastAPI)
file: apps/api/Dockerfile.production

# NEW (Go Gateway)
file: go_gateway/Dockerfile
```

---

### 4. **quality.yml**
**Issue:** Builds FastAPI Docker image (removed)
**Action:** Update to build Go Gateway image

```yaml
# OLD (FastAPI)
run: docker build . -f apps/api/Dockerfile -t igris-overture-image

# NEW (Go Gateway)
run: docker build . -f go_gateway/Dockerfile -t schlep-gateway-image
```

---

### 5. **performance-baseline.yml**
**Issue:** Starts FastAPI with `uvicorn` (removed)
**Action:** Update to start Go Gateway

```yaml
# OLD (FastAPI)
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# NEW (Go Gateway)
./go_gateway/bin/gateway &
```

---

## Migration Checklist

- [ ] Update `docker-build.yml` to use Go Gateway Dockerfile
- [ ] Update `blue-green-deployment.yml` for Go Gateway deployment
- [ ] Update `deploy-production.yml` to deploy Go Gateway
- [ ] Update `quality.yml` to build Go Gateway image
- [ ] Update `performance-baseline.yml` to run Go Gateway
- [ ] Remove FastAPI-specific test workflows (if any)
- [ ] Update deployment scripts to reference Go Gateway
- [ ] Test CI/CD pipeline on feature branch before merging

---

## Architecture Reference

### Before (FastAPI Monolith)
```
apps/api/
├── Dockerfile
├── Dockerfile.production
├── app/main.py (uvicorn entrypoint)
└── requirements.txt
```

### After (Go Gateway)
```
go_gateway/
├── Dockerfile
├── cmd/api/main.go (Fiber entrypoint)
└── go.mod
```

---

## Rollback Procedure

If CI/CD changes cause issues:

```bash
# Restore FastAPI service temporarily
git checkout archive/fastapi-legacy -- apps/api/

# Rebuild Docker image
docker build -f apps/api/Dockerfile -t igris-overture .

# Redeploy
docker-compose up -d backend
```

See [docs/LEGACY/fastapi-archive.md](../../docs/LEGACY/fastapi-archive.md) for full rollback instructions.

---

## Documentation

- **Architecture:** [docs/ARCHITECTURE_ANALYSIS_REPORT.md](../../docs/ARCHITECTURE_ANALYSIS_REPORT.md)
- **Deployment:** [docs/EXECUTION_GUIDE.md](../../docs/EXECUTION_GUIDE.md)
- **Cleanup:** [CLEANUP_REPORT.md](../../CLEANUP_REPORT.md)

---

**Next Steps:** Update workflows above and test on staging before production deployment.
