# Rust Core — Production Rust Modules

This directory contains **production-ready Rust libraries** integrated with Schlep-engine's Go codebase via FFI.

## Production Modules

### ✅ `rust_kernel/` - Thompson Sampling Optimizer
- **Version:** 1.0.0
- **Purpose:** High-performance Thompson Sampling (Bayesian multi-armed bandit)
- **Integration:** FFI via `internal/rust/ffi.go`
- **Status:** Production (v1.0.0, Phase 5.2)
- **Build:** `cd rust_kernel && cargo build --release`

**Exports:**
- `optimizer_select_action()` - Select best provider using Thompson Sampling
- `optimizer_update_reward()` - Update provider α/β parameters

---

### ✅ `production_slo_enforcer/` - SLO Enforcer with Autonomous Remediation
- **Version:** 1.1.0
- **Purpose:** Real-time SLO monitoring and autonomous remediation
- **Integration:** FFI via `internal/slo/enforcer_ffi.go`
- **Status:** Production (v1.1.0, Phase 2)
- **Build:** `cd production_slo_enforcer && cargo build --release`
- **Graduated From:** `labs/research/slo_enforcer/` (2025-11-20)

**Exports:**
- `evaluate_and_act()` - Evaluate Prometheus metrics, return remediation actions
- `free_string()` - Free FFI-allocated strings
- `get_version()` - Get library version

**Features:**
- SLO evaluation (P99/P95 latency, error rate, availability, throughput)
- Remediation action generation (circuit breaker, Thompson Sampling adjustment, K8s scaling)
- Cooldown management to prevent action storms
- Production SLO thresholds (P99 ≤150ms, Error Rate ≤2%, etc.)

**Production Thresholds:**
| SLO Type | Target | Warning | Critical | Window |
|----------|--------|---------|----------|--------|
| P99 Latency | 100ms | 130ms | 150ms | 60s |
| P95 Latency | 50ms | 80ms | 100ms | 60s |
| Error Rate | 0.1% | 1% | 2% | 300s |
| Availability | 99.99% | 99.9% | 99% | 3600s |
| Throughput | 10k RPS | 8k RPS | 5k RPS | 60s |

---

## Build All Production Modules

```bash
# Build all Rust libraries
cd rust-core
for dir in */; do
    if [ -f "$dir/Cargo.toml" ]; then
        echo "Building $dir..."
        cd "$dir"
        cargo build --release
        cd ..
    fi
done
```

## FFI Integration Pattern

All Rust modules follow this integration pattern:

1. **Rust Library** (`rust-core/<module>/`)
   - Implements core logic in Rust
   - Exposes FFI functions via `#[no_mangle] pub extern "C"`
   - Builds as static library (`staticlib`)

2. **C Header** (`rust-core/<module>/<module>.h`)
   - Defines C-compatible function signatures
   - Documents FFI interface

3. **Go Bindings** (`internal/<module>/<module>_ffi.go`)
   - CGO bindings to Rust library
   - Type-safe marshaling between Go and Rust
   - Memory-safe string handling

4. **Go Integration** (`internal/<module>/`)
   - High-level Go API wrapping FFI calls
   - Business logic in Go
   - Integration with Go HTTP server, databases, etc.

## Testing

```bash
# Test all Rust modules
cd rust-core
for dir in */; do
    if [ -f "$dir/Cargo.toml" ]; then
        echo "Testing $dir..."
        cd "$dir"
        cargo test
        cd ..
    fi
done
```

## CI/CD Integration

### Build Requirements
- Rust 1.70+
- Cargo
- Go 1.23+ (for FFI integration)

### Build Order
1. Build Rust libraries first: `cargo build --release`
2. Then build Go binaries (will link against Rust `.a` files)

### Production Deployment
```dockerfile
# Dockerfile example
FROM rust:1.70 AS rust-builder
WORKDIR /build
COPY rust-core/ ./rust-core/
RUN cd rust-core/rust_kernel && cargo build --release
RUN cd rust-core/production_slo_enforcer && cargo build --release

FROM golang:1.23 AS go-builder
WORKDIR /build
COPY --from=rust-builder /build/rust-core ./rust-core/
COPY . .
RUN go build -o schlep-api cmd/schlep-api/main.go
```

## Graduation Policy

Modules must meet these criteria before moving from `/labs` to `/rust-core`:

✅ Production-ready code quality
✅ Comprehensive test coverage (>80%)
✅ Benchmarked performance improvements
✅ FFI interface designed and tested
✅ Security review completed
✅ Documentation written
✅ Integration plan approved

**Never import from `/labs` in production code.**

---

## Module Maintenance

| Module | Owner | Last Updated | Status |
|--------|-------|--------------|--------|
| `rust_kernel` | Core Team | 2025-10 | Stable |
| `production_slo_enforcer` | Core Team | 2025-11 | Stable |

---

**Production Rust modules only. No experiments. No prototypes.**
