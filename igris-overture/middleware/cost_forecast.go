package middleware

import (
	"fmt"
	"log"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/observability"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// CostForecastMiddleware adds cost estimation headers to inference requests
type CostForecastMiddleware struct {
	costMap         *config.CostMapConfig
	adapterRegistry *providers.AdapterRegistry
	mu              sync.RWMutex
}

// NewCostForecastMiddleware creates cost forecast middleware
func NewCostForecastMiddleware() (*CostForecastMiddleware, error) {
	// Load cost map from YAML
	costMap, err := config.LoadCostMapFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to load cost map: %w", err)
	}

	// Create adapter registry
	adapterRegistry := providers.NewAdapterRegistry()

	log.Printf("[CostForecast] Loaded cost map with %d providers", len(costMap.Providers))

	return &CostForecastMiddleware{
		costMap:         costMap,
		adapterRegistry: adapterRegistry,
	}, nil
}

// Handler returns the Fiber middleware handler
func (m *CostForecastMiddleware) Handler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Only apply to inference endpoints
		path := c.Path()
		if path != "/v1/infer" && path != "/v1/chat/completions" {
			return c.Next()
		}

		// Parse request body
		var req models.InferRequest
		if err := c.BodyParser(&req); err != nil {
			// Can't parse request, skip cost forecast
			return c.Next()
		}

		// Extract provider and model
		provider := c.Locals("provider")
		if provider == nil {
			// Default to "openai" - provider field removed from request
			provider = "openai"
		}

		model := req.Model
		if model == "" {
			model = "gpt-3.5-turbo" // Default fallback
		}

		// Get adapter for token estimation
		adapter, exists := m.adapterRegistry.Get(provider.(string))
		if !exists {
			// No adapter, skip forecast but still process request
			return c.Next()
		}

		// Estimate tokens
		estimatedInputTokens := adapter.EstimateInputTokens(&req)
		estimatedOutputTokens := adapter.EstimateOutputTokens(&req)

		// Calculate estimated cost
		estimatedCost, err := m.costMap.EstimateCost(
			provider.(string),
			model,
			estimatedInputTokens,
			estimatedOutputTokens,
		)

		if err != nil {
			// Cost estimation failed, log and continue without header
			log.Printf("[CostForecast] Failed to estimate cost for %s:%s - %v",
				provider, model, err)
			return c.Next()
		}

		// Store estimated cost in context for post-request comparison
		c.Locals("estimated_cost_usd", estimatedCost)
		c.Locals("estimated_input_tokens", estimatedInputTokens)
		c.Locals("estimated_output_tokens", estimatedOutputTokens)

		// Add forecast header if enabled
		if m.costMap.IsForecastHeaderEnabled() {
			headerName := m.costMap.GetForecastHeaderName()
			c.Set(headerName, fmt.Sprintf("%.6f", estimatedCost))
		}

		// Record metrics
		observability.RecordEstimatedCost(
			provider.(string),
			model,
			estimatedCost,
			estimatedInputTokens,
			estimatedOutputTokens,
		)

		// Log if enabled
		if m.costMap.IsCostLoggingEnabled() {
			log.Printf("[CostForecast] Provider=%s Model=%s InputTokens=%d OutputTokens=%d EstCost=$%.6f",
				provider, model, estimatedInputTokens, estimatedOutputTokens, estimatedCost)
		}

		return c.Next()
	}
}

// PostRequestHandler processes the response to record actual costs
func (m *CostForecastMiddleware) PostRequestHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get estimated cost from context
		estimatedCostRaw := c.Locals("estimated_cost_usd")
		if estimatedCostRaw == nil {
			return c.Next()
		}

		estimatedCost, ok := estimatedCostRaw.(float64)
		if !ok {
			return c.Next()
		}

		// Get provider and model
		provider := c.Locals("provider")
		model := c.Locals("model")

		if provider == nil || model == nil {
			return c.Next()
		}

		// Try to get actual usage from response
		// This would typically be set by the inference handler
		actualInputTokens := c.Locals("actual_input_tokens")
		actualOutputTokens := c.Locals("actual_output_tokens")

		if actualInputTokens != nil && actualOutputTokens != nil {
			inputTokens, _ := actualInputTokens.(int)
			outputTokens, _ := actualOutputTokens.(int)

			// Calculate actual cost
			actualCost, err := m.costMap.EstimateCost(
				provider.(string),
				model.(string),
				inputTokens,
				outputTokens,
			)

			if err == nil {
				// Record actual cost metrics
				observability.RecordActualCost(
					provider.(string),
					model.(string),
					actualCost,
					estimatedCost,
					inputTokens,
					outputTokens,
				)

				// Calculate and record cost ratio
				if estimatedCost > 0 {
					costRatio := actualCost / estimatedCost
					observability.RecordProviderCostRatio(
						provider.(string),
						model.(string),
						costRatio,
					)
				}

				// Log actual vs estimated
				if m.costMap.IsCostLoggingEnabled() {
					accuracy := (actualCost / estimatedCost) * 100
					log.Printf("[CostForecast] Provider=%s Model=%s ActualCost=$%.6f EstCost=$%.6f Accuracy=%.1f%%",
						provider, model, actualCost, estimatedCost, accuracy)
				}
			}
		}

		return c.Next()
	}
}

// ReloadCostMap reloads the cost map from file (useful for updates without restart)
func (m *CostForecastMiddleware) ReloadCostMap() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	costMap, err := config.LoadCostMapFromEnv()
	if err != nil {
		return fmt.Errorf("failed to reload cost map: %w", err)
	}

	m.costMap = costMap
	log.Printf("[CostForecast] Reloaded cost map with %d providers", len(costMap.Providers))

	return nil
}

// GetCostMap returns the current cost map (for testing/inspection)
func (m *CostForecastMiddleware) GetCostMap() *config.CostMapConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.costMap
}
