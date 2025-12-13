package client

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// QualityClient handles data quality operations
type QualityClient struct {
	client *Client
}

// NewQualityClient creates a new data quality client
func NewQualityClient(client *Client) *QualityClient {
	return &QualityClient{
		client: client,
	}
}

// DataQualityReport represents a data quality assessment report
type DataQualityReport struct {
	ID              string                 `json:"id"`
	DataPath        string                 `json:"data_path"`
	TotalRecords    int                    `json:"total_records"`
	ValidRecords    int                    `json:"valid_records"`
	InvalidRecords  int                    `json:"invalid_records"`
	QualityScore    float64                `json:"quality_score"`     // 0-100
	QualityLevel    string                 `json:"quality_level"`     // excellent, good, fair, poor
	Checks          []QualityCheck         `json:"checks"`
	Issues          []QualityIssue         `json:"issues"`
	Recommendations []string               `json:"recommendations,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt       string                 `json:"created_at"`
	CompletedAt     string                 `json:"completed_at,omitempty"`
}

// QualityCheck represents a single quality check
type QualityCheck struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`        // completeness, accuracy, consistency, validity, etc.
	Status      string                 `json:"status"`      // passed, failed, warning
	Score       float64                `json:"score"`       // 0-100
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details,omitempty"`
	AffectedRows int                   `json:"affected_rows,omitempty"`
}

// QualityIssue represents a specific data quality issue
type QualityIssue struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`        // missing_value, invalid_format, outlier, duplicate, etc.
	Severity    string                 `json:"severity"`    // critical, high, medium, low
	Column      string                 `json:"column,omitempty"`
	Row         int                    `json:"row,omitempty"`
	Value       interface{}            `json:"value,omitempty"`
	ExpectedValue interface{}          `json:"expected_value,omitempty"`
	Description string                 `json:"description"`
	Suggestion  string                 `json:"suggestion,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AssessQualityRequest represents a quality assessment request
type AssessQualityRequest struct {
	DataPath string   `json:"data_path"`
	Checks   []string `json:"checks,omitempty"` // Specific checks to run, empty means all
}

// AssessQuality performs data quality assessment
func (q *QualityClient) AssessQuality(ctx context.Context, dataPath string, checks []string) (*DataQualityReport, error) {
	// Start tracing
	ctx, span := q.client.tracer.StartSpan(ctx, "assess_quality")
	defer span.End()

	span.SetAttributes(
		attribute.String("data.path", dataPath),
		attribute.Int("checks.count", len(checks)),
	)

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"data_path":    dataPath,
		"checks_count": len(checks),
	}).Info("Assessing data quality")

	// Prepare request
	request := AssessQualityRequest{
		DataPath: dataPath,
		Checks:   checks,
	}

	// Make API request
	resp, err := q.client.Post(ctx, "/quality/assess", request)
	if err != nil {
		q.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to assess quality: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		q.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		q.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse quality report
	reportBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal report data: %w", err)
	}

	var report DataQualityReport
	if err := json.Unmarshal(reportBytes, &report); err != nil {
		return nil, fmt.Errorf("failed to parse quality report: %w", err)
	}

	span.SetAttributes(
		attribute.Float64("quality.score", report.QualityScore),
		attribute.String("quality.level", report.QualityLevel),
		attribute.Int("quality.total_records", report.TotalRecords),
		attribute.Int("quality.invalid_records", report.InvalidRecords),
		attribute.Int("quality.issues_count", len(report.Issues)),
	)

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"quality_score":   report.QualityScore,
		"quality_level":   report.QualityLevel,
		"total_records":   report.TotalRecords,
		"invalid_records": report.InvalidRecords,
		"issues_count":    len(report.Issues),
	}).Info("Data quality assessment completed")

	return &report, nil
}

// GetReport retrieves a quality assessment report by ID
func (q *QualityClient) GetReport(ctx context.Context, reportID string) (*DataQualityReport, error) {
	// Start tracing
	ctx, span := q.client.tracer.StartSpan(ctx, "get_quality_report")
	defer span.End()

	span.SetAttributes(attribute.String("report.id", reportID))

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_id": reportID,
	}).Debug("Fetching quality report")

	// Make API request
	path := fmt.Sprintf("/quality/reports/%s", reportID)
	resp, err := q.client.Get(ctx, path)
	if err != nil {
		q.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get report: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		q.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		q.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse quality report
	reportBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal report data: %w", err)
	}

	var report DataQualityReport
	if err := json.Unmarshal(reportBytes, &report); err != nil {
		return nil, fmt.Errorf("failed to parse quality report: %w", err)
	}

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_id":     report.ID,
		"quality_score": report.QualityScore,
		"issues_count":  len(report.Issues),
	}).Debug("Retrieved quality report")

	return &report, nil
}

// ListReports lists quality assessment reports
func (q *QualityClient) ListReports(ctx context.Context, opts *models.ListOptions) ([]DataQualityReport, error) {
	// Start tracing
	ctx, span := q.client.tracer.StartSpan(ctx, "list_quality_reports")
	defer span.End()

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		params = opts.ToQuery()
	}

	// Build path with query parameters
	path := "/quality/reports"
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
	resp, err := q.client.Get(ctx, path)
	if err != nil {
		q.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list reports: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		q.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		q.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse reports
	reportsBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal reports data: %w", err)
	}

	var reports []DataQualityReport
	if err := json.Unmarshal(reportsBytes, &reports); err != nil {
		return nil, fmt.Errorf("failed to parse reports: %w", err)
	}

	span.SetAttributes(attribute.Int("reports.count", len(reports)))

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"report_count": len(reports),
	}).Debug("Listed quality reports")

	return reports, nil
}

// QualityRule represents a data quality rule
type QualityRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Type        string                 `json:"type"`        // completeness, accuracy, consistency, validity
	Column      string                 `json:"column,omitempty"`
	Condition   string                 `json:"condition"`   // SQL-like expression or rule definition
	Severity    string                 `json:"severity"`    // critical, high, medium, low
	Active      bool                   `json:"active"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at"`
}

// CreateRule creates a new quality rule
func (q *QualityClient) CreateRule(ctx context.Context, rule *QualityRule) (*QualityRule, error) {
	// Start tracing
	ctx, span := q.client.tracer.StartSpan(ctx, "create_quality_rule")
	defer span.End()

	span.SetAttributes(
		attribute.String("rule.name", rule.Name),
		attribute.String("rule.type", rule.Type),
		attribute.String("rule.severity", rule.Severity),
	)

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"rule_name": rule.Name,
		"rule_type": rule.Type,
		"severity":  rule.Severity,
	}).Info("Creating quality rule")

	// Make API request
	resp, err := q.client.Post(ctx, "/quality/rules", rule)
	if err != nil {
		q.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to create rule: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		q.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		q.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse created rule
	ruleBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal rule data: %w", err)
	}

	var result QualityRule
	if err := json.Unmarshal(ruleBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse rule: %w", err)
	}

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"rule_id":   result.ID,
		"rule_name": result.Name,
	}).Info("Quality rule created")

	return &result, nil
}

// GetRule retrieves a quality rule by ID
func (q *QualityClient) GetRule(ctx context.Context, ruleID string) (*QualityRule, error) {
	// Start tracing
	ctx, span := q.client.tracer.StartSpan(ctx, "get_quality_rule")
	defer span.End()

	span.SetAttributes(attribute.String("rule.id", ruleID))

	// Make API request
	path := fmt.Sprintf("/quality/rules/%s", ruleID)
	resp, err := q.client.Get(ctx, path)
	if err != nil {
		q.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get rule: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		q.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		q.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse rule
	ruleBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal rule data: %w", err)
	}

	var rule QualityRule
	if err := json.Unmarshal(ruleBytes, &rule); err != nil {
		return nil, fmt.Errorf("failed to parse rule: %w", err)
	}

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"rule_id": rule.ID,
		"active":  rule.Active,
	}).Debug("Retrieved quality rule")

	return &rule, nil
}

// ListRules lists quality rules
func (q *QualityClient) ListRules(ctx context.Context, opts *models.ListOptions) ([]QualityRule, error) {
	// Start tracing
	ctx, span := q.client.tracer.StartSpan(ctx, "list_quality_rules")
	defer span.End()

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		params = opts.ToQuery()
	}

	// Build path with query parameters
	path := "/quality/rules"
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
	resp, err := q.client.Get(ctx, path)
	if err != nil {
		q.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list rules: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		q.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		q.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse rules
	rulesBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal rules data: %w", err)
	}

	var rules []QualityRule
	if err := json.Unmarshal(rulesBytes, &rules); err != nil {
		return nil, fmt.Errorf("failed to parse rules: %w", err)
	}

	span.SetAttributes(attribute.Int("rules.count", len(rules)))

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"rule_count": len(rules),
	}).Debug("Listed quality rules")

	return rules, nil
}

// UpdateRule updates a quality rule
func (q *QualityClient) UpdateRule(ctx context.Context, ruleID string, rule *QualityRule) (*QualityRule, error) {
	// Start tracing
	ctx, span := q.client.tracer.StartSpan(ctx, "update_quality_rule")
	defer span.End()

	span.SetAttributes(attribute.String("rule.id", ruleID))

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"rule_id": ruleID,
	}).Info("Updating quality rule")

	// Make API request
	path := fmt.Sprintf("/quality/rules/%s", ruleID)
	resp, err := q.client.Put(ctx, path, rule)
	if err != nil {
		q.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to update rule: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		q.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		q.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse updated rule
	ruleBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal rule data: %w", err)
	}

	var result QualityRule
	if err := json.Unmarshal(ruleBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse rule: %w", err)
	}

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"rule_id": result.ID,
	}).Info("Quality rule updated")

	return &result, nil
}

// DeleteRule deletes a quality rule
func (q *QualityClient) DeleteRule(ctx context.Context, ruleID string) error {
	// Start tracing
	ctx, span := q.client.tracer.StartSpan(ctx, "delete_quality_rule")
	defer span.End()

	span.SetAttributes(attribute.String("rule.id", ruleID))

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"rule_id": ruleID,
	}).Info("Deleting quality rule")

	// Make API request
	path := fmt.Sprintf("/quality/rules/%s", ruleID)
	resp, err := q.client.Delete(ctx, path)
	if err != nil {
		q.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to delete rule: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		q.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		q.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	q.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"rule_id": ruleID,
	}).Info("Quality rule deleted")

	return nil
}