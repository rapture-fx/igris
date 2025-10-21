# Phase 14 Multi-Tenancy Integration - Quick Reference

## Key Files to Understand

### MUST READ (Foundation):
1. `/cmd/schlep-api/main.go` - Main entry point, middleware stack
2. `/internal/api/routes_infer.go` - Endpoint registration
3. `/cmd/schlep-api/handlers/infer.go` - Core handler logic

### PHASE 12 (Current Safety):
4. `/internal/safety/safety_controller.go` - Budget/token checks
5. `/internal/safety/audit_logger.go` - Already has tenantID field!

### PHASE 13+ (Audit):
6. `/internal/safety/audit_logger.go` - Multi-tenant ready

### EXISTING AUTH (Not Used):
7. `/internal/security/auth.go` - JWT & API key middleware

### TO EXTEND:
8. `/internal/middleware/ratelimit.go` - Extend for per-tenant
9. `/internal/config/` - Add tenant configuration

## What's Already in Place

✓ Middleware stack architecture (Fiber v2)
✓ TraceID injection (distributed tracing)
✓ Structured logging
✓ Error handling
✓ Provider registry pattern
✓ Safety checks (budget, tokens)
✓ Audit logging (tenant-aware)
✓ Database support
✓ JWT/API key auth code (available but unused)

## What's Missing

✗ Tenant authentication middleware
✗ Tenant context extraction
✗ BYOK vault endpoints
✗ Policy enforcement endpoints
✗ Tenant management endpoints
✗ Tenant-aware provider routing
✗ Per-tenant rate limiting
✗ Database schema for tenants

## Phase 14 Implementation Checklist

### 1. MIDDLEWARE (Priority 1)
- [ ] Create `internal/middleware/tenant.go`
  - Extract tenant from JWT/header
  - Validate tenant exists
  - Load tenant config
  - Store in c.Locals("tenant_context")

- [ ] Update `cmd/schlep-api/main.go`
  - Add middleware to stack after TraceID

### 2. VAULT ENDPOINTS (Priority 2)
- [ ] Create `internal/vault/` package
  - `encrypt.go` - AES-256-GCM encryption
  - `validator.go` - Extend key_validator.go
  - `storage.go` - Database operations
  - `manager.go` - Cache management

- [ ] Create `internal/api/vault_handler.go`
  - UploadKey()
  - ListKeys()
  - RotateKey()
  - DeleteKey()
  - ValidateKeys()

- [ ] Create `internal/api/routes_vault.go`
  - POST /v1/tenants/{id}/vault/keys
  - GET /v1/tenants/{id}/vault/keys
  - PUT /v1/tenants/{id}/vault/keys/{keyId}
  - DELETE /v1/tenants/{id}/vault/keys/{keyId}
  - POST /v1/tenants/{id}/vault/validate

### 3. POLICY ENDPOINTS (Priority 3)
- [ ] Create `internal/api/policy_handler.go`
  - CreatePolicy()
  - UpdatePolicy()
  - DeletePolicy()
  - GetPolicy()
  - ListPolicies()

- [ ] Create `internal/api/routes_policy.go`
  - GET /v1/tenants/{id}/policies
  - POST /v1/tenants/{id}/policies
  - PUT /v1/tenants/{id}/policies/{policyId}
  - DELETE /v1/tenants/{id}/policies/{policyId}
  - POST /v1/tenants/{id}/policies/{policyId}/validate

- [ ] Extend SafetyController
  - Add policy check in PreRequestCheck()

### 4. TENANT MANAGEMENT (Priority 4)
- [ ] Create `internal/api/tenant_handler.go`
  - CreateTenant()
  - UpdateTenant()
  - GetTenant()
  - ListTenants()
  - SuspendTenant()

- [ ] Create `internal/api/routes_tenants.go`
  - GET /v1/admin/tenants
  - POST /v1/admin/tenants
  - GET /v1/admin/tenants/{id}
  - PUT /v1/admin/tenants/{id}
  - GET /v1/tenants/me
  - PUT /v1/tenants/me

### 5. TENANT-AWARE INFERENCE (Priority 5)
- [ ] Update `cmd/schlep-api/handlers/infer.go`
  - Add HandleInferWithTenant()
  - Extract tenantID from context
  - Use tenant's BYOK key
  - Apply tenant policy
  - Record per-tenant metrics

- [ ] Update `internal/api/routes_infer.go`
  - Register tenant-specific routes
  - POST /v1/tenants/{id}/infer
  - POST /v1/tenants/{id}/chat/completions

### 6. DATABASE (Priority 6)
- [ ] Create migration scripts
  - Create tenants table
  - Create tenant_users table
  - Create tenant_api_keys table
  - Create tenant_byok_keys table
  - Create tenant_policies table
  - Add indexes

- [ ] Create migration runner
  - Auto-run on startup if needed

### 7. CONFIGURATION (Priority 7)
- [ ] Create `internal/config/tenant_config.go`
  - TenantConfig struct
  - Load from environment/database
  - Cache with TTL

### 8. METRICS (Priority 8)
- [ ] Extend `internal/metrics/`
  - Per-tenant cost tracking
  - Per-tenant error rates
  - Per-tenant request counts

### 9. RATE LIMITING (Priority 9)
- [ ] Update `internal/middleware/ratelimit.go`
  - Per-tenant buckets
  - Tenant-specific limits from config

### 10. TESTING & DOCUMENTATION
- [ ] Unit tests for each new handler
- [ ] Integration tests for tenant flows
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Migration guide

## Code Patterns to Follow

### Middleware Pattern
```go
// In internal/middleware/tenant.go
func TenantAuth() fiber.Handler {
    return func(c *fiber.Ctx) error {
        // 1. Extract tenant ID from request
        tenantID := extractTenantID(c)
        
        // 2. Validate tenant
        tenant, err := ValidateTenant(tenantID)
        if err != nil {
            return c.Status(401).JSON(...)
        }
        
        // 3. Load config
        config := LoadTenantConfig(tenantID)
        
        // 4. Store in context
        c.Locals("tenant_id", tenantID)
        c.Locals("tenant_context", TenantContext{
            TenantID: tenantID,
            Config: config,
        })
        
        return c.Next()
    }
}

// In main.go
app.Use(middleware.TenantAuth())
```

### Handler Pattern
```go
// In internal/api/vault_handler.go
type VaultHandler struct {
    vault *vault.Manager
    db    *sql.DB
}

func (h *VaultHandler) UploadKey(c *fiber.Ctx) error {
    tenantID := c.Locals("tenant_id").(string)
    
    var req UploadKeyRequest
    c.BodyParser(&req)
    
    // Validate & encrypt
    encrypted := h.vault.Encrypt(req.Key)
    
    // Store
    h.db.Exec("INSERT INTO tenant_byok_keys ...")
    
    return c.JSON(...)
}
```

### Route Registration Pattern
```go
// In internal/api/routes_vault.go
func RegisterVaultRoutes(app *fiber.App) error {
    handler := &VaultHandler{
        vault: vault.NewManager(),
        db: db.GetConnection(),
    }
    
    v1 := app.Group("/v1")
    tenants := v1.Group("/tenants/:tenantID")
    
    tenants.Post("/vault/keys", handler.UploadKey)
    tenants.Get("/vault/keys", handler.ListKeys)
    // ... more routes
    
    return nil
}
```

## Integration Points in Existing Code

### InferHandler Changes
Location: `/cmd/schlep-api/handlers/infer.go` line 256

Current:
```go
func (h *InferHandler) HandleInfer(c *fiber.Ctx) error {
    // ... 
    safetyCheck, err := h.safetyController.PreRequestCheck(&req, estimatedCost)
```

Phase 14 Enhancement:
```go
func (h *InferHandler) HandleInferWithTenant(c *fiber.Ctx, tenantID string) error {
    // Get tenant context from middleware
    tenantCtx := c.Locals("tenant_context").(TenantContext)
    
    // Get BYOK key from vault
    key := h.vault.GetKey(tenantID, provider)
    
    // Use tenant-specific budget
    safetyCheck, err := h.safetyController.PreRequestCheckWithTenant(
        &req, estimatedCost, tenantID, tenantCtx.Config)
```

### SafetyController Changes
Location: `/internal/safety/safety_controller.go`

Add tenant-aware budget checking:
```go
func (sc *SafetyController) PreRequestCheckWithTenant(
    req *InferRequest,
    estimatedCost float64,
    tenantID string,
    config *TenantConfig) (*SafetyCheckResult, error) {
    
    // Use tenant's budget, not global
    currentSpend := sc.budgetTracker.GetTenantSpend(tenantID)
    limit := config.BudgetLimit
    
    // ...
}
```

### AuditLogger - Already Tenant-Ready!
Location: `/internal/safety/audit_logger.go` line 24

```go
type AuditLogger struct {
    db       *sql.DB
    tenantID string  // Already here!
    // ...
}

func (al *AuditLogger) LogEvent(event *AuditEvent) {
    if event.TenantID == "" {
        event.TenantID = al.tenantID  // Auto-populate
    }
    // ...
}
```

## Testing Strategy

### Unit Tests
- Tenant middleware extraction
- Key encryption/decryption
- Policy validation
- Budget calculation

### Integration Tests
- Tenant signup flow
- BYOK key upload & use
- Policy enforcement
- Multi-tenant isolation

### Performance Tests
- Tenant lookup latency
- Key decryption overhead
- Database query performance

## Deployment Strategy

1. **Phase 14.1**: Deploy middleware (non-enforcing)
2. **Phase 14.2**: Deploy vault endpoints
3. **Phase 14.3**: Deploy policies
4. **Phase 14.4**: Deploy tenant management
5. **Phase 14.5**: Gradual customer rollout

Feature flags can gate each phase independently.

## Key Decisions

1. **Authentication**: JWT from existing auth.go, extended for tenant claims
2. **Key Storage**: AES-256-GCM encrypted in database
3. **Rate Limiting**: Extend existing RateLimiter with per-tenant buckets
4. **Database**: Add 5 new tables, keep audit_events structure
5. **Caching**: 5-min tenant config, 1-hour key cache
6. **RBAC**: admin, user, viewer roles

## Quick Start Commands

```bash
# Find all places that need updates
grep -r "handleInfer\|PreRequestCheck\|AuditLogger" \
  --include="*.go" \
  /Users/wira/Desktop/schlep-engine/

# Create new file structure
mkdir -p /Users/wira/Desktop/schlep-engine/internal/vault
touch /Users/wira/Desktop/schlep-engine/internal/vault/{encrypt,storage,manager,validator}.go
touch /Users/wira/Desktop/schlep-engine/internal/middleware/tenant.go
touch /Users/wira/Desktop/schlep-engine/internal/api/{vault_handler,policy_handler,tenant_handler}.go
touch /Users/wira/Desktop/schlep-engine/internal/api/routes_{vault,policy,tenants}.go

# Run tests
go test ./internal/middleware/... -v
go test ./internal/api/... -v
```

## Success Criteria

- All 5 new endpoint groups working
- BYOK keys encrypted at rest
- Per-tenant budgets enforced
- Per-tenant rate limits working
- Audit logs segregated per tenant
- No multi-tenant data leakage
- < 100ms tenant lookup latency
- 100% test coverage for new code

