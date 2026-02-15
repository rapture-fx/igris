# Igris Inertial Developer Onboarding Guide

Welcome to the Igris Inertial project! This guide will help you get up and running quickly.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Local Development Setup](#local-development-setup)
4. [Running the System](#running-the-system)
5. [Testing](#testing)
6. [Contributing](#contributing)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Igris Inertial** is an intelligent LLM routing and governance platform that:

- **Semantic Routing**: Classifies prompts and routes to optimal providers
- **Adaptive Learning**: Uses Thompson Sampling bandits to learn from feedback
- **Adaptive Governance**: Enforces SLA policies and auto-tunes weights
- **Cost Optimization**: Balances latency, cost, and success rates

### Key Features (Phase 3 & 4)

- ✅ **ML-Based Classification**: ONNX DistilBERT model (≥92% accuracy)
- ✅ **Thompson Sampling**: Multi-armed bandit for provider selection
- ✅ **Bayesian Optimization**: Auto-tuning reward weights with 95% confidence
- ✅ **Policy DSL v2**: Hot-reload policies with <1s latency
- ✅ **SLA Management**: Real-time compliance checking and auto-degradation
- ✅ **Telemetry**: 22 Prometheus metrics for observability

---

## Architecture

### High-Level Components

```
┌─────────────────┐
│   API Gateway   │  (Go, FastAPI)
└────────┬────────┘
         │
    ┌────┴────┐
    │ Routing │
    └────┬────┘
         │
    ┌────┴─────────────────────────────┐
    │                                  │
┌───┴──────────┐            ┌─────────┴────────┐
│   Semantic   │            │    Governance    │
│ Classifier   │            │   Policy Engine  │
│ (ONNX Model) │            │   SLA Manager    │
└───┬──────────┘            └─────────┬────────┘
    │                                 │
    │         ┌───────────────────────┘
    │         │
┌───┴─────────┴───┐
│  Thompson        │
│  Sampling        │
│  Bandit          │
└──────┬───────────┘
       │
┌──────┴───────────┐
│  Feedback Loop   │
│  (Async Queue)   │
└──────────────────┘
```

### Data Flow

1. **Request Arrives** → API Gateway
2. **Semantic Classification** → ONNX Model (or keyword fallback)
3. **Provider Selection** → Thompson Sampling Bandit
4. **Policy Check** → DSL Engine validates request
5. **LLM Inference** → Selected provider
6. **Feedback Submission** → Async queue updates bandit arms
7. **SLA Monitoring** → Real-time compliance checking

---

## Local Development Setup

### Prerequisites

- **Go 1.21+**
- **Python 3.9+** (for ONNX model training)
- **Docker & Docker Compose**
- **PostgreSQL 15**
- **Redis 7**
- **Git**

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/igris-inertial.git
cd igris-inertial

# 2. Install Go dependencies
go mod download

# 3. Set up Python environment (for model training)
python3 -m venv venv
source venv/bin/activate
pip install -r internal/semantic/model_training/requirements.txt

# 4. Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# 5. Start infrastructure services
docker-compose up -d postgres redis

# 6. Run database migrations
./scripts/run_migrations.sh

# 7. Seed test data (optional)
./scripts/seed_test_data.sh
```

---

## Running the System

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f igris-overture

# Stop services
docker-compose down
```

### Option 2: Local Development

```bash
# Terminal 1: Start API server
export DATABASE_URL="postgres://igris:password@localhost:5432/igris_dev?sslmode=disable"
export REDIS_URL="redis://localhost:6379/0"
go run cmd/igris-overture/main.go

# Terminal 2: Start scheduler (optional)
go run cmd/scheduler/main.go

# Terminal 3: Run tests
go test ./... -v
```

### Verify Installation

```bash
# Check API health
curl http://localhost:8081/health

# Test semantic classification
curl -X POST http://localhost:8081/v1/routing/semantic/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a Python function to reverse a string"}'

# Expected response:
# {"class": "code_generation", "confidence": 0.92, "latency_ms": 15.3}
```

---

## Testing

### Test Structure

```
tests/
├── unit/                       # Unit tests (Go)
├── integration/                # Integration tests
│   ├── phase3_semantic_e2e_test.go
│   ├── phase4_governance_e2e_test.go
│   ├── e2e_bandit_scenarios.go
│   └── e2e_bandit_feedback_test.go
├── load/                       # Load tests
│   └── load_test_semantic_routing.sh
└── db/                         # Database tests
    ├── db_load_test.sh
    └── db_retention_test.sh
```

### Running Tests

```bash
# Unit tests
go test ./internal/... -v

# Integration tests (requires Docker)
docker-compose -f docker-compose.ci.yml up -d
go test -tags=integration ./tests/... -v

# Load tests
./tests/load_test_semantic_routing.sh

# Database tests
./tests/db_load_test.sh
./tests/db_retention_test.sh

# CI/CD tests (GitHub Actions)
gh workflow run e2e.yml
```

### Test Coverage

```bash
# Generate coverage report
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out

# Target: ≥80% coverage
```

---

## Contributing

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/semantic-routing-v2

# 2. Make changes
# ... code, test, commit ...

# 3. Run tests locally
go test ./... -v
./tests/load_test_semantic_routing.sh

# 4. Commit with descriptive message
git commit -m "feat(semantic): Add ONNX classifier with shadow mode"

# 5. Push and create PR
git push origin feature/semantic-routing-v2
gh pr create --title "Add ONNX Classifier" --body "..."
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactor
- `test`: Add/update tests
- `docs`: Documentation
- `perf`: Performance improvement

### Code Review Checklist

- [ ] Tests pass locally and in CI
- [ ] Code coverage ≥80%
- [ ] No new linter warnings
- [ ] Documentation updated
- [ ] Metrics/observability added
- [ ] Performance benchmarks (if applicable)

---

## Common Tasks

### 1. Train a New ONNX Model

```bash
cd internal/semantic/model_training

# Prepare training data (CSV format)
# prompt,label
# "Write a Python function...",code_generation
# ...

# Train model
python train_classifier.py \
  --train_data=training_data.csv \
  --test_data=test_data.csv \
  --output_dir=./models/semantic_classifier

# Export to ONNX
python export_onnx.py \
  --model_dir=./models/semantic_classifier \
  --output=semantic_classifier.onnx \
  --quantize

# Deploy model
cp semantic_classifier_quantized.onnx ../models/
```

### 2. Add a New Semantic Class

```go
// internal/semantic/classifier.go

// 1. Add class definition
const (
    ClassCodeGeneration    = "code_generation"
    ClassQuestionAnswering = "question_answering"
    ClassYourNewClass      = "your_new_class"  // Add here
)

// 2. Register class with keywords
classifier.RegisterClass("your_new_class", []string{
    "keyword1", "keyword2", "keyword3",
}, 0.7) // confidence threshold

// 3. Update database schema (if needed)
ALTER TABLE semantic_classifications
  ADD CONSTRAINT check_class
  CHECK (class IN ('code_generation', ..., 'your_new_class'));

// 4. Retrain ONNX model with new class
```

### 3. Create a New Policy

```yaml
# Create policy YAML
tenant_id: acme-corp
version: 1
allow:
  - provider: ["openai", "anthropic"]
    max_cost_usd: 0.05
    prefer: latency
    retry_chain: ["openai", "anthropic", "cohere"]

weights:
  latency: 0.5
  cost: 0.3
  success: 0.2

# Upload via API
curl -X POST http://localhost:8081/v1/policies \
  -H "Content-Type: application/json" \
  -d @policy.json
```

### 4. Monitor System Health

```bash
# View Prometheus metrics
curl http://localhost:8081/metrics

# Check semantic classification stats
curl http://localhost:8081/v1/routing/semantic/stats

# Check feedback stats
curl http://localhost:8081/v1/feedback/stats

# View Grafana dashboards
open http://localhost:3000
```

### 5. Tune Bayesian Optimizer

```go
// internal/scheduler/bayesian_tuner.go

// Adjust confidence threshold (default: 0.95)
tuner.posteriorConfidence = 0.90

// Adjust canary percentage (default: 0.01 = 1%)
tuner.canaryPercentage = 0.05 // 5%

// Change optimization interval (default: 7 days)
tuner.interval = 3 * 24 * time.Hour // 3 days
```

---

## Troubleshooting

### Issue: API Server Won't Start

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check Redis connection
redis-cli ping

# View logs
docker-compose logs igris-overture

# Common fixes:
# - Verify DATABASE_URL and REDIS_URL in .env
# - Run migrations: ./scripts/run_migrations.sh
# - Check port conflicts: lsof -i :8081
```

### Issue: Tests Failing

```bash
# Reset test database
docker-compose -f docker-compose.ci.yml down -v
docker-compose -f docker-compose.ci.yml up -d

# Re-run migrations
DATABASE_URL="postgres://igris:igris_ci_password@localhost:5433/igris_test?sslmode=disable" \
  ./scripts/run_migrations.sh

# Run tests with verbose output
go test ./tests/... -v -tags=integration
```

### Issue: ONNX Model Not Loading

```bash
# Verify model file exists
ls -lh internal/semantic/models/semantic_classifier.onnx

# Check model format
python -c "import onnx; print(onnx.load('semantic_classifier.onnx'))"

# Enable shadow mode (fallback to keyword classifier)
export USE_ONNX_CLASSIFIER=true
export ONNX_SHADOW_MODE=true
```

### Issue: Bandit Not Converging

```bash
# Check if feedback is being processed
curl http://localhost:8081/v1/feedback/stats

# Verify bandit arm updates
psql $DATABASE_URL -c "SELECT * FROM bandit_arms WHERE semantic_class = 'code_generation';"

# Check reward calculation
curl http://localhost:8081/v1/analytics/rewards/composition
```

### Issue: High Alert Noise

```bash
# Review alert rules
vim infra/monitoring/prometheus/rules_tuned.yml

# Adjust thresholds or `for` durations
# Example: Increase latency threshold from 500ms to 1s

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload
```

---

## Additional Resources

- **Architecture Overview**: [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
- **API Documentation**: [API.md](./API.md)
- **Phase 3/4 Summary**: [PHASE_3_4_IMPLEMENTATION_SUMMARY.md](./PHASE_3_4_IMPLEMENTATION_SUMMARY.md)
- **Model Training Guide**: [internal/semantic/model_training/README.md](../internal/semantic/model_training/README.md)

---

## Getting Help

- **Slack**: #igris-inertial-dev
- **GitHub Issues**: https://github.com/your-org/igris-inertial/issues
- **Team Lead**: @tech-lead
- **Documentation**: https://docs.igris-inertial.com

---

**Welcome to the team! 🚀**
