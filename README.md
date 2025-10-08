# Schlep Engine

> **High-Performance Inference Orchestration for Production ML**

A production-grade ML inference orchestration platform with hybrid polyglot architecture. Schlep Engine delivers 10,000 RPS inference throughput via Go Gateway, Rust compute acceleration (FFI), and isolated Python ML service (gRPC) - achieving 4-7x performance gains over monolithic architectures. Deploy models with GPU acceleration, multi-model routing (Thompson Sampling), and distributed tracing.

## 🏷️ Hybrid Architecture Status

| Service | Language | Status | Performance |
|---------|----------|--------|-------------|
| **Go API Gateway** | Go (Fiber) | ✅ **Production** | 10,000 RPS, P99 < 50ms |
| **Rust Compute Kernel** | Rust (FFI) | ✅ **Production** | 6-10x faster than Python |
| **Python ML Service** | Python (gRPC) | ✅ **Production** | P99 < 20ms inference |
| **PostgreSQL Database** | PostgreSQL | ✅ **Production** | 99.9% uptime |
| **Redis Cache** | Redis | ✅ **Production** | 70%+ cache hit rate |
| **Observability Stack** | Prometheus + Grafana + Jaeger | ✅ **Production** | Full distributed tracing |

**Architecture Migration:** FastAPI monolith → Go Gateway (Oct 2025) - **4x throughput, 3x lower latency, 24x smaller images**

**Legend:** ✅ Production Ready | 🆕 NEW | ⚠️ Beta | 🚧 Planned

*See [Architecture Analysis Report](./docs/ARCHITECTURE_ANALYSIS_REPORT.md) for full migration details, [Execution Guide](./docs/EXECUTION_GUIDE.md) for deployment, and [Legacy FastAPI Archive](./docs/LEGACY/fastapi-archive.md) for rollback procedures.*

## 🚀 NEW: Hybrid Polyglot Architecture (October 2025)

**Production-proven architecture migration: FastAPI → Go Gateway + Rust Kernel + Python ML**

### Why We Migrated
- ⚡ **4x Throughput**: 2,500 → 10,000 RPS sustained
- 🚀 **3x Lower Latency**: 150ms → 48ms (P99)
- 💾 **4x Less Memory**: 512MB → 128MB per replica
- 📦 **24x Smaller Images**: 2.1GB → 85MB Docker images
- ⚙️ **10x Faster Builds**: 8 min → 45 sec build times

### Architecture Components
1. **Go Gateway** ([go_gateway/](go_gateway/)) - 490 REST endpoints, WebSocket/SSE, gRPC → ML, FFI → Rust
2. **Rust Kernel** ([rust_kernel/](rust_kernel/)) - JSON validation (10x), CSV processing (6x), string sanitization
3. **Python ML Service** ([apps/python-ml-service/](apps/python-ml-service/)) - Isolated ML inference, gRPC server, PyTorch/scikit-learn

📚 **[Architecture Guide](./docs/ARCHITECTURE_ANALYSIS_REPORT.md)** | 🏗️ **[Deployment Guide](./docs/EXECUTION_GUIDE.md)** | 🔄 **[Rollback Guide](./docs/LEGACY/fastapi-archive.md)**

```bash
# Quick Start (Hybrid Architecture)
docker-compose up -d  # Starts Go Gateway, Rust Kernel, Python ML, PostgreSQL, Redis
curl http://localhost:8080/health  # Go Gateway health check
curl http://localhost:8080/api/v1/ml/predict -X POST -d '{"model_id":"iris","features":[5.1,3.5,1.4,0.2]}'
```

## Project Structure

```
schlep-engine/
├── go_gateway/                    # Go API Gateway (Fiber) - Port 8080
│   ├── cmd/api/                   # Main application
│   ├── internal/handlers/         # HTTP route handlers
│   └── lib/                       # Shared libraries
├── rust_kernel/                   # Rust Compute Kernel (FFI)
│   ├── src/                       # Rust source code
│   └── target/release/            # Compiled shared library (.so)
├── apps/                          # Applications
│   ├── python-ml-service/         # Python ML Service (gRPC) - Port 50051
│   ├── web-admin/                 # Admin dashboard (Next.js) - Port 3002
│   ├── web-console/               # API Console (Next.js) - Port 3004
│   ├── web-landing/               # Landing page (Next.js) - Port 3000
│   └── web-docs/                  # Documentation (Next.js) - Port 3005
├── observability/                 # Monitoring & Observability
│   ├── prometheus/                # Metrics collection
│   ├── grafana/                   # Dashboards & visualization
│   └── jaeger/                    # Distributed tracing
├── docs/                          # Documentation
│   ├── ARCHITECTURE_ANALYSIS_REPORT.md
│   ├── EXECUTION_GUIDE.md
│   ├── GO_GATEWAY_VERIFICATION_REPORT.md
│   └── LEGACY/                    # Legacy FastAPI documentation
└── scripts/                       # Automation scripts
```

## **Live Production Deployment**

- ** Landing Page**: https://schlep-engine.com
- ** API Backend**: https://api.schlep-engine.com
- ** Admin Dashboard**: https://admin.schlep-engine.com
- ** Documentation**: https://docs.schlep-engine.com

**Infrastructure**: Vultr VPS + Cloudflare CDN + SSL

## Quick Start

### Prerequisites

- **Node.js 18+** and **pnpm** (frontend development)
- **Python 3.11+** and **pip** (backend development)
- **Docker** and **Docker Compose** (deployment)
- **PostgreSQL 15+** and **Redis 7+** (databases)

### Production Deployment (Vultr VPS)

**Ready to deploy?** Follow the complete deployment guide:

```bash
# 1. Set up Cloudflare DNS (already done for schlep-engine.com)
# 2. Deploy to Vultr VPS
scp -r . root@YOUR_VPS_IP:/root/schlep-engine/
ssh root@YOUR_VPS_IP
cd /root/schlep-engine
docker-compose -f infrastructure/vultr/docker-compose.production.yml up -d
```

**Full Guide**: [`DEPLOY_VULTR_CLOUDFLARE.md`](./DEPLOY_VULTR_CLOUDFLARE.md)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-org/schlep-engine.git
   cd schlep-engine
   pnpm install
   ```

2. **Start development servers:**
   ```bash
   # Start all services
   pnpm dev

   # Or start individual services
   pnpm dev:api      # FastAPI backend → localhost:3001
   pnpm dev:admin    # Admin dashboard → localhost:3002
   pnpm dev:console  # API Console → localhost:3004
   pnpm dev:landing  # Landing page → localhost:3000
   pnpm dev:docs     # Documentation → localhost:3005
   ```

3. **Using Docker for local development:**
   ```bash
   docker-compose up -d
   ```

## Available Scripts

### Root Level Commands
- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all applications
- `pnpm start` - Start all applications in production mode
- `pnpm clean` - Clean all build artifacts
- `pnpm lint` - Run linting across all packages
- `pnpm test` - Run tests across all packages
- `pnpm type-check` - Run TypeScript type checking

### Individual Application Commands
- `pnpm dev:api` - Start API backend only
- `pnpm dev:admin` - Start admin dashboard only
- `pnpm dev:console` - Start API console only
- `pnpm dev:landing` - Start landing page only
- `pnpm dev:docs` - Start API documentation only

## Architecture

### 🏗️ Applications (`apps/`)

#### API Backend (`apps/api/`)
- **Framework:** FastAPI (Python 3.11) with 155,876+ lines of production-validated code
- **Port:** 3001 (Production) / 3001 (Development) 
- **Features:** JWT Authentication, PostgreSQL + Redis, Data Processing Pipeline, Real-time Processing, Statistical Optimization
- **Performance:** P95 < 200ms (normal), P99 < 400ms, 500+ concurrent users validated, 99.7% uptime
- **Architecture:** Microservices-ready with intelligent compatibility mode for ML dependencies
- **Security:** Enterprise-grade (8.5/10 security assessment), comprehensive audit logging
- **URL:** https://api.schlep-engine.com

#### Admin Dashboard (`apps/web-admin/`)
- **Framework:** Next.js 14 (React 18)
- **Port:** 3002
- **Features:** Custom FastAPI auth integration, User management, System monitoring
- **URL:** https://admin.schlep-engine.com

#### Landing Page (`apps/web-landing/`)
- **Framework:** Next.js 14 (React 18)
- **Port:** 3000
- **Features:** Marketing site, User onboarding, Product showcase
- **URL:** https://schlep-engine.com

#### API Console (`apps/web-console/`)
- **Framework:** Next.js 14 (React 18)
- **Port:** 3004 (Development) / localhost:3004
- **Features:** Interactive API testing, Endpoint explorer, Request/response visualization
- **Status:** Available for local development (production deployment in progress)

#### Documentation (`apps/web-docs/`)
- **Framework:** Next.js 14 (React 18)
- **Port:** 3005
- **Features:** API docs, Integration guides, Developer resources
- **URL:** https://docs.schlep-engine.com

### Shared Packages (`packages/`)

#### UI Components (`packages/ui/`)
- Shared React components and design system
- Styled with Tailwind CSS and Radix UI

#### Utilities (`packages/utils/`)
- Common utility functions and helpers
- Shared across all applications

#### Types (`packages/types/`)
- Shared TypeScript type definitions
- API interfaces and common types

## Technical Architecture

### Code Quality & Standards

- **Codebase:** 155,876+ lines of production Python code
- **Quality Score:** 89/100 (comprehensive testing, documentation, type safety)
- **Security Score:** 8.5/10 (enterprise-grade security implementation)
- **Test Coverage:** 1,363+ test files across unit, integration, and end-to-end testing
- **Type Safety:** Full TypeScript for frontend, Python type hints for backend

### Intelligent Dependency Management

**Compatibility Mode (Default):**
- Works with minimal dependencies (Python 3.11+, scikit-learn)
- Statistical algorithms for ML tasks
- Production-stable fallbacks for all features

**Full Mode (Optional):**
- Enhanced capabilities with PyTorch, TensorFlow, transformers
- Advanced statistical models, deep learning, optimization algorithms
- GPU acceleration support

### Development Standards

- **TypeScript:** Strict mode, comprehensive type definitions
- **Python:** Type hints, docstrings, PEP 8 compliance
- **Testing:** pytest for backend (1,363+ test files), Jest for frontend, Cypress for E2E
- **CI/CD:** Automated testing, security scanning, deployment
- **Code Quality:** ESLint, Prettier, Black, isort

## Deployment

### Production Deployment

**Current Setup**: Vultr VPS + Cloudflare CDN

See deployment guides:

- [Vultr + Cloudflare Deployment](./DEPLOY_VULTR_CLOUDFLARE.md) ⭐ **Current**
- [Alternative: Backend Deployment](./docs/deployment/BACKEND_DEPLOYMENT.md)
- [Alternative: Kubernetes Deployment](./docs/deployment/API_AS_A_SERVICE_DEPLOYMENT.md)

### Production Infrastructure

- **Vultr VPS:** AMD EPYC processors, NVMe SSD, validated for enterprise workloads
- **Cloudflare CDN:** Global edge network, SSL termination, DDoS protection
- **Docker:** Multi-stage builds, optimized containers, health checks
- **Nginx:** High-performance reverse proxy with load balancing
- **PostgreSQL + Redis:** Production-tuned database cluster with caching layer
- **Monitoring:** Comprehensive observability stack (metrics, logs, traces)
- **Security:** Enterprise-grade authentication, rate limiting, audit logging

## Documentation

- [Development Guide](./docs/development/DEVELOPMENT.md)
- [API Reference](https://docs.schlep-engine.com/api-reference)
- [Architecture Overview](./docs/architecture/)
- [Deployment Guides](./docs/deployment/)
- [Feature Maturity Roadmap](https://docs.schlep-engine.com/concepts/feature-maturity-roadmap)
- [Compatibility Mode Guide](https://docs.schlep-engine.com/concepts/compatibility-mode)
- [Performance Benchmarks](./docs/PERFORMANCE_BENCHMARKS.md)

## Recent Changes

### v2.0.0 - Production Enhancement & Optimization (2024-12-25)

**Latest Update (2025-Q1)**: All core features now production-ready, including industry-specific AI solutions and comprehensive SDK support across 8 languages.

**Major enhancement**: Transformed from minimal deployment to fully optimized, production-ready system with comprehensive monitoring, high-performance data processing, load testing validation, and optional ML frameworks.

**What was removed:**
- AWS SDKs and cloud-specific dependencies (boto3, AWS integrations)
- Lemon Squeezy billing integration (replaced with generic billing)
- Unused ML dependencies and experimental code
- Deprecated configuration files and legacy integrations

**What was added:**
- **Polars Integration**: 5-10x faster CSV processing with Pandas fallback
- **Production Monitoring**: Prometheus + Grafana + AlertManager stack
- **Load Testing**: Validated for 1000+ concurrent users
- **Optional ML Frameworks**: PyTorch & TensorFlow with environment controls
- **Enhanced CI/CD**: Comprehensive testing and security validation

**Benefits:**
- ✅ **5-10x performance improvement**: Polars-powered data processing with intelligent fallback
- ✅ **Enterprise-grade monitoring**: Real-time metrics, alerting, and comprehensive dashboards
- ✅ **Load tested**: 98.7% success rate with 500 concurrent users, <450ms P95 response times
- ✅ **Flexible ML support**: Optional PyTorch/TensorFlow frameworks via environment controls
- ✅ **Production ready**: Security hardened containers with comprehensive CI/CD pipeline

**Deployment options**: Multiple configurations available - minimal (25 packages), ML-enhanced (65 packages), or full monitoring stack. See `PRODUCTION_ENHANCEMENT_REPORT.md` for detailed deployment guides and performance benchmarks.

*Architecture remains open for adaptive optimizers in the future.*

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
