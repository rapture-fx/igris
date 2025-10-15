# Structure Stabilization Log - schlep-engine MVP Preparation

**Date:** 2025-10-15  
**Task:** Repository Stabilization for MVP Development  
**Module:** github.com/schlep-engine/schlep-engine  
**Status:** ✓ Major Cleanup Complete - Ready for /v1/infer Development

---

## Executive Summary

Successfully stabilized the schlep-engine repository by:
- ✅ Fixed all Go import paths from legacy `go-gateway` module
- ✅ Added missing dependencies (Vault API, Redis v8)
- ✅ Cleaned up root directory structure
- ✅ Moved infrastructure files to proper locations
- ⚠️ Identified remaining build issues for manual review

---

## Phase 1: Go Import Path Migration

### Objective
Replace all legacy `go-gateway` module references with new `schlep-engine` structure.

### Actions Taken
**Files Updated (6 total):**

1. `labs/tools/cache_warmer/warmer.go`
   - OLD: `github.com/schlep-engine/go-gateway/internal/cache`
   - NEW: `github.com/schlep-engine/schlep-engine/web/apps/go-gateway/internal/cache`

2. `tests/cache_integration_test.go`
   - Updated import paths to reflect new module structure

3. `web/apps/go-gateway/internal/edge/edge_router.go`
   - Fixed proto imports

4. `web/apps/go-gateway/internal/handlers/predict_cached.go`
   - Updated cache and ML client imports

5. `web/apps/go-gateway/internal/ml/client.go`
   - Updated proto package imports

6. `web/apps/go-gateway/internal/ml/client_lb.go`
   - Updated proto package imports

### Validation
```bash
grep -r "github.com/schlep-engine/go-gateway" --include="*.go" .
# Result: All references successfully replaced
```

---

## Phase 2: Dependency Management

### Dependencies Added

1. **HashiCorp Vault API** (v1.22.0)
   ```bash
   go get github.com/hashicorp/vault/api@latest
   ```
   - Added 16 transitive dependencies
   - Required for secrets management integration

2. **Redis v8** (v8.11.5)
   ```bash
   go get github.com/go-redis/redis/v8@latest
   ```
   - Maintains compatibility with legacy code using v8
   - Repository already has v9 (github.com/redis/go-redis/v9)

### Module Verification
```bash
go mod verify
# Result: all modules verified
```

---

## Phase 2.5: Root Directory Cleanup

### Files Moved

#### Infrastructure → `infra/vps/`
- `docker-compose.yml` → `infra/vps/docker-compose.yml`
- ✓ Directory already contained: Dockerfile, staging/production configs, systemd

#### Logs → `logs/`
- `web-console.log` → `logs/web-console.log`
- `web-docs.log` → `logs/web-docs.log`
- `web-landing.log` → `logs/web-landing.log`
- ✓ Directory already in .gitignore (line 277)

#### Notes
- No phase reports or scripts found in root (already cleaned up)
- Root directory significantly cleaner post-Phase 2 refactor

---

## Phase 3: Build Validation

### Build Test Results

```bash
go build ./...
```

### Current Build Status: ⚠️ PARTIAL

#### Remaining Issues

**1. Package Name Conflicts (3 locations)**

- `internal/inference/` - contains both `ml` and `router` packages
  - File: `handler.go` (package ml)
  - File: `policy.go` (package router)
  - **Fix Required:** Separate into distinct directories

- `labs/proto/proto/` - contains both `ml` and `proto` packages
  - File: `ml_service.pb.go` (package ml)
  - File: `ml_service_pb_stub.go` (package proto)
  - **Fix Required:** Consolidate or separate proto files

- `web/apps/python-ml-service/proto/` - contains both `ml` and `ml_service` packages
  - Files using `package ml`
  - Files using `package ml_service`
  - **Fix Required:** Standardize package naming

**2. Missing Proto Packages**

The following import paths don't exist and need proto generation or removal:
- `github.com/schlep-engine/schlep-engine/proto` (imported by internal/ml/client.go)
- `github.com/schlep-engine/schlep-engine/proto/orchestration` (imported by internal/inference/policy.go)
- `github.com/schlep-engine/schlep-engine/web/apps/go-gateway/proto/ml/v1` (imported by cache_warmer)

**3. Missing go.sum Entries**

Some indirect dependencies need to be added:
```bash
go get go.opentelemetry.io/otel/sdk/resource@v1.21.0
go get github.com/gofiber/fiber/v2@v2.52.0
go get github.com/prometheus/client_golang/api/prometheus/v1@v1.18.0
go get golang.org/x/crypto/blake2b@v0.40.0
```

---

## Protobuf Status (from previous session)

### Generated Files (12 total)
✅ All .pb.go files regenerated with correct module paths:

**Locations:**
- `adapters/python/python_ml/proto/` (2 files)
- `labs/proto/` (2 files)
- `labs/proto/proto/` (2 files)
- `labs/proto/orchestration/` (2 files)
- `web/apps/python-ml-service/proto/` (4 files)

**Module Path Used:**
`github.com/schlep-engine/schlep-engine/proto/*`

---

## Repository Structure - Current State

```
schlep-engine/
├── adapters/           # Adapter implementations (Python, etc.)
├── cmd/               # Main applications
├── infra/
│   └── vps/          # ✅ Docker & deployment configs (cleaned up)
├── internal/         # ⚠️ Package conflicts to resolve
├── labs/             # Experimental features
├── logs/             # ✅ Log files (properly ignored)
├── proto/            # ⚠️ Missing - needs creation
├── scripts/          # Build and automation scripts
├── tests/            # Integration tests
└── web/
    └── apps/
        └── go-gateway/  # Main Go API gateway
```

---

## Recommendations for Next Steps

### Immediate (Before /v1/infer Development)

1. **Resolve Package Conflicts**
   ```bash
   # Split conflicting packages into separate directories
   mkdir -p internal/inference/router
   mv internal/inference/policy.go internal/inference/router/
   
   # Fix proto package conflicts
   # Decide on single package name (ml vs ml_service)
   ```

2. **Create Central Proto Directory**
   ```bash
   mkdir -p proto/ml proto/orchestration
   # Move or symlink generated proto files
   ```

3. **Fix Missing go.sum Entries**
   ```bash
   go get -u all
   go mod tidy
   ```

### Medium Priority

4. **Consolidate Proto Definitions**
   - Multiple `ml_service.proto` files exist in different locations
   - Should have single source of truth
   - Consider `proto/ml/` as canonical location

5. **Update Import Paths**
   - Some code still references `proto/ml/v1`
   - Standardize to new structure

### Optional (Post-MVP)

6. **Remove Duplicate Proto Files**
   - `labs/proto/proto/ml_service.proto` (duplicate)
   - `labs/proto/ml_service.proto` (older version)

7. **Proto Package Naming**
   - Standardize on either `ml` or `ml_service`
   - Update all .proto files accordingly

---

## Git-Safe Operations Summary

### Commands Used
```bash
# Import path updates (sed)
sed -i '' 's|github.com/schlep-engine/go-gateway|...|g' [files]

# File moves (mv)
mv docker-compose.yml infra/vps/
mv *.log logs/

# Dependency additions (go get)
go get github.com/hashicorp/vault/api@latest
go get github.com/go-redis/redis/v8@latest

# Module verification
go mod verify
```

### Files Modified
- 6 Go source files (import paths only)
- go.mod (dependencies added)
- go.sum (updated automatically)

### Files Moved
- 1 infrastructure file
- 3 log files

### Files Created
- `logs/` directory
- `STRUCTURE_STABILIZATION_LOG.md` (this file)
- `PROTO_GENERATION_REPORT.txt` (from previous session)

---

## Validation Checklist

- [x] All go-gateway imports replaced
- [x] Vault and Redis dependencies added
- [x] Modules verified
- [x] Root directory cleaned
- [x] Infrastructure files organized
- [x] Log files archived
- [x] .gitignore covers logs/
- [ ] Package conflicts resolved (manual step)
- [ ] Proto structure centralized (manual step)
- [ ] Build passes without errors (pending manual fixes)

---

## MVP Readiness Status

### ✅ Ready
- Repository structure is clean and organized
- Import paths are consistent
- Dependencies are available
- Infrastructure is properly categorized

### ⚠️ Requires Attention
- Package name conflicts in 3 directories
- Proto organization needs standardization
- Some missing proto packages need resolution

### 🎯 Next Milestone
**Ready for /v1/infer endpoint development** once package conflicts are resolved.

---

## Change Log

| Date | Phase | Action | Status |
|------|-------|--------|--------|
| 2025-10-15 | 1 | Import path migration | ✅ Complete |
| 2025-10-15 | 2 | Dependency management | ✅ Complete |
| 2025-10-15 | 2.5 | Root cleanup | ✅ Complete |
| 2025-10-15 | 3 | Build validation | ⚠️ Partial |
| 2025-10-15 | 4 | Optimizer RFC documentation | ✅ Complete |

---

## Phase 4: Optimizer Migration RFC

### Objective
Document the migration strategy for moving inference optimization logic from Go to Rust via FFI.

### Document Created
**File:** `docs/architecture/OPTIMIZER_RFC.md`

**Key Sections:**
1. Purpose and Scope - Migration objectives and boundaries
2. Current Architecture Overview - Go router, Rust kernel, Thompson Sampling research module
3. Target Architecture - Rust optimizer core with FFI integration
4. Optimizer Module Design - Bandits, arms, rewards, state management
5. Go ↔ Rust FFI Contract - Function signatures, cgo bindings, memory model
6. State Ownership Strategy - Three phases (Go-held, Hybrid, Full Rust)
7. Error Handling and Panic Safety - Fallback strategies
8. Migration Phases - MVP, Hybrid State, Production Rollout, Advanced Algorithms
9. Testing and Validation Plan - Unit, integration, load, and shadow mode testing
10. Deprecation Plan - Python adapter status and future extensions

### Key Decisions

**Algorithm Choice:**
- Start with Thompson Sampling (Beta distribution-based multi-armed bandit)
- Existing implementation in `labs/research/rl/thompson_sampling.rs`
- Future extension to LinUCB, neural bandits, contextual RL

**State Ownership:**
- Phase 1 (MVP): Go holds state, Rust is stateless (JSON serialization)
- Phase 2 (Recommended): Rust owns state via opaque handle, Go manages lifecycle
- Phase 3 (Long-term): Full Rust core with separate service option

**FFI Design Principles:**
1. All panics caught via `catch_unwind()` and converted to error codes
2. Memory ownership: Rust allocates strings, Go frees via `optimizer_free_string()`
3. Opaque handle pattern for stateful optimizer
4. JSON for complex data transfer (simplicity over binary performance)

**Performance Targets:**
- FFI overhead: < 100μs per call (p99)
- Result parity: < 1% difference vs reference implementation
- Reward improvement: +10% over baseline within 10,000 iterations

### Integration Points

**Go Gateway:**
- New package: `web/apps/go-gateway/internal/optimizer/`
- Wraps Rust FFI with idiomatic Go interface
- Feature flag: `OPTIMIZER_RUST_ENABLED` for gradual rollout
- Fallback to priority-based routing on Rust failure

**Rust Kernel:**
- New module: `rust-core/rust_kernel/src/optimizer/`
- Submodules: `bandits.rs`, `arms.rs`, `rewards.rs`, `state.rs`, `ffi.rs`
- Leverages existing `ffi_guard.rs` for panic safety
- Exports via `lib.rs` alongside existing FFI functions

### Testing Strategy

**Unit Tests:**
- Rust: Arm update logic, action space generation, state serialization
- Go: FFI wrapper, error handling, memory management

**Integration Tests:**
- Result parity (1000 cycles, < 1% deviation)
- Performance benchmarking (< 100μs FFI latency)
- Failure injection (panic recovery, fallback)

**Load Testing:**
- 10,000 req/sec for 1 hour
- Memory leak detection (stable RSS)
- Reward convergence validation

**Shadow Mode:**
- Parallel Go and Rust optimizers
- Log divergences and reward deltas
- > 80% agreement rate target

### Migration Timeline

**Week 1-2 (MVP):**
- Create optimizer module structure
- Implement stateless FFI integration
- Write integration tests

**Week 3-4 (Hybrid State):**
- Add handle-based state management
- Integrate with edge router
- Enable in staging environment

**Week 5-6 (Production Rollout):**
- Gradual rollout: 1% → 10% → 50% → 100%
- Monitor metrics and alerts
- Deprecate Go optimizer

**Week 7+ (Advanced Algorithms):**
- Contextual bandits with feature vectors
- Offline policy evaluation
- Neural bandit exploration

### Related Files
- Thompson Sampling: `labs/research/rl/thompson_sampling.rs`
- Edge Router: `web/apps/go-gateway/internal/edge/edge_router.go`
- Rust Kernel FFI: `rust-core/rust_kernel/src/lib.rs`
- FFI Guard: `rust-core/rust_kernel/src/ffi_guard.rs`

---

**Prepared by:** Claude Code (Sonnet 4.5)
**Repository:** github.com/schlep-engine/schlep-engine
**Branch:** refactor/clean-strays
**Commit:** a47f37fb1 (post-Phase-2)
