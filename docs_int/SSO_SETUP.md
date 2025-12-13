# SSO Setup Guide

## Overview

Schlep-Engine supports Single Sign-On (SSO) authentication for **Growth** and **Scale** tier tenants. This feature enables enterprise customers to integrate with their existing identity providers using industry-standard protocols:

- **OAuth2/OpenID Connect (OIDC)** - For modern cloud identity providers
- **SAML 2.0** - For traditional enterprise identity providers

## Tier Requirements

| Tier      | SSO Support | Auto-Provisioning | Custom Attribute Mapping |
|-----------|-------------|-------------------|--------------------------|
| Developer | ❌          | N/A               | N/A                      |
| Growth    | ✅          | ✅                | ✅                       |
| Scale     | ✅          | ✅                | ✅                       |

## Supported Providers

### Pre-configured Providers

Schlep-Engine includes pre-configured templates for popular identity providers:

- **Auth0**
- **Okta**
- **Google Workspace**
- **Microsoft Azure AD / Entra ID**
- **GitHub Enterprise**

### Custom Providers

You can configure any OAuth2/OIDC or SAML 2.0 compliant identity provider using custom configuration.

---

## Setup Instructions

### 1. Enable SSO Feature

First, ensure SSO is enabled in your tier configuration:

**File: `config/tier_config.yaml`**

```yaml
# For Growth tier
growth:
  features:
    sso: true  # Enable SSO

# For Scale tier
scale:
  features:
    sso: true  # Enable SSO

# Global feature flag
feature_flags:
  enable_sso: true
```

### 2. Run Database Migration

Apply the SSO database migration to create required tables:

```bash
# Run migration 009
psql -h localhost -U schlep_user -d schlep_db -f migrations/009_add_sso_providers_table.sql
```

This creates:
- `sso_providers` table - Stores provider configurations
- `sso_user_links` table - Links SSO identities to local users
- Helper functions and views for SSO management

### 3. Configure SSO Provider

#### Option A: Using Pre-configured Provider Template

For supported providers, you can use the built-in presets:

```go
import "github.com/igris-inertial/internal/auth"

// Example: Configure Auth0
provider, err := auth.NewOAuth2ProviderFromPreset(
    "auth0",
    "YOUR_CLIENT_ID",
    "YOUR_CLIENT_SECRET",
    "https://your-app.com/auth/callback",
)
```

#### Option B: Custom Provider Configuration

For custom providers or advanced configuration:

```sql
INSERT INTO sso_providers (
    provider_id,
    provider_name,
    provider_type,
    tenant_id,
    client_id,
    client_secret,
    auth_url,
    token_url,
    user_info_url,
    scopes,
    redirect_uri,
    enabled,
    allow_auto_provision,
    default_roles,
    attribute_mapping
) VALUES (
    'custom-okta',                                    -- Unique provider ID
    'Company Okta',                                   -- Display name
    'oauth2',                                         -- Type: oauth2, oidc, saml
    '00000000-0000-0000-0000-000000000001',          -- Tenant ID
    'YOUR_OKTA_CLIENT_ID',                           -- OAuth2 client ID
    'YOUR_OKTA_CLIENT_SECRET',                       -- OAuth2 client secret (encrypt!)
    'https://your-org.okta.com/oauth2/v1/authorize', -- Authorization URL
    'https://your-org.okta.com/oauth2/v1/token',     -- Token URL
    'https://your-org.okta.com/oauth2/v1/userinfo',  -- UserInfo URL
    '["openid", "profile", "email", "groups"]'::jsonb, -- Scopes
    'https://your-app.com/auth/sso/callback',        -- Callback URL
    true,                                             -- Enabled
    true,                                             -- Auto-provision users
    '["user", "authenticated"]'::jsonb,              -- Default roles for new users
    '{"department": "dept", "employeeId": "employee_number"}'::jsonb -- Attribute mapping
);
```

### 4. Provider-Specific Configuration

#### Auth0

1. Create an application in Auth0 Dashboard
2. Configure callback URL: `https://your-app.com/auth/sso/callback`
3. Copy Client ID and Client Secret
4. Set Auth0 domain in provider config

**Example Auth0 Configuration:**

```yaml
provider_name: "Company Auth0"
provider_type: "oauth2"
auth_url: "https://YOUR_DOMAIN.auth0.com/authorize"
token_url: "https://YOUR_DOMAIN.auth0.com/oauth/token"
user_info_url: "https://YOUR_DOMAIN.auth0.com/userinfo"
scopes: ["openid", "profile", "email"]
```

#### Okta

1. Create an OIDC Web Application in Okta Admin Console
2. Add sign-in redirect URI: `https://your-app.com/auth/sso/callback`
3. Enable "Authorization Code" grant type
4. Copy Client ID and Client Secret

**Example Okta Configuration:**

```yaml
provider_name: "Company Okta"
provider_type: "oidc"
auth_url: "https://YOUR_ORG.okta.com/oauth2/v1/authorize"
token_url: "https://YOUR_ORG.okta.com/oauth2/v1/token"
user_info_url: "https://YOUR_ORG.okta.com/oauth2/v1/userinfo"
scopes: ["openid", "profile", "email", "groups"]
```

#### Google Workspace

1. Create OAuth2 credentials in Google Cloud Console
2. Add authorized redirect URI: `https://your-app.com/auth/sso/callback`
3. Enable Google+ API and Admin SDK
4. Copy Client ID and Client Secret

**Example Google Configuration:**

```yaml
provider_name: "Google Workspace"
provider_type: "oauth2"
auth_url: "https://accounts.google.com/o/oauth2/v2/auth"
token_url: "https://oauth2.googleapis.com/token"
user_info_url: "https://openidconnect.googleapis.com/v1/userinfo"
scopes: ["openid", "profile", "email"]
```

#### Microsoft Azure AD

1. Register an application in Azure AD
2. Add redirect URI: `https://your-app.com/auth/sso/callback`
3. Create a client secret
4. Configure API permissions (User.Read)

**Example Azure AD Configuration:**

```yaml
provider_name: "Microsoft Azure AD"
provider_type: "oidc"
auth_url: "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize"
token_url: "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token"
user_info_url: "https://graph.microsoft.com/v1.0/me"
scopes: ["openid", "profile", "email", "User.Read"]
```

#### SAML 2.0 Configuration

For SAML-based providers:

```sql
INSERT INTO sso_providers (
    provider_id,
    provider_name,
    provider_type,
    tenant_id,
    saml_entity_id,
    saml_sso_url,
    saml_metadata_url,
    saml_certificate,
    saml_assertion_url,
    enabled,
    allow_auto_provision
) VALUES (
    'company-saml',
    'Company SAML IdP',
    'saml',
    '00000000-0000-0000-0000-000000000001',
    'https://your-app.com/saml/metadata',           -- SP Entity ID
    'https://idp.example.com/saml/sso',             -- IdP SSO URL
    'https://idp.example.com/saml/metadata',        -- IdP Metadata URL
    '-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----', -- IdP Certificate
    'https://your-app.com/auth/saml/acs',           -- Assertion Consumer Service URL
    true,
    true
);
```

---

## API Integration

### SSO Login Flow

#### 1. Initiate SSO Login

**Endpoint:** `POST /api/v1/auth/sso/login`

**Request:**
```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "provider_id": "auth0-prod",
  "redirect_uri": "https://your-app.com/auth/callback"
}
```

**Response:**
```json
{
  "authorization_url": "https://your-domain.auth0.com/authorize?client_id=...&state=...",
  "state": "csrf-token-abc123",
  "provider": "Company Auth0"
}
```

#### 2. User Redirects to Authorization URL

The user is redirected to the identity provider for authentication.

#### 3. Handle SSO Callback

**Endpoint:** `GET /api/v1/auth/sso/callback`

**Query Parameters:**
- `code` - Authorization code (OAuth2)
- `state` - CSRF protection token
- `tenant_id` - Tenant ID
- `provider_id` - Provider ID

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "user-uuid-123",
    "email": "user@company.com",
    "name": "John Doe",
    "provider": "Company Auth0"
  }
}
```

### List Configured Providers

**Endpoint:** `GET /api/v1/auth/sso/providers`

**Response:**
```json
{
  "providers": [
    {
      "provider_id": "auth0-prod",
      "provider_name": "Company Auth0",
      "provider_type": "oauth2",
      "enabled": true,
      "created_at": "2025-11-10T00:00:00Z"
    }
  ]
}
```

---

## Advanced Configuration

### Auto-Provisioning

When `allow_auto_provision` is enabled, users are automatically created on first SSO login.

**Configuration:**
```sql
UPDATE sso_providers
SET allow_auto_provision = true
WHERE provider_id = 'auth0-prod';
```

### Custom Attribute Mapping

Map SSO provider attributes to local user attributes:

```sql
UPDATE sso_providers
SET attribute_mapping = '{
  "department": "dept",
  "employeeId": "employee_number",
  "costCenter": "cost_center"
}'::jsonb
WHERE provider_id = 'auth0-prod';
```

### Default Roles

Assign default roles to auto-provisioned users:

```sql
UPDATE sso_providers
SET default_roles = '["user", "sso_authenticated", "viewer"]'::jsonb
WHERE provider_id = 'auth0-prod';
```

### Group/Role Mapping

SSO providers can pass groups and roles in the authentication response. These are automatically mapped to user roles.

**Supported attributes:**
- `groups` - User groups from provider
- `roles` - User roles from provider
- Custom attributes via `attribute_mapping`

---

## Security Considerations

### 1. Encrypt Secrets at Rest

**IMPORTANT:** Client secrets and private keys must be encrypted in production.

Use environment variables or a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager):

```go
import "github.com/igris-inertial/internal/vault"

// Encrypt client secret before storing
encryptedSecret, err := vault.Encrypt(clientSecret)

// Decrypt when loading provider config
clientSecret, err := vault.Decrypt(encryptedSecret)
```

### 2. CSRF Protection

The SSO flow uses `state` parameter for CSRF protection. The middleware automatically validates this.

### 3. Token Validation

- OAuth2 tokens are validated by fetching user info from the provider
- SAML assertions are validated for signature and expiration
- Token expiration is enforced

### 4. Tenant Isolation

SSO providers are isolated per tenant. Users from one tenant cannot access another tenant's resources.

### 5. Audit Logging

All SSO login attempts are logged in the `sso_user_links` table with:
- `last_login` - Last successful login timestamp
- `login_count` - Total number of logins
- Audit trail in policy_audit_log (if enabled)

---

## Monitoring and Analytics

### View Provider Statistics

```sql
SELECT * FROM sso_provider_stats
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
```

**Output:**
```
provider_id   | provider_name | linked_users | total_logins | last_login
--------------|---------------|--------------|--------------|------------
auth0-prod    | Company Auth0 | 150          | 4523         | 2025-11-10 14:30:00
okta-prod     | Company Okta  | 75           | 1234         | 2025-11-09 10:15:00
```

### View Tenant SSO Summary

```sql
SELECT * FROM tenant_sso_summary
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
```

### Metrics

Prometheus metrics are exposed for SSO monitoring:

- `schlep_sso_login_attempts_total{provider, status}` - Total SSO login attempts
- `schlep_sso_login_duration_seconds{provider}` - SSO login duration
- `schlep_sso_provider_errors_total{provider, error_type}` - SSO provider errors
- `schlep_sso_users_provisioned_total{provider}` - Auto-provisioned users

---

## Troubleshooting

### Issue: "SSO not enabled for this tenant"

**Solution:** Check tenant tier and feature flag:

```sql
SELECT id, tier, status FROM tenants WHERE id = 'YOUR_TENANT_ID';
```

Ensure tier is `growth` or `scale`, and `config/tier_config.yaml` has `sso: true`.

### Issue: "Provider not found"

**Solution:** Verify provider exists and is enabled:

```sql
SELECT provider_id, provider_name, enabled
FROM sso_providers
WHERE tenant_id = 'YOUR_TENANT_ID';
```

### Issue: "Invalid OAuth2 configuration"

**Solution:** Validate required fields:

```sql
SELECT client_id, auth_url, token_url, user_info_url
FROM sso_providers
WHERE provider_id = 'YOUR_PROVIDER_ID';
```

Ensure all URLs are accessible and client credentials are correct.

### Issue: "User not provisioned"

**Solution:** Check auto-provisioning setting:

```sql
SELECT allow_auto_provision FROM sso_providers
WHERE provider_id = 'YOUR_PROVIDER_ID';
```

Set to `true` to enable auto-provisioning.

### Debug Logging

Enable debug logging for SSO flows:

```bash
export SSO_DEBUG=true
export LOG_LEVEL=debug
```

---

## Migration and Rollback

### Apply Migration

```bash
psql -h localhost -U schlep_user -d schlep_db -f migrations/009_add_sso_providers_table.sql
```

### Rollback Migration

```bash
# Run rollback commands from migration file
psql -h localhost -U schlep_user -d schlep_db <<EOF
DROP VIEW IF EXISTS tenant_sso_summary CASCADE;
DROP VIEW IF EXISTS sso_provider_stats CASCADE;
DROP FUNCTION IF EXISTS update_sso_last_login CASCADE;
DROP FUNCTION IF EXISTS check_sso_tier_access CASCADE;
DROP FUNCTION IF EXISTS update_sso_updated_at CASCADE;
DROP TABLE IF EXISTS sso_user_links CASCADE;
DROP TABLE IF EXISTS sso_providers CASCADE;
DROP TYPE IF EXISTS sso_provider_type CASCADE;
EOF
```

---

## Best Practices

1. **Use OIDC over OAuth2** when possible for standardized user info
2. **Enable auto-provisioning** for seamless user onboarding
3. **Map groups/roles** to leverage existing organizational structure
4. **Monitor SSO metrics** to detect authentication issues early
5. **Rotate client secrets** regularly (recommended: every 90 days)
6. **Test SSO flow** in staging before production rollout
7. **Document provider-specific** configuration for your team
8. **Use separate providers** for staging and production environments

---

## Support

For additional help:
- Check the [Schlep-Engine Documentation](https://docs.igris-inertial.com)
- Review [provider-specific guides](#provider-specific-configuration)
- Contact support: support@igris-inertial.com
- File an issue: https://github.com/igris-inertial/issues

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Phase:** 5.3 - Feature Gap Closure
