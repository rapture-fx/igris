// Package api provides HTTP endpoints for SLO Enforcer administration
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/Igris-inertial/system/igris-overture/slo"
)

// SLOHandler handles SLO Enforcer HTTP requests
type SLOHandler struct {
	auditLogger *slo.AuditLogger
	scraper     *slo.PrometheusScraper
}

// NewSLOHandler creates a new SLO handler
func NewSLOHandler(auditLogger *slo.AuditLogger, scraper *slo.PrometheusScraper) *SLOHandler {
	return &SLOHandler{
		auditLogger: auditLogger,
		scraper:     scraper,
	}
}

// SLOStatusResponse represents the current SLO status
type SLOStatusResponse struct {
	Success       bool             `json:"success"`
	EnforcerStats EnforcerStats    `json:"enforcer_stats"`
	RecentEvents  []slo.AuditEvent `json:"recent_events,omitempty"`
	Error         string           `json:"error,omitempty"`
}

// EnforcerStats represents SLO enforcer statistics
type EnforcerStats struct {
	Active            bool   `json:"active"`
	Version           string `json:"version"`
	Mode              string `json:"mode"`
	NativeAvailable   bool   `json:"native_available"`
	TotalEvaluations  int64  `json:"total_evaluations"`
	TotalBreaches     int64  `json:"total_breaches"`
	TotalActions      int64  `json:"total_actions"`
	FailedActions     int64  `json:"failed_actions"`
	LastEvaluationAge string `json:"last_evaluation_age"`
}

// AuditEventsResponse represents the audit events response
type AuditEventsResponse struct {
	Success bool             `json:"success"`
	Events  []slo.AuditEvent `json:"events"`
	Count   int              `json:"count"`
	Error   string           `json:"error,omitempty"`
}

// EvaluateRequest represents a manual SLO evaluation request
type EvaluateRequest struct {
	P99LatencyMs  *float64 `json:"p99_latency_ms,omitempty"`
	P95LatencyMs  *float64 `json:"p95_latency_ms,omitempty"`
	ErrorRate     *float64 `json:"error_rate,omitempty"`
	Availability  *float64 `json:"availability,omitempty"`
	ThroughputRPS *float64 `json:"throughput_rps,omitempty"`
}

// EvaluateResponse represents the evaluation response
type EvaluateResponse struct {
	Success   bool                    `json:"success"`
	Breached  bool                    `json:"breached"`
	Actions   []slo.RemediationAction `json:"actions"`
	Timestamp uint64                  `json:"timestamp"`
	Error     string                  `json:"error,omitempty"`
}

// HandleGetStatus handles GET /admin/slo/status
func (h *SLOHandler) HandleGetStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get SLO enforcer version
	version := slo.GetVersion()

	// Get recent events
	events, err := h.auditLogger.GetRecentEvents(10)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, SLOStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to fetch events: %v", err),
		})
		return
	}

	// Calculate stats from events
	stats := EnforcerStats{
		Active:           slo.NativeAvailable(),
		Version:          version,
		Mode:             slo.Mode(),
		NativeAvailable:  slo.NativeAvailable(),
		TotalEvaluations: int64(len(events)),
	}

	for _, event := range events {
		if event.EventType == "slo.breach" {
			stats.TotalBreaches++
		}
		if event.EventType == "action.executed" {
			stats.TotalActions++
		}
		if event.EventType == "action.failed" {
			stats.FailedActions++
		}
	}

	respondJSON(w, http.StatusOK, SLOStatusResponse{
		Success:       true,
		EnforcerStats: stats,
		RecentEvents:  events,
	})
}

// HandleGetAuditEvents handles GET /admin/slo/audit?limit=100
func (h *SLOHandler) HandleGetAuditEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse limit parameter
	limitStr := r.URL.Query().Get("limit")
	limit := 100 // Default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
			if limit > 1000 {
				limit = 1000 // Max limit
			}
		}
	}

	// Fetch events
	events, err := h.auditLogger.GetRecentEvents(limit)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, AuditEventsResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to fetch audit events: %v", err),
		})
		return
	}

	respondJSON(w, http.StatusOK, AuditEventsResponse{
		Success: true,
		Events:  events,
		Count:   len(events),
	})
}

// HandleEvaluate handles POST /admin/slo/evaluate (manual evaluation)
func (h *SLOHandler) HandleEvaluate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req EvaluateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, EvaluateResponse{
			Success: false,
			Error:   fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Build metrics input
	metrics := slo.MetricsInput{
		P99LatencyMs:  req.P99LatencyMs,
		P95LatencyMs:  req.P95LatencyMs,
		ErrorRate:     req.ErrorRate,
		Availability:  req.Availability,
		ThroughputRPS: req.ThroughputRPS,
	}

	// Call SLO enforcer
	response, err := slo.EvaluateAndAct(metrics)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, EvaluateResponse{
			Success: false,
			Error:   fmt.Sprintf("Evaluation failed: %v", err),
		})
		return
	}

	// Log breach if any
	if response.Breached {
		for _, action := range response.Actions {
			h.auditLogger.LogBreach(
				action.SLOType,
				"Manual Evaluation",
				action.CurrentValue,
				action.ThresholdValue,
			)
		}
	}

	respondJSON(w, http.StatusOK, EvaluateResponse{
		Success:   true,
		Breached:  response.Breached,
		Actions:   response.Actions,
		Timestamp: response.Timestamp,
	})
}

// HandleGetMetrics handles GET /admin/slo/metrics (Prometheus-style metrics)
func (h *SLOHandler) HandleGetMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get recent events for metrics
	events, err := h.auditLogger.GetRecentEvents(1000)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to fetch events: %v", err), http.StatusInternalServerError)
		return
	}

	// Calculate metrics
	var breaches, actions, failures int
	for _, event := range events {
		switch event.EventType {
		case "slo.breach":
			breaches++
		case "action.executed":
			actions++
		case "action.failed":
			failures++
		}
	}

	// Output Prometheus format
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	fmt.Fprintf(w, "# HELP slo_enforcer_breaches_total Total number of SLO breaches\n")
	fmt.Fprintf(w, "# TYPE slo_enforcer_breaches_total counter\n")
	fmt.Fprintf(w, "slo_enforcer_breaches_total %d\n\n", breaches)

	fmt.Fprintf(w, "# HELP slo_enforcer_actions_total Total number of remediation actions executed\n")
	fmt.Fprintf(w, "# TYPE slo_enforcer_actions_total counter\n")
	fmt.Fprintf(w, "slo_enforcer_actions_total %d\n\n", actions)

	fmt.Fprintf(w, "# HELP slo_enforcer_action_failures_total Total number of failed actions\n")
	fmt.Fprintf(w, "# TYPE slo_enforcer_action_failures_total counter\n")
	fmt.Fprintf(w, "slo_enforcer_action_failures_total %d\n\n", failures)

	fmt.Fprintf(w, "# HELP slo_enforcer_audit_events_total Total number of audit events\n")
	fmt.Fprintf(w, "# TYPE slo_enforcer_audit_events_total counter\n")
	fmt.Fprintf(w, "slo_enforcer_audit_events_total %d\n", len(events))
}
