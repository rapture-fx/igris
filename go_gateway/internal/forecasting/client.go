// Package forecasting provides client for interacting with Rust forecast engine
package forecasting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client manages communication with the Rust forecasting engine
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new forecasting client
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// IngestMetrics sends metric data to the forecast engine
func (c *Client) IngestMetrics(dataPoints []TimeSeriesData) error {
	req := IngestRequest{
		DataPoints: dataPoints,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal ingest request: %w", err)
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/forecast/ingest", c.baseURL),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("post ingest request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ingest failed: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// GetForecast retrieves forecast for specific metrics
func (c *Client) GetForecast(metricNames []string) ([]ForecastResult, error) {
	req := ForecastRequest{
		MetricNames: metricNames,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal forecast request: %w", err)
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/forecast/predict", c.baseURL),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("post forecast request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("forecast failed: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	var forecastResp ForecastResponse
	if err := json.NewDecoder(resp.Body).Decode(&forecastResp); err != nil {
		return nil, fmt.Errorf("decode forecast response: %w", err)
	}

	return forecastResp.Forecasts, nil
}

// UpdatePolicy notifies the engine of a policy change
func (c *Client) UpdatePolicy(policyName string, value float64) error {
	req := PolicyUpdateRequest{
		PolicyName: policyName,
		Value:      value,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal policy update: %w", err)
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/forecast/policy", c.baseURL),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("post policy update: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("policy update failed: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// RecordOutcome records the outcome of a decision
func (c *Client) RecordOutcome(policyName string, success bool, actualImpact float64) error {
	req := OutcomeRequest{
		PolicyName:   policyName,
		Success:      success,
		ActualImpact: actualImpact,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal outcome request: %w", err)
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/forecast/outcome", c.baseURL),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("post outcome request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("outcome recording failed: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// GetMetrics retrieves engine metrics
func (c *Client) GetMetrics() (*ForecastMetrics, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/api/v1/forecast/metrics", c.baseURL))
	if err != nil {
		return nil, fmt.Errorf("get metrics: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get metrics failed: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	var metrics ForecastMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("decode metrics: %w", err)
	}

	return &metrics, nil
}

// GetHealth checks the health status of the forecast engine
func (c *Client) GetHealth() (*HealthStatus, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/api/v1/forecast/health", c.baseURL))
	if err != nil {
		return nil, fmt.Errorf("get health: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get health failed: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	var health HealthStatus
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, fmt.Errorf("decode health: %w", err)
	}

	return &health, nil
}
