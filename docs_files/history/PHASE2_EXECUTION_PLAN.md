# Phase 2: Production Hardening & Runtime Consolidation
## Execution Plan

**Timeline:** 8 weeks
**Target:** 90% North Star Compliance
**Status:** 🚀 IN PROGRESS

---

## Week 1: Critical Security & Contract Fixes

### SEC-001: Secret Rotation (CRITICAL)
**Owner:** DevOps
**Hours:** 8
**Status:** 🔴 BLOCKED - Requires CTO approval for Vault implementation

**Action Items:**
1. [ ] Get approval for HashiCorp Vault vs AWS Secrets Manager
2. [ ] Rotate all secrets in `.env.production`
3. [ ] Implement secret injection in CI/CD
4. [ ] Remove local `.env.production` file
5. [ ] Scan git history for leaked secrets

**Deliverables:**
- `security/vault_config.yaml`
- `security/secrets_rotated.md`

---

### RNT-001: Unify Proto Contracts (CRITICAL)
**Owner:** Rust/Go Engineers
**Hours:** 24
**Status:** ⚡ READY TO START

**Current State:**
- Go: `go_gateway/proto/ml_service.proto` (34 lines, 2 RPCs)
- Python: `apps/python-ml-service/proto/ml_service.proto` + `ml_service_extended.proto`
- **Mismatch:** Field names differ (`inference_time_ms` vs `latency_ms`)

**Solution:**
1. Consolidate to `proto/ml_service.proto` (single source of truth)
2. Python as canonical source (has more RPCs)
3. Set up proper proto codegen for both Go and Python
4. Add proto versioning

**Implementation:** Starting now...

---

### SEC-003: Deploy AlertManager
**Owner:** DevOps
**Hours:** 10
**Status:** ⚡ READY TO START

**Current State:**
- Prometheus configured ✅
- Grafana configured ✅
- AlertManager configured ❌ (not deployed)

**Action Items:**
1. [ ] Deploy AlertManager to Vultr/Hetzner
2. [ ] Configure alert routing (email, Slack, PagerDuty)
3. [ ] Create alert rules for:
   - P99 latency >50ms
   - Error rate >1%
   - Memory growth >10%
   - Secret expiry warnings
4. [ ] Test alert delivery

---

## Week 2-3: ML Service Testing & Runtime Abstraction

### RNT-003: ML Service Tests (CRITICAL)
**Owner:** Python Engineer
**Hours:** 16
**Status:** ⚡ STARTING NOW

**Current Coverage:** 0% (396 LOC untested)
**Target:** >70%

**Test Plan:**
1. Unit tests for gRPC handlers
2. Integration tests for model loading
3. Error handling validation
4. Mock server tests
5. Performance benchmarks

---

### RNT-002: Runtime Abstraction Layer
**Owner:** Rust Engineer
**Hours:** 20
**Status:** 🟡 DEPENDS ON RNT-001

**Design:**
```rust
// runtime_abstraction.rs
pub trait InferenceRuntime {
    fn predict(&self, features: Vec<f64>, model_id: &str) -> Result<Prediction>;
    fn load_model(&self, model_id: &str, path: &Path) -> Result<()>;
    fn health_check(&self) -> Result<HealthStatus>;
}

// Implementations:
// - RustNativeRuntime (local inference)
// - PythonGrpcRuntime (remote via gRPC)
// - WasmRuntime (future: WASM-based isolation)
```

---

## Week 4-5: Performance & SDK Cleanup

### RNT-004: gRPC Connection Pooling
**Owner:** Go Engineer
**Hours:** 16

**Current Issue:** Single connection to 10 ML replicas → bottleneck

**Solution:**
```go
type MLClientPool struct {
    conns []*grpc.ClientConn
    index atomic.Uint32
}

func (p *MLClientPool) GetClient() MLServiceClient {
    idx := p.index.Add(1) % uint32(len(p.conns))
    return NewMLServiceClient(p.conns[idx])
}
```

---

### SDK-001/002: Extract Business Logic from SDK
**Owner:** Python Engineer
**Hours:** 20

**Current Problem:** SDK has 6,777 LOC with business logic embedded

**Refactor Plan:**
1. Move data processing to backend API
2. Keep only HTTP client wrapper in SDK
3. Remove domain-specific transformations
4. Create thin, version-agnostic client

**Before:**
```python
# SDK does too much
client.process_data(df)  # Complex business logic in SDK
```

**After:**
```python
# SDK only handles HTTP
response = client.post("/data/process", data=df)
```

---

## Week 6-7: Cost Tracking & Benchmarking

### MON-001: Cost-Per-Inference Tracking
**Owner:** DevOps + Rust Engineer
**Hours:** 12

**Implementation:**
1. Add cost metrics to Prometheus
2. Track: compute time, memory usage, GPU cycles
3. Calculate $/1000 inferences
4. Create Grafana dashboard

**Metrics:**
```yaml
# cost_metrics.yaml
inference_cost_total{runtime="rust"} 0.0001  # $0.0001 per inference
inference_cost_total{runtime="python"} 0.0003
inference_duration_seconds{runtime="rust"} 0.001
inference_memory_bytes{runtime="rust"} 1048576
```

---

### MON-002: Performance Benchmarks
**Owner:** Rust/Go Engineer
**Hours:** 16

**Benchmark Suite:**
1. FFI latency (Rust ↔ Go)
2. gRPC latency (Go ↔ Python)
3. Full stack (Go → Rust → Python)
4. Throughput under load
5. Memory leak tests
6. Cost-per-inference

**Command:**
```bash
cd benchmarks
./run_benchmarks.sh --full --output=results/phase2_results.json
go run generate_report.go -i results/phase2_results.json -o BENCHMARK_REPORT.md
```

---

## Week 8: Infrastructure Decision & Final Audit

### INF-001: Vultr → Hetzner Migration
**Owner:** DevOps
**Hours:** 16
**Status:** 🟡 PENDING CTO DECISION

**Options:**
- **Option A:** Stay on Vultr (update docs to match reality)
- **Option B:** Migrate to Hetzner (align with directive)

**Migration Checklist (if Option B):**
1. [ ] Provision Hetzner VPS
2. [ ] Set up network and firewall
3. [ ] Deploy services via docker-compose
4. [ ] Migrate PostgreSQL data
5. [ ] Update DNS (Cloudflare)
6. [ ] Test and cut over
7. [ ] Decommission Vultr

---

## Success Metrics

### North Star Compliance (Target: 90%)

| Requirement | Week 1 | Week 4 | Week 8 | Target |
|-------------|--------|--------|--------|--------|
| Modular RPC/gRPC | 40% | 70% | 95% | ✅ |
| Reusable runtime | 20% | 60% | 90% | ✅ |
| Developer control | 85% | 85% | 90% | ✅ |
| Cost efficiency | 0% | 50% | 100% | ✅ |
| Trust & security | 40% | 75% | 90% | ✅ |

### Technical Metrics

| Metric | Current | Week 4 | Week 8 | Target |
|--------|---------|--------|--------|--------|
| Security Score | 65/100 | 80/100 | 90/100 | 85+ |
| ML Test Coverage | 0% | 50% | 75% | 70%+ |
| Proto Unification | ❌ | ✅ | ✅ | ✅ |
| Cost Tracking | ❌ | ⚠️ | ✅ | ✅ |
| FFI Safety | ❌ | ⚠️ | ✅ | ✅ |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Secret rotation breaks production | Medium | Critical | Test in staging first, have rollback plan |
| Proto changes break compatibility | Low | High | Version all changes, deprecate gracefully |
| Hetzner migration downtime | Medium | High | Blue-green deployment, DNS cut-over |
| Benchmark reveals performance issues | High | Medium | Have optimization sprint ready |
| Team capacity constraints | High | Medium | Prioritize P0/P1, defer nice-to-haves |

---

## Deliverables

### Week 1
- [ ] `security/vault_config.yaml`
- [ ] `proto/ml_service.proto` (unified)
- [ ] `observability/alertmanager_config.yaml`

### Week 3
- [ ] `apps/python-ml-service/tests/` (70%+ coverage)
- [ ] `rust_kernel/src/runtime_abstraction.rs`
- [ ] `go_gateway/internal/ml/grpc_pool.go`

### Week 6
- [ ] `packages/python-sdk/` (refactored, thin client)
- [ ] `observability/cost_metrics_dashboard.json`
- [ ] `benchmarks/results/phase2_benchmark_report.md`

### Week 8
- [ ] `docs/ENGINEERING_DIRECTIVE_PHASE2_AUDIT.md`
- [ ] `docs/RUNTIME_CONSOLIDATION_REPORT.md`
- [ ] Production-ready deployment (90% compliance)

---

## Phase 2 Completion Criteria

✅ **Must Have:**
1. All production secrets rotated and in Vault
2. Proto contracts unified with versioning
3. ML service test coverage >70%
4. Cost-per-inference tracking live
5. Security score >85/100
6. Performance benchmarks complete

⚠️ **Should Have:**
7. Runtime abstraction layer implemented
8. gRPC connection pooling
9. SDK business logic extracted
10. AlertManager deployed

🎯 **Nice to Have:**
11. Hetzner migration complete (if approved)
12. WASM runtime prototype
13. Multi-GPU scheduling proof-of-concept

---

**Status:** Phase 2 execution starting now
**Next Checkpoint:** Week 1 (Critical fixes complete)
**Final Review:** Week 8 (Production-ready audit)
