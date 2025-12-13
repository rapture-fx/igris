package client

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// MLClient handles machine learning operations
type MLClient struct {
	client *Client
}

// NewMLClient creates a new ML client
func NewMLClient(client *Client) *MLClient {
	return &MLClient{
		client: client,
	}
}

// CreatePipeline creates a new ML pipeline
func (m *MLClient) CreatePipeline(ctx context.Context, pipeline *models.MLPipeline) (*models.MLPipeline, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "create_pipeline", "")
	defer span.End()

	span.SetAttributes(
		attribute.String("ml.pipeline.name", pipeline.Name),
		attribute.String("ml.pipeline.type", string(pipeline.Type)),
		attribute.String("ml.pipeline.framework", string(pipeline.Framework)),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"pipeline_name": pipeline.Name,
		"model_type":    pipeline.Type,
		"framework":     pipeline.Framework,
	}).Info("Creating ML pipeline")

	// Make API request
	resp, err := m.client.Post(ctx, "/ml/pipelines", pipeline)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to create ML pipeline: %w", err)
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

	// Parse pipeline
	pipelineBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal pipeline data: %w", err)
	}

	var result models.MLPipeline
	if err := json.Unmarshal(pipelineBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse pipeline: %w", err)
	}

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"pipeline_id":   result.ID,
		"pipeline_name": result.Name,
	}).Info("ML pipeline created successfully")

	return &result, nil
}

// TrainModel starts training a machine learning model
func (m *MLClient) TrainModel(ctx context.Context, req *models.TrainingRequest) (*models.TrainingJob, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "train_model", "")
	defer span.End()

	span.SetAttributes(
		attribute.String("ml.dataset_id", req.DatasetID),
		attribute.String("ml.target_column", req.TargetColumn),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"pipeline_id":     req.PipelineID,
		"dataset_id":      req.DatasetID,
		"target_column":   req.TargetColumn,
		"experiment_name": req.ExperimentName,
	}).Info("Starting model training")

	// Make API request
	resp, err := m.client.Post(ctx, "/ml/train", req)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to start training: %w", err)
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

	// Parse training job
	jobBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job data: %w", err)
	}

	var trainingJob models.TrainingJob
	if err := json.Unmarshal(jobBytes, &trainingJob); err != nil {
		return nil, fmt.Errorf("failed to parse training job: %w", err)
	}

	// Record metrics
	m.client.metrics.RecordJob("ml_training", string(trainingJob.Status), 0)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":      trainingJob.JobID,
		"pipeline_id": trainingJob.PipelineID,
		"status":      trainingJob.Status,
	}).Info("Model training started")

	return &trainingJob, nil
}

// GetTrainingJob retrieves the status of a training job
func (m *MLClient) GetTrainingJob(ctx context.Context, jobID string) (*models.TrainingJob, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "get_training_job", "")
	defer span.End()

	span.SetAttributes(attribute.String("ml.job_id", jobID))

	// Make API request
	path := fmt.Sprintf("/ml/training-jobs/%s", jobID)
	resp, err := m.client.Get(ctx, path)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get training job: %w", err)
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

	// Parse training job
	jobBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job data: %w", err)
	}

	var trainingJob models.TrainingJob
	if err := json.Unmarshal(jobBytes, &trainingJob); err != nil {
		return nil, fmt.Errorf("failed to parse training job: %w", err)
	}

	// Record job progress
	m.client.tracer.RecordJobProgress(span, trainingJob.Progress, string(trainingJob.Status))

	m.client.logger.WithContext(ctx).WithJob(trainingJob.JobID, "ml_training", string(trainingJob.Status)).WithFields(map[string]interface{}{
		"progress": trainingJob.Progress,
		"stage":    trainingJob.Stage,
	}).Debug("Retrieved training job status")

	return &trainingJob, nil
}

// WaitForTraining waits for a training job to complete
func (m *MLClient) WaitForTraining(ctx context.Context, jobID string, pollInterval time.Duration) (*models.TrainingJob, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "wait_for_training", "")
	defer span.End()

	span.SetAttributes(
		attribute.String("ml.job_id", jobID),
		attribute.String("ml.poll_interval", pollInterval.String()),
	)

	if pollInterval == 0 {
		pollInterval = 5 * time.Second
	}

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":        jobID,
		"poll_interval": pollInterval,
	}).Info("Waiting for training job completion")

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
			job, err := m.GetTrainingJob(ctx, jobID)
			if err != nil {
				return nil, err
			}

			// Update progress in span
			m.client.tracer.RecordJobProgress(span, job.Progress, string(job.Status))

			// Check if job is completed
			if job.Status.IsCompleted() {
				if job.Status == models.JobStatusCompleted {
					m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
						"job_id": jobID,
						"status": job.Status,
					}).Info("Training job completed successfully")
				} else {
					m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
						"job_id":       jobID,
						"status":       job.Status,
						"error_message": job.ErrorMessage,
					}).Error("Training job failed")
				}
				return job, nil
			}

			// Log progress
			m.client.logger.LogJobProgress(ctx, jobID, "ml_training", string(job.Status), job.Progress)
		}
	}
}

// RunInference runs inference on a trained model
func (m *MLClient) RunInference(ctx context.Context, req *models.InferenceRequest) (*models.InferenceResult, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "run_inference", req.ModelID)
	defer span.End()

	span.SetAttributes(
		attribute.String("ml.model_id", req.ModelID),
		attribute.Bool("ml.explain_prediction", req.ExplainPrediction),
		attribute.Bool("ml.include_metadata", req.IncludeMetadata),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"model_id":           req.ModelID,
		"explain_prediction": req.ExplainPrediction,
		"batch_size":         len(req.BatchFeatures),
	}).Info("Running model inference")

	// Make API request
	resp, err := m.client.Post(ctx, "/ml/inference", req)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to run inference: %w", err)
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

	// Parse inference result
	resultBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	var result models.InferenceResult
	if err := json.Unmarshal(resultBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse inference result: %w", err)
	}

	// Record metrics
	m.client.metrics.RecordJob("ml_inference", "completed", time.Duration(result.ProcessingTime)*time.Millisecond)

	span.SetAttributes(
		attribute.Float64("ml.processing_time_ms", result.ProcessingTime),
		attribute.String("ml.request_id", result.RequestID),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"model_id":        result.ModelID,
		"processing_time": result.ProcessingTime,
		"request_id":      result.RequestID,
	}).Debug("Inference completed")

	return &result, nil
}

// RunBatchInference runs batch inference on a dataset
func (m *MLClient) RunBatchInference(ctx context.Context, req *models.BatchInferenceRequest) (*models.BatchInferenceResult, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "run_batch_inference", req.ModelID)
	defer span.End()

	span.SetAttributes(
		attribute.String("ml.model_id", req.ModelID),
		attribute.String("ml.dataset_id", req.DatasetID),
		attribute.String("ml.output_format", string(req.OutputFormat)),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"model_id":             req.ModelID,
		"dataset_id":           req.DatasetID,
		"output_format":        req.OutputFormat,
		"include_probabilities": req.IncludeProbabilities,
	}).Info("Starting batch inference")

	// Make API request
	resp, err := m.client.Post(ctx, "/ml/batch-inference", req)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to start batch inference: %w", err)
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

	// Parse batch inference result
	resultBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	var result models.BatchInferenceResult
	if err := json.Unmarshal(resultBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse batch inference result: %w", err)
	}

	// Record metrics
	m.client.metrics.RecordJob("ml_batch_inference", string(result.Status), 0)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":         result.JobID,
		"model_id":       result.ModelID,
		"total_records":  result.TotalRecords,
		"status":         result.Status,
	}).Info("Batch inference started")

	return &result, nil
}

// GetModel retrieves a trained model
func (m *MLClient) GetModel(ctx context.Context, modelID string) (*models.Model, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "get_model", modelID)
	defer span.End()

	span.SetAttributes(attribute.String("ml.model_id", modelID))

	// Make API request
	path := fmt.Sprintf("/ml/models/%s", modelID)
	resp, err := m.client.Get(ctx, path)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get model: %w", err)
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

	// Parse model
	modelBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model data: %w", err)
	}

	var model models.Model
	if err := json.Unmarshal(modelBytes, &model); err != nil {
		return nil, fmt.Errorf("failed to parse model: %w", err)
	}

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"model_id":   model.ID,
		"model_name": model.Name,
		"status":     model.Status,
		"type":       model.Type,
		"framework":  model.Framework,
	}).Debug("Retrieved model")

	return &model, nil
}

// ListModels lists available models
func (m *MLClient) ListModels(ctx context.Context, opts *models.ListOptions) (*models.PaginatedResponse, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "list_models", "")
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
	path := "/ml/models"
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
	resp, err := m.client.Get(ctx, path)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list models: %w", err)
	}

	// Parse response
	var result models.PaginatedResponse
	if err := json.Unmarshal(resp.Body, &result); err != nil {
		m.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !result.Success {
		err := fmt.Errorf("API error: %s", result.Error)
		m.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	span.SetAttributes(
		attribute.Int("models.total", result.Pagination.Total),
		attribute.Int("models.page", result.Pagination.Page),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"total_models": result.Pagination.Total,
		"page":         result.Pagination.Page,
		"per_page":     result.Pagination.PerPage,
	}).Debug("Listed models")

	return &result, nil
}

// DeployModel deploys a model for inference
func (m *MLClient) DeployModel(ctx context.Context, modelID string, deployment *models.ModelDeployment) (*models.ModelDeployment, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "deploy_model", modelID)
	defer span.End()

	span.SetAttributes(
		attribute.String("ml.model_id", modelID),
		attribute.String("ml.instance_type", deployment.InstanceType),
		attribute.Int("ml.instance_count", deployment.InstanceCount),
	)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"model_id":       modelID,
		"instance_type":  deployment.InstanceType,
		"instance_count": deployment.InstanceCount,
	}).Info("Deploying model")

	// Make API request
	path := fmt.Sprintf("/ml/models/%s/deploy", modelID)
	resp, err := m.client.Post(ctx, path, deployment)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to deploy model: %w", err)
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

	// Parse deployment result
	deploymentBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal deployment data: %w", err)
	}

	var result models.ModelDeployment
	if err := json.Unmarshal(deploymentBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse deployment: %w", err)
	}

	// Record metrics
	m.client.metrics.RecordJob("ml_deployment", result.Status, 0)

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"model_id":       modelID,
		"deployment_id":  result.ID,
		"endpoint_url":   result.EndpointURL,
		"status":         result.Status,
	}).Info("Model deployment initiated")

	return &result, nil
}

// GetModelMetrics retrieves performance metrics for a model
func (m *MLClient) GetModelMetrics(ctx context.Context, modelID string) (*models.InferenceMetrics, error) {
	// Start tracing
	ctx, span := m.client.tracer.StartMLSpan(ctx, "get_model_metrics", modelID)
	defer span.End()

	span.SetAttributes(attribute.String("ml.model_id", modelID))

	// Make API request
	path := fmt.Sprintf("/ml/models/%s/metrics", modelID)
	resp, err := m.client.Get(ctx, path)
	if err != nil {
		m.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get model metrics: %w", err)
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

	var metrics models.InferenceMetrics
	if err := json.Unmarshal(metricsBytes, &metrics); err != nil {
		return nil, fmt.Errorf("failed to parse metrics: %w", err)
	}

	m.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"model_id":            modelID,
		"requests_per_second": metrics.RequestsPerSecond,
		"average_latency":     metrics.AverageLatency,
		"error_rate":          metrics.ErrorRate,
	}).Debug("Retrieved model metrics")

	return &metrics, nil
}