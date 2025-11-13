# Quality Routing - Quick Start Guide

## ✨ Overview

Quality routing is **NOW ENABLED BY DEFAULT** in Schlep-Engine. The system automatically:
- Classifies every request by domain (code, creative, analytical, general)
- Scores response quality in real-time (<0.032ms overhead)
- Optimizes routing based on quality (30%), latency (25%), cost (20%), and success (25%)

**Value Proposition**: **Optimal AI allocation** - not just the cheapest model, but the *best* model for each task.

---

## 🚀 Quick Start (5 minutes)

### 1. **Run Database Migration** (Optional - for preferences API)

```bash
# If you have PostgreSQL set up:
psql -d schlep_engine -f migrations/011_create_customer_routing_preferences.sql

# Or use your migration tool:
# goose up
# migrate up
```

### 2. **Start the API** (Quality routing auto-enabled)

```bash
# Default mode: Quality routing with balanced weights
go run ./cmd/schlep-engine-api

# Quality routing is enabled by default via:
# r.enableQualityRouting = true  (line 67, router_integration.go)
```

### 3. **Test Quality Routing**

```bash
# Test with a code request (should route to high-quality provider)
curl -X POST http://localhost:8080/v1/infer \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Write a Python function to calculate Fibonacci numbers with memoization"}],
    "max_tokens": 500
  }'

# Check logs for quality scoring:
# [Router] 🦀 Sent optimizer feedback: provider=openai_benchmark, latency=123ms, cost=$0.000450, quality=0.745
```

---

## 📊 Routing Modes

Quality routing supports 3 optimization modes:

| Mode | Quality Weight | Latency Weight | Cost Weight | Success Weight | Use Case |
|------|----------------|----------------|-------------|----------------|----------|
| `cost` | 10% | 30% | 30% | 30% | Cost-sensitive workloads |
| `balanced` | **30%** | 25% | 20% | 25% | **DEFAULT - Best of both worlds** |
| `quality` | **50%** | 15% | 15% | 20% | Production apps requiring high quality |

---

## 🎛️ Configuration Options

### Environment Variables

```bash
# Quality routing (enabled by default)
ENABLE_QUALITY_ROUTING=true

# Database (required for preferences API)
ENABLE_PERSISTENCE=true
DATABASE_URL=postgresql://user:pass@localhost:5432/schlep_engine

# Multi-tenancy (optional)
ENABLE_MULTI_TENANCY=true
```

### Customer Preferences API

Once the database is set up, customers can configure their routing preferences:

#### **Get Current Preferences**

```bash
curl http://localhost:8080/v1/preferences/routing \
  -H 'Authorization: Bearer <tenant-jwt-token>'
```

**Response**:
```json
{
  "tenant_id": "customer-123",
  "optimization_mode": "balanced",
  "max_cost_per_request": null,
  "min_quality_score": null,
  "max_latency_ms": null,
  "domain_preferences": {}
}
```

#### **Update to Quality Mode**

```bash
curl -X PUT http://localhost:8080/v1/preferences/routing \
  -H 'Authorization: Bearer <tenant-jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "optimization_mode": "quality"
  }'
```

#### **Custom Weights**

```bash
curl -X PUT http://localhost:8080/v1/preferences/routing \
  -H 'Authorization: Bearer <tenant-jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "optimization_mode": "custom",
    "quality_weight": 0.6,
    "cost_weight": 0.2,
    "latency_weight": 0.2
  }'
```

#### **Domain-Specific Preferences**

```bash
curl -X PUT http://localhost:8080/v1/preferences/routing \
  -H 'Authorization: Bearer <tenant-jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "optimization_mode": "balanced",
    "domain_preferences": {
      "code": {
        "domain": "code",
        "quality_weight": 0.7,
        "cost_weight": 0.1
      },
      "creative": {
        "domain": "creative",
        "quality_weight": 0.4,
        "cost_weight": 0.3
      }
    }
  }'
```

---

## 📈 Monitoring Quality Routing

### Check Logs

Quality routing logs include quality scores:

```
[Router] 🦀 Sent optimizer feedback: provider=openai_benchmark, latency=123ms, cost=$0.000450, quality=0.745
```

- **quality=0.745**: High quality response (0.0-1.0 scale)
- **quality=nil**: Quality scoring timed out or disabled

### Quality Score Interpretation

- **0.8-1.0**: Excellent quality (well-structured, accurate, comprehensive)
- **0.6-0.8**: Good quality (acceptable, meets requirements)
- **0.4-0.6**: Fair quality (usable but could be better)
- **0.0-0.4**: Low quality (refusal, errors, or poor structure)

---

## 🧪 Testing Different Scenarios

### 1. **Code Generation (High Quality Sensitivity)**

```bash
curl -X POST http://localhost:8080/v1/infer \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Implement a binary search tree in Python with insert, delete, and search methods"}]
  }'
```

**Expected Behavior**:
- Classification: `domain=code, complexity=complex, sensitivity=high`
- Routing: Prioritizes high-quality providers (e.g., GPT-4, Claude)
- Quality Score: 0.7-0.9 (code structure, syntax, comments)

### 2. **Creative Writing (Medium Quality Sensitivity)**

```bash
curl -X POST http://localhost:8080/v1/infer \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Write a short story about a robot discovering emotions"}]
  }'
```

**Expected Behavior**:
- Classification: `domain=creative, complexity=moderate, sensitivity=medium`
- Routing: Balanced between quality and cost
- Quality Score: 0.6-0.8 (descriptive language, narrative structure)

### 3. **Simple Query (Low Quality Sensitivity)**

```bash
curl -X POST http://localhost:8080/v1/infer \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
  }'
```

**Expected Behavior**:
- Classification: `domain=general, complexity=simple, sensitivity=low`
- Routing: May route to cost-effective providers
- Quality Score: 0.5-0.7 (simple but correct)

---

## 🔧 Troubleshooting

### Quality Scores Always `nil`

**Cause**: Quality scoring timeout or disabled

**Solutions**:
1. Check if quality routing is enabled:
   ```go
   // In router_integration.go:67
   enableQualityRouting: true
   ```

2. Increase timeout (default 20ms):
   ```go
   // In router_integration.go:479
   20*time.Millisecond  // Increase if needed
   ```

### Database Connection Errors

**Cause**: Preferences API requires PostgreSQL

**Solutions**:
1. Set up database:
   ```bash
   export DATABASE_URL=postgresql://localhost:5432/schlep_engine
   export ENABLE_PERSISTENCE=true
   ```

2. Run migration:
   ```bash
   psql -d schlep_engine -f migrations/011_create_customer_routing_preferences.sql
   ```

3. Verify connection:
   ```bash
   # Check logs for:
   [Database] ✅ Database connection established
   ```

### Preferences API Returns 404

**Cause**: Routes not registered

**Solutions**:
1. Ensure database is enabled: `ENABLE_PERSISTENCE=true`
2. Check if routes are registered in logs:
   ```
   [Routes] ✓ POST /v1/infer (PUBLIC)
   ```

---

## 📚 Implementation Details

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Inference Request                                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Request Classifier                                  │
│  - Domain detection (code, creative, analytical)     │
│  - Complexity scoring (simple, moderate, complex)    │
│  - Quality sensitivity (low, medium, high)           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Reward Policy Builder                               │
│  - Load customer preferences (DB)                    │
│  - Apply domain-specific adjustments                 │
│  - Build weighted reward policy                      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Thompson Sampling (Rust Optimizer)                  │
│  - Select provider based on weighted rewards         │
│  - Balance exploration (10%) vs exploitation (90%)   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Provider Execution                                  │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Quality Scorer                                      │
│  - Calculate heuristic quality score                 │
│  - Response length, structure, coherence             │
│  - Domain-specific quality checks                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Feedback Loop                                       │
│  - Update optimizer with quality, latency, cost      │
│  - Improve future routing decisions                  │
└─────────────────────────────────────────────────────┘
```

### Performance Characteristics

- **Request Classification**: ~0.075ms
- **Quality Score Calculation**: ~0.032ms
- **Total Overhead**: <0.2ms per request
- **Routing Decision**: ~50ms (unchanged)

### Files Modified/Created

**New Packages**:
- `internal/inference/quality/` - Quality scoring engine (4 files)
- `internal/models/customer_preferences.go` - Preferences model
- `migrations/011_create_customer_routing_preferences.sql` - DB schema

**Modified**:
- `internal/inference/router/router_integration.go` - Quality integration
- `internal/inference/router/reward_builder.go` - Dynamic reward policies
- `cmd/schlep-engine-api/handlers/infer.go` - DB parameter
- `cmd/schlep-engine-api/handlers/preferences.go` - Preferences API
- `internal/api/routes_infer.go` - Route registration
- `internal/api/routes_metrics.go` - Route registration
- `cmd/schlep-engine-api/main.go` - DB passing

---

## 🎯 Next Steps

1. **Monitor Quality Scores**: Track quality metrics in production
2. **Collect Feedback**: Add thumbs up/down for quality validation
3. **Run Benchmarks**: Measure quality improvements vs. cost-only routing
4. **A/B Testing**: Compare `balanced` vs `quality` modes
5. **Tune Weights**: Adjust default weights based on customer feedback

---

## 📞 Support

- **Documentation**: `/docs` folder
- **Issues**: GitHub Issues
- **Feature Requests**: GitHub Discussions

---

**Quality routing is live! 🎉**

Every request is now routed with quality-awareness by default.
