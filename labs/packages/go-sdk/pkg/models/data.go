package models

import (
	"time"

	"github.com/google/uuid"
)

// DataProcessingRequest represents a request for data processing operation
type DataProcessingRequest struct {
	SourcePath      *string                `json:"source_path,omitempty"`
	SourceURL       *string                `json:"source_url,omitempty"`
	DataFormat      DataFormat             `json:"data_format"`
	ProcessingMode  ProcessingMode         `json:"processing_mode"`
	Transformations []TransformationRule   `json:"transformations,omitempty"`
	OutputFormat    DataFormat             `json:"output_format"`
	Options         map[string]interface{} `json:"options,omitempty"`
	Tags            []string               `json:"tags,omitempty"`
	Priority        int                    `json:"priority,omitempty"`        // 1-10, higher is more important
	TimeoutSeconds  int                    `json:"timeout_seconds,omitempty"` // Job timeout
}

// DataProcessingResult represents the result of a data processing operation
type DataProcessingResult struct {
	JobID                 string                 `json:"job_id"`
	Status                JobStatus              `json:"status"`
	InputRecords          int                    `json:"input_records"`
	OutputRecords         int                    `json:"output_records"`
	ProcessingTimeSeconds float64                `json:"processing_time_seconds"`
	OutputPath            *string                `json:"output_path,omitempty"`
	OutputURL             *string                `json:"output_url,omitempty"`
	Metadata              map[string]interface{} `json:"metadata,omitempty"`
	ErrorMessage          *string                `json:"error_message,omitempty"`
	CreatedAt             time.Time              `json:"created_at"`
	CompletedAt           *time.Time             `json:"completed_at,omitempty"`
	QualityReport         *DataQualityReport     `json:"quality_report,omitempty"`
	ResourceUsage         *ResourceUsage         `json:"resource_usage,omitempty"`
}

// SuccessRate calculates the processing success rate
func (r *DataProcessingResult) SuccessRate() float64 {
	if r.InputRecords == 0 {
		return 0.0
	}
	return (float64(r.OutputRecords) / float64(r.InputRecords)) * 100
}

// RecordsPerSecond calculates processing throughput
func (r *DataProcessingResult) RecordsPerSecond() float64 {
	if r.ProcessingTimeSeconds == 0 {
		return 0.0
	}
	return float64(r.InputRecords) / r.ProcessingTimeSeconds
}

// DataQualityMetric represents an individual data quality metric
type DataQualityMetric struct {
	Name        string                 `json:"name"`
	Score       float64                `json:"score"`         // 0-100
	Description string                 `json:"description"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// GetQualityLevel returns the quality level based on the score
func (m *DataQualityMetric) GetQualityLevel() QualityLevel {
	switch {
	case m.Score >= 90:
		return QualityLevelExcellent
	case m.Score >= 75:
		return QualityLevelGood
	case m.Score >= 60:
		return QualityLevelFair
	default:
		return QualityLevelPoor
	}
}

// DataQualityReport represents a comprehensive data quality assessment report
type DataQualityReport struct {
	OverallScore     float64                        `json:"overall_score"`
	TotalRecords     int                            `json:"total_records"`
	ValidRecords     int                            `json:"valid_records"`
	InvalidRecords   int                            `json:"invalid_records"`
	Metrics          []DataQualityMetric            `json:"metrics"`
	ColumnProfiles   map[string]map[string]interface{} `json:"column_profiles"`
	Issues           []DataQualityIssue             `json:"issues"`
	Recommendations  []string                       `json:"recommendations"`
	GeneratedAt      time.Time                      `json:"generated_at"`
}

// GetOverallQualityLevel returns the overall quality level
func (r *DataQualityReport) GetOverallQualityLevel() QualityLevel {
	switch {
	case r.OverallScore >= 90:
		return QualityLevelExcellent
	case r.OverallScore >= 75:
		return QualityLevelGood
	case r.OverallScore >= 60:
		return QualityLevelFair
	default:
		return QualityLevelPoor
	}
}

// ValidityRate calculates the data validity rate
func (r *DataQualityReport) ValidityRate() float64 {
	if r.TotalRecords == 0 {
		return 0.0
	}
	return (float64(r.ValidRecords) / float64(r.TotalRecords)) * 100
}

// GetMetric returns a specific quality metric by name
func (r *DataQualityReport) GetMetric(name string) *DataQualityMetric {
	for i := range r.Metrics {
		if r.Metrics[i].Name == name {
			return &r.Metrics[i]
		}
	}
	return nil
}

// DataQualityIssue represents a data quality issue
type DataQualityIssue struct {
	Type        string                 `json:"type"`        // "missing", "invalid", "duplicate", "outlier", etc.
	Severity    string                 `json:"severity"`    // "low", "medium", "high", "critical"
	Column      string                 `json:"column,omitempty"`
	Row         int                    `json:"row,omitempty"`
	Value       interface{}            `json:"value,omitempty"`
	Description string                 `json:"description"`
	Suggestion  string                 `json:"suggestion,omitempty"`
	Count       int                    `json:"count,omitempty"` // For aggregated issues
	Details     map[string]interface{} `json:"details,omitempty"`
}

// TransformationRule represents a data transformation rule
type TransformationRule struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"` // "filter", "map", "aggregate", "join", "clean", "normalize"
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	Condition   *string                `json:"condition,omitempty"`
	Description *string                `json:"description,omitempty"`
	Enabled     bool                   `json:"enabled"`
	Order       int                    `json:"order,omitempty"` // Execution order
}

// DataPipeline represents a data processing pipeline configuration
type DataPipeline struct {
	ID                 string                 `json:"id,omitempty"`
	Name               string                 `json:"name"`
	Description        *string                `json:"description,omitempty"`
	SourceConfig       map[string]interface{} `json:"source_config"`
	Transformations    []TransformationRule   `json:"transformations"`
	DestinationConfig  map[string]interface{} `json:"destination_config"`
	Schedule           *string                `json:"schedule,omitempty"` // Cron expression
	IsActive           bool                   `json:"is_active"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
	CreatedBy          string                 `json:"created_by,omitempty"`
	LastRunAt          *time.Time             `json:"last_run_at,omitempty"`
	LastRunStatus      *JobStatus             `json:"last_run_status,omitempty"`
	NextRunAt          *time.Time             `json:"next_run_at,omitempty"`
	RunCount           int                    `json:"run_count"`
	SuccessfulRunCount int                    `json:"successful_run_count"`
	ErrorCount         int                    `json:"error_count"`
}

// AddTransformation adds a transformation rule to the pipeline
func (p *DataPipeline) AddTransformation(transformation TransformationRule) {
	p.Transformations = append(p.Transformations, transformation)
}

// SuccessRate calculates the pipeline success rate
func (p *DataPipeline) SuccessRate() float64 {
	if p.RunCount == 0 {
		return 0.0
	}
	return (float64(p.SuccessfulRunCount) / float64(p.RunCount)) * 100
}

// ProcessFileRequest represents a request to process a single file
type ProcessFileRequest struct {
	FilePath        string                 `json:"file_path,omitempty"`
	FileURL         string                 `json:"file_url,omitempty"`
	FileContent     []byte                 `json:"file_content,omitempty"` // For small files
	Filename        string                 `json:"filename,omitempty"`
	DataFormat      DataFormat             `json:"data_format,omitempty"`
	OutputFormat    DataFormat             `json:"output_format"`
	Transformations []TransformationRule   `json:"transformations,omitempty"`
	Options         map[string]interface{} `json:"options,omitempty"`
	Tags            []string               `json:"tags,omitempty"`
	Priority        int                    `json:"priority,omitempty"`
	Async           bool                   `json:"async"`
}

// ProcessBatchRequest represents a request to process multiple files
type ProcessBatchRequest struct {
	Files           []ProcessFileRequest   `json:"files"`
	BatchOptions    map[string]interface{} `json:"batch_options,omitempty"`
	ParallelJobs    int                    `json:"parallel_jobs,omitempty"` // Max parallel processing jobs
	Priority        int                    `json:"priority,omitempty"`
	Tags            []string               `json:"tags,omitempty"`
	StopOnFirstError bool                   `json:"stop_on_first_error"`
}

// BatchProcessingResult represents the result of batch processing
type BatchProcessingResult struct {
	BatchID           string                    `json:"batch_id"`
	Status            JobStatus                 `json:"status"`
	TotalFiles        int                       `json:"total_files"`
	ProcessedFiles    int                       `json:"processed_files"`
	SuccessfulFiles   int                       `json:"successful_files"`
	FailedFiles       int                       `json:"failed_files"`
	Results           []DataProcessingResult    `json:"results"`
	AggregateMetrics  AggregateProcessingMetrics `json:"aggregate_metrics"`
	CreatedAt         time.Time                 `json:"created_at"`
	CompletedAt       *time.Time                `json:"completed_at,omitempty"`
	ProcessingTime    float64                   `json:"processing_time_seconds"`
}

// SuccessRate calculates the batch processing success rate
func (r *BatchProcessingResult) SuccessRate() float64 {
	if r.TotalFiles == 0 {
		return 0.0
	}
	return (float64(r.SuccessfulFiles) / float64(r.TotalFiles)) * 100
}

// AggregateProcessingMetrics represents aggregated processing metrics
type AggregateProcessingMetrics struct {
	TotalInputRecords          int     `json:"total_input_records"`
	TotalOutputRecords         int     `json:"total_output_records"`
	TotalProcessingTime        float64 `json:"total_processing_time_seconds"`
	AverageProcessingTime      float64 `json:"average_processing_time_seconds"`
	TotalDataSizeBytes         int64   `json:"total_data_size_bytes"`
	AverageRecordsPerSecond    float64 `json:"average_records_per_second"`
	AverageDataQualityScore    float64 `json:"average_data_quality_score"`
	TotalTransformationsApplied int     `json:"total_transformations_applied"`
}

// StreamingDataRequest represents a request for streaming data processing
type StreamingDataRequest struct {
	StreamID        string                 `json:"stream_id"`
	DataFormat      DataFormat             `json:"data_format"`
	Transformations []TransformationRule   `json:"transformations,omitempty"`
	OutputFormat    DataFormat             `json:"output_format,omitempty"`
	BufferSize      int                    `json:"buffer_size,omitempty"`      // Records to buffer before processing
	FlushInterval   int                    `json:"flush_interval_ms,omitempty"` // Interval to flush buffer
	Options         map[string]interface{} `json:"options,omitempty"`
	Tags            []string               `json:"tags,omitempty"`
}

// StreamingDataResult represents streaming processing result
type StreamingDataResult struct {
	StreamID              string    `json:"stream_id"`
	Status                JobStatus `json:"status"`
	RecordsProcessed      int64     `json:"records_processed"`
	RecordsPerSecond      float64   `json:"records_per_second"`
	ErrorCount            int64     `json:"error_count"`
	LastProcessedAt       time.Time `json:"last_processed_at"`
	StartedAt             time.Time `json:"started_at"`
	AverageLatencyMs      float64   `json:"average_latency_ms"`
	BacklogSize           int64     `json:"backlog_size,omitempty"`
	ThroughputBytesPerSec int64     `json:"throughput_bytes_per_sec"`
}

// DataSource represents a data source configuration
type DataSource struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Type         string                 `json:"type"` // "file", "database", "api", "stream", "cloud_storage"
	ConnectionString string             `json:"connection_string,omitempty"`
	Configuration map[string]interface{} `json:"configuration"`
	Credentials   map[string]interface{} `json:"credentials,omitempty"`
	Schema        map[string]interface{} `json:"schema,omitempty"`
	IsActive      bool                   `json:"is_active"`
	LastTested    *time.Time             `json:"last_tested,omitempty"`
	TestResult    *string                `json:"test_result,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

// TestConnectionRequest represents a request to test data source connection
type TestConnectionRequest struct {
	ConnectionString string                 `json:"connection_string,omitempty"`
	Configuration    map[string]interface{} `json:"configuration"`
	Credentials      map[string]interface{} `json:"credentials,omitempty"`
	Type             string                 `json:"type"`
}

// TestConnectionResult represents the result of connection test
type TestConnectionResult struct {
	Success     bool                   `json:"success"`
	Message     string                 `json:"message"`
	Latency     time.Duration          `json:"latency_ms"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	TestedAt    time.Time              `json:"tested_at"`
	ErrorCode   string                 `json:"error_code,omitempty"`
	Suggestions []string               `json:"suggestions,omitempty"`
}

// DataSourceType represents the type of data source
type DataSourceType string

const (
	DataSourceTypeFile         DataSourceType = "file"
	DataSourceTypeDatabase     DataSourceType = "database"
	DataSourceTypeAPI          DataSourceType = "api"
	DataSourceTypeStream       DataSourceType = "stream"
	DataSourceTypeCloudStorage DataSourceType = "cloud_storage"
)

// DataInvestigation represents a data investigation
type DataInvestigation struct {
	ID                  uuid.UUID              `json:"id"`
	WorkspaceID         uuid.UUID              `json:"workspace_id"`
	CreatedByID         uuid.UUID              `json:"created_by_id"`
	Name                string                 `json:"name"`
	Description         *string                `json:"description,omitempty"`
	DataSourceType      *DataSourceType        `json:"data_source_type,omitempty"`
	DataSourceConfig    map[string]interface{} `json:"data_source_config,omitempty"`
	AnalysisConfig      map[string]interface{} `json:"analysis_config,omitempty"`
	OriginalFilePath    *string                `json:"original_file_path,omitempty"`
	SchemaInfo          map[string]interface{} `json:"schema_info,omitempty"`
	ProcessedFilePath   *string                `json:"processed_file_path,omitempty"`
	QualityScore        *float64               `json:"quality_score,omitempty"`
	AnomaliesDetected   []interface{}          `json:"anomalies_detected,omitempty"`
	PatternsFound       []interface{}          `json:"patterns_found,omitempty"`
	Recommendations     []interface{}          `json:"recommendations,omitempty"`
	Status              JobStatus              `json:"status"`
	ProgressPercentage  *float64               `json:"progress_percentage,omitempty"`
	ErrorMessage        *string                `json:"error_message,omitempty"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           *time.Time             `json:"updated_at,omitempty"`
	CompletedAt         *time.Time             `json:"completed_at,omitempty"`
}

// DataInvestigationCreate represents a request to create a data investigation
type DataInvestigationCreate struct {
	WorkspaceID         uuid.UUID              `json:"workspace_id"`
	Name                string                 `json:"name"`
	Description         *string                `json:"description,omitempty"`
	DataSourceType      *DataSourceType        `json:"data_source_type,omitempty"`
	DataSourceConfig    map[string]interface{} `json:"data_source_config,omitempty"`
	AnalysisConfig      map[string]interface{} `json:"analysis_config,omitempty"`
	OriginalFilePath    *string                `json:"original_file_path,omitempty"`
}

// DataInvestigationUpdate represents a request to update a data investigation
type DataInvestigationUpdate struct {
	Name               *string                `json:"name,omitempty"`
	Description        *string                `json:"description,omitempty"`
	DataSourceType     *DataSourceType        `json:"data_source_type,omitempty"`
	DataSourceConfig   map[string]interface{} `json:"data_source_config,omitempty"`
	AnalysisConfig     map[string]interface{} `json:"analysis_config,omitempty"`
	Status             *JobStatus             `json:"status,omitempty"`
}

// ProcessingJob represents a processing job for a data investigation
type ProcessingJob struct {
	ID                   uuid.UUID              `json:"id"`
	InvestigationID      uuid.UUID              `json:"investigation_id"`
	JobType              string                 `json:"job_type"`
	Config               map[string]interface{} `json:"config,omitempty"`
	Status               JobStatus              `json:"status"`
	ProgressPercentage   *float64               `json:"progress_percentage,omitempty"`
	OutputSummary        map[string]interface{} `json:"output_summary,omitempty"`
	OutputArtifactPath   *string                `json:"output_artifact_path,omitempty"`
	ErrorMessage         *string                `json:"error_message,omitempty"`
	CreatedAt            time.Time              `json:"created_at"`
	StartedAt            *time.Time             `json:"started_at,omitempty"`
	CompletedAt          *time.Time             `json:"completed_at,omitempty"`
}

// ProcessingJobCreate represents a request to create a processing job
type ProcessingJobCreate struct {
	InvestigationID uuid.UUID              `json:"investigation_id"`
	JobType         string                 `json:"job_type"`
	Config          map[string]interface{} `json:"config,omitempty"`
}

// ProcessingJobUpdate represents a request to update a processing job
type ProcessingJobUpdate struct {
	Config               map[string]interface{} `json:"config,omitempty"`
	Status               *JobStatus             `json:"status,omitempty"`
	ProgressPercentage   *float64               `json:"progress_percentage,omitempty"`
	OutputSummary        map[string]interface{} `json:"output_summary,omitempty"`
	OutputArtifactPath   *string                `json:"output_artifact_path,omitempty"`
	ErrorMessage         *string                `json:"error_message,omitempty"`
}