package middleware

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/Igris-inertial/system/igris-overture/auth"
)

// SSOEnforcerConfig holds SSO enforcement configuration
type SSOEnforcerConfig struct {
	DB                  *sql.DB
	ProviderRegistry    *auth.SSOProviderRegistry
	TierConfigPath      string
	JWTSecret           string
	AllowAutoProvisioning bool
	DefaultRedirectURI  string
}

// SSOEnforcer validates SSO access based on tier configuration
type SSOEnforcer struct {
	config *SSOEnforcerConfig
}

// NewSSOEnforcer creates a new SSO enforcer
func NewSSOEnforcer(config *SSOEnforcerConfig) *SSOEnforcer {
	return &SSOEnforcer{
		config: config,
	}
}

// SSOMiddleware enforces SSO tier gating and handles authentication
func (e *SSOEnforcer) SSOMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Extract tenant ID from context (set by tenant auth middleware)
		tenantID := c.Locals("tenant_id")
		if tenantID == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "tenant_not_authenticated",
				"message": "Tenant authentication required",
			})
		}

		tenantUUID, ok := tenantID.(string)
		if !ok {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "invalid_tenant_id_format",
			})
		}

		// Check if tenant has SSO enabled for their tier
		hasSSO, err := e.checkTenantSSOAccess(tenantUUID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "sso_check_failed",
				"message": err.Error(),
			})
		}

		if !hasSSO {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "sso_not_available",
				"message": "SSO is only available for Growth and Scale tiers",
				"upgrade_required": true,
				"feature": "sso",
			})
		}

		return c.Next()
	}
}

// HandleSSOLogin initiates SSO login flow
func (e *SSOEnforcer) HandleSSOLogin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Parse request
		var req struct {
			TenantID   string `json:"tenant_id"`
			ProviderID string `json:"provider_id"`
			RedirectURI string `json:"redirect_uri"`
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid_request",
			})
		}

		// Validate tenant has SSO access
		hasSSO, err := e.checkTenantSSOAccess(req.TenantID)
		if err != nil || !hasSSO {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "sso_not_enabled",
				"message": "SSO is not enabled for this tenant tier",
			})
		}

		// Load SSO provider configuration
		providerConfig, err := e.loadProviderConfig(req.TenantID, req.ProviderID)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "provider_not_found",
				"message": err.Error(),
			})
		}

		// Check if provider is enabled
		if !providerConfig.Enabled {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "provider_disabled",
				"message": "SSO provider is disabled",
			})
		}

		// Get provider instance
		provider, err := e.createProvider(providerConfig)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "provider_creation_failed",
				"message": err.Error(),
			})
		}

		// Generate state for CSRF protection
		state := uuid.New().String()

		// Store state in session/cache (simplified - use Redis in production)
		// TODO: Store state with tenant_id and provider_id for validation in callback

		// Get authorization URL
		redirectURI := req.RedirectURI
		if redirectURI == "" {
			redirectURI = e.config.DefaultRedirectURI
		}

		authURL, err := provider.GetAuthorizationURL(state, redirectURI)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "auth_url_generation_failed",
				"message": err.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"authorization_url": authURL,
			"state":            state,
			"provider":         providerConfig.ProviderName,
		})
	}
}

// HandleSSOCallback processes SSO callback and issues JWT
func (e *SSOEnforcer) HandleSSOCallback() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Parse callback parameters
		code := c.Query("code")
		_ = c.Query("state") // state - validate later if needed
		samlResponse := c.FormValue("SAMLResponse") // For SAML POST binding

		if code == "" && samlResponse == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "missing_code_or_saml_response",
			})
		}

		// Validate state (CSRF protection)
		// TODO: Retrieve stored state from session/cache and validate
		// For now, we'll proceed with basic validation

		// Extract tenant_id and provider_id from state or query params
		tenantID := c.Query("tenant_id")
		providerID := c.Query("provider_id")

		if tenantID == "" || providerID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "missing_tenant_or_provider_id",
			})
		}

		// Load provider configuration
		providerConfig, err := e.loadProviderConfig(tenantID, providerID)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "provider_not_found",
				"message": err.Error(),
			})
		}

		// Create provider instance
		provider, err := e.createProvider(providerConfig)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "provider_creation_failed",
			})
		}

		// Exchange code/response for user info
		var userInfo *auth.SSOUserInfo
		ctx := context.Background()

		if code != "" {
			// OAuth2 flow
			userInfo, err = provider.ExchangeCode(ctx, code, providerConfig.RedirectURI)
		} else {
			// SAML flow
			userInfo, err = provider.ExchangeCode(ctx, samlResponse, providerConfig.RedirectURI)
		}

		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "authentication_failed",
				"message": err.Error(),
			})
		}

		// Provision or link user
		userID, err := e.provisionUser(tenantID, providerID, userInfo)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "user_provisioning_failed",
				"message": err.Error(),
			})
		}

		// Generate tenant-scoped JWT
		authConfig := &AuthConfig{
			JWTSecret:     e.config.JWTSecret,
			TokenDuration: 24 * time.Hour,
		}

		token, err := GenerateToken(authConfig, userID, userInfo.Email, userInfo.Roles)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "token_generation_failed",
				"message": err.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"access_token": token,
			"token_type":   "Bearer",
			"expires_in":   int(24 * time.Hour.Seconds()),
			"user": fiber.Map{
				"id":       userID,
				"email":    userInfo.Email,
				"name":     userInfo.Name,
				"provider": providerConfig.ProviderName,
			},
		})
	}
}

// checkTenantSSOAccess checks if tenant's tier includes SSO feature
func (e *SSOEnforcer) checkTenantSSOAccess(tenantID string) (bool, error) {
	// Query tenant tier from database
	var tier string
	query := `SELECT tier FROM tenants WHERE id = $1 AND status = 'active'`
	err := e.config.DB.QueryRow(query, tenantID).Scan(&tier)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, fmt.Errorf("tenant not found")
		}
		return false, err
	}

	// SSO is only available for Growth and Scale tiers (per tier_config.yaml)
	// In the current config, SSO is marked as false for all tiers (NOT IMPLEMENTED)
	// Once feature flag is enabled, use this logic:
	switch tier {
	case "growth", "scale":
		return true, nil
	default:
		return false, nil
	}
}

// loadProviderConfig loads SSO provider configuration from database
func (e *SSOEnforcer) loadProviderConfig(tenantID, providerID string) (*auth.SSOProviderConfig, error) {
	query := `
		SELECT
			provider_id, provider_name, provider_type, tenant_id,
			client_id, client_secret, auth_url, token_url, user_info_url, scopes, redirect_uri,
			saml_metadata_url, saml_entity_id, saml_sso_url, saml_certificate,
			enabled, allow_auto_provision, default_roles, attribute_mapping,
			created_at, updated_at
		FROM sso_providers
		WHERE tenant_id = $1 AND provider_id = $2
	`

	var config auth.SSOProviderConfig
	var scopesJSON, rolesJSON, mappingJSON []byte

	err := e.config.DB.QueryRow(query, tenantID, providerID).Scan(
		&config.ProviderID,
		&config.ProviderName,
		&config.ProviderType,
		&config.TenantID,
		&config.ClientID,
		&config.ClientSecret,
		&config.AuthURL,
		&config.TokenURL,
		&config.UserInfoURL,
		&scopesJSON,
		&config.RedirectURI,
		&config.SAMLMetadataURL,
		&config.SAMLEntityID,
		&config.SAMLSSOURL,
		&config.SAMLCertificate,
		&config.Enabled,
		&config.AllowAutoProvision,
		&rolesJSON,
		&mappingJSON,
		&config.CreatedAt,
		&config.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, auth.ErrProviderNotFound
		}
		return nil, err
	}

	// Unmarshal JSON fields
	if len(scopesJSON) > 0 {
		json.Unmarshal(scopesJSON, &config.Scopes)
	}
	if len(rolesJSON) > 0 {
		json.Unmarshal(rolesJSON, &config.DefaultRoles)
	}
	if len(mappingJSON) > 0 {
		json.Unmarshal(mappingJSON, &config.AttributeMapping)
	}

	return &config, nil
}

// createProvider creates the appropriate provider instance
func (e *SSOEnforcer) createProvider(config *auth.SSOProviderConfig) (auth.SSOProvider, error) {
	switch config.ProviderType {
	case "oauth2", "oidc":
		return auth.NewOAuth2Provider(config)
	case "saml":
		return auth.NewSAMLProvider(config)
	default:
		return nil, fmt.Errorf("unsupported provider type: %s", config.ProviderType)
	}
}

// provisionUser creates or links a user account based on SSO user info
func (e *SSOEnforcer) provisionUser(tenantID, providerID string, userInfo *auth.SSOUserInfo) (string, error) {
	// Check if user already exists (linked to this SSO provider)
	var userID string
	linkQuery := `
		SELECT user_id FROM sso_user_links
		WHERE tenant_id = $1 AND provider_id = $2 AND external_id = $3
	`
	err := e.config.DB.QueryRow(linkQuery, tenantID, providerID, userInfo.ExternalID).Scan(&userID)

	if err == nil {
		// User already linked, update last login
		updateQuery := `
			UPDATE sso_user_links
			SET last_login = NOW()
			WHERE user_id = $1 AND provider_id = $2
		`
		e.config.DB.Exec(updateQuery, userID, providerID)
		return userID, nil
	}

	// User not found - check if auto-provisioning is allowed
	providerConfig, _ := e.loadProviderConfig(tenantID, providerID)
	if !providerConfig.AllowAutoProvision {
		return "", fmt.Errorf("user not found and auto-provisioning is disabled")
	}

	// Auto-provision new user
	userID = uuid.New().String()

	// Insert user (simplified - adapt to your user table schema)
	userQuery := `
		INSERT INTO users (id, tenant_id, email, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (email, tenant_id) DO UPDATE
		SET name = EXCLUDED.name, updated_at = NOW()
		RETURNING id
	`
	err = e.config.DB.QueryRow(userQuery, userID, tenantID, userInfo.Email, userInfo.Name).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("failed to provision user: %w", err)
	}

	// Create SSO link
	linkInsertQuery := `
		INSERT INTO sso_user_links (user_id, tenant_id, provider_id, external_id, email, last_login, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
	`
	_, err = e.config.DB.Exec(linkInsertQuery, userID, tenantID, providerID, userInfo.ExternalID, userInfo.Email)
	if err != nil {
		return "", fmt.Errorf("failed to create SSO link: %w", err)
	}

	return userID, nil
}

// HandleSSOProviderList lists SSO providers for a tenant
func (e *SSOEnforcer) HandleSSOProviderList() fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := c.Locals("tenant_id")
		if tenantID == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "tenant_not_authenticated",
			})
		}

		query := `
			SELECT provider_id, provider_name, provider_type, enabled, created_at
			FROM sso_providers
			WHERE tenant_id = $1
			ORDER BY created_at DESC
		`

		rows, err := e.config.DB.Query(query, tenantID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "database_error",
			})
		}
		defer rows.Close()

		var providers []fiber.Map
		for rows.Next() {
			var id, name, provType string
			var enabled bool
			var createdAt time.Time

			if err := rows.Scan(&id, &name, &provType, &enabled, &createdAt); err != nil {
				continue
			}

			providers = append(providers, fiber.Map{
				"provider_id":   id,
				"provider_name": name,
				"provider_type": provType,
				"enabled":       enabled,
				"created_at":    createdAt,
			})
		}

		return c.JSON(fiber.Map{
			"providers": providers,
		})
	}
}
