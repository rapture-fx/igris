# Schlep Engine Architecture

**Last Updated:** October 7, 2025
**Current Phase:** Phase 11 - AI-Native Evolution Complete

---

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────┐
│         CLIENT APPLICATIONS             │
│  (Web: Admin, Docs, Landing, Console)  │
└──────────────┬──────────────────────────┘
               │ HTTP/REST
               ↓
┌─────────────────────────────────────────┐
│        GO GATEWAY (Port 8080)           │
│       go_gateway/ - Main Backend        │
│                                         │
│  📍 REST API (152 endpoints)            │
│  🔄 Adaptive ML Pool (Phase 10)         │
│  🛡️  Circuit Breaker                    │
│  ✅ Request Validation                  │
│  📊 Prometheus Metrics                  │
│  🎯 Multi-Model Router (Phase 11)       │
│  📡 Streaming Inference (WebSocket)     │
└──────┬──────────────┬────────────────────┘
       │ gRPC         │ FFI
       ↓              ↓
┌──────────────┐  ┌──────────────┐
│ PYTHON ML    │  │ RUST KERNEL  │
│ python_ml/   │  │ rust_kernel/ │
│              │  │              │
│ • PyTorch    │  │ • Data proc  │
│ • ONNX       │  │ • Validation │
│ • TensorRT   │  │ • Transform  │
│ • gRPC only  │  │ • String ops │
│ Port 50051   │  │ • FFI bridge │
└──────────────┘  └──────────────┘
       │              │
       └──────┬───────┘
              ↓
      ┌──────────────┐
      │  PostgreSQL  │
      │    Redis     │
      └──────────────┘
```

---

## 📁 Repository Structure

```
schlep-engine/
├── go_gateway/              # 🚀 Main Backend (Go)
│   ├── cmd/api/             # Entry point
│   ├── internal/
│   │   ├── handlers/        # HTTP handlers
│   │   ├── middleware/      # Circuit breaker, validation
│   │   ├── ml/              # Phase 10-11: Adaptive pool, router
│   │   └── observability/   # Prometheus metrics
│   ├── Dockerfile
│   └── go.mod
│
├── python_ml/               # 🤖 ML Inference Service (Python gRPC)
│   ├── service/
│   │   ├── server.py        # gRPC server
│   │   └── models/          # PyTorch/ONNX models
│   ├── Dockerfile
│   └── requirements.txt
│
├── rust_kernel/             # ⚡ High-Performance Kernels (Rust)
│   ├── src/
│   │   ├── lib.rs           # FFI exports
│   │   ├── string_kernels.rs
│   │   └── polars_kernels.rs
│   └── Cargo.toml
│
├── apps/                    # 🌐 Frontend Applications
│   ├── web-admin/           # Admin dashboard (Next.js)
│   ├── web-docs/            # Documentation site (Next.js)
│   ├── web-landing/         # Marketing site (Next.js)
│   └── web-console/         # API console (Next.js)
│
└── .github/workflows/       # CI/CD Pipelines
    ├── go-gateway-ci.yml    # Go Gateway tests & builds
    ├── docker-build.yml     # Docker image builds
    └── ...
```

---

## 🔄 Architecture Evolution Timeline

### Phase 1-2: FastAPI Foundation (2024)
- **Architecture:** Python FastAPI monolith
- **Size:** 330+ Python files, ~850 KB
- **Endpoints:** 152 REST endpoints

### Phase 3: Migration to Hybrid (Oct 2025)
- **Decision:** Migrate to Go + Rust + Python (ML only)
- **Reason:** Performance (9-13x faster), scalability
- **Migration:**
  - 128 endpoints → Go Gateway
  - 24 compute operations → Rust FFI
  - ML inference → Isolated Python gRPC

### Oct 4, 2025: FastAPI Removal
- **Commit:** `19f028bbc` - "Remove legacy FastAPI endpoints"
- ❌ Deleted 330 Python files
- ❌ Removed FastAPI infrastructure
- ✅ Archived in `archive/fastapi-legacy` branch
- ✅ **100% migrated to Go Gateway**

### Phase 4-9: Go Gateway Stabilization
- Observability 2.0 (Prometheus, Grafana)
- Infrastructure automation (K8s, Helm)
- Developer experience (SDKs, docs)
- AI-native evolution layer

### Phase 10-11: ML Inference Hardening (Current)
- ✅ Adaptive inference pool (5-50 workers)
- ✅ Circuit breaker pattern
- ✅ GPU runtime support
- ✅ Multi-model router (Thompson Sampling)
- ✅ Drift detection & feedback monitoring
- ✅ Streaming inference (WebSocket)

---

## 🚀 Key Features

### Go Gateway (Main Backend)
- **Language:** Go 1.21+
- **Port:** 8080
- **Responsibilities:**
  - All HTTP/REST endpoints (152 total)
  - Request validation & authentication
  - Rate limiting & circuit breaking
  - Database operations (PostgreSQL, Redis)
  - ML request routing & orchestration
  - Prometheus metrics & observability

**Phase 10-11 Features:**
- Adaptive worker pool (auto-scaling 5-50 goroutines)
- Circuit breaker (gobreaker)
- Multi-model router with Thompson Sampling
- Streaming inference (WebSocket SSE)
- Feedback monitoring & drift detection

### Python ML Service (gRPC Only)
- **Language:** Python 3.11
- **Port:** 50051
- **Protocol:** gRPC
- **Responsibilities:**
  - ML model inference (PyTorch, ONNX, TensorRT)
  - GPU acceleration
  - Model registry & lazy loading
  - NO HTTP endpoints, NO REST API

### Rust Kernel (FFI)
- **Language:** Rust (latest stable)
- **Integration:** FFI via CGO
- **Responsibilities:**
  - High-performance data processing
  - String operations & validation
  - Polars DataFrame operations
  - JSON parsing & transformation

---

## 🛠️ Development

### Prerequisites
```bash
# Go Gateway
go 1.21+

# Python ML Service
python 3.11+

# Rust Kernel
rust 1.70+

# Infrastructure
docker & docker-compose
postgresql 15+
redis 7+
```

### Quick Start

```bash
# 1. Start infrastructure
docker-compose up -d postgres redis

# 2. Start Python ML Service
cd python_ml
pip install -r requirements.txt
python service/server.py

# 3. Start Go Gateway
cd go_gateway
go run cmd/api/main.go

# 4. Test
curl http://localhost:8080/health
curl -X POST http://localhost:8080/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"features":[1,2,3]}'
```

### Running Tests

```bash
# Go Gateway tests
cd go_gateway
go test -v -race -cover ./...

# Python ML tests
cd python_ml
pytest -v

# Rust tests
cd rust_kernel
cargo test
```

---

## 📊 Performance Metrics

### Phase 10-11 Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Max RPS | 2,000 | 10,000+ | **5x** |
| P99 Latency | 145ms | 35ms | **76% faster** |
| Dropped @ Peak | 3.2% | <0.01% | **99.7% better** |
| Worker Efficiency | 42% | 95% | **126% better** |

### GPU Acceleration

| Runtime | P50 Latency | vs CPU |
|---------|-------------|--------|
| CPU Baseline | 23ms | - |
| ONNX + CUDA | 10ms | **56% faster** |
| TensorRT + FP16 | 8ms | **64% faster** |

---

## 🔐 Security

- ✅ JWT authentication
- ✅ Rate limiting
- ✅ Input validation
- ✅ Circuit breaker
- ✅ TLS/HTTPS ready
- ✅ Security headers
- ✅ CORS configuration
- ✅ Trivy container scanning

---

## 📚 Documentation

- [Phase 10 Summary](./PHASE10_DAY5-7_SUMMARY.md)
- [Phase 11 Summary](./PHASE11_SUMMARY.md)
- [Go Gateway README](./go_gateway/README_PHASE10_DAY3-4.md)
- [Legacy Docs](./docs/LEGACY/)

---

## 🚨 Important Notes

### ⚠️ No FastAPI Backend

**FastAPI was completely removed on October 4, 2025.**

- ❌ No `apps/api/` backend
- ❌ No Python REST API
- ❌ No FastAPI dependencies

**If you see references to FastAPI in workflows or docs, they are outdated.**

**Current Backend:** Go Gateway (`go_gateway/`)
**ML Service:** Python gRPC only (`python_ml/`)

### Rollback to FastAPI (Emergency Only)

```bash
# Checkout the last FastAPI commit
git checkout archive/fastapi-legacy

# Or view the commit
git show 19f028bbc
```

---

## 📞 Contact & Support

- **Issues:** [GitHub Issues](https://github.com/wiramahendra/Schlep-engine/issues)
- **Latest:** Issue #47 - CI/CD infrastructure cleanup

---

**Last Architecture Change:** October 4, 2025 (FastAPI removal)
**Current Phase:** Phase 11 Complete
**Next:** Production deployment & monitoring
