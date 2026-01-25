package handlers

import (
	"math"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/igris-overture/config"
)

// CostAnalyticsHandler provides real-time cost analytics
type CostAnalyticsHandler struct {
	costMap *config.CostMapConfig
}

// NewCostAnalyticsHandler creates a new cost analytics handler
func NewCostAnalyticsHandler() (*CostAnalyticsHandler, error) {
	costMap, err := config.LoadCostMapFromEnv()
	if err != nil {
		return nil, err
	}

	return &CostAnalyticsHandler{
		costMap: costMap,
	}, nil
}

// CostAnalyticsResponse represents the /v1/analytics/cost response
type CostAnalyticsResponse struct {
	ProviderBreakdown   map[string]float64 `json:"provider_breakdown"`
	AvgCostPerRequest   float64            `json:"avg_cost_per_request"`
	AvgLatencyMs        float64            `json:"avg_latency_ms"`
	ForecastAccuracy    float64            `json:"forecast_accuracy"`
	TotalRequests       int64              `json:"total_requests"`
	TotalCostUSD        float64            `json:"total_cost_usd"`
	TimeWindow          string             `json:"time_window"`
	GeneratedAt         string             `json:"generated_at"`
}

// ProviderStats holds per-provider statistics
type ProviderStats struct {
	Provider         string  `json:"provider"`
	TotalCost        float64 `json:"total_cost"`
	RequestCount     int64   `json:"request_count"`
	AvgCost          float64 `json:"avg_cost"`
	AvgLatency       float64 `json:"avg_latency"`
	ForecastAccuracy float64 `json:"forecast_accuracy"`
}

// GetCostAnalytics returns real-time cost analytics
// GET /v1/analytics/cost?window=1h
func (h *CostAnalyticsHandler) GetCostAnalytics(c *fiber.Ctx) error {
	// Parse time window (default 1h)
	window := c.Query("window", "1h")
	duration, err := time.ParseDuration(window)
	if err != nil {
		duration = 1 * time.Hour
	}

	// Gather metrics from Prometheus
	analytics := h.gatherAnalytics(duration)

	return c.JSON(analytics)
}

// GetProviderStats returns detailed per-provider statistics
// GET /v1/analytics/cost/providers
func (h *CostAnalyticsHandler) GetProviderStats(c *fiber.Ctx) error {
	window := c.Query("window", "1h")
	duration, err := time.ParseDuration(window)
	if err != nil {
		duration = 1 * time.Hour
	}

	stats := h.gatherProviderStats(duration)

	return c.JSON(fiber.Map{
		"providers":    stats,
		"time_window":  window,
		"generated_at": time.Now().Format(time.RFC3339),
	})
}

// gatherAnalytics collects analytics from Prometheus metrics
func (h *CostAnalyticsHandler) gatherAnalytics(window time.Duration) *CostAnalyticsResponse {
	// In production, query Prometheus API for actual metrics
	// For now, simulate with sample data structure

	analytics := &CostAnalyticsResponse{
		ProviderBreakdown: make(map[string]float64),
		TimeWindow:        window.String(),
		GeneratedAt:       time.Now().Format(time.RFC3339),
	}

	// Simulate provider breakdown (would query schlep_estimated_cost_usd_total)
	analytics.ProviderBreakdown = map[string]float64{
		"openai":    0.61,
		"anthropic": 0.39,
	}

	// Simulate avg cost per request
	analytics.AvgCostPerRequest = 0.021

	// Simulate avg latency
	analytics.AvgLatencyMs = 54.0

	// Simulate forecast accuracy
	analytics.ForecastAccuracy = 0.97

	// Simulate totals
	analytics.TotalRequests = 1250
	analytics.TotalCostUSD = 26.25

	return analytics
}

// gatherProviderStats collects per-provider statistics
func (h *CostAnalyticsHandler) gatherProviderStats(window time.Duration) []ProviderStats {
	// In production, query Prometheus for actual provider metrics
	stats := []ProviderStats{
		{
			Provider:         "openai",
			TotalCost:        16.01,
			RequestCount:     762,
			AvgCost:          0.021,
			AvgLatency:       58.3,
			ForecastAccuracy: 0.96,
		},
		{
			Provider:         "anthropic",
			TotalCost:        10.24,
			RequestCount:     488,
			AvgCost:          0.021,
			AvgLatency:       49.1,
			ForecastAccuracy: 0.98,
		},
	}

	return stats
}

// queryPrometheusMetric queries Prometheus API for a metric
// This would be implemented with actual Prometheus client in production
func (h *CostAnalyticsHandler) queryPrometheusMetric(query string, window time.Duration) (float64, error) {
	// TODO: Implement actual Prometheus query
	// Example: prom.Query(context.Background(), query, time.Now())
	return 0, nil
}

// calculateProviderBreakdown calculates cost breakdown by provider
func (h *CostAnalyticsHandler) calculateProviderBreakdown(metricValues map[string]float64) map[string]float64 {
	total := 0.0
	for _, value := range metricValues {
		total += value
	}

	breakdown := make(map[string]float64)
	if total > 0 {
		for provider, value := range metricValues {
			breakdown[provider] = math.Round((value/total)*100) / 100
		}
	}

	return breakdown
}

// GetCostTrend returns cost trend over time
// GET /v1/analytics/cost/trend?window=24h&interval=1h
func (h *CostAnalyticsHandler) GetCostTrend(c *fiber.Ctx) error {
	window := c.Query("window", "24h")
	interval := c.Query("interval", "1h")

	windowDuration, _ := time.ParseDuration(window)
	intervalDuration, _ := time.ParseDuration(interval)

	dataPoints := int(windowDuration / intervalDuration)
	trend := make([]fiber.Map, dataPoints)

	// Simulate trend data
	now := time.Now()
	for i := 0; i < dataPoints; i++ {
		timestamp := now.Add(-time.Duration(dataPoints-i) * intervalDuration)
		trend[i] = fiber.Map{
			"timestamp":  timestamp.Format(time.RFC3339),
			"total_cost": 1.2 + (float64(i) * 0.1),
			"requests":   50 + (i * 5),
		}
	}

	return c.JSON(fiber.Map{
		"window":   window,
		"interval": interval,
		"trend":    trend,
	})
}

// RegisterRoutes registers analytics routes
func (h *CostAnalyticsHandler) RegisterRoutes(app *fiber.App) {
	analytics := app.Group("/v1/analytics")

	analytics.Get("/cost", h.GetCostAnalytics)
	analytics.Get("/cost/providers", h.GetProviderStats)
	analytics.Get("/cost/trend", h.GetCostTrend)
}
