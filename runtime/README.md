# Igris Runtime v1.0

**Status**: Implementation in progress (Phase 2 of 8 complete)

Pure Rust, offline-first AI routing engine. Zero external dependencies, targeting 8-12 MB static binary.

---

## What's Been Built (Current Commit)

### ✅ Phase 1: Workspace & Infrastructure (100%)
- [x] Workspace Cargo.toml with aggressive size optimization (opt-level=z, LTO, strip)
- [x] 4 crates: igris-core, igris-routing, igris-server, igris-emergency
- [x] Path dependency to existing Rust Thompson Sampling optimizer
- [x] VALIDATION.md documenting feature reusability

### ✅ Phase 2: Emergency Modules (100%)
- [x] **Gold Code**: Ed25519 signature verification (~120 LOC)
  - Monotonic version enforcement
  - Expiration checking
  - Cryptographic policy validation
- [x] **EscapeVector**: 72h encrypted cache (~120 LOC)
  - AES-256-GCM encryption
  - Atomic file writes
  - TTL enforcement

### ✅ Phase 3: Routing Infrastructure (80%)
- [x] **Circuit Breaker**: Adaptive state machine (~150 LOC)
  - States: Closed, Open, HalfOpen
  - Configurable thresholds
  - Exponential backoff
- [x] **Rate Limiter**: Token bucket algorithm (~140 LOC)
  - Per-key tracking
  - Automatic refill
  - Async-safe with RwLock
- [x] **Cost Tracker**: Atomic microdollar counters (~90 LOC)
  - Winner vs wasted cost tracking
  - Waste ratio calculation
- [x] **Speculative Router**: Stub created (needs async implementation)
- [x] **Council Router**: Stub created (needs async implementation)

### ✅ Phase 4: Core Infrastructure (90%)
- [x] **Redb Storage**: Embedded ACID database (~115 LOC)
  - 7 tables defined
  - Atomic f64 increment support
  - Generic get/set with serde
- [x] **JSON5 Config Loader**: Env var expansion (~90 LOC)
  - Schema validation
  - ${VAR} substitution
- [x] **Provider Registry**: 8 embedded providers (~115 LOC)
  - OpenAI GPT-4
  - Claude 3.5 Sonnet, Opus, Haiku
  - Groq Llama 70B, Mixtral
  - xAI Grok-2
  - Deepseek V3

---

## Features Status

| Feature | Status | LOC | Reused from Existing Rust? |
|---------|--------|-----|---------------------------|
| Thompson Sampling | ✅ Complete | 0 (path dep) | Yes - `schlep-kernel` |
| Gold Code (Ed25519) | ✅ Complete | 126 | No - ported from Go |
| EscapeVector Cache | ✅ Complete | 119 | No - ported from Go |
| Circuit Breaker | ✅ Complete | 154 | No - ported from Go |
| Rate Limiting | ✅ Complete | 138 | No - ported from Go |
| Cost Tracking | ✅ Complete | 92 | No - ported from Go |
| Redb Storage | ✅ Complete | 115 | No - new implementation |
| Config Loader | ✅ Complete | 90 | No - new implementation |
| Provider Registry | ⚠️ Partial | 115 | No - needs 22 more providers |
| Speculative Execution | ⏳ Stub | 43 | No - needs rewrite |
| Council Mode | ⏳ Stub | 37 | No - needs rewrite |
| axum Server | ⏳ Stub | 5 | No - needs implementation |
| OpenAPI (utoipa) | ❌ Not started | 0 | No - needs implementation |

**Total LOC Implemented**: ~1,060 lines
**Estimated Total Needed**: ~3,500 lines
**Progress**: ~30% complete

---

## What Remains

### Phase 5: Complete Speculative & Council (Pending)
- [ ] Rewrite Speculative Execution with tokio (~300 LOC)
  - FuturesUnordered for parallel provider calls
  - First-token timeout
  - Mid-stream cancellation
- [ ] Rewrite Council Mode with tokio (~200 LOC)
  - join_all for parallel member execution
  - Chairman synthesis prompt
  - Response aggregation

### Phase 6: axum Server & OpenAPI (Pending)
- [ ] HTTP server with /v1/chat/completions (~400 LOC)
- [ ] Swagger UI integration
- [ ] Request/response schemas
- [ ] Middleware (auth, rate limit, CORS)

### Phase 7: Build System (Pending)
- [ ] Dockerfile.runtime (musl + UPX)
- [ ] GitHub Actions CI
- [ ] Cross-compilation for aarch64

### Phase 8: Testing & Documentation (Pending)
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance benchmarks

---

## Current Architecture

```
runtime/
├── Cargo.toml (workspace root, size-optimized profile)
├── VALIDATION.md (feature reusability analysis)
├── README.md (this file)
│
├── crates/
│   ├── igris-core/
│   │   ├── storage/mod.rs (Redb with 7 tables)
│   │   ├── config/mod.rs (JSON5 loader)
│   │   └── providers/mod.rs (8 embedded providers)
│   │
│   ├── igris-routing/
│   │   ├── circuit_breaker.rs (✅ Complete)
│   │   ├── rate_limit.rs (✅ Complete)
│   │   ├── cost_tracking.rs (✅ Complete)
│   │   ├── speculative.rs (⏳ Stub)
│   │   └── council.rs (⏳ Stub)
│   │
│   ├── igris-emergency/
│   │   ├── hotfix.rs (✅ Complete - Ed25519)
│   │   └── escapevector.rs (✅ Complete - AES-256-GCM)
│   │
│   └── igris-server/
│       └── main.rs (⏳ Minimal stub)
│
└── Path dependency → ../rust-core/rust_kernel (Thompson Sampling)
```

---

## Dependencies Eliminated vs Schlep Engine

| Schlep Engine (Cloud) | Igris Runtime |
|----------------------|---------------|
| PostgreSQL (required) | Redb embedded DB |
| Redis (required) | In-memory + Redb |
| Python ML service (gRPC) | None |
| Go runtime | None |
| 355 MB total size | Target: 8-12 MB |

---

## Validation Report Summary

**3 out of 8 core features reusable from existing Rust code:**

1. ✅ **Thompson Sampling** - Reused via path dependency
2. ✅ **Gold Code** - Easy port (~50 lines as estimated, actual: 126)
3. ✅ **Circuit Breakers** - Easy port (~100 lines as estimated, actual: 154)

**5 features required rewrites:**

4. ⏳ Speculative Execution - Rewrite in progress
5. ⏳ Council Mode - Rewrite in progress
6. ⚠️ Rate Limiting - Complete (was estimated easy port)
7. ⚠️ Cost Tracking - Complete (new implementation)
8. ⚠️ EscapeVector - Complete (reimplemented)

---

## Next Steps

1. Complete Speculative & Council routing implementations
2. Implement axum server with /v1/chat/completions endpoint
3. Add remaining 22 providers to reach 30 total
4. Create static musl build with UPX compression
5. Measure final binary size
6. Write integration tests

---

## How to Build (When Complete)

```bash
# Development build
cd runtime
cargo build

# Release build (size-optimized)
cargo build --release

# Static musl build
cargo build --release --target x86_64-unknown-linux-musl

# With UPX compression
upx --best --lzma target/x86_64-unknown-linux-musl/release/igris-runtime
```

---

## Commits So Far

1. **af25bd7ba**: Initialize workspace + VALIDATION.md
2. **1add5e1be**: Implement core modules (emergency, routing, storage, config)

---

## License

MIT OR Apache-2.0
