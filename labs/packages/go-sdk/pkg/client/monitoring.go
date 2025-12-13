package client

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// MonitoringClient handles monitoring and health check operations
type MonitoringClient struct {
	client *Client
}

// NewMonitoringClient creates a new monitoring client
func NewMonitoringClient(client *Client) *MonitoringClient {
	return &MonitoringClient{
		client: client,
	}
}

// GetHealth retrieves the health status of the API
func (m *MonitoringClient) GetHealth(ctx context.Context) (*models.HealthStatus, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartSpan(ctx, "get_health_status")
	defer span.End()

	m.client.logger.WithContext(ctx).Debug("Getting API health status")

	// Make API request
	resp, err := m.client.Get(ctx, "/health")
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get health status: %w", err)
	}

	// Parse response directly as health status (not wrapped in APIResponse)
	var health models.HealthStatus
	if err := json.Unmarshal(resp.Body, &health); err != nil {
		m.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse health status: %w", err)
	}

	// Record health status
	healthy := health.Status == "healthy"
	span.SetAttributes(
		attribute.Bool("health.healthy", healthy),
		attribute.String("health.status", health.Status),
		attribute.Int("health.check_count", len(health.Checks)),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"status":      health.Status,
		"check_count": len(health.Checks),
		"version":     health.Version,
		"uptime":      health.Uptime,
	}).Info("Retrieved API health status")

	return &health, nil
}

// GetMetrics retrieves system metrics
func (m *MonitoringClient) GetMetrics(ctx context.Context) (*models.Metrics, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartSpan(ctx, "get_metrics")
	defer span.End()

	m.client.logger.WithContext(ctx).Debug("Getting system metrics")

	// Make API request
	resp, err := m.client.Get(ctx, "/metrics")
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get metrics: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		m.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		m.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse metrics
	metricsBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metrics data: %w", err)
	}

	var metrics models.Metrics
	if err := json.Unmarshal(metricsBytes, &metrics); err != nil {
		return nil, fmt.Errorf("failed to parse metrics: %w", err)
	}

	// Record key metrics in span
	span.SetAttributes(
		attribute.Float64("system.cpu_usage", metrics.System.CPUUsage),
		attribute.Float64("system.memory_usage", metrics.System.MemoryUsage),
		attribute.Float64("api.requests_per_second", metrics.API.RequestsPerSecond),
		attribute.Float64("api.error_rate", metrics.API.ErrorRate),
		attribute.Int("jobs.active", metrics.Jobs.ActiveJobs),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"cpu_usage":            metrics.System.CPUUsage,
		"memory_usage":         metrics.System.MemoryUsage,
		"requests_per_second":  metrics.API.RequestsPerSecond,
		"active_jobs":          metrics.Jobs.ActiveJobs,
		"error_rate":           metrics.API.ErrorRate,
	}).Debug("Retrieved system metrics")

	return &metrics, nil
}

// GetJobLogs retrieves logs for a specific job
func (m *MonitoringClient) GetJobLogs(ctx context.Context, jobID string, lines int) ([]string, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartSpan(ctx, "get_job_logs")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", jobID),
		attribute.Int("logs.lines", lines),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id": jobID,
		"lines":  lines,
	}).Debug("Getting job logs")

	// Build path
	path := fmt.Sprintf("/monitoring/jobs/%s/logs", jobID)
	if lines > 0 {
		path += fmt.Sprintf("?lines=%d", lines)
	}

	// Make API request
	resp, err := m.client.Get(ctx, path)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get job logs: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		m.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		m.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse logs
	logsBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal logs data: %w", err)
	}

	var logs []string
	if err := json.Unmarshal(logsBytes, &logs); err != nil {
		return nil, fmt.Errorf("failed to parse logs: %w", err)
	}

	span.SetAttributes(attribute.Int("logs.count", len(logs)))

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":    jobID,
		"log_count": len(logs),
	}).Debug("Retrieved job logs")

	return logs, nil
}

// StreamJobLogs streams logs for a job in real-time (if supported)
func (m *MonitoringClient) StreamJobLogs(ctx context.Context, jobID string) (<-chan string, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartSpan(ctx, "stream_job_logs")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", jobID))

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id": jobID,
	}).Info("Starting log stream")

	// Create channel for logs
	logChan := make(chan string, 100)

	// This would typically connect to a WebSocket or Server-Sent Events endpoint
	// For now, we'll simulate with periodic polling
	go func() {
		defer close(logChan)
		
		// Implementation would depend on the actual streaming protocol
		// This is a placeholder for the streaming functionality
		m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
			"job_id": jobID,
		}).Warn("Log streaming not yet implemented - falling back to periodic polling")
	}()

	return logChan, nil
}

// GetSystemInfo retrieves detailed system information
func (m *MonitoringClient) GetSystemInfo(ctx context.Context) (map[string]interface{}, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartSpan(ctx, "get_system_info")
	defer span.End()

	m.client.logger.WithContext(ctx).Debug("Getting system information")

	// Make API request
	resp, err := m.client.Get(ctx, "/system/info")
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get system info: %w", err)
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(resp.Body, &result); err != nil {
		m.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse system info: %w", err)
	}

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"info_keys": len(result),
	}).Debug("Retrieved system information")

	return result, nil
}

// GetEvents retrieves recent system events
func (m *MonitoringClient) GetEvents(ctx context.Context, eventType models.EventType, limit int) ([]models.Event, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartSpan(ctx, "get_events")
	defer span.End()

	span.SetAttributes(
		attribute.String("event.type", string(eventType)),
		attribute.Int("event.limit", limit),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"event_type": eventType,
		"limit":      limit,
	}).Debug("Getting system events")

	// Build path
	path := "/monitoring/events"
	params := make([]string, 0)
	if eventType != "" {
		params = append(params, fmt.Sprintf("type=%s", eventType))
	}
	if limit > 0 {
		params = append(params, fmt.Sprintf("limit=%d", limit))
	}
	if len(params) > 0 {
		path += "?" + params[0]
		for _, param := range params[1:] {
			path += "&" + param
		}
	}

	// Make API request
	resp, err := m.client.Get(ctx, path)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get events: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		m.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		m.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse events
	eventsBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal events data: %w", err)
	}

	var events []models.Event
	if err := json.Unmarshal(eventsBytes, &events); err != nil {
		return nil, fmt.Errorf("failed to parse events: %w", err)
	}

	span.SetAttributes(attribute.Int("events.count", len(events)))

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"event_type":  eventType,
		"event_count": len(events),
	}).Debug("Retrieved system events")

	return events, nil
}