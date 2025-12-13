// Package forecasting provides types and interfaces for the Predictive Intelligence Layer
package forecasting

import "time"

// ForecastHorizon represents a forecast for a specific time horizon
type ForecastHorizon struct {
	PredictedValue   float64   `json:"predicted_value"`
	ConfidenceLower  float64   `json:"confidence_lower"`
	ConfidenceUpper  float64   `json:"confidence_upper"`
	Confidence       float64   `json:"confidence"`
	HorizonMinutes   int       `json:"horizon_minutes"`
	MetricName       string    `json:"metric_name"`
	ForecastTime     time.Time `json:"forecast_timestamp"`
	Trend            string    `json:"trend"` // "increasing", "decreasing", "stable"
}

// ProactiveDecision represents a decision made by the proactive adjuster
type ProactiveDecision struct {
	DecisionType       string           `json:"decision_type"` // "scale_up", "scale_down", "adjust_policy", "preemptive_rollback", "no_action"
	PolicyName         string           `json:"policy_name"`
	CurrentValue       float64          `json:"current_value"`
	RecommendedValue   float64          `json:"recommended_value"`
	Confidence         float64          `json:"confidence"`
	Reason             string           `json:"reason"`
	Timestamp          time.Time        `json:"timestamp"`
	Urgent             bool             `json:"urgent"`
	TriggeringForecast *ForecastHorizon `json:"triggering_forecast,omitempty"`
}

// ForecastResult combines forecast and decision
type ForecastResult struct {
	MetricName string            `json:"metric_name"`
	Forecast   ForecastHorizon   `json:"forecast"`
	Decision   ProactiveDecision `json:"decision"`
	Timestamp  time.Time         `json:"timestamp"`
}

// ForecastMetrics represents engine-level metrics
type ForecastMetrics struct {
	TotalForecasts        uint64  `json:"total_forecasts"`
	ActionableForecasts   uint64  `json:"actionable_forecasts"`
	PreemptiveActions     uint64  `json:"preemptive_actions"`
	Rollbacks             uint64  `json:"rollbacks"`
	ForecastAccuracy      float64 `json:"forecast_accuracy"`
	DecisionAccuracy      float64 `json:"decision_accuracy"`
	AvgForecastLatencyMs  float64 `json:"avg_forecast_latency_ms"`
	UptimeSeconds         uint64  `json:"uptime_seconds"`
	RollbackSuccessRate   float64 `json:"rollback_success_rate"`
}

// TimeSeriesData represents a single metric data point
type TimeSeriesData struct {
	Timestamp  uint64  `json:"timestamp"`
	Value      float64 `json:"value"`
	MetricName string  `json:"metric_name"`
}

// IngestRequest for ingesting metrics
type IngestRequest struct {
	DataPoints []TimeSeriesData `json:"data_points"`
}

// IngestResponse for ingestion results
type IngestResponse struct {
	Ingested int    `json:"ingested"`
	Message  string `json:"message,omitempty"`
}

// ForecastRequest for requesting forecasts
type ForecastRequest struct {
	MetricNames []string `json:"metric_names"`
}

// ForecastResponse contains multiple forecast results
type ForecastResponse struct {
	Forecasts []ForecastResult `json:"forecasts"`
	Timestamp time.Time        `json:"timestamp"`
}

// PolicyUpdateRequest for updating policy values
type PolicyUpdateRequest struct {
	PolicyName string  `json:"policy_name"`
	Value      float64 `json:"value"`
}

// OutcomeRequest for recording decision outcomes
type OutcomeRequest struct {
	PolicyName   string  `json:"policy_name"`
	Success      bool    `json:"success"`
	ActualImpact float64 `json:"actual_impact"`
}

// HealthStatus represents the health of the forecasting engine
type HealthStatus struct {
	Status       string          `json:"status"` // "healthy", "degraded", "unhealthy"
	Running      bool            `json:"running"`
	Metrics      ForecastMetrics `json:"metrics"`
	LastForecast time.Time       `json:"last_forecast"`
	Message      string          `json:"message,omitempty"`
}
