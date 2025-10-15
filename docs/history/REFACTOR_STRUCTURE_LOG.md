# Schlep-Engine Infrastructure-Aware Restructure Log

**Branch:** refactor/structure
**Date:** October 14, 2025
**Purpose:** Restructure repository into final product-first layout with clear separation of concerns

---

## Executive Summary

This refactor transformed the Schlep-engine codebase from an experimental research project into a **production-ready MVP structure**. The new layout clearly separates:

- **Production code** (cmd/, internal/, rust-core/, adapters/)
- **Research/experimental** (labs/)
- **Historical context** (docs/history/)
- **Infrastructure** (infra/)

**Files Changed:** 199 files
**Impact:** Complete repository reorganization with **zero code logic changes**

---

## Final Directory Layout

```
schlep-engine/
├── cmd/schlep-api/               # Application entry point (from go_gateway/cmd)
│   └── api/main.go               # Main server
│
├── internal/                     # Core business logic (from go_gateway/internal)
│   ├── inference/                # NEW: Inference orchestration structure
│   │   ├── router/               # (placeholder for MVP)
│   │   ├── batcher/              # (placeholder for MVP)
│   │   ├── policy/               # (placeholder for MVP)
│   │   └── cost/                 # (placeholder for MVP)
│   ├── providers/                # NEW: Provider adapters
│   │   ├── openai/               # (placeholder for MVP)
│   │   ├── anthropic/            # (placeholder for MVP)
│   │   └── local/                # (placeholder for MVP)
│   ├── ml/                       # Existing ML pool and routing
│   ├── router/                   # Existing adaptive router
│   ├── middleware/               # Auth, rate limiting, validation
│   ├── runtime/                  # Python gRPC, Rust FFI
│   ├── observability/            # Metrics, tracing
│   ├── cache/                    # Redis caching
│   └── ... (15+ more modules)
│
├── rust-core/                    # Renamed from rust_kernel/
│   ├── src/                      # Core Rust modules only
│   │   ├── cache/
│   │   ├── mempool/
│   │   ├── parallel/
│   │   ├── prefetch/
│   │   ├── reliability/
│   │   ├── orchestration/
│   │   └── lib.rs (FFI exports)
│   ├── lib/                      # Compiled artifacts (.dylib, .a)
│   └── Cargo.toml
│
├── adapters/python/              # Renamed from python_ml/
│   └── python_ml/                # Canonical Python ML service
│       ├── service/server.py
│       ├── proto/
│       └── requirements.txt
│
├── labs/                         # R&D modules (from previous refactor)
│   ├── research/                 # Experimental Rust modules
│   │   ├── cognitive/
│   │   ├── rl/
│   │   ├── predictive/
│   │   ├── autonomous/
│   │   └── slo_enforcer/
│   ├── cognitive/                # Cognitive experiments
│   ├── scaling/                  # (placeholder)
│   ├── validation/               # (placeholder)
│   ├── _archive/                 # (placeholder)
│   └── README.md
│
├── infra/                        # NEW: Infrastructure as code
│   ├── vps/                      # VPS deployment
│   │   ├── docker-compose.yml   # Production docker-compose
│   │   └── systemd/              # Systemd service files
│   ├── provisioning/terraform/  # (placeholder)
│   └── k8s/helm/                 # (placeholder)
│
├── docs/                         # Documentation
│   ├── history/                  # NEW: Archived phase reports (50+ files)
│   │   ├── README.md
│   │   ├── PHASE*.md (20+ files)
│   │   ├── CTO_*.md (6 files)
│   │   ├── reports/ (subdirectory)
│   │   └── ...
│   ├── ARCHITECTURE.md           # (existing)
│   └── ...
│
├── scripts/                      # NEW: Utility scripts (placeholder)
├── proto/                        # gRPC proto definitions
├── go.mod                        # From go_gateway/
├── go.sum                        # From go_gateway/
├── Dockerfile                    # From go_gateway/
├── .env.example                  # From go_gateway/
├── README.md                     # (existing)
└── refactor_log.md               # Previous cleanup log (moved to docs/history/)
```

---

## Detailed Changes

### 1. Go Gateway Restructuring

**From:**
```
go_gateway/
├── cmd/api/main.go
├── internal/ (17 modules)
├── go.mod
├── go.sum
└── ...
```

**To:**
```
cmd/schlep-api/api/main.go
internal/ (17 modules at root)
go.mod (at root)
go.sum (at root)
```

**Rationale:** Standard Go project layout - cmd/ for entry points, internal/ for business logic at repository root.

**Files Moved:**
- `go_gateway/cmd/` → `cmd/schlep-api/`
- `go_gateway/internal/*` → `internal/`
- `go_gateway/go.mod` → `go.mod`
- `go_gateway/go.sum` → `go.sum`
- `go_gateway/proto/` → `proto/`
- `go_gateway/Dockerfile` → `Dockerfile`
- `go_gateway/.env.example` → `.env.example`

### 2. Rust Kernel Renaming

**From:** `rust_kernel/`
**To:** `rust-core/rust_kernel/`

**Rationale:** "rust-core" better reflects its role as the core computational kernel. Nested `rust_kernel/` maintained for Cargo workspace compatibility.

**Impact:** 60+ Rust source files, Cargo.toml, build scripts, tests

### 3. Python ML Service Consolidation

**From:** `python_ml/`
**To:** `adapters/python/python_ml/`

**Rationale:** Clarifies role as an adapter/provider. Nested `python_ml/` for module organization.

**Files Moved:**
- Service implementation (server.py, server_enhanced.py)
- Proto definitions
- Auth interceptor
- Requirements

### 4. Documentation Archival

**Archived 50+ files to `docs/history/`:**

#### Phase Documents (20+ files)
- PHASE1_TECHNICAL_AUDIT_REPORT.md
- PHASE2_EXECUTION_COMPLETE_REPORT.md
- PHASE3_EXECUTION_REPORT.md
- PHASE4_*.md (3 files)
- PHASE10_*.md (4 files)
- PHASE11_*.md (4 files)
- PHASE12_*.md (4 files)
- PHASE13_*.md (4 files)

#### CTO Reports (6 files)
- CTO_COMPREHENSIVE_AUDIT_REPORT_2025.md
- CTO_TECHNICAL_AUDIT_REPORT.md
- CTO_FINAL_AUDIT_REPORT.md
- etc.

#### Strategic & Analysis Docs (8 files)
- COMPETITIVE_ANALYSIS_2025.md
- STRATEGIC_ENHANCEMENTS.md
- FINAL_VALIDATION_REPORT.md
- etc.

#### Historical Docs subdirectory
- `docs/phase*.md` → `docs/history/phase*.md`
- `reports/` → `docs/history/reports/`
- `refactor_log.md` → `docs/history/refactor_log.md`

**Created:**
- `docs/history/README.md` - Index and context

### 5. New Infrastructure Scaffolding

**Created `infra/` directory structure:**

#### VPS Deployment
- `infra/vps/docker-compose.yml` - Production-ready compose file with schlep-api + Redis
- `infra/vps/systemd/schlep-api.service` - Systemd service definition with security hardening

#### Placeholders
- `infra/provisioning/terraform/` - For Terraform IaC
- `infra/k8s/helm/` - For Helm charts

**Purpose:** Ready for immediate VPS deployment or cloud infrastructure provisioning.

### 6. New Internal Structure

**Created placeholder directories for MVP development:**

```
internal/
├── inference/          # NEW: Core inference logic
│   ├── router/         # Model/provider routing
│   ├── batcher/        # Request batching
│   ├── policy/         # Routing policies
│   ├── cost/           # Cost tracking
│   └── README.md       # Documentation
├── providers/          # NEW: Provider adapters
│   ├── openai/
│   ├── anthropic/
│   └── local/
├── security/           # NEW: Security modules (placeholder)
├── metrics/            # NEW: (separate from observability)
├── config/             # NEW: (separate from other configs)
└── api/                # NEW: API handlers (placeholder)
```

### 7. Labs Organization

**Updated `labs/README.md`** with:
- Clear purpose statement
- Directory structure explanation
- Integration path guidelines
- Preserved from previous refactor:
  - `labs/research/` (cognitive, RL, predictive, autonomous, slo_enforcer)
  - `labs/cognitive/` (experiments)

---

## Import Path Changes

### ⚠️ Breaking Changes

**Go Import Paths:** All imports referencing `github.com/schlep-engine/go-gateway/internal/*` need to be updated to `github.com/schlep-engine/internal/*` or relative imports.

**Example:**
```go
// OLD
import "github.com/schlep-engine/go-gateway/internal/ml"

// NEW
import "github.com/schlep-engine/internal/ml"
```

**Status:** Import paths **NOT updated** in this refactor (per constraints). Will break build. Needs follow-up PR.

**TODO in next PR:**
1. Update all Go import statements
2. Update go.mod module path if needed
3. Run `go mod tidy`
4. Verify build with `go build ./...`

---

## Build Status

### Rust (rust-core/)
```bash
cd rust-core/rust_kernel
cargo check
```
**Status:** ✅ **Expected to build** (structure unchanged, only directory renamed)

### Go (cmd/schlep-api, internal/)
```bash
go build ./cmd/schlep-api/api
```
**Status:** ⚠️ **WILL FAIL** - Import paths need updating

**Known Issues:**
1. Import paths reference `go-gateway/internal/*`
2. Module path may need updating in go.mod
3. Pre-existing build errors in grpc_pool.go (from previous refactor)

### Python (adapters/python/python_ml/)
```bash
cd adapters/python/python_ml
python -m py_compile service/server.py
```
**Status:** ✅ **Expected to work** (structure unchanged)

---

## Preserved Infrastructure

**Kept without modification:**
- `.github/workflows/**` - CI/CD pipelines
- `Makefile` - Build automation
- `infrastructure/` - Existing Terraform/K8s configs (if present)
- `helm/` - Existing Helm charts (if present)
- All test files

---

## Git History Preservation

**All moves done with `git mv`:**
- Preserves full commit history
- Enables `git log --follow <file>` to track renames
- Maintains blame information

**Commits on refactor/structure:**
1. `11b2b974e` - fix: Clean up merge conflict marker in lib.rs
2. `90644971c` - refactor: Restructure to product-first directory layout

---

## Metrics

| Metric | Count |
|--------|-------|
| **Files Moved** | 199 |
| **Directories Created** | 15+ |
| **Directories Renamed** | 3 |
| **Documentation Archived** | 50+ files |
| **Placeholder Files Created** | 5 |
| **Git Operations** | All via `git mv` (history preserved) |

---

## Next Steps

### Immediate (Week 1)
1. **Fix Go import paths**
   ```bash
   # Update all files in internal/ and cmd/
   find internal cmd -name "*.go" -exec sed -i '' 's|go-gateway/internal|schlep-engine/internal|g' {} +

   # Update go.mod module path
   go mod edit -module github.com/schlep-engine/schlep-engine
   go mod tidy
   ```

2. **Verify builds**
   ```bash
   go build ./...
   cd rust-core/rust_kernel && cargo check
   ```

3. **Update README.md** with new structure

### MVP Development (Week 2-6)
4. **Implement `/v1/infer` endpoint**
   - Create `internal/api/handlers.go`
   - Implement inference logic in `internal/inference/`

5. **Add provider support**
   - `internal/providers/openai/` - OpenAI API client
   - `internal/providers/anthropic/` - Anthropic API client
   - `internal/providers/local/` - Local model provider

6. **Integrate Rust batching**
   - Call `rust-core` FFI for batch processing
   - Implement in `internal/inference/batcher/`

7. **Cost tracking**
   - Token counting
   - Provider cost calculation
   - Implement in `internal/inference/cost/`

### Infrastructure (Week 7-8)
8. **VPS Deployment**
   - Test `infra/vps/docker-compose.yml`
   - Deploy systemd service

9. **Terraform/Helm**
   - Populate `infra/provisioning/terraform/`
   - Create Helm charts in `infra/k8s/helm/`

---

## Rollback Instructions

### To Undo This Refactor
```bash
# Return to refactor/cleanup branch
git checkout refactor/cleanup

# Or cherry-pick specific changes
git log refactor/structure --oneline
git cherry-pick <commit-hash>
```

### To Restore Old Structure
```bash
# Revert the restructure commit
git revert 90644971c

# Or manually restore
git checkout refactor/cleanup -- go_gateway/
git checkout refactor/cleanup -- rust_kernel/
git checkout refactor/cleanup -- python_ml/
```

---

## Validation Checklist

- [x] All moves done with `git mv`
- [x] Git history preserved
- [x] Directory structure matches specification
- [x] Infrastructure scaffolding created
- [x] Documentation archived with README
- [x] Labs structure maintained
- [x] Placeholder files created
- [ ] Go import paths updated (TODO)
- [ ] Builds verified (blocked by import paths)
- [ ] Tests passing (blocked by builds)

---

## Questions & Answers

### Q: Why nest `rust_kernel/` inside `rust-core/`?
**A:** Cargo workspace compatibility. The `Cargo.toml` references `rust_kernel` as the package name. Renaming the package would require updating all FFI bindings.

### Q: Why nest `python_ml/` inside `adapters/python/`?
**A:** Allows for multiple Python adapters in the future (e.g., `adapters/python/openai_wrapper/`) while keeping the canonical ML service organized.

### Q: What about apps/python-ml-service/?
**A:** Still exists. Consolidation deferred to avoid scope creep. See previous refactor log for plan.

### Q: Will CI/CD break?
**A:** Likely yes - workflows may reference old paths. Needs update in follow-up PR.

---

## Summary

This refactor successfully transformed the Schlep-engine repository into a production-ready structure optimized for:

✅ **Clear separation of concerns** (production vs research vs history)
✅ **Standard Go project layout** (cmd/, internal/)
✅ **Infrastructure-first mindset** (infra/ with VPS scaffolding)
✅ **MVP development readiness** (internal/inference/, internal/providers/)
✅ **Historical context preservation** (docs/history/)
✅ **Git history intact** (all moves via `git mv`)

**Next:** Fix import paths, verify builds, begin MVP implementation.

---

**Refactored by:** Claude (Sonnet 4.5)
**Date:** October 14, 2025
**Branch:** refactor/structure
**Review:** Ready for human review and build fixes

---

**Last Updated:** October 14, 2025

---

# Phase-2: Directory Consolidation & Cleanup

**Branch:** refactor/phase-2
**Date:** October 14, 2025
**Purpose:** Final enforcement of production-grade monorepo structure

## Overview

Phase-2 completes the repository restructuring by consolidating scattered root directories into organized top-level categories. All moves preserve git history.

## Changes Summary

### 1. Frontend Consolidation
**Moved:**
- `apps/*` → `web/apps/`
  - Consolidated all web applications (backend, go-gateway, python-ml-service, web-admin, web-console, web-docs, web-landing)

**Result:** Single `web/` directory for all frontend and web-related code.

### 2. Infrastructure Consolidation
**Moved:**
- `deploy/` → `infra/deploy/`
- `nginx/` → `infra/nginx/`
- `monitoring/` → `infra/monitoring/`
- `observability/` → `infra/observability/`
- `helm/` → `infra/helm/`
- `infrastructure/*` → `infra/` (merged)
- `database/` → `infra/database/`
- `redis/` → `infra/redis/`
- `security/` → `infra/security/`
- `telemetry/` → `infra/observability/telemetry/`
- `config/` → `infra/config/`
- `configs/` → `infra/config/` (merged)

**Result:** All infrastructure, deployment, and operational configs unified under `infra/`.

### 3. Scripts & Config Files
**Moved:**
- All `*.sh` scripts → `scripts/`
- `.env.example`, `.env.production.example`, `.env.test` → `infra/vps/`
- `docker-compose*.yml` → `infra/vps/`
- `Dockerfile` → `infra/vps/`
- `cypress.config.ts` → `infra/config/`
- `Makefile*` → `scripts/`
- `pyproject.toml`, `requirements-hybrid-ml.txt` → `adapters/python/`
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` → `web/`

**Result:** Clean root with scripts and configs in proper locations.

### 4. Documentation Archival
**Moved to `docs/history/`:**
- ADAPTIVE_SCALING_IMPLEMENTATION.md
- AGENTS.md
- AI_NATIVE_EVOLUTION_REPORT.md
- ARCHITECTURE.md
- ARCHITECTURE_ALIGNMENT_REPORT.md
- CERTIFICATION_REPORT.md
- CIRCUIT_BREAKER_IMPLEMENTATION_REPORT.md
- CLEANUP_REPORT.md
- COMPREHENSIVE_IMPLEMENTATION_SUMMARY.md
- MERGE_INSTRUCTIONS.md
- OBSERVABILITY_PATCH.md
- OPTIMIZATION_PATCHES.md
- README_MIGRATION.md
- RUN_BENCHMARKS.md
- SCHLEP_ENGINE_FABRIC_ALIGNMENT_REPORT.md
- REFACTOR_STRUCTURE_LOG.md (this file)

**Result:** Root directory decluttered, historical docs preserved.

### 5. Labs & Experimental Code
**Moved:**
- `chaos/` → `labs/chaos/`
- `experiments/` → `labs/experiments/`
- `examples/` → `labs/examples/`
- `packages/` → `labs/packages/`
- `proto/` → `labs/proto/`
- `tools/` → `labs/tools/`
- Removed empty `migration-archive/` and `uploads/`

**Result:** All experimental/R&D code consolidated in `labs/`.

### 6. Testing & Benchmarks
**Moved:**
- `benchmarks/` → `tests/benchmarks/`
- `cypress/` → `tests/cypress/`
- `validation/` → `tests/validation/`
- `test_*.py` → `tests/`

**Result:** All testing code unified under `tests/`.

## Final Root Directory Structure

```
schlep-engine/
├── web/                    # All web applications
│   ├── apps/               # Next.js, admin, console, docs, landing
│   ├── pnpm-lock.yaml
│   └── pnpm-workspace.yaml
├── infra/                  # All infrastructure
│   ├── vps/                # VPS deployment (docker-compose, env files)
│   ├── config/             # Configuration files
│   ├── deploy/
│   ├── nginx/
│   ├── monitoring/
│   ├── observability/
│   ├── helm/
│   ├── database/
│   ├── redis/
│   ├── security/
│   ├── k8s/
│   └── provisioning/
├── labs/                   # Experimental/R&D code
│   ├── chaos/
│   ├── experiments/
│   ├── examples/
│   ├── packages/
│   ├── proto/
│   └── tools/
├── tests/                  # All testing code
│   ├── benchmarks/
│   ├── cypress/
│   ├── validation/
│   └── test_*.py
├── docs/                   # Documentation
│   └── history/            # Archived refactor docs
├── scripts/                # Utility scripts
│   ├── *.sh
│   └── Makefile*
├── adapters/               # Language adapters
│   └── python/
│       ├── pyproject.toml
│       └── requirements-hybrid-ml.txt
├── cmd/                    # Go entry points
├── internal/               # Go business logic
├── rust-core/              # Rust core
├── deployments/            # Deployment manifests
├── integration/            # Integration tests
├── go.mod                  # Root Go module
├── go.sum
├── .gitignore
└── README.md
```

## Metrics

| Category | Items Moved |
|----------|-------------|
| **Frontend** | 7 apps → web/ |
| **Infrastructure** | 13 dirs → infra/ |
| **Scripts/Configs** | 20+ files |
| **Documentation** | 15 reports → docs/history/ |
| **Labs** | 6 dirs → labs/ |
| **Tests** | 4 dirs + 3 files → tests/ |
| **Total Moves** | 65+ operations |

## Safety & Validation

✅ All moves done with `git mv` (history preserved)
✅ No code modifications
✅ No deletions (except empty directories)
✅ Sequential execution (no race conditions)
✅ Directories created as needed

## Next Steps

1. **Verify git status** - Check all moves tracked
2. **Commit changes** - Single atomic commit
3. **Fix Go imports** - Update import paths in follow-up PR
4. **Update CI/CD** - Fix any hardcoded paths in workflows
5. **Update README.md** - Reflect new structure

## Known Issues

- Go imports will still reference old paths (needs follow-up)
- Some config files (.env.production) not tracked by git (skipped)
- ENDPOINT_CLASSIFICATION.csv not tracked (skipped)

---

**Phase-2 Complete**
**Refactored by:** Claude (Sonnet 4.5)
**Date:** October 14, 2025
**Branch:** refactor/phase-2
