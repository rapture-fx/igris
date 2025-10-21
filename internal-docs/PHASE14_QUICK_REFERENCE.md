# Phase 14 Quick Reference Guide

Quick reference for using the Multi-Tenancy and BYOK features.

---

## 🚀 Quick Start

### 1. Run Migration

```bash
export DATABASE_URL="postgres://localhost/schlep?sslmode=disable"
./scripts/migrations/migrate.sh
```

### 2. Generate Secrets

```go
// Generate JWT secret (64-byte hex)
secret, _ := security.GenerateJWTSecret()
fmt.Println(secret) // Use as JWT_SECRET

// Generate vault master key (32-byte hex)
masterKey, _ := security.GenerateMasterKey()
fmt.Println(masterKey) // Use as VAULT_MASTER_KEY
```

### 3. Configure Environment

```bash
# .env file
DATABASE_URL=postgres://localhost/schlep?sslmode=disable
ENABLE_PERSISTENCE=true
ENABLE_MULTI_TENANCY=true
ENABLE_BYOK_VAULT=true
JWT_SECRET=your-64-char-hex-secret
VAULT_MASTER_KEY=your-64-char-hex-key
TOKEN_TTL_HOURS=24
```

---

## 👤 Tenant Management

### Create Tenant (Admin)

```bash
curl -X POST http://localhost:8080/v1/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "tenant_name": "Acme Corporation",
    "email": "admin@acme.com"
  }'
```

**Response:**
```json
{
  "tenant_id": "acme-corp",
  "tenant_name": "Acme Corporation",
  "email": "admin@acme.com",
  "api_key": "schlep_a1b2c3d4e5f6...",
  "status": "active",
  "created_at": "2025-10-20T10:00:00Z"
}
```

⚠️ **IMPORTANT:** Save the `api_key` - it's only shown once!

### List Tenants

```bash
curl http://localhost:8080/v1/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Get Tenant

```bash
curl http://localhost:8080/v1/tenants/acme-corp \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Suspend Tenant

```bash
curl -X POST http://localhost:8080/v1/tenants/acme-corp/suspend \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🔐 Authentication

### Using API Key (Service Accounts)

```bash
curl http://localhost:8080/v1/vault/keys \
  -H "X-API-Key: schlep_a1b2c3d4e5f6..."
```

### Using JWT Token

1. **Generate Token (Server-Side):**

```go
jwtManager := security.NewJWTManager(db, jwtSecret, 24, true)

tokenInfo, err := jwtManager.GenerateToken(
    "acme-corp",              // tenantID
    "Acme Corporation",       // tenantName
    []string{"user"},         // roles
    c.IP(),                   // ipAddress
    c.Get("User-Agent"),      // userAgent
)

// Return token to client
```

2. **Use Token:**

```bash
curl http://localhost:8080/v1/vault/keys \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

3. **Refresh Token:**

```go
newToken, err := jwtManager.RefreshToken(oldToken, ipAddress, userAgent)
```

---

## 🔑 BYOK Vault

### Store API Key

```bash
curl -X POST http://localhost:8080/v1/vault/keys \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "key_name": "production",
    "api_key": "sk-proj-abc123..."
  }'
```

**Response:**
```json
{
  "id": "uuid-here",
  "provider": "openai",
  "key_name": "production",
  "masked_key": "sk-p****123",
  "is_active": true,
  "created_at": "2025-10-20T10:00:00Z"
}
```

### List Keys (Masked)

```bash
curl http://localhost:8080/v1/vault/keys \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

**Response:**
```json
{
  "keys": [
    {
      "id": "uuid-1",
      "provider": "openai",
      "key_name": "production",
      "masked_key": "sk-p****123",
      "is_active": true,
      "usage_count": 42,
      "created_at": "2025-10-20T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Get Specific Key

```bash
curl http://localhost:8080/v1/vault/keys/openai \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

### Rotate Key

```bash
curl -X POST http://localhost:8080/v1/vault/keys/openai/rotate \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_api_key": "sk-proj-new-key-xyz..."
  }'
```

### Delete Key

```bash
curl -X DELETE http://localhost:8080/v1/vault/keys/openai \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

---

## 💻 Code Examples

### Initialize Components

```go
package main

import (
    "log"
    "github.com/schlep-engine/schlep-engine/internal/database"
    "github.com/schlep-engine/schlep-engine/internal/security"
    "github.com/schlep-engine/schlep-engine/internal/middleware"
)

func main() {
    // Connect to database
    dbConfig := database.NewConfig()
    db, err := database.Connect(dbConfig)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    // Initialize JWT manager
    jwtManager, err := security.NewJWTManager(
        db.DB,
        os.Getenv("JWT_SECRET"),
        24, // TTL in hours
        true, // Track sessions
    )
    if err != nil {
        log.Fatal(err)
    }

    // Initialize key vault
    vault, err := security.NewKeyVault(
        db.DB,
        os.Getenv("VAULT_MASTER_KEY"),
    )
    if err != nil {
        log.Fatal(err)
    }

    // Create middleware
    tenantAuth := middleware.NewTenantAuth(jwtManager, db.DB)

    // ... set up Fiber routes
}
```

### Protect Routes

```go
import "github.com/gofiber/fiber/v2"

func setupRoutes(app *fiber.App, tenantAuth *middleware.TenantAuth) {
    // Public routes (no auth)
    app.Get("/health", healthHandler)
    app.Get("/metrics", metricsHandler)

    // Tenant routes (require authentication)
    v1 := app.Group("/v1")
    v1.Use(tenantAuth.Authenticate())

    v1.Get("/vault/keys", vaultHandler.ListKeys)
    v1.Post("/vault/keys", vaultHandler.StoreKey)

    // Admin routes (require admin role)
    admin := v1.Group("/tenants")
    admin.Use(tenantAuth.RequireAdmin())

    admin.Post("/", tenantHandler.CreateTenant)
    admin.Get("/", tenantHandler.ListTenants)
}
```

### Get Tenant Context

```go
func myHandler(c *fiber.Ctx) error {
    // Get tenant ID
    tenantID := middleware.GetTenantID(c)

    // Get full tenant context
    tenantCtx := middleware.GetTenantContext(c)
    if tenantCtx != nil {
        log.Printf("Request from: %s (%s)",
            tenantCtx.TenantName,
            tenantCtx.TenantID)

        if tenantCtx.IsAdmin {
            // Admin-specific logic
        }
    }

    return c.JSON(fiber.Map{
        "tenant_id": tenantID,
    })
}
```

### Use BYOK Keys

```go
func makeProviderRequest(c *fiber.Ctx, vault *security.KeyVault) error {
    tenantID := middleware.GetTenantID(c)

    // Retrieve decrypted key
    decKey, err := vault.GetKey(tenantID, "openai")
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "Failed to retrieve API key",
        })
    }

    // Use the plain key for provider API call
    client := openai.NewClient(decKey.PlainKey)

    // ... make API call
}
```

---

## 🗄️ Database Queries

### View Active Tenants

```sql
SELECT * FROM v_active_tenants;
```

### View Tenant Usage

```sql
SELECT * FROM v_tenant_usage_summary
WHERE tenant_id = 'acme-corp';
```

### View Key Status

```sql
SELECT * FROM v_tenant_keys_status
WHERE tenant_id = 'acme-corp';
```

### Check Active Sessions

```sql
SELECT tenant_id, issued_at, expires_at, last_used_at, request_count
FROM tenant_sessions
WHERE tenant_id = 'acme-corp'
  AND revoked_at IS NULL
  AND expires_at > NOW()
ORDER BY issued_at DESC;
```

---

## 🧪 Testing

### Test Tenant Creation

```go
func TestCreateTenant(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()

    // Create tenant
    var tenantID string
    err := db.QueryRow(`
        SELECT create_tenant($1, $2, $3, $4, $5, $6)
    `, "test-tenant", "Test Tenant", "hash", "prefix", "test@example.com", "system").Scan(&tenantID)

    assert.NoError(t, err)
    assert.NotEmpty(t, tenantID)

    // Verify tenant exists
    var count int
    db.QueryRow("SELECT COUNT(*) FROM tenants WHERE tenant_id = $1", "test-tenant").Scan(&count)
    assert.Equal(t, 1, count)
}
```

### Test Key Encryption

```go
func TestKeyVault(t *testing.T) {
    masterKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    vault, err := security.NewKeyVault(nil, masterKey) // nil = in-memory
    assert.NoError(t, err)

    // Store key
    plainKey := "sk-test-key-12345"
    encKey, err := vault.StoreKey("test-tenant", "openai", "test", plainKey, "test")
    assert.NoError(t, err)

    // Retrieve and decrypt
    decKey, err := vault.GetKey("test-tenant", "openai")
    assert.NoError(t, err)
    assert.Equal(t, plainKey, decKey.PlainKey)
}
```

### Test JWT

```go
func TestJWT(t *testing.T) {
    jwtSecret := "test-secret-at-least-32-chars-long-for-security"
    jwtManager, err := security.NewJWTManager(nil, jwtSecret, 24, false)
    assert.NoError(t, err)

    // Generate token
    tokenInfo, err := jwtManager.GenerateToken("test-tenant", "Test", []string{"user"}, "", "")
    assert.NoError(t, err)

    // Validate token
    claims, err := jwtManager.ValidateToken(tokenInfo.Token)
    assert.NoError(t, err)
    assert.Equal(t, "test-tenant", claims.TenantID)
}
```

---

## 🔧 Troubleshooting

### "Invalid master key format"
- Ensure `VAULT_MASTER_KEY` is 64 hex characters (32 bytes)
- Generate new: `security.GenerateMasterKey()`

### "JWT_SECRET must be at least 32 characters"
- Use a strong secret (64+ characters recommended)
- Generate new: `security.GenerateJWTSecret()`

### "Tenant not found"
- Check tenant exists: `SELECT * FROM tenants WHERE tenant_id = 'xxx'`
- Verify tenant status is 'active'

### "Access denied"
- Verify JWT token is valid and not expired
- Check tenant status is 'active'
- Ensure user has required role (admin for admin routes)

### "Failed to decrypt key"
- Ensure `VAULT_MASTER_KEY` hasn't changed
- Check database has `encryption_iv` and `encryption_tag` columns
- Verify key was encrypted with same master key

---

## 📚 Related Documentation

- [Phase 14 Implementation Status](PHASE14_IMPLEMENTATION_STATUS.md)
- [Phase 13 Persistence Report](PHASE13_PERSISTENCE_REPORT.md)
- [Database Schema](../internal/database/schema.sql)
- [Migration Guide](../scripts/migrations/)

---

**Version:** 1.0
**Last Updated:** October 20, 2025
