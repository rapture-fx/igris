package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// DataClient handles data processing operations
type DataClient struct {
	client *Client
}

// NewDataClient creates a new data processing client
func NewDataClient(client *Client) *DataClient {
	return &DataClient{
		client: client,
	}
}

// ProcessFile processes a single file
func (d *DataClient) ProcessFile(ctx context.Context, req *models.ProcessFileRequest) (*models.DataProcessingResult, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartDataProcessingSpan(ctx, "process_file", 0)
	defer span.End()

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename":      req.Filename,
		"data_format":   req.DataFormat,
		"output_format": req.OutputFormat,
		"async":         req.Async,
	}).Info("Starting file processing")

	// Validate request
	if req.FilePath == "" && req.FileURL == "" && len(req.FileContent) == 0 {
		err := fmt.Errorf("file path, URL, or content must be provided")
		d.client.tracer.RecordError(span, err, "Invalid request")
		return nil, err
	}

	// Make API request
	resp, err := d.client.Post(ctx, "/data/process-file", req)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to process file: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse data processing result
	resultBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	var result models.DataProcessingResult
	if err := json.Unmarshal(resultBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse processing result: %w", err)
	}

	// Record tracing data
	d.client.tracer.RecordDataProcessingResult(span, result.InputRecords, result.OutputRecords, result.ProcessingTimeSeconds)

	// Record metrics
	d.client.metrics.RecordJob("data_processing", string(result.Status), 0)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":         result.JobID,
		"input_records":  result.InputRecords,
		"output_records": result.OutputRecords,
		"status":         result.Status,
	}).Info("File processing completed")

	return &result, nil
}

// ProcessBatch processes multiple files in batch
func (d *DataClient) ProcessBatch(ctx context.Context, req *models.ProcessBatchRequest) (*models.BatchProcessingResult, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartDataProcessingSpan(ctx, "process_batch", len(req.Files))
	defer span.End()

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_count":          len(req.Files),
		"parallel_jobs":       req.ParallelJobs,
		"stop_on_first_error": req.StopOnFirstError,
	}).Info("Starting batch processing")

	// Make API request
	resp, err := d.client.Post(ctx, "/data/process-batch", req)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to process batch: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse batch processing result
	resultBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	var result models.BatchProcessingResult
	if err := json.Unmarshal(resultBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse batch result: %w", err)
	}

	// Record tracing data
	span.SetAttributes(
		attribute.Int("batch.total_files", result.TotalFiles),
		attribute.Int("batch.processed_files", result.ProcessedFiles),
		attribute.Int("batch.successful_files", result.SuccessfulFiles),
		attribute.Int("batch.failed_files", result.FailedFiles),
		attribute.Float64("batch.success_rate", result.SuccessRate()),
	)

	// Record metrics
	d.client.metrics.RecordJob("batch_processing", string(result.Status), 0)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"batch_id":         result.BatchID,
		"total_files":      result.TotalFiles,
		"successful_files": result.SuccessfulFiles,
		"failed_files":     result.FailedFiles,
		"success_rate":     result.SuccessRate(),
	}).Info("Batch processing completed")

	return &result, nil
}

// GetJobStatus retrieves the status of a processing job
func (d *DataClient) GetJobStatus(ctx context.Context, jobID string) (*models.Job, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "get_job_status")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", jobID))

	// Make API request
	path := fmt.Sprintf("/data/jobs/%s", jobID)
	resp, err := d.client.Get(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get job status: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse job
	jobBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job data: %w", err)
	}

	var job models.Job
	if err := json.Unmarshal(jobBytes, &job); err != nil {
		return nil, fmt.Errorf("failed to parse job: %w", err)
	}

	// Record job progress
	d.client.tracer.RecordJobProgress(span, job.Progress, string(job.Status))

	d.client.logger.WithContext(ctx).WithJob(job.ID, job.Type, string(job.Status)).WithFields(map[string]interface{}{
		"progress": job.Progress,
	}).Debug("Retrieved job status")

	return &job, nil
}

// ListJobs lists processing jobs with optional filters
func (d *DataClient) ListJobs(ctx context.Context, opts *models.ListOptions) (*models.PaginatedResponse, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "list_jobs")
	defer span.End()

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		if opts.Page > 0 {
			params["page"] = strconv.Itoa(opts.Page)
		}
		if opts.PerPage > 0 {
			params["per_page"] = strconv.Itoa(opts.PerPage)
		}
		if opts.SortBy != "" {
			params["sort_by"] = opts.SortBy
		}
		if opts.SortOrder != "" {
			params["sort_order"] = opts.SortOrder
		}
		if opts.Search != "" {
			params["search"] = opts.Search
		}
		// Add filters
		for key, value := range opts.Filters {
			params["filter_"+key] = value
		}
	}

	// Build path with query parameters
	path := "/data/jobs"
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
	resp, err := d.client.Get(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}

	// Parse response
	var result models.PaginatedResponse
	if err := json.Unmarshal(resp.Body, &result); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !result.Success {
		err := fmt.Errorf("API error: %s", result.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	span.SetAttributes(
		attribute.Int("jobs.total", result.Pagination.Total),
		attribute.Int("jobs.page", result.Pagination.Page),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"total_jobs": result.Pagination.Total,
		"page":       result.Pagination.Page,
		"per_page":   result.Pagination.PerPage,
	}).Debug("Listed jobs")

	return &result, nil
}

// CancelJob cancels a running job
func (d *DataClient) CancelJob(ctx context.Context, jobID string) error {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "cancel_job")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", jobID))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id": jobID,
	}).Info("Cancelling job")

	// Make API request
	path := fmt.Sprintf("/data/jobs/%s/cancel", jobID)
	resp, err := d.client.Post(ctx, path, nil)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to cancel job: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id": jobID,
	}).Info("Job cancelled successfully")

	return nil
}

// GetJobLogs retrieves logs for a specific job
func (d *DataClient) GetJobLogs(ctx context.Context, jobID string, lines int) ([]string, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "get_job_logs")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", jobID),
		attribute.Int("logs.lines", lines),
	)

	// Build path
	path := fmt.Sprintf("/data/jobs/%s/logs", jobID)
	if lines > 0 {
		path += fmt.Sprintf("?lines=%d", lines)
	}

	// Make API request
	resp, err := d.client.Get(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get job logs: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
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

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":    jobID,
		"log_lines": len(logs),
	}).Debug("Retrieved job logs")

	return logs, nil
}

// CreatePipeline creates a new data processing pipeline
func (d *DataClient) CreatePipeline(ctx context.Context, pipeline *models.DataPipeline) (*models.DataPipeline, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "create_pipeline")
	defer span.End()

	span.SetAttributes(
		attribute.String("pipeline.name", pipeline.Name),
		attribute.Int("pipeline.transformations", len(pipeline.Transformations)),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"pipeline_name":    pipeline.Name,
		"transformations":  len(pipeline.Transformations),
		"is_active":        pipeline.IsActive,
	}).Info("Creating data pipeline")

	// Make API request
	resp, err := d.client.Post(ctx, "/data/pipelines", pipeline)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to create pipeline: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse created pipeline
	pipelineBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal pipeline data: %w", err)
	}

	var result models.DataPipeline
	if err := json.Unmarshal(pipelineBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse pipeline: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"pipeline_id":   result.ID,
		"pipeline_name": result.Name,
	}).Info("Data pipeline created successfully")

	return &result, nil
}

// UploadFile uploads a file for processing
func (d *DataClient) UploadFile(ctx context.Context, file io.Reader, filename string, additionalFields map[string]string) (*models.FileUpload, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "upload_file")
	defer span.End()

	span.SetAttributes(attribute.String("file.name", filename))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename": filename,
	}).Info("Uploading file")

	// Upload file
	resp, err := d.client.httpClient.UploadFile(ctx, "/data/upload", file, filename, additionalFields)
	if err != nil {
		d.client.tracer.RecordError(span, err, "File upload failed")
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse file upload result
	uploadBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal upload data: %w", err)
	}

	var upload models.FileUpload
	if err := json.Unmarshal(uploadBytes, &upload); err != nil {
		return nil, fmt.Errorf("failed to parse upload result: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_id":   upload.ID,
		"filename":  upload.Filename,
		"file_size": upload.Size,
	}).Info("File uploaded successfully")

	return &upload, nil
}

// CreateDataInvestigation creates a new data investigation
func (d *DataClient) CreateDataInvestigation(ctx context.Context, req *models.DataInvestigationCreate) (*models.DataInvestigation, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "create_data_investigation")
	defer span.End()

	span.SetAttributes(
		attribute.String("investigation.name", req.Name),
		attribute.String("workspace.id", req.WorkspaceID.String()),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"name":         req.Name,
		"workspace_id": req.WorkspaceID,
		"description":  req.Description,
	}).Info("Creating data investigation")

	// Make API request
	resp, err := d.client.Post(ctx, "/data/investigations/", req)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to create data investigation: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse investigation result
	investigationBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal investigation data: %w", err)
	}

	var investigation models.DataInvestigation
	if err := json.Unmarshal(investigationBytes, &investigation); err != nil {
		return nil, fmt.Errorf("failed to parse investigation: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"investigation_id": investigation.ID,
		"name":            investigation.Name,
		"status":          investigation.Status,
	}).Info("Data investigation created successfully")

	return &investigation, nil
}

// GetDataInvestigation retrieves a specific data investigation by ID
func (d *DataClient) GetDataInvestigation(ctx context.Context, investigationID string) (*models.DataInvestigation, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "get_data_investigation")
	defer span.End()

	span.SetAttributes(attribute.String("investigation.id", investigationID))

	// Make API request
	path := fmt.Sprintf("/data/investigations/%s", investigationID)
	resp, err := d.client.Get(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get data investigation: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse investigation
	investigationBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal investigation data: %w", err)
	}

	var investigation models.DataInvestigation
	if err := json.Unmarshal(investigationBytes, &investigation); err != nil {
		return nil, fmt.Errorf("failed to parse investigation: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"investigation_id": investigation.ID,
		"status":          investigation.Status,
		"progress":        investigation.ProgressPercentage,
	}).Debug("Retrieved data investigation")

	return &investigation, nil
}

// ListDataInvestigations lists data investigations with optional filters
func (d *DataClient) ListDataInvestigations(ctx context.Context, workspaceID *string, opts *models.ListOptions) ([]*models.DataInvestigation, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "list_data_investigations")
	defer span.End()

	// Build query parameters
	params := make(map[string]string)
	if workspaceID != nil {
		params["workspace_id"] = *workspaceID
	}
	if opts != nil {
		if opts.Page > 0 {
			params["skip"] = strconv.Itoa((opts.Page - 1) * opts.PerPage)
		}
		if opts.PerPage > 0 {
			params["limit"] = strconv.Itoa(opts.PerPage)
		}
	}

	// Build path with query parameters
	path := "/data/investigations/"
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
	resp, err := d.client.Get(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list data investigations: %w", err)
	}

	// Parse response as array
	var investigations []*models.DataInvestigation
	if err := json.Unmarshal(resp.Body, &investigations); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	span.SetAttributes(attribute.Int("investigations.count", len(investigations)))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"investigation_count": len(investigations),
		"workspace_id":       workspaceID,
	}).Debug("Listed data investigations")

	return investigations, nil
}

// UpdateDataInvestigation updates a data investigation
func (d *DataClient) UpdateDataInvestigation(ctx context.Context, investigationID string, req *models.DataInvestigationUpdate) (*models.DataInvestigation, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "update_data_investigation")
	defer span.End()

	span.SetAttributes(attribute.String("investigation.id", investigationID))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"investigation_id": investigationID,
		"update_fields":   len(getUpdateFields(req)),
	}).Info("Updating data investigation")

	// Make API request
	path := fmt.Sprintf("/data/investigations/%s", investigationID)
	resp, err := d.client.Put(ctx, path, req)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to update data investigation: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse updated investigation
	investigationBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal investigation data: %w", err)
	}

	var investigation models.DataInvestigation
	if err := json.Unmarshal(investigationBytes, &investigation); err != nil {
		return nil, fmt.Errorf("failed to parse investigation: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"investigation_id": investigation.ID,
		"status":          investigation.Status,
	}).Info("Data investigation updated successfully")

	return &investigation, nil
}

// DeleteDataInvestigation deletes a data investigation
func (d *DataClient) DeleteDataInvestigation(ctx context.Context, investigationID string) error {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "delete_data_investigation")
	defer span.End()

	span.SetAttributes(attribute.String("investigation.id", investigationID))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"investigation_id": investigationID,
	}).Info("Deleting data investigation")

	// Make API request
	path := fmt.Sprintf("/data/investigations/%s", investigationID)
	resp, err := d.client.Delete(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to delete data investigation: %w", err)
	}

	// Check status code
	if resp.StatusCode != 204 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"investigation_id": investigationID,
	}).Info("Data investigation deleted successfully")

	return nil
}

// CreateProcessingJob creates a new processing job
func (d *DataClient) CreateProcessingJob(ctx context.Context, req *models.ProcessingJobCreate) (*models.ProcessingJob, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "create_processing_job")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.type", req.JobType),
		attribute.String("investigation.id", req.InvestigationID.String()),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_type":         req.JobType,
		"investigation_id": req.InvestigationID,
	}).Info("Creating processing job")

	// Make API request
	resp, err := d.client.Post(ctx, "/data/jobs/", req)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to create processing job: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse job result
	jobBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job data: %w", err)
	}

	var job models.ProcessingJob
	if err := json.Unmarshal(jobBytes, &job); err != nil {
		return nil, fmt.Errorf("failed to parse job: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":   job.ID,
		"job_type": job.JobType,
		"status":   job.Status,
	}).Info("Processing job created successfully")

	return &job, nil
}

// GetProcessingJob retrieves a specific processing job by ID
func (d *DataClient) GetProcessingJob(ctx context.Context, jobID string) (*models.ProcessingJob, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "get_processing_job")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", jobID))

	// Make API request
	path := fmt.Sprintf("/data/jobs/%s", jobID)
	resp, err := d.client.Get(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get processing job: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse job
	jobBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job data: %w", err)
	}

	var job models.ProcessingJob
	if err := json.Unmarshal(jobBytes, &job); err != nil {
		return nil, fmt.Errorf("failed to parse job: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":   job.ID,
		"status":   job.Status,
		"progress": job.ProgressPercentage,
	}).Debug("Retrieved processing job")

	return &job, nil
}

// ListProcessingJobsForInvestigation lists processing jobs for a specific data investigation
func (d *DataClient) ListProcessingJobsForInvestigation(ctx context.Context, investigationID string, opts *models.ListOptions) ([]*models.ProcessingJob, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "list_processing_jobs_for_investigation")
	defer span.End()

	span.SetAttributes(attribute.String("investigation.id", investigationID))

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		if opts.Page > 0 {
			params["skip"] = strconv.Itoa((opts.Page - 1) * opts.PerPage)
		}
		if opts.PerPage > 0 {
			params["limit"] = strconv.Itoa(opts.PerPage)
		}
	}

	// Build path with query parameters
	path := fmt.Sprintf("/data/investigations/%s/jobs/", investigationID)
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
	resp, err := d.client.Get(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list processing jobs: %w", err)
	}

	// Parse response as array
	var jobs []*models.ProcessingJob
	if err := json.Unmarshal(resp.Body, &jobs); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	span.SetAttributes(attribute.Int("jobs.count", len(jobs)))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_count":        len(jobs),
		"investigation_id": investigationID,
	}).Debug("Listed processing jobs for investigation")

	return jobs, nil
}

// UpdateProcessingJob updates a processing job
func (d *DataClient) UpdateProcessingJob(ctx context.Context, jobID string, req *models.ProcessingJobUpdate) (*models.ProcessingJob, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "update_processing_job")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", jobID))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":        jobID,
		"update_fields": len(getProcessingJobUpdateFields(req)),
	}).Info("Updating processing job")

	// Make API request
	path := fmt.Sprintf("/data/jobs/%s", jobID)
	resp, err := d.client.Put(ctx, path, req)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to update processing job: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse updated job
	jobBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job data: %w", err)
	}

	var job models.ProcessingJob
	if err := json.Unmarshal(jobBytes, &job); err != nil {
		return nil, fmt.Errorf("failed to parse job: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id": job.ID,
		"status": job.Status,
	}).Info("Processing job updated successfully")

	return &job, nil
}

// DeleteProcessingJob deletes a processing job
func (d *DataClient) DeleteProcessingJob(ctx context.Context, jobID string) error {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "delete_processing_job")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", jobID))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id": jobID,
	}).Info("Deleting processing job")

	// Make API request
	path := fmt.Sprintf("/data/jobs/%s", jobID)
	resp, err := d.client.Delete(ctx, path)
	if err != nil {
		d.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to delete processing job: %w", err)
	}

	// Check status code
	if resp.StatusCode != 204 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id": jobID,
	}).Info("Processing job deleted successfully")

	return nil
}

// Helper functions to count update fields (for logging purposes)
func getUpdateFields(req *models.DataInvestigationUpdate) []string {
	var fields []string
	if req.Name != nil {
		fields = append(fields, "name")
	}
	if req.Description != nil {
		fields = append(fields, "description")
	}
	if req.DataSourceType != nil {
		fields = append(fields, "data_source_type")
	}
	if req.DataSourceConfig != nil {
		fields = append(fields, "data_source_config")
	}
	if req.AnalysisConfig != nil {
		fields = append(fields, "analysis_config")
	}
	if req.Status != nil {
		fields = append(fields, "status")
	}
	return fields
}

func getProcessingJobUpdateFields(req *models.ProcessingJobUpdate) []string {
	var fields []string
	if req.Config != nil {
		fields = append(fields, "config")
	}
	if req.Status != nil {
		fields = append(fields, "status")
	}
	if req.ProgressPercentage != nil {
		fields = append(fields, "progress_percentage")
	}
	if req.OutputSummary != nil {
		fields = append(fields, "output_summary")
	}
	if req.OutputArtifactPath != nil {
		fields = append(fields, "output_artifact_path")
	}
	if req.ErrorMessage != nil {
		fields = append(fields, "error_message")
	}
	return fields
}