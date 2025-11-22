package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
)

// OAuth2Provider implements SSOProvider for OAuth2-based authentication
type OAuth2Provider struct {
	config       *SSOProviderConfig
	oauth2Config *oauth2.Config
	httpClient   *http.Client
}

// NewOAuth2Provider creates a new OAuth2 provider
func NewOAuth2Provider(config *SSOProviderConfig) (*OAuth2Provider, error) {
	if config == nil {
		return nil, ErrInvalidConfiguration
	}

	// Validate required fields
	if config.ClientID == "" || config.ClientSecret == "" {
		return nil, errors.New("client_id and client_secret are required for OAuth2")
	}
	if config.AuthURL == "" || config.TokenURL == "" {
		return nil, errors.New("auth_url and token_url are required for OAuth2")
	}

	// Default scopes if not provided
	scopes := config.Scopes
	if len(scopes) == 0 {
		scopes = []string{"openid", "profile", "email"}
	}

	oauth2Config := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:  config.AuthURL,
			TokenURL: config.TokenURL,
		},
		RedirectURL: config.RedirectURI,
		Scopes:      scopes,
	}

	return &OAuth2Provider{
		config:       config,
		oauth2Config: oauth2Config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// GetAuthorizationURL returns the OAuth2 authorization URL
func (p *OAuth2Provider) GetAuthorizationURL(state string, redirectURI string) (string, error) {
	// Override redirect URI if provided
	if redirectURI != "" {
		p.oauth2Config.RedirectURL = redirectURI
	}

	authURL := p.oauth2Config.AuthCodeURL(state, oauth2.AccessTypeOffline)
	return authURL, nil
}

// ExchangeCode exchanges authorization code for user information
func (p *OAuth2Provider) ExchangeCode(ctx context.Context, code string, redirectURI string) (*SSOUserInfo, error) {
	// Override redirect URI if provided
	if redirectURI != "" {
		p.oauth2Config.RedirectURL = redirectURI
	}

	// Exchange code for token
	token, err := p.oauth2Config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrCodeExchangeFailed, err)
	}

	// Fetch user information
	userInfo, err := p.fetchUserInfo(ctx, token.AccessToken)
	if err != nil {
		return nil, err
	}

	// Add token information
	userInfo.AccessToken = token.AccessToken
	userInfo.RefreshToken = token.RefreshToken
	userInfo.ExpiresAt = token.Expiry
	userInfo.Provider = p.config.ProviderName
	userInfo.ProviderType = "oauth2"

	return userInfo, nil
}

// ValidateToken validates an OAuth2 access token
func (p *OAuth2Provider) ValidateToken(ctx context.Context, accessToken string) (*SSOUserInfo, error) {
	// Fetch user info to validate token
	userInfo, err := p.fetchUserInfo(ctx, accessToken)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrTokenValidationFailed, err)
	}

	userInfo.AccessToken = accessToken
	userInfo.Provider = p.config.ProviderName
	userInfo.ProviderType = "oauth2"

	return userInfo, nil
}

// fetchUserInfo fetches user information from the OAuth2 provider
func (p *OAuth2Provider) fetchUserInfo(ctx context.Context, accessToken string) (*SSOUserInfo, error) {
	if p.config.UserInfoURL == "" {
		return nil, errors.New("user_info_url not configured")
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, "GET", p.config.UserInfoURL, nil)
	if err != nil {
		return nil, err
	}

	// Add authorization header
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	req.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUserInfoFetchFailed, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: status %d, body: %s", ErrUserInfoFetchFailed, resp.StatusCode, string(body))
	}

	// Parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Parse user info (generic structure, provider-specific parsing below)
	var rawUserInfo map[string]interface{}
	if err := json.Unmarshal(body, &rawUserInfo); err != nil {
		return nil, err
	}

	// Map to SSOUserInfo with attribute mapping
	userInfo := p.mapUserInfo(rawUserInfo)

	// Apply default roles if configured
	if len(p.config.DefaultRoles) > 0 && len(userInfo.Roles) == 0 {
		userInfo.Roles = p.config.DefaultRoles
	}

	return userInfo, nil
}

// mapUserInfo maps provider-specific user info to SSOUserInfo
func (p *OAuth2Provider) mapUserInfo(raw map[string]interface{}) *SSOUserInfo {
	userInfo := &SSOUserInfo{
		Attrs: make(map[string]string),
	}

	// Standard OIDC claims
	if sub, ok := raw["sub"].(string); ok {
		userInfo.ExternalID = sub
	}
	if email, ok := raw["email"].(string); ok {
		userInfo.Email = email
	}
	if name, ok := raw["name"].(string); ok {
		userInfo.Name = name
	}
	if username, ok := raw["preferred_username"].(string); ok {
		userInfo.Username = username
	}

	// Groups (provider-specific)
	if groups, ok := raw["groups"].([]interface{}); ok {
		userInfo.Groups = make([]string, len(groups))
		for i, g := range groups {
			if gs, ok := g.(string); ok {
				userInfo.Groups[i] = gs
			}
		}
	}

	// Roles (provider-specific)
	if roles, ok := raw["roles"].([]interface{}); ok {
		userInfo.Roles = make([]string, len(roles))
		for i, r := range roles {
			if rs, ok := r.(string); ok {
				userInfo.Roles[i] = rs
			}
		}
	}

	// Apply custom attribute mapping if configured
	if p.config.AttributeMapping != nil {
		for target, source := range p.config.AttributeMapping {
			if value, ok := raw[source]; ok {
				if strValue, ok := value.(string); ok {
					userInfo.Attrs[target] = strValue
				}
			}
		}
	}

	// Store all unmapped attributes
	for key, value := range raw {
		if _, mapped := p.config.AttributeMapping[key]; !mapped {
			if strValue, ok := value.(string); ok {
				userInfo.Attrs[key] = strValue
			}
		}
	}

	return userInfo
}

// GetProviderName returns the provider name
func (p *OAuth2Provider) GetProviderName() string {
	return p.config.ProviderName
}

// GetProviderType returns "oauth2"
func (p *OAuth2Provider) GetProviderType() string {
	return "oauth2"
}

// RefreshToken refreshes an OAuth2 access token using a refresh token
func (p *OAuth2Provider) RefreshToken(ctx context.Context, refreshToken string) (*SSOUserInfo, error) {
	token := &oauth2.Token{
		RefreshToken: refreshToken,
	}

	tokenSource := p.oauth2Config.TokenSource(ctx, token)
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	// Fetch updated user information
	userInfo, err := p.fetchUserInfo(ctx, newToken.AccessToken)
	if err != nil {
		return nil, err
	}

	userInfo.AccessToken = newToken.AccessToken
	userInfo.RefreshToken = newToken.RefreshToken
	userInfo.ExpiresAt = newToken.Expiry
	userInfo.Provider = p.config.ProviderName
	userInfo.ProviderType = "oauth2"

	return userInfo, nil
}

// ProviderPresets contains common OAuth2 provider configurations
var ProviderPresets = map[string]func(clientID, clientSecret, redirectURI string) *SSOProviderConfig{
	"auth0": func(clientID, clientSecret, redirectURI string) *SSOProviderConfig {
		// Auth0 requires domain to be set via env or config
		// This is a template - actual domain should be configured per tenant
		domain := "YOUR_DOMAIN.auth0.com"
		return &SSOProviderConfig{
			ProviderName: "Auth0",
			ProviderType: "oauth2",
			ClientID:     clientID,
			ClientSecret: clientSecret,
			AuthURL:      fmt.Sprintf("https://%s/authorize", domain),
			TokenURL:     fmt.Sprintf("https://%s/oauth/token", domain),
			UserInfoURL:  fmt.Sprintf("https://%s/userinfo", domain),
			RedirectURI:  redirectURI,
			Scopes:       []string{"openid", "profile", "email"},
		}
	},
	"okta": func(clientID, clientSecret, redirectURI string) *SSOProviderConfig {
		// Okta requires org domain to be set
		orgDomain := "YOUR_ORG.okta.com"
		return &SSOProviderConfig{
			ProviderName: "Okta",
			ProviderType: "oauth2",
			ClientID:     clientID,
			ClientSecret: clientSecret,
			AuthURL:      fmt.Sprintf("https://%s/oauth2/v1/authorize", orgDomain),
			TokenURL:     fmt.Sprintf("https://%s/oauth2/v1/token", orgDomain),
			UserInfoURL:  fmt.Sprintf("https://%s/oauth2/v1/userinfo", orgDomain),
			RedirectURI:  redirectURI,
			Scopes:       []string{"openid", "profile", "email"},
		}
	},
	"google": func(clientID, clientSecret, redirectURI string) *SSOProviderConfig {
		return &SSOProviderConfig{
			ProviderName: "Google",
			ProviderType: "oauth2",
			ClientID:     clientID,
			ClientSecret: clientSecret,
			AuthURL:      "https://accounts.google.com/o/oauth2/v2/auth",
			TokenURL:     "https://oauth2.googleapis.com/token",
			UserInfoURL:  "https://openidconnect.googleapis.com/v1/userinfo",
			RedirectURI:  redirectURI,
			Scopes:       []string{"openid", "profile", "email"},
		}
	},
	"microsoft": func(clientID, clientSecret, redirectURI string) *SSOProviderConfig {
		return &SSOProviderConfig{
			ProviderName: "Microsoft",
			ProviderType: "oauth2",
			ClientID:     clientID,
			ClientSecret: clientSecret,
			AuthURL:      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			TokenURL:     "https://login.microsoftonline.com/common/oauth2/v2.0/token",
			UserInfoURL:  "https://graph.microsoft.com/v1.0/me",
			RedirectURI:  redirectURI,
			Scopes:       []string{"openid", "profile", "email"},
		}
	},
	"github": func(clientID, clientSecret, redirectURI string) *SSOProviderConfig {
		return &SSOProviderConfig{
			ProviderName: "GitHub",
			ProviderType: "oauth2",
			ClientID:     clientID,
			ClientSecret: clientSecret,
			AuthURL:      "https://github.com/login/oauth/authorize",
			TokenURL:     "https://github.com/login/oauth/access_token",
			UserInfoURL:  "https://api.github.com/user",
			RedirectURI:  redirectURI,
			Scopes:       []string{"read:user", "user:email"},
		}
	},
}

// NewOAuth2ProviderFromPreset creates a provider from a preset configuration
func NewOAuth2ProviderFromPreset(preset, clientID, clientSecret, redirectURI string) (*OAuth2Provider, error) {
	presetFunc, ok := ProviderPresets[strings.ToLower(preset)]
	if !ok {
		return nil, fmt.Errorf("unknown preset: %s", preset)
	}

	config := presetFunc(clientID, clientSecret, redirectURI)
	config.Enabled = true
	config.CreatedAt = time.Now()
	config.UpdatedAt = time.Now()

	return NewOAuth2Provider(config)
}
