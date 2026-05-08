// Package services provides business logic for Igris Inertial
package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/repository"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// ProviderRegistryService handles provider registration and validation
type ProviderRegistryService struct {
	repo       repository.ProviderRegistryRepository
	keyVault   *security.KeyVault
	httpClient *http.Client
	logger     *log.Logger
}

// NewProviderRegistryService creates a new provider registry service
func NewProviderRegistryService(repo repository.ProviderRegistryRepository, keyVault *security.KeyVault) *ProviderRegistryService {
	return &ProviderRegistryService{
		repo:     repo,
		keyVault: keyVault,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: log.Default(),
	}
}

// RegisterProviderRequest represents the request to register a new provider
type RegisterProviderRequest struct {
	Name               string                     `json:"name" validate:"required,min=1,max=255"`
	BaseURL            string                     `json:"base_url" validate:"required,url"`
	KeyID              string                     `json:"key_id" validate:"required"` // Vault key reference
	Models             []string                   `json:"models"`
	Pricing            *models.ProviderPricing    `json:"pricing"`
	CompatibilityClass *models.CompatibilityClass `json:"compatibility_class,omitempty"`
}

// VerifiedProviders contains the list of verified providers with their defaults
var VerifiedProviders = map[string]struct {
	BaseURL            string
	CompatibilityClass models.CompatibilityClass
	AuthHeaderTemplate string
}{
	"openai":        {"https://api.openai.com/v1", models.OpenAICompatible, "Authorization: Bearer {key}"},
	"anthropic":     {"https://api.anthropic.com/v1", models.AnthropicCompatible, "x-api-key: {key}"},
	"xai":           {"https://api.x.ai/v1", models.OpenAICompatible, "Authorization: Bearer {key}"},
	"kimi":          {"https://api.moonshot.ai/v1", models.OpenAICompatible, "Authorization: Bearer {key}"},
	"qwen":          {"https://dashscope.aliyuncs.com/compatible-mode/v1", models.OpenAICompatible, "Authorization: Bearer {key}"},
	"deepseek":      {"https://api.deepseek.com", models.OpenAICompatible, "Authorization: Bearer {key}"},
	"mistral":       {"https://api.mistral.ai/v1", models.OpenAICompatible, "Authorization: Bearer {key}"},
	"llama":         {"https://api.meta.ai/v1", models.OpenAICompatible, "Authorization: Bearer {key}"},
	"google_gemini": {"https://generativelanguage.googleapis.com/v1", models.CustomAdapter, "x-goog-api-key: {key}"},
	"glm":           {"https://open.bigmodel.cn/api/paas/v4", models.OpenAICompatible, "Authorization: Bearer {key}"},
	"zai":           {"https://open.bigmodel.cn/api/paas/v4", models.OpenAICompatible, "Authorization: Bearer {key}"},
}

// RegisterProvider registers a new provider with security validation
func (s *ProviderRegistryService) RegisterProvider(ctx context.Context, tenantID string, req *RegisterProviderRequest) (*models.ProviderRegistry, error) {
	// 1. Validate HTTPS-only URLs
	if err := s.validateHTTPS(req.BaseURL); err != nil {
		return nil, fmt.Errorf("security validation failed: %w", err)
	}

	// 2. SSRF protection: reject internal/private IP ranges
	if err := s.validateNoSSRF(req.BaseURL); err != nil {
		return nil, fmt.Errorf("security validation failed: %w", err)
	}

	// 3. Check if provider already exists for this tenant
	existing, err := s.repo.GetByTenantAndName(ctx, tenantID, req.Name)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("provider '%s' already exists for this tenant", req.Name)
	}

	// 4. Determine compatibility class
	compatibilityClass := models.OpenAICompatible // Default
	if req.CompatibilityClass != nil {
		compatibilityClass = *req.CompatibilityClass
	} else if verified, ok := VerifiedProviders[strings.ToLower(req.Name)]; ok {
		compatibilityClass = verified.CompatibilityClass
	}

	// 5. Derive static auth header template from verified provider list.
	// The template contains only the header name and the {key} placeholder — never a raw key.
	authHeaderTemplate := "Authorization: Bearer {key}" // default
	if verified, ok := VerifiedProviders[strings.ToLower(req.Name)]; ok {
		authHeaderTemplate = verified.AuthHeaderTemplate
	}

	// 6. Initialize health metrics
	health := models.ProviderHealth{
		ConsecutiveFailures: 0,
		UptimePercent:       100.0,
		TotalChecks:         0,
		SuccessfulChecks:    0,
	}

	// 7. Set default pricing if not provided
	pricing := models.ProviderPricing{Input: 0.0, Output: 0.0}
	if req.Pricing != nil {
		pricing = *req.Pricing
	}

	// 8. Create provider registry entry
	provider := &models.ProviderRegistry{
		TenantID:           tenantID,
		Name:               req.Name,
		BaseURL:            req.BaseURL,
		AuthHeaderTemplate: authHeaderTemplate,
		KeyID:              &req.KeyID,
		Models:             req.Models,
		Pricing:            pricing,
		CompatibilityClass: compatibilityClass,
		Status:             models.StatusPending,
		Health:             health,
		IsVerified:         false,
		IsOfficial:         false,
	}

	// 9. Check if this is a verified provider
	if _, ok := VerifiedProviders[strings.ToLower(req.Name)]; ok {
		provider.IsVerified = true
	}

	// 10. Store in database
	if err := s.repo.Create(ctx, provider); err != nil {
		return nil, fmt.Errorf("failed to create provider: %w", err)
	}

	s.logger.Printf("[ProviderRegistry] Registered provider '%s' for tenant '%s' with status 'pending'", req.Name, tenantID)

	return provider, nil
}

// ValidateProvider validates connectivity and compatibility of a provider
func (s *ProviderRegistryService) ValidateProvider(ctx context.Context, providerID string) (*models.ProviderValidationLog, error) {
	// 1. Get provider details
	provider, err := s.repo.GetByID(ctx, providerID)
	if err != nil {
		return nil, fmt.Errorf("provider not found: %w", err)
	}

	// 2. Retrieve API key from vault via key_id reference
	if provider.KeyID == nil || *provider.KeyID == "" {
		return nil, fmt.Errorf("provider '%s' has no vault key reference (key_id is missing)", provider.Name)
	}
	decryptedKey, err := s.keyVault.GetKeyByID(*provider.KeyID)
	if err != nil {
		return nil, fmt.Errorf("vault key not found for provider '%s' (key_id=%s): %w", provider.Name, *provider.KeyID, err)
	}

	apiKey := decryptedKey.PlainKey

	// 3. Perform validation based on compatibility class
	validationLog := &models.ProviderValidationLog{
		ProviderID: providerID,
	}

	startTime := time.Now()

	switch provider.CompatibilityClass {
	case models.OpenAICompatible:
		err = s.validateOpenAICompatible(ctx, provider, apiKey, validationLog)
	case models.AnthropicCompatible:
		err = s.validateAnthropicCompatible(ctx, provider, apiKey, validationLog)
	case models.CustomAdapter:
		err = s.validateCustomAdapter(ctx, provider, apiKey, validationLog)
	default:
		validationLog.Success = false
		validationLog.ErrorMessage = stringPtr("unsupported compatibility class")
	}

	latencyMs := int(time.Since(startTime).Milliseconds())
	validationLog.LatencyMs = &latencyMs

	// 4. Update provider status based on validation result
	if validationLog.Success {
		provider.Status = models.StatusActive
		provider.Health.LastSuccess = timePtr(time.Now())
		provider.Health.ConsecutiveFailures = 0
		provider.Health.SuccessfulChecks++
	} else {
		provider.Status = models.StatusInvalid
		provider.Health.LastFailure = timePtr(time.Now())
		provider.Health.ConsecutiveFailures++
	}

	provider.Health.TotalChecks++
	provider.Health.UptimePercent = (float64(provider.Health.SuccessfulChecks) / float64(provider.Health.TotalChecks)) * 100.0
	provider.Health.LatencyMs = &latencyMs

	// 5. Update provider in database
	if err := s.repo.UpdateStatus(ctx, providerID, provider.Status); err != nil {
		s.logger.Printf("[ProviderRegistry] Failed to update provider status: %v", err)
	}
	if err := s.repo.UpdateHealth(ctx, providerID, provider.Health); err != nil {
		s.logger.Printf("[ProviderRegistry] Failed to update provider health: %v", err)
	}

	// 6. Log validation attempt
	if err := s.repo.LogValidation(ctx, validationLog); err != nil {
		s.logger.Printf("[ProviderRegistry] Failed to log validation: %v", err)
	}

	s.logger.Printf("[ProviderRegistry] Validated provider '%s' (status: %s, latency: %dms)", provider.Name, provider.Status, latencyMs)

	return validationLog, nil
}

// validateOpenAICompatible validates an OpenAI-compatible provider
func (s *ProviderRegistryService) validateOpenAICompatible(ctx context.Context, provider *models.ProviderRegistry, apiKey string, log *models.ProviderValidationLog) error {
	// Test GET /models endpoint
	modelsURL := fmt.Sprintf("%s/models", strings.TrimSuffix(provider.BaseURL, "/"))

	req, err := http.NewRequestWithContext(ctx, "GET", modelsURL, nil)
	if err != nil {
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("failed to create request: %v", err))
		return err
	}

	// Set authentication header
	authHeader := strings.Replace(provider.AuthHeaderTemplate, "{key}", apiKey, 1)
	parts := strings.SplitN(authHeader, ":", 2)
	if len(parts) == 2 {
		req.Header.Set(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
	}

	// Add trace headers
	req.Header.Set("x-igris-provider-id", provider.ID)
	req.Header.Set("User-Agent", "Igris Inertial/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("request failed: %v", err))
		return err
	}
	defer resp.Body.Close()

	statusCode := resp.StatusCode
	log.StatusCode = &statusCode

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(body)))
		return fmt.Errorf("validation failed with status %d", resp.StatusCode)
	}

	// Parse response to extract models
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("failed to read response: %v", err))
		return err
	}

	var modelsResponse struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &modelsResponse); err != nil {
		// Try alternative format
		var modelsList []string
		if err := json.Unmarshal(body, &modelsList); err != nil {
			log.Success = false
			log.ErrorMessage = stringPtr("failed to parse models response")
			return err
		}
		log.ModelsDetected = modelsList
	} else {
		models := make([]string, 0, len(modelsResponse.Data))
		for _, model := range modelsResponse.Data {
			models = append(models, model.ID)
		}
		log.ModelsDetected = models
	}

	log.Success = true
	return nil
}

func (s *ProviderRegistryService) validateAnthropicCompatible(ctx context.Context, provider *models.ProviderRegistry, apiKey string, log *models.ProviderValidationLog) error {
	model := "claude-haiku-4-5-20251001"
	if len(provider.Models) > 0 && strings.TrimSpace(provider.Models[0]) != "" {
		model = provider.Models[0]
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":      model,
		"max_tokens": 1,
		"messages": []map[string]string{
			{"role": "user", "content": "hi"},
		},
	})

	messagesURL := fmt.Sprintf("%s/messages", strings.TrimSuffix(provider.BaseURL, "/"))
	req, err := http.NewRequestWithContext(ctx, "POST", messagesURL, strings.NewReader(string(body)))
	if err != nil {
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("failed to create request: %v", err))
		return err
	}

	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-igris-provider-id", provider.ID)
	req.Header.Set("User-Agent", "Igris Inertial/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("request failed: %v", err))
		return err
	}
	defer resp.Body.Close()

	statusCode := resp.StatusCode
	log.StatusCode = &statusCode

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusTooManyRequests {
		respBody, _ := io.ReadAll(resp.Body)
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(respBody)))
		return fmt.Errorf("validation failed with status %d", resp.StatusCode)
	}

	log.Success = true
	log.ModelsDetected = provider.Models
	if len(log.ModelsDetected) == 0 {
		log.ModelsDetected = []string{model}
	}
	return nil
}

// validateCustomAdapter validates a custom adapter provider
func (s *ProviderRegistryService) validateCustomAdapter(ctx context.Context, provider *models.ProviderRegistry, apiKey string, log *models.ProviderValidationLog) error {
	// For custom adapters, we perform a basic health check
	// TODO: Implement adapter-specific validation logic

	healthURL := fmt.Sprintf("%s/health", strings.TrimSuffix(provider.BaseURL, "/"))

	req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
	if err != nil {
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("failed to create request: %v", err))
		return err
	}

	req.Header.Set("User-Agent", "Igris Inertial/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("request failed: %v", err))
		return err
	}
	defer resp.Body.Close()

	statusCode := resp.StatusCode
	log.StatusCode = &statusCode

	if resp.StatusCode != http.StatusOK {
		log.Success = false
		log.ErrorMessage = stringPtr(fmt.Sprintf("health check failed with status %d", resp.StatusCode))
		return fmt.Errorf("validation failed with status %d", resp.StatusCode)
	}

	log.Success = true
	log.ModelsDetected = provider.Models // Use provider-declared models
	return nil
}

// validateHTTPS ensures the URL uses HTTPS
func (s *ProviderRegistryService) validateHTTPS(urlStr string) error {
	u, err := url.Parse(urlStr)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	if u.Scheme != "https" {
		return fmt.Errorf("only HTTPS URLs are allowed, got: %s", u.Scheme)
	}

	return nil
}

// validateNoSSRF validates that the URL does not point to internal/private IP ranges
func (s *ProviderRegistryService) validateNoSSRF(urlStr string) error {
	u, err := url.Parse(urlStr)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	host := u.Hostname()

	// Resolve hostname to IP
	ips, err := net.LookupIP(host)
	if err != nil {
		return fmt.Errorf("failed to resolve hostname: %w", err)
	}

	// Check each IP address
	for _, ip := range ips {
		// Check for private/internal IP ranges
		if ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
			return fmt.Errorf("URL points to internal/private IP address: %s", ip.String())
		}

		// Additional check for common internal ranges
		if ip.To4() != nil {
			// 10.0.0.0/8
			if ip[0] == 10 {
				return fmt.Errorf("URL points to private network (10.0.0.0/8): %s", ip.String())
			}
			// 172.16.0.0/12
			if ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31 {
				return fmt.Errorf("URL points to private network (172.16.0.0/12): %s", ip.String())
			}
			// 192.168.0.0/16
			if ip[0] == 192 && ip[1] == 168 {
				return fmt.Errorf("URL points to private network (192.168.0.0/16): %s", ip.String())
			}
			// 127.0.0.0/8
			if ip[0] == 127 {
				return fmt.Errorf("URL points to loopback address: %s", ip.String())
			}
		}
	}

	return nil
}

// sanitizeAuthHeader sanitizes the auth header to prevent injection
func (s *ProviderRegistryService) sanitizeAuthHeader(authHeader string) string {
	// Remove any control characters and newlines
	authHeader = strings.ReplaceAll(authHeader, "\n", "")
	authHeader = strings.ReplaceAll(authHeader, "\r", "")
	authHeader = strings.TrimSpace(authHeader)
	return authHeader
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func timePtr(t time.Time) *time.Time {
	return &t
}
