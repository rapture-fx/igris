package auth

import (
	"context"
	"errors"
	"time"
)

// SSOProvider defines the interface for SSO authentication providers
type SSOProvider interface {
	// GetAuthorizationURL returns the URL to redirect users for authentication
	GetAuthorizationURL(state string, redirectURI string) (string, error)

	// ExchangeCode exchanges an authorization code for user information
	ExchangeCode(ctx context.Context, code string, redirectURI string) (*SSOUserInfo, error)

	// ValidateToken validates an SSO token and returns user information
	ValidateToken(ctx context.Context, token string) (*SSOUserInfo, error)

	// GetProviderName returns the name of the SSO provider
	GetProviderName() string

	// GetProviderType returns the type (oauth2, saml, oidc)
	GetProviderType() string
}

// SSOUserInfo represents user information returned from SSO provider
type SSOUserInfo struct {
	// User identification
	ExternalID string `json:"external_id"` // Provider's unique user ID
	Email      string `json:"email"`
	Name       string `json:"name"`
	Username   string `json:"username,omitempty"`

	// Provider information
	Provider     string `json:"provider"`      // e.g., "auth0", "okta", "google"
	ProviderType string `json:"provider_type"` // oauth2, saml, oidc

	// Access control
	Groups []string          `json:"groups,omitempty"` // User groups from provider
	Roles  []string          `json:"roles,omitempty"`  // Roles from provider
	Attrs  map[string]string `json:"attrs,omitempty"`  // Additional attributes

	// Token information
	AccessToken  string    `json:"-"` // Don't serialize tokens
	RefreshToken string    `json:"-"`
	ExpiresAt    time.Time `json:"expires_at,omitempty"`
}

// SSOProviderConfig holds common configuration for SSO providers
type SSOProviderConfig struct {
	// Provider identification
	ProviderID   string `json:"provider_id"`   // Unique ID for this provider config
	ProviderName string `json:"provider_name"` // Display name
	ProviderType string `json:"provider_type"` // oauth2, saml, oidc
	TenantID     string `json:"tenant_id"`     // Tenant this provider belongs to

	// OAuth2/OIDC configuration
	ClientID     string   `json:"client_id,omitempty"`
	ClientSecret string   `json:"client_secret,omitempty"`
	AuthURL      string   `json:"auth_url,omitempty"`
	TokenURL     string   `json:"token_url,omitempty"`
	UserInfoURL  string   `json:"user_info_url,omitempty"`
	Scopes       []string `json:"scopes,omitempty"`
	RedirectURI  string   `json:"redirect_uri,omitempty"`

	// SAML configuration
	SAMLMetadataURL    string `json:"saml_metadata_url,omitempty"`
	SAMLEntityID       string `json:"saml_entity_id,omitempty"`
	SAMLSSOURL         string `json:"saml_sso_url,omitempty"`
	SAMLCertificate    string `json:"saml_certificate,omitempty"`
	SAMLPrivateKey     string `json:"saml_private_key,omitempty"`
	SAMLAssertionURL   string `json:"saml_assertion_url,omitempty"`

	// Advanced options
	Enabled          bool              `json:"enabled"`
	AllowAutoProvision bool            `json:"allow_auto_provision"` // Auto-create users
	DefaultRoles     []string          `json:"default_roles,omitempty"`
	AttributeMapping map[string]string `json:"attribute_mapping,omitempty"`

	// Metadata
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Common errors
var (
	ErrProviderNotFound     = errors.New("sso provider not found")
	ErrProviderNotEnabled   = errors.New("sso provider not enabled")
	ErrInvalidConfiguration = errors.New("invalid provider configuration")
	ErrCodeExchangeFailed   = errors.New("failed to exchange authorization code")
	ErrTokenValidationFailed = errors.New("failed to validate token")
	ErrUserInfoFetchFailed  = errors.New("failed to fetch user information")
	ErrSSONotEnabled        = errors.New("sso not enabled for this tenant")
)

// SSOProviderRegistry manages SSO provider instances
type SSOProviderRegistry struct {
	providers map[string]SSOProvider
}

// NewSSOProviderRegistry creates a new provider registry
func NewSSOProviderRegistry() *SSOProviderRegistry {
	return &SSOProviderRegistry{
		providers: make(map[string]SSOProvider),
	}
}

// Register adds a provider to the registry
func (r *SSOProviderRegistry) Register(providerID string, provider SSOProvider) error {
	if providerID == "" {
		return errors.New("provider ID cannot be empty")
	}
	if provider == nil {
		return errors.New("provider cannot be nil")
	}

	r.providers[providerID] = provider
	return nil
}

// Get retrieves a provider by ID
func (r *SSOProviderRegistry) Get(providerID string) (SSOProvider, error) {
	provider, exists := r.providers[providerID]
	if !exists {
		return nil, ErrProviderNotFound
	}
	return provider, nil
}

// Remove removes a provider from the registry
func (r *SSOProviderRegistry) Remove(providerID string) {
	delete(r.providers, providerID)
}

// List returns all registered provider IDs
func (r *SSOProviderRegistry) List() []string {
	ids := make([]string, 0, len(r.providers))
	for id := range r.providers {
		ids = append(ids, id)
	}
	return ids
}
