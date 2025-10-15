package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// JobStatus represents the status of a processing job
type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusRunning    JobStatus = "running"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
	JobStatusCancelled  JobStatus = "cancelled"
	JobStatusQueued     JobStatus = "queued"
)

// DataFormat represents supported data formats
type DataFormat string

const (
	DataFormatCSV     DataFormat = "csv"
	DataFormatJSON    DataFormat = "json"
	DataFormatXLSX    DataFormat = "xlsx"
	DataFormatParquet DataFormat = "parquet"
	DataFormatAvro    DataFormat = "avro"
	DataFormatORC     DataFormat = "orc"
)

// ProcessingMode represents data processing modes
type ProcessingMode string

const (
	ProcessingModeBatch     ProcessingMode = "batch"
	ProcessingModeStreaming ProcessingMode = "streaming"
	ProcessingModeRealTime  ProcessingMode = "real_time"
)

// QualityLevel represents data quality levels
type QualityLevel string

const (
	QualityLevelExcellent QualityLevel = "excellent" // 90-100%
	QualityLevelGood      QualityLevel = "good"      // 75-89%
	QualityLevelFair      QualityLevel = "fair"      // 60-74%
	QualityLevelPoor      QualityLevel = "poor"      // Below 60%
)

// APIResponse represents a standard API response
type APIResponse struct {
	Success   bool                   `json:"success"`
	Data      interface{}            `json:"data,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Message   string                 `json:"message,omitempty"`
	Code      string                 `json:"code,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	RequestID string                 `json:"request_id,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// PaginationInfo represents pagination information
type PaginationInfo struct {
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

// PaginatedResponse represents a paginated API response
type PaginatedResponse struct {
	APIResponse
	Pagination PaginationInfo `json:"pagination"`
	Items      interface{}    `json:"items"`
}

// FileUpload represents a file upload
type FileUpload struct {
	ID          string            `json:"id"`
	Filename    string            `json:"filename"`
	ContentType string            `json:"content_type"`
	Size        int64             `json:"size"`
	Path        string            `json:"path"`
	URL         string            `json:"url"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	UploadedAt  time.Time         `json:"uploaded_at"`
}

// Job represents a processing job
type Job struct {
	ID              string                 `json:"id"`
	Type            string                 `json:"type"`
	Status          JobStatus              `json:"status"`
	Progress        float64                `json:"progress"`         // 0-100
	InputFiles      []FileUpload           `json:"input_files"`
	OutputFiles     []FileUpload           `json:"output_files"`
	Configuration   map[string]interface{} `json:"configuration"`
	Results         map[string]interface{} `json:"results,omitempty"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
	ErrorDetails    map[string]interface{} `json:"error_details,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	StartedAt       *time.Time             `json:"started_at,omitempty"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	EstimatedTime   *int                   `json:"estimated_time_seconds,omitempty"`
	ProcessingTime  *float64               `json:"processing_time_seconds,omitempty"`
	ResourceUsage   *ResourceUsage         `json:"resource_usage,omitempty"`
	UserID          string                 `json:"user_id"`
	Tags            []string               `json:"tags,omitempty"`
}

// ResourceUsage represents resource usage information
type ResourceUsage struct {
	CPUUsage    float64 `json:"cpu_usage"`     // CPU usage percentage
	MemoryUsage int64   `json:"memory_usage"`  // Memory usage in bytes
	DiskUsage   int64   `json:"disk_usage"`    // Disk usage in bytes
	NetworkIn   int64   `json:"network_in"`    // Network bytes received
	NetworkOut  int64   `json:"network_out"`   // Network bytes sent
}

// HealthStatus represents the health status of a service
type HealthStatus struct {
	Status      string                 `json:"status"` // "healthy", "degraded", "unhealthy"
	Timestamp   time.Time              `json:"timestamp"`
	Version     string                 `json:"version,omitempty"`
	Environment string                 `json:"environment,omitempty"`
	Uptime      int64                  `json:"uptime_seconds,omitempty"`
	Checks      map[string]HealthCheck `json:"checks,omitempty"`
}

// HealthCheck represents an individual health check
type HealthCheck struct {
	Status      string                 `json:"status"`
	Description string                 `json:"description,omitempty"`
	Error       string                 `json:"error,omitempty"`
	Duration    time.Duration          `json:"duration_ms,omitempty"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// Metrics represents system metrics
type Metrics struct {
	Timestamp time.Time              `json:"timestamp"`
	System    SystemMetrics          `json:"system"`
	API       APIMetrics             `json:"api"`
	Jobs      JobMetrics             `json:"jobs"`
	Custom    map[string]interface{} `json:"custom,omitempty"`
}

// SystemMetrics represents system-level metrics
type SystemMetrics struct {
	CPUUsage         float64 `json:"cpu_usage_percent"`
	MemoryUsage      float64 `json:"memory_usage_percent"`
	MemoryAvailable  int64   `json:"memory_available_bytes"`
	DiskUsage        float64 `json:"disk_usage_percent"`
	DiskAvailable    int64   `json:"disk_available_bytes"`
	NetworkBytesIn   int64   `json:"network_bytes_in"`
	NetworkBytesOut  int64   `json:"network_bytes_out"`
	OpenConnections  int     `json:"open_connections"`
	ActiveGoroutines int     `json:"active_goroutines,omitempty"`
}

// APIMetrics represents API-level metrics
type APIMetrics struct {
	RequestsPerSecond   float64            `json:"requests_per_second"`
	AverageResponseTime time.Duration      `json:"average_response_time_ms"`
	ErrorRate           float64            `json:"error_rate_percent"`
	StatusCodes         map[string]int     `json:"status_codes"`
	Endpoints           map[string]int     `json:"endpoints"`
	RateLimitHits       int                `json:"rate_limit_hits"`
	CircuitBreakerState string             `json:"circuit_breaker_state,omitempty"`
}

// JobMetrics represents job processing metrics
type JobMetrics struct {
	ActiveJobs     int                    `json:"active_jobs"`
	QueuedJobs     int                    `json:"queued_jobs"`
	CompletedJobs  int                    `json:"completed_jobs"`
	FailedJobs     int                    `json:"failed_jobs"`
	JobsPerHour    float64                `json:"jobs_per_hour"`
	AverageJobTime time.Duration          `json:"average_job_time_seconds"`
	JobTypes       map[string]int         `json:"job_types"`
	ResourceUsage  AggregateResourceUsage `json:"resource_usage"`
}

// AggregateResourceUsage represents aggregated resource usage
type AggregateResourceUsage struct {
	TotalCPUTime     float64 `json:"total_cpu_time_seconds"`
	PeakMemoryUsage  int64   `json:"peak_memory_usage_bytes"`
	TotalDiskUsage   int64   `json:"total_disk_usage_bytes"`
	TotalNetworkIn   int64   `json:"total_network_in_bytes"`
	TotalNetworkOut  int64   `json:"total_network_out_bytes"`
}

// Error represents an API error
type Error struct {
	Code       string                 `json:"code"`
	Message    string                 `json:"message"`
	Type       string                 `json:"type,omitempty"`
	Details    map[string]interface{} `json:"details,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
	RequestID  string                 `json:"request_id,omitempty"`
	Path       string                 `json:"path,omitempty"`
	StatusCode int                    `json:"status_code,omitempty"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
	Value   string `json:"value,omitempty"`
}

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type      string                 `json:"type"`
	Channel   string                 `json:"channel,omitempty"`
	Data      interface{}            `json:"data,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	ID        string                 `json:"id,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// EventType represents different types of events
type EventType string

const (
	EventTypeJobCreated    EventType = "job.created"
	EventTypeJobStarted    EventType = "job.started"
	EventTypeJobProgress   EventType = "job.progress"
	EventTypeJobCompleted  EventType = "job.completed"
	EventTypeJobFailed     EventType = "job.failed"
	EventTypeJobCancelled  EventType = "job.cancelled"
	EventTypeSystemHealth  EventType = "system.health"
	EventTypeSystemMetrics EventType = "system.metrics"
	EventTypeUserActivity  EventType = "user.activity"
)

// Event represents a system event
type Event struct {
	ID        string                 `json:"id"`
	Type      EventType              `json:"type"`
	Source    string                 `json:"source"`
	Data      interface{}            `json:"data"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	UserID    string                 `json:"user_id,omitempty"`
	JobID     string                 `json:"job_id,omitempty"`
}

// ListOptions represents options for listing resources
type ListOptions struct {
	Page      int               `json:"page,omitempty"`
	PerPage   int               `json:"per_page,omitempty"`
	SortBy    string            `json:"sort_by,omitempty"`
	SortOrder string            `json:"sort_order,omitempty"` // "asc" or "desc"
	Filters   map[string]string `json:"filters,omitempty"`
	Search    string            `json:"search,omitempty"`
}

// ToQuery converts ListOptions to URL query parameters
func (o *ListOptions) ToQuery() map[string]string {
	params := make(map[string]string)
	
	if o.Page > 0 {
		params["page"] = string(rune(o.Page))
	}
	if o.PerPage > 0 {
		params["per_page"] = string(rune(o.PerPage))
	}
	if o.SortBy != "" {
		params["sort_by"] = o.SortBy
	}
	if o.SortOrder != "" {
		params["sort_order"] = o.SortOrder
	}
	if o.Search != "" {
		params["search"] = o.Search
	}
	
	// Add filters
	for key, value := range o.Filters {
		params["filter_"+key] = value
	}
	
	return params
}

// UnmarshalJobStatus unmarshals JobStatus from JSON
func (s *JobStatus) UnmarshalJSON(data []byte) error {
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return err
	}
	*s = JobStatus(str)
	return nil
}

// IsValid checks if the JobStatus is valid
func (s JobStatus) IsValid() bool {
	switch s {
	case JobStatusPending, JobStatusRunning, JobStatusCompleted, JobStatusFailed, JobStatusCancelled, JobStatusQueued:
		return true
	default:
		return false
	}
}

// IsCompleted checks if the job is in a completed state (success or failure)
func (s JobStatus) IsCompleted() bool {
	return s == JobStatusCompleted || s == JobStatusFailed || s == JobStatusCancelled
}

// IsActive checks if the job is actively processing
func (s JobStatus) IsActive() bool {
	return s == JobStatusRunning || s == JobStatusQueued
}