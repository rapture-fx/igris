package client

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// AnalyticsClient handles analytics operations
type AnalyticsClient struct {
	client *Client
}

// NewAnalyticsClient creates a new analytics client
func NewAnalyticsClient(client *Client) *AnalyticsClient {
	return &AnalyticsClient{
		client: client,
	}
}

// AnalyticsQuery represents an analytics query configuration
type AnalyticsQuery struct {
	Dataset      string                 `json:"dataset"`
	Metrics      []string               `json:"metrics"`
	Dimensions   []string               `json:"dimensions,omitempty"`
	Filters      map[string]interface{} `json:"filters,omitempty"`
	DateRange    *DateRange             `json:"date_range,omitempty"`
	Aggregation  string                 `json:"aggregation,omitempty"`
	Granularity  string                 `json:"granularity,omitempty"`
	Limit        int                    `json:"limit,omitempty"`
	OrderBy      string                 `json:"order_by,omitempty"`
	OrderDir     string                 `json:"order_dir,omitempty"`
}

// DateRange represents a date range filter
type DateRange struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// AnalyticsResult represents the result of an analytics query
type AnalyticsResult struct {
	Data      []map[string]interface{} `json:"data"`
	Schema    map[string]string        `json:"schema"`
	RowCount  int                      `json:"row_count"`
	QueryTime float64                  `json:"query_time_seconds"`
	Metadata  map[string]interface{}   `json:"metadata,omitempty"`
}

// Query executes an analytics query
func (a *AnalyticsClient) Query(ctx context.Context, query *AnalyticsQuery) (*AnalyticsResult, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "analytics_query")
	defer span.End()

	span.SetAttributes(
		attribute.String("analytics.dataset", query.Dataset),
		attribute.Int("analytics.metrics_count", len(query.Metrics)),
		attribute.Int("analytics.dimensions_count", len(query.Dimensions)),
	)

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"dataset":    query.Dataset,
		"metrics":    query.Metrics,
		"dimensions": query.Dimensions,
	}).Info("Executing analytics query")

	// Make API request
	resp, err := a.client.Post(ctx, "/analytics/query", query)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse analytics result
	resultBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	var result AnalyticsResult
	if err := json.Unmarshal(resultBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse analytics result: %w", err)
	}

	span.SetAttributes(
		attribute.Int("analytics.row_count", result.RowCount),
		attribute.Float64("analytics.query_time", result.QueryTime),
	)

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"row_count":  result.RowCount,
		"query_time": result.QueryTime,
	}).Info("Analytics query completed")

	return &result, nil
}

// Dataset represents an analytics dataset
type Dataset struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Schema      map[string]string      `json:"schema"`
	RowCount    int64                  `json:"row_count"`
	SizeBytes   int64                  `json:"size_bytes"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// GetDatasets retrieves available datasets for analytics
func (a *AnalyticsClient) GetDatasets(ctx context.Context) ([]Dataset, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "get_datasets")
	defer span.End()

	a.client.logger.WithContext(ctx).Info("Fetching available datasets")

	// Make API request
	resp, err := a.client.Get(ctx, "/analytics/datasets")
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get datasets: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse datasets
	datasetsBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal datasets data: %w", err)
	}

	// Handle different response formats
	var datasetsWrapper struct {
		Datasets []Dataset `json:"datasets"`
	}
	if err := json.Unmarshal(datasetsBytes, &datasetsWrapper); err != nil {
		// Try parsing as direct array
		var datasets []Dataset
		if err := json.Unmarshal(datasetsBytes, &datasets); err != nil {
			return nil, fmt.Errorf("failed to parse datasets: %w", err)
		}
		return datasets, nil
	}

	span.SetAttributes(attribute.Int("datasets.count", len(datasetsWrapper.Datasets)))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"dataset_count": len(datasetsWrapper.Datasets),
	}).Info("Retrieved datasets")

	return datasetsWrapper.Datasets, nil
}

// GetSchema retrieves the schema for a specific dataset
func (a *AnalyticsClient) GetSchema(ctx context.Context, dataset string) (map[string]interface{}, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "get_dataset_schema")
	defer span.End()

	span.SetAttributes(attribute.String("dataset.name", dataset))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"dataset": dataset,
	}).Info("Fetching dataset schema")

	// Make API request
	path := fmt.Sprintf("/analytics/datasets/%s/schema", dataset)
	resp, err := a.client.Get(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get schema: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse schema
	schemaBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal schema data: %w", err)
	}

	var schema map[string]interface{}
	if err := json.Unmarshal(schemaBytes, &schema); err != nil {
		return nil, fmt.Errorf("failed to parse schema: %w", err)
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"dataset":      dataset,
		"field_count":  len(schema),
	}).Info("Retrieved dataset schema")

	return schema, nil
}

// CreateReport creates a new analytics report
func (a *AnalyticsClient) CreateReport(ctx context.Context, report *ReportConfig) (*Report, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "create_report")
	defer span.End()

	span.SetAttributes(attribute.String("report.name", report.Name))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_name": report.Name,
		"dataset":     report.Dataset,
	}).Info("Creating analytics report")

	// Make API request
	resp, err := a.client.Post(ctx, "/analytics/reports", report)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse report
	reportBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal report data: %w", err)
	}

	var result Report
	if err := json.Unmarshal(reportBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse report: %w", err)
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_id":   result.ID,
		"report_name": result.Name,
	}).Info("Analytics report created")

	return &result, nil
}

// ReportConfig represents analytics report configuration
type ReportConfig struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Dataset     string                 `json:"dataset"`
	Query       *AnalyticsQuery        `json:"query"`
	Schedule    *ReportSchedule        `json:"schedule,omitempty"`
	Format      string                 `json:"format,omitempty"`
	Recipients  []string               `json:"recipients,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// ReportSchedule represents report scheduling configuration
type ReportSchedule struct {
	Frequency string `json:"frequency"` // "daily", "weekly", "monthly"
	Time      string `json:"time,omitempty"`
	DayOfWeek int    `json:"day_of_week,omitempty"`
	DayOfMonth int   `json:"day_of_month,omitempty"`
	Timezone  string `json:"timezone,omitempty"`
}

// Report represents an analytics report
type Report struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Dataset     string                 `json:"dataset"`
	Query       *AnalyticsQuery        `json:"query"`
	Schedule    *ReportSchedule        `json:"schedule,omitempty"`
	Status      string                 `json:"status"`
	LastRun     string                 `json:"last_run,omitempty"`
	NextRun     string                 `json:"next_run,omitempty"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// GetReport retrieves an analytics report by ID
func (a *AnalyticsClient) GetReport(ctx context.Context, reportID string) (*Report, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "get_report")
	defer span.End()

	span.SetAttributes(attribute.String("report.id", reportID))

	// Make API request
	path := fmt.Sprintf("/analytics/reports/%s", reportID)
	resp, err := a.client.Get(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get report: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse report
	reportBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal report data: %w", err)
	}

	var report Report
	if err := json.Unmarshal(reportBytes, &report); err != nil {
		return nil, fmt.Errorf("failed to parse report: %w", err)
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_id": report.ID,
		"status":    report.Status,
	}).Debug("Retrieved analytics report")

	return &report, nil
}

// ListReports lists analytics reports
func (a *AnalyticsClient) ListReports(ctx context.Context, opts *models.ListOptions) ([]Report, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "list_reports")
	defer span.End()

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		params = opts.ToQuery()
	}

	// Build path with query parameters
	path := "/analytics/reports"
	if len(params) > 0 {
		path += "?"
		first := true
		for key, value := range params {
			if !first {
				path += "&"
			}
			path += fmt.Sprintf("%s=%s", key, value)
			first = false
		}
	}

	// Make API request
	resp, err := a.client.Get(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list reports: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse reports
	reportsBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal reports data: %w", err)
	}

	var reports []Report
	if err := json.Unmarshal(reportsBytes, &reports); err != nil {
		return nil, fmt.Errorf("failed to parse reports: %w", err)
	}

	span.SetAttributes(attribute.Int("reports.count", len(reports)))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_count": len(reports),
	}).Debug("Listed analytics reports")

	return reports, nil
}

// DeleteReport deletes an analytics report
func (a *AnalyticsClient) DeleteReport(ctx context.Context, reportID string) error {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "delete_report")
	defer span.End()

	span.SetAttributes(attribute.String("report.id", reportID))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_id": reportID,
	}).Info("Deleting analytics report")

	// Make API request
	path := fmt.Sprintf("/analytics/reports/%s", reportID)
	resp, err := a.client.Delete(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to delete report: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_id": reportID,
	}).Info("Analytics report deleted")

	return nil
}