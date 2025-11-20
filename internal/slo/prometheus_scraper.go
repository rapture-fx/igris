// Package slo provides Prometheus metrics scraping for SLO enforcement
package slo

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"time"
)

// PrometheusScraper scrapes metrics from Prometheus /metrics endpoint
type PrometheusScraper struct {
	metricsURL     string
	scrapeInterval time.Duration
	client         *http.Client
	logger         *log.Logger
	stopCh         chan struct{}
}

// NewPrometheusScraper creates a new Prometheus scraper
func NewPrometheusScraper(metricsURL string) *PrometheusScraper {
	return &PrometheusScraper{
		metricsURL:     metricsURL,
		scrapeInterval: 20 * time.Second,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		logger: log.Default(),
		stopCh: make(chan struct{}),
	}
}

// Start begins scraping metrics and calling SLO enforcer
func (ps *PrometheusScraper) Start(ctx context.Context, actionExecutor ActionExecutor) {
	ticker := time.NewTicker(ps.scrapeInterval)
	defer ticker.Stop()

	ps.logger.Printf("[SLO] Starting Prometheus scraper (interval: %v, url: %s)", ps.scrapeInterval, ps.metricsURL)

	for {
		select {
		case <-ctx.Done():
			ps.logger.Println("[SLO] Prometheus scraper stopped")
			return
		case <-ps.stopCh:
			ps.logger.Println("[SLO] Prometheus scraper stopped via stopCh")
			return
		case <-ticker.C:
			ps.scrapeAndEvaluate(actionExecutor)
		}
	}
}

// Stop stops the scraper
func (ps *PrometheusScraper) Stop() {
	close(ps.stopCh)
}

func (ps *PrometheusScraper) scrapeAndEvaluate(executor ActionExecutor) {
	// Scrape Prometheus metrics
	metrics, err := ps.scrapeMetrics()
	if err != nil {
		ps.logger.Printf("[SLO] Failed to scrape metrics: %v", err)
		return
	}

	// Call SLO enforcer FFI
	response, err := EvaluateAndAct(metrics)
	if err != nil {
		ps.logger.Printf("[SLO] SLO evaluation failed: %v", err)
		return
	}

	// Log evaluation results
	if response.Breached {
		ps.logger.Printf("[SLO] ⚠️  SLO BREACH DETECTED - %d remediation actions required", len(response.Actions))
	} else {
		ps.logger.Printf("[SLO] ✅ All SLOs compliant")
		return
	}

	// Execute remediation actions
	for _, action := range response.Actions {
		ps.logger.Printf("[SLO] Executing action: %s on %s (reason: %s)",
			action.ActionType, action.Target, action.Reason)

		if err := executor.Execute(action); err != nil {
			ps.logger.Printf("[SLO] ❌ Action execution failed: %v", err)
		} else {
			ps.logger.Printf("[SLO] ✅ Action executed successfully")
		}
	}
}

func (ps *PrometheusScraper) scrapeMetrics() (MetricsInput, error) {
	// Fetch metrics from /metrics endpoint
	resp, err := ps.client.Get(ps.metricsURL)
	if err != nil {
		return MetricsInput{}, fmt.Errorf("failed to fetch metrics: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return MetricsInput{}, fmt.Errorf("metrics endpoint returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return MetricsInput{}, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse Prometheus text format
	return ps.parsePrometheusMetrics(string(body))
}

func (ps *PrometheusScraper) parsePrometheusMetrics(metricsText string) (MetricsInput, error) {
	var metrics MetricsInput

	// Regex patterns for Prometheus metrics
	patterns := map[string]*regexp.Regexp{
		"p99_latency": regexp.MustCompile(`inference_latency_seconds\{.*quantile="0\.99".*\}\s+([\d.]+)`),
		"p95_latency": regexp.MustCompile(`inference_latency_seconds\{.*quantile="0\.95".*\}\s+([\d.]+)`),
		"error_rate":  regexp.MustCompile(`inference_errors_total\s+([\d.]+)`),
		"throughput":  regexp.MustCompile(`inference_requests_total\s+([\d.]+)`),
	}

	// Extract P99 latency (convert seconds to milliseconds)
	if matches := patterns["p99_latency"].FindStringSubmatch(metricsText); len(matches) > 1 {
		if val, err := strconv.ParseFloat(matches[1], 64); err == nil {
			p99Ms := val * 1000 // Convert seconds to milliseconds
			metrics.P99LatencyMs = &p99Ms
		}
	}

	// Extract P95 latency (convert seconds to milliseconds)
	if matches := patterns["p95_latency"].FindStringSubmatch(metricsText); len(matches) > 1 {
		if val, err := strconv.ParseFloat(matches[1], 64); err == nil {
			p95Ms := val * 1000 // Convert seconds to milliseconds
			metrics.P95LatencyMs = &p95Ms
		}
	}

	// Extract error rate (calculate from total errors / total requests)
	// For now, use a simplified approach
	if matches := patterns["error_rate"].FindStringSubmatch(metricsText); len(matches) > 1 {
		if val, err := strconv.ParseFloat(matches[1], 64); err == nil {
			// Assume error_rate is already normalized (0.0-1.0)
			errorRate := val
			metrics.ErrorRate = &errorRate
		}
	}

	// Extract throughput (requests per second)
	if matches := patterns["throughput"].FindStringSubmatch(metricsText); len(matches) > 1 {
		if val, err := strconv.ParseFloat(matches[1], 64); err == nil {
			// Calculate RPS from total counter (simplified - would need rate() in real impl)
			rps := val
			metrics.ThroughputRPS = &rps
		}
	}

	// Calculate availability (simplified: 1 - error_rate)
	if metrics.ErrorRate != nil {
		availability := 1.0 - *metrics.ErrorRate
		metrics.Availability = &availability
	}

	return metrics, nil
}
