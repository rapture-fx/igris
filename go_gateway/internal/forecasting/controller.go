// Package forecasting provides HTTP controllers for the Predictive Intelligence Layer
package forecasting

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// Controller handles HTTP requests for forecasting
type Controller struct {
	client *Client
}

// NewController creates a new forecasting controller
func NewController(forecastEngineURL string) *Controller {
	return &Controller{
		client: NewClient(forecastEngineURL),
	}
}

// HandleIngest handles metric ingestion requests
// POST /api/v1/forecast/ingest
func (c *Controller) HandleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req IngestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := c.client.IngestMetrics(req.DataPoints); err != nil {
		log.Printf("Failed to ingest metrics: %v", err)
		http.Error(w, "Failed to ingest metrics", http.StatusInternalServerError)
		return
	}

	resp := IngestResponse{
		Ingested: len(req.DataPoints),
		Message:  "Metrics ingested successfully",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// HandleForecast handles forecast requests
// POST /api/v1/forecast/predict
func (c *Controller) HandleForecast(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ForecastRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	forecasts, err := c.client.GetForecast(req.MetricNames)
	if err != nil {
		log.Printf("Failed to get forecasts: %v", err)
		http.Error(w, "Failed to get forecasts", http.StatusInternalServerError)
		return
	}

	resp := ForecastResponse{
		Forecasts: forecasts,
		Timestamp: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// HandlePolicyUpdate handles policy update notifications
// POST /api/v1/forecast/policy
func (c *Controller) HandlePolicyUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req PolicyUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := c.client.UpdatePolicy(req.PolicyName, req.Value); err != nil {
		log.Printf("Failed to update policy: %v", err)
		http.Error(w, "Failed to update policy", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Policy updated successfully",
	})
}

// HandleOutcome handles decision outcome recording
// POST /api/v1/forecast/outcome
func (c *Controller) HandleOutcome(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req OutcomeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := c.client.RecordOutcome(req.PolicyName, req.Success, req.ActualImpact); err != nil {
		log.Printf("Failed to record outcome: %v", err)
		http.Error(w, "Failed to record outcome", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Outcome recorded successfully",
	})
}

// HandleMetrics handles metrics requests
// GET /api/v1/forecast/metrics
func (c *Controller) HandleMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	metrics, err := c.client.GetMetrics()
	if err != nil {
		log.Printf("Failed to get metrics: %v", err)
		http.Error(w, "Failed to get metrics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// HandleHealth handles health check requests
// GET /api/v1/forecast/health
func (c *Controller) HandleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	health, err := c.client.GetHealth()
	if err != nil {
		log.Printf("Failed to get health: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(HealthStatus{
			Status:  "unhealthy",
			Running: false,
			Message: err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if health.Status != "healthy" {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	json.NewEncoder(w).Encode(health)
}

// RegisterRoutes registers all forecasting routes with the given mux
func (c *Controller) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/forecast/ingest", c.HandleIngest)
	mux.HandleFunc("/api/v1/forecast/predict", c.HandleForecast)
	mux.HandleFunc("/api/v1/forecast/policy", c.HandlePolicyUpdate)
	mux.HandleFunc("/api/v1/forecast/outcome", c.HandleOutcome)
	mux.HandleFunc("/api/v1/forecast/metrics", c.HandleMetrics)
	mux.HandleFunc("/api/v1/forecast/health", c.HandleHealth)
}
