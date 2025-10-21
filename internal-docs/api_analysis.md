# Schlep-Engine API Structure Analysis - Phase 14 Multi-Tenancy Integration

## Executive Summary

The Schlep-Engine API has a modular Fiber-based architecture with clear separation of concerns. The existing structure provides good integration points for Phase 14 multi-tenancy features, including tenant authentication, BYOK vault endpoints, and policy APIs.

---

## 1. CURRENT API HANDLER STRUCTURE

### Main Entry Points

**Location**: `/Users/wira/Desktop/schlep-engine/cmd/schlep-api/`

#### 1.1 Primary Entry Point: `main.go`
- **Framework**: Fiber v2 (Go web framework)
- **Key Initialization**:
  - Metrics middleware (for observability)
  - CORS middleware (cross-origin support)
  - TraceID middleware (distributed tracing)
  - Request logger (structured logging)
  - Custom error handler (centralized error handling)

**Critical Code Structure**:
```go
app := fiber.New(fiber.Config{
    AppName:      "Schlep-Engine API",
    ServerHeader: "Schlep-Engine",
    ErrorHandler: customErrorHandler,
})

// Middleware stack
app.Use(recover.New())
app.Use(cors.New())
app.Use(middleware.TraceID())
app.Use(middleware.RequestLogger())

// Routes registration
api.RegisterAllRoutes(app)
```

#### 1.2 Handler Structure: `handlers/infer.go`
- **Handler Type**: `InferHandler` struct
- **Responsibilities**:
  - Inference request processing
  - Provider routing (OpenAI, Anthropic)
  - Safety checks (budget, token limits)
  - Streaming support
  - Shadow mode optimization (Rust/Go routing)

**Handler Components**:
- `router` (InferenceRouter) - Routes to providers
- `shadowRunner` (ShadowRunner) - Rust optimizer
- `sloBreaker` (SLOBreaker) - Safety guardrails
- `runtimeConfig` (RuntimeOptimizerConfig) - Dynamic config
- `activationMetrics` (ActivationMetricsRecorder) - Telemetry
- `safetyController` (SafetyController) - Budget/token enforcement

---

## 2. ENDPOINT DEFINITIONS AND ROUTING

### 2.1 Route Registration Structure

**Location**: `/Users/wira/Desktop/schlep-engine/internal/api/`

#### Routes Files:
1. **routes_infer.go**: Inference endpoints
2. **routes_metrics.go**: Observability endpoints
3. **admin_optimizer.go**: Admin API (token-based auth)

#### Core Endpoints

**Inference Routes** (via `RegisterInferRoutes()`):
- `POST /v1/infer` - Main inference endpoint
- `POST /v1/chat/completions` - OpenAI-compatible alias
- `GET /v1/health` - Health check
- `GET /v1/models` - List available models
- `GET /v1/providers/stats` - Provider statistics

**Metrics Routes** (via `RegisterMetricsRoutes()`):
- `GET /metrics` - Prometheus format metrics
- `GET /v1/metrics` - JSON aggregated metrics
- `GET /v1/metrics/health` - Metrics collection health
- `GET /v1/metrics/debug` - Debug information

**Admin Routes** (via admin_optimizer.go):
- `POST /admin/optimizer` - Update optimizer config (X-Admin-Token auth)
- `GET /admin/optimizer/status` - Get optimizer status (X-Admin-Token auth)

### 2.2 Route Registration Flow

```
RegisterAllRoutes(app)
├── RegisterInferRoutes(app)
│   ├── Create InferHandler
│   └── Register v1 routes
├── RegisterMetricsRoutes(app)
│   ├── Prometheus endpoint
│   └── Schlep-specific metrics
└── (Optional) Register admin routes
```

---

## 3. REQUEST PROCESSING FLOW

### 3.1 Inference Request Lifecycle

```
HTTP Request
    ↓
[Middleware Chain]
  ├── recover.New() - Panic recovery
  ├── cors.New() - CORS handling
  ├── TraceID() - Add trace ID (X-Trace-ID header)
  ├── RequestLogger() - Structured logging
  └── (Optional) Metrics middleware
    ↓
[Route Handler] InferHandler.HandleInfer()
  ├── Parse JSON body → InferRequest
  ├── Validate request
  ├── PHASE 12: Safety checks (PreRequestCheck)
  │   ├── Budget validation
  │   ├── Token limit checks
  │   └── Benchmark fallback decision
  ├── Determine routing (Go vs Rust optimizer)
  ├── Route to provider
  │   ├── If Rust: routeWithRustOptimizer()
  │   └── If Go: router.Route()
  ├── PHASE 12: Record cost (PostRequestRecord)
  ├── Record metrics
  └── Return JSON response
    ↓
HTTP Response + X-Trace-ID header
```

### 3.2 Safety Controller Integration (Phase 12)

**Location**: `/Users/wira/Desktop/schlep-engine/internal/safety/`

The SafetyController is initialized in InferHandler:
```go
safetyConfig := safety.LoadSafetyConfig()
safetyController := safety.NewSafetyController(safetyConfig)
```

**Pre-request checks**:
```go
safetyCheck, err := h.safetyController.PreRequestCheck(&req, estimatedCost)
if err != nil || !safetyCheck.Allowed {
    return c.Status(fiber.StatusForbidden).JSON(...)
}
```

**Post-request recording**:
```go
h.safetyController.PostRequestRecord(provider, model, costUSD)
```

---

## 4. INTEGRATION POINTS FOR MIDDLEWARE

### 4.1 Middleware Architecture

**Location**: `/Users/wira/Desktop/schlep-engine/internal/middleware/`

Current middleware includes:
1. **inference.go**: Trace ID and metrics for inference
2. **ratelimit.go**: Token bucket rate limiting

### 4.2 Middleware Stack Order (in main.go)

```go
// CRITICAL: Order matters!
app.Use(recover.New())           // 1. Panic recovery (first)
app.Use(cors.New())              // 2. CORS handling
app.Use(middleware.TraceID())    // 3. Add X-Trace-ID
app.Use(middleware.RequestLogger()) // 4. Structured logging

// Routes registered here
api.RegisterAllRoutes(app)
```

### 4.3 Integration Points for Phase 14

**Tenant Authentication Middleware** should go:
- **Position**: After TraceID, before route handlers
- **Order**: recover → cors → traceID → **[TENANT AUTH]** → RequestLogger
- **Responsibility**: Extract tenant ID, validate, add to context

**BYOK Vault Middleware** could:
- Extend RateLimiter for per-tenant rate limits
- Add tenant-specific secret access controls
- Validate vault keys before provider calls

---

## 5. CURRENT AUTHENTICATION/AUTHORIZATION

### 5.1 Existing Auth Infrastructure

**Location**: `/Users/wira/Desktop/schlep-engine/internal/security/auth.go`

#### JWT Authentication
```go
type Claims struct {
    UserID   string
    Email    string
    Roles    []string
    jwt.RegisteredClaims
}

// Middleware available but NOT currently used in main API
JWTMiddleware(config *AuthConfig) fiber.Handler
```

#### API Key Authentication (Alternative)
```go
APIKeyMiddleware(config *APIKeyConfig) fiber.Handler
```

#### Role-Based Access Control
```go
RequireRole(requiredRole string) fiber.Handler
```

### 5.2 Admin API Authentication (Currently Used)

**Location**: `/Users/wira/Desktop/schlep-engine/internal/api/admin_optimizer.go`

Uses simple token validation:
```go
adminToken := c.Get("X-Admin-Token")
expectedToken := h.runtimeConfig.GetAdminToken()
if adminToken != expectedToken {
    return c.Status(fiber.StatusUnauthorized).JSON(...)
}
```

### 5.3 Key Validation (Phase 12)

**Location**: `/Users/wira/Desktop/schlep-engine/internal/safety/key_validator.go`

Validates OpenAI/Anthropic API keys:
- `ValidateOpenAIKey()` - Tests /v1/models endpoint
- `ValidateAnthropicKey()` - Tests /v1/messages endpoint
- `ValidateAllKeys()` - Validates all configured keys

**Future TODOs** (from code comments):
```
// TODO Phase 14: Add key rotation support
// TODO Phase 14: Add key expiry detection and warnings
// TODO Phase 15: Add UI for customer BYOK key upload and validation
// TODO Phase 15: Add encrypted key storage
```

### 5.4 Audit Logging (Phase 13+)

**Location**: `/Users/wira/Desktop/schlep-engine/internal/safety/audit_logger.go`

Already supports tenant-based audit logging:
```go
type AuditLogger struct {
    db       *sql.DB
    tenantID string  // Already tenant-aware!
    ...
}

// Event types
EventTypeBudgetCheck, EventTypeBudgetBreach,
EventTypeTokenLimit, EventTypeKeyValidation,
EventTypeFallbackTriggered, EventTypePolicyViolation
```

---

## 6. INTEGRATION POINTS FOR PHASE 14

### 6.1 Tenant Authentication Middleware

**New Middleware Location**: `internal/middleware/tenant.go`

```go
// TenantContext extracts and validates tenant from request
type TenantContext struct {
    TenantID     string
    TenantAPIKey string
    UserID       string
    Roles        []string
}

// TenantMiddleware() should:
// 1. Extract tenant ID from header or JWT claims
// 2. Validate tenant is active
// 3. Load tenant config (rate limits, budget)
// 4. Store in context for downstream handlers
```

**Integration Point**:
```go
// In main.go after TraceID middleware
app.Use(middleware.TenantAuth())
```

### 6.2 BYOK Vault Endpoints

**New Route File**: `internal/api/routes_vault.go`

```go
// POST /v1/tenants/{tenantID}/vault/keys - Upload BYOK keys
// GET /v1/tenants/{tenantID}/vault/keys - List vault keys
// PUT /v1/tenants/{tenantID}/vault/keys/{keyID} - Rotate key
// DELETE /v1/tenants/{tenantID}/vault/keys/{keyID} - Delete key
// POST /v1/tenants/{tenantID}/vault/validate - Validate keys
```

**Requires New Handler**: `internal/api/vault_handler.go`

### 6.3 Tenant Policy Endpoints

**New Route File**: `internal/api/routes_policy.go`

```go
// GET /v1/tenants/{tenantID}/policies - List policies
// POST /v1/tenants/{tenantID}/policies - Create policy
// PUT /v1/tenants/{tenantID}/policies/{policyID} - Update policy
// DELETE /v1/tenants/{tenantID}/policies/{policyID} - Delete policy
// POST /v1/tenants/{tenantID}/policies/{policyID}/validate - Validate policy
```

**Requires New Handler**: `internal/api/policy_handler.go`

**Policy Structure** already exists at:
- `internal/inference/policy/policy.go`
- `internal/inference/policy/policy_versioning.go`

### 6.4 Tenant Management Endpoints

**New Route File**: `internal/api/routes_tenants.go`

```go
// GET /v1/admin/tenants - List all tenants (admin only)
// POST /v1/admin/tenants - Create tenant
// GET /v1/admin/tenants/{tenantID} - Get tenant details
// PUT /v1/admin/tenants/{tenantID} - Update tenant
// GET /v1/tenants/me - Get current tenant info
// PUT /v1/tenants/me - Update current tenant settings
```

### 6.5 Tenant-Aware Inference

**Modifications**: `internal/api/routes_infer.go`

```go
// Existing endpoints become tenant-aware:
// POST /v1/infer?tenant_id={tenantID}
// POST /v1/chat/completions?tenant_id={tenantID}

// New endpoints:
// POST /v1/tenants/{tenantID}/infer
// POST /v1/tenants/{tenantID}/chat/completions
```

---

## 7. RECOMMENDED INTEGRATION STRATEGY

### Phase 7.1: Preparation (Minimal Code Changes)

1. **Create middleware foundation**:
   - `internal/middleware/tenant.go` - Extract tenant context
   - Add to middleware stack after TraceID

2. **Update handlers to accept tenant context**:
   - Extract `tenantID` from context in existing handlers
   - Currently handlers use default/mock provider

3. **Extend SafetyController** (already partially done):
   - Add tenant-specific budget limits
   - Add tenant-specific rate limits
   - Use AuditLogger.tenantID for multi-tenant audits

### Phase 7.2: BYOK Implementation

1. **Create vault package**:
   - `internal/vault/` - Key storage and retrieval
   - `internal/vault/encrypt.go` - Encryption utilities
   - `internal/vault/validator.go` - Extend key_validator

2. **Add vault routes**:
   - `internal/api/routes_vault.go`
   - `internal/api/vault_handler.go`

3. **Extend provider registry**:
   - Allow per-tenant provider credentials
   - Route BYOK keys to providers securely

### Phase 7.3: Policy Implementation

1. **Create policy enforcement**:
   - `internal/api/policy_handler.go`
   - `internal/api/routes_policy.go`
   - Extend SafetyController with policy checks

2. **Tenant-specific policies**:
   - Budget limits
   - Model restrictions
   - Provider preferences
   - Token limits

---

## 8. DATABASE SUPPORT

**Location**: `/Users/wira/Desktop/schlep-engine/internal/database/`

Existing database infrastructure:
- SQL database support already initialized
- Audit logger uses database (`audit_events` table)
- Budget tracker uses database
- Policy persistence uses database

**For Phase 14, add tables**:
```sql
-- Tenants table
CREATE TABLE tenants (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    billing_email VARCHAR(255),
    ...
);

-- Tenant API Keys table
CREATE TABLE tenant_api_keys (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) REFERENCES tenants(id),
    key_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP,
    ...
);

-- Tenant Policies table
CREATE TABLE tenant_policies (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) REFERENCES tenants(id),
    policy_config JSONB,
    created_at TIMESTAMP,
    ...
);

-- Tenant BYOK Keys Vault table
CREATE TABLE tenant_byok_keys (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) REFERENCES tenants(id),
    provider VARCHAR(50) NOT NULL,
    key_encrypted TEXT NOT NULL,
    created_at TIMESTAMP,
    ...
);
```

---

## 9. METRICS & OBSERVABILITY

**Location**: `/Users/wira/Desktop/schlep-engine/internal/metrics/`

Current metrics support:
- Provider metrics (cost, latency, errors)
- Request latency tracking
- Prometheus export

**For Phase 14, add**:
- Per-tenant metrics
- Per-tenant cost aggregation
- Per-tenant error rates
- Policy violation metrics

---

## 10. HANDLER DEPENDENCY INJECTION

### Current Pattern

InferHandler is initialized in `RegisterInferRoutes()`:
```go
inferHandler, err := handlers.NewInferHandler()
if err != nil {
    return err
}

v1.Post("/infer", inferHandler.HandleInfer)
```

### Recommended for Phase 14

Create a `TenantContext` that flows through:
```go
type TenantHandler struct {
    handler *InferHandler
    tenantID string
    config *TenantConfig
}

// Middleware extracts tenant, wraps handler
app.Use(extractTenant()) // Sets c.Locals("tenant")

v1.Post("/infer", func(c *fiber.Ctx) error {
    tenantID := c.Locals("tenant_id")
    tenantConfig := c.Locals("tenant_config")
    return inferHandler.HandleInferWithTenant(c, tenantID, tenantConfig)
})
```

---

## 11. ERROR HANDLING & STATUS CODES

Current error handler: `customErrorHandler()` in `main.go`

**For Phase 14, add tenant-specific errors**:
- 401: Invalid tenant credentials
- 403: Tenant policy violation
- 429: Tenant rate limit exceeded
- 451: Tenant vault key missing

---

## 12. CONFIGURATION MANAGEMENT

**Location**: `/Users/wira/Desktop/schlep-engine/internal/config/`

Existing:
- `optimizer_config.go` - Optimizer settings
- Environment variable loading

**For Phase 14, extend**:
- Tenant config loader
- Per-tenant environment overrides
- Tenant-specific feature flags

---

## SUMMARY: File Locations for Phase 14 Implementation

| Component | Location | Status |
|-----------|----------|--------|
| Main API | `/cmd/schlep-api/main.go` | Active |
| Routes | `/internal/api/routes_*.go` | Active |
| Handlers | `/cmd/schlep-api/handlers/` | Active |
| Middleware | `/internal/middleware/` | Extensible |
| Auth (JWT) | `/internal/security/auth.go` | Exists, unused |
| Safety | `/internal/safety/` | Phase 12 |
| Audit | `/internal/safety/audit_logger.go` | Tenant-ready |
| Database | `/internal/database/` | Available |
| Metrics | `/internal/metrics/` | Extensible |

---

## NEXT STEPS FOR PHASE 14

1. **Create tenant context middleware** (`internal/middleware/tenant.go`)
2. **Extend SafetyController** for tenant-specific budgets
3. **Create vault endpoints** (`internal/api/routes_vault.go`)
4. **Create policy endpoints** (`internal/api/routes_policy.go`)
5. **Create tenant management endpoints** (`internal/api/routes_tenants.go`)
6. **Migrate existing handlers** to use tenant context
7. **Add database migrations** for tenant tables
8. **Implement BYOK key rotation**
9. **Add per-tenant rate limiting**
10. **Update audit logging** for tenant segregation

