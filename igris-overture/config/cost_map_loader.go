package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// CostMapConfig represents the structure of cost_map.yaml
type CostMapConfig struct {
	Providers map[string]map[string]*ModelPricing `yaml:"providers"`
	Config    *CostConfig                         `yaml:"config"`
}

// ModelPricing defines pricing for a specific model
type ModelPricing struct {
	InputPer1k  float64 `yaml:"input_per_1k"`
	OutputPer1k float64 `yaml:"output_per_1k"`
	Per1k       float64 `yaml:"per_1k"` // For unified pricing
}

// CostConfig holds cost calculation configuration
type CostConfig struct {
	CostPrecision          int     `yaml:"cost_precision"`
	EnableFallback         bool    `yaml:"enable_fallback"`
	MaxCostPerRequest      float64 `yaml:"max_cost_per_request"`
	TokenEstimationMethod  string  `yaml:"token_estimation_method"`
	EnableForecastHeader   bool    `yaml:"enable_forecast_header"`
	ForecastHeaderName     string  `yaml:"forecast_header_name"`
	EnableCostLogging      bool    `yaml:"enable_cost_logging"`
}

// LoadCostMap loads the cost map from YAML file
func LoadCostMap(filePath string) (*CostMapConfig, error) {
	// If no path provided, use default location
	if filePath == "" {
		filePath = "igris-overture/config/cost_map.yaml"
	}

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read cost map file: %w", err)
	}

	// Parse YAML
	var costMap CostMapConfig
	if err := yaml.Unmarshal(data, &costMap); err != nil {
		return nil, fmt.Errorf("failed to parse cost map YAML: %w", err)
	}

	// Validate
	if err := costMap.Validate(); err != nil {
		return nil, fmt.Errorf("invalid cost map configuration: %w", err)
	}

	return &costMap, nil
}

// LoadCostMapFromEnv loads cost map with path from environment variable
func LoadCostMapFromEnv() (*CostMapConfig, error) {
	costMapPath := os.Getenv("COST_MAP_PATH")
	if costMapPath == "" {
		// Try to find it relative to project root
		if _, err := os.Stat("igris-overture/config/cost_map.yaml"); err == nil {
			costMapPath = "igris-overture/config/cost_map.yaml"
		} else if _, err := os.Stat("../internal/config/cost_map.yaml"); err == nil {
			costMapPath = "../internal/config/cost_map.yaml"
		} else {
			// Try absolute path based on current directory
			wd, _ := os.Getwd()
			costMapPath = filepath.Join(wd, "igris-overture/config/cost_map.yaml")
		}
	}

	return LoadCostMap(costMapPath)
}

// Validate checks if the cost map configuration is valid
func (cm *CostMapConfig) Validate() error {
	if len(cm.Providers) == 0 {
		return fmt.Errorf("no providers defined in cost map")
	}

	// Validate each provider has at least one model
	for providerName, models := range cm.Providers {
		if len(models) == 0 {
			return fmt.Errorf("provider %s has no models defined", providerName)
		}

		// Validate pricing for each model
		for modelName, pricing := range models {
			if err := pricing.Validate(); err != nil {
				return fmt.Errorf("invalid pricing for %s:%s - %w", providerName, modelName, err)
			}
		}
	}

	// Set default config if not provided
	if cm.Config == nil {
		cm.Config = DefaultCostConfig()
	}

	return nil
}

// Validate checks if model pricing is valid
func (mp *ModelPricing) Validate() error {
	// Must have either separate input/output pricing OR unified pricing
	hasSeparate := mp.InputPer1k > 0 || mp.OutputPer1k > 0
	hasUnified := mp.Per1k > 0

	if !hasSeparate && !hasUnified {
		return fmt.Errorf("must specify either input_per_1k/output_per_1k or per_1k")
	}

	// Validate values are non-negative
	if mp.InputPer1k < 0 || mp.OutputPer1k < 0 || mp.Per1k < 0 {
		return fmt.Errorf("pricing values must be non-negative")
	}

	return nil
}

// GetPricing retrieves pricing for a specific provider and model
func (cm *CostMapConfig) GetPricing(provider, model string) (*ModelPricing, bool) {
	providerModels, ok := cm.Providers[provider]
	if !ok {
		return nil, false
	}

	// Try exact model match
	if pricing, ok := providerModels[model]; ok {
		return pricing, true
	}

	// Try default fallback if enabled
	if cm.Config.EnableFallback {
		if defaultPricing, ok := providerModels["default"]; ok {
			return defaultPricing, true
		}
	}

	return nil, false
}

// EstimateCost calculates the estimated cost for a request
func (cm *CostMapConfig) EstimateCost(provider, model string, inputTokens, outputTokens int) (float64, error) {
	pricing, found := cm.GetPricing(provider, model)
	if !found {
		return 0, fmt.Errorf("no pricing information for provider=%s model=%s", provider, model)
	}

	var cost float64

	// Use separate pricing if available
	if pricing.InputPer1k > 0 || pricing.OutputPer1k > 0 {
		cost = (float64(inputTokens)/1000.0)*pricing.InputPer1k +
			(float64(outputTokens)/1000.0)*pricing.OutputPer1k
	} else {
		// Use unified pricing
		totalTokens := inputTokens + outputTokens
		cost = (float64(totalTokens) / 1000.0) * pricing.Per1k
	}

	// Apply cost cap if configured
	if cm.Config.MaxCostPerRequest > 0 && cost > cm.Config.MaxCostPerRequest {
		return cm.Config.MaxCostPerRequest, fmt.Errorf(
			"estimated cost $%.6f exceeds maximum $%.6f",
			cost, cm.Config.MaxCostPerRequest)
	}

	// Round to configured precision
	precision := cm.Config.CostPrecision
	if precision > 0 {
		multiplier := float64(1)
		for i := 0; i < precision; i++ {
			multiplier *= 10
		}
		cost = float64(int(cost*multiplier)) / multiplier
	}

	return cost, nil
}

// GetForecastHeaderName returns the configured forecast header name
func (cm *CostMapConfig) GetForecastHeaderName() string {
	if cm.Config != nil && cm.Config.ForecastHeaderName != "" {
		return cm.Config.ForecastHeaderName
	}
	return "X-Igris-Est-Cost-USD"
}

// IsForecastHeaderEnabled returns whether forecast header should be added
func (cm *CostMapConfig) IsForecastHeaderEnabled() bool {
	return cm.Config != nil && cm.Config.EnableForecastHeader
}

// IsCostLoggingEnabled returns whether cost logging is enabled
func (cm *CostMapConfig) IsCostLoggingEnabled() bool {
	return cm.Config != nil && cm.Config.EnableCostLogging
}

// DefaultCostConfig returns default cost configuration
func DefaultCostConfig() *CostConfig {
	return &CostConfig{
		CostPrecision:         6,
		EnableFallback:        true,
		MaxCostPerRequest:     1.0,
		TokenEstimationMethod: "approximate",
		EnableForecastHeader:  true,
		ForecastHeaderName:    "X-Igris-Est-Cost-USD",
		EnableCostLogging:     true,
	}
}

// ListProviders returns all provider names in the cost map
func (cm *CostMapConfig) ListProviders() []string {
	providers := make([]string, 0, len(cm.Providers))
	for name := range cm.Providers {
		providers = append(providers, name)
	}
	return providers
}

// ListModels returns all model names for a given provider
func (cm *CostMapConfig) ListModels(provider string) []string {
	providerModels, ok := cm.Providers[provider]
	if !ok {
		return nil
	}

	models := make([]string, 0, len(providerModels))
	for name := range providerModels {
		models = append(models, name)
	}
	return models
}
