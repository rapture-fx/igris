/**
 * ML Pipeline API for Schlep-engine JavaScript SDK
 */

import { BaseAPI } from './base';
import {
  MLPipelineConfig,
  TrainingJob,
  MLPipelineResult,
  PredictionRequest,
  PredictionResult,
  ModelInfo,
  ModelMetrics,
  MLTaskType,
  ModelType,
  TrainingStatus,
  HyperparameterConfig,
  FeatureEngineering,
  CrossValidationConfig,
  DeploymentConfig,
  BatchPredictionJob,
  ModelMonitoring,
  AutoMLConfig,
  ModelRegistryEntry,
  ExplainabilityRequest,
  ExplainabilityResult
} from '../types/ml';
import { APIResponse } from '../types/common';
import { ProgressCallback } from '../types/common';

/**
 * ML Pipeline API client
 * Provides methods for machine learning model training, deployment, and prediction
 */
export class MLPipelineAPI extends BaseAPI {
  constructor(client: any) {
    super(client);
    this.basePath = '/ml';
  }

  /**
   * Create ML pipeline
   */
  async createPipeline(config: MLPipelineConfig): Promise<APIResponse<{ pipeline_id: string }>> {
    this.validateRequired(config, ['name', 'task_type', 'model_type', 'target_column']);
    
    return this.post<{ pipeline_id: string }>('/pipelines', {
      params: config
    });
  }

  /**
   * Get ML pipeline configuration
   */
  async getPipeline(pipelineId: string): Promise<APIResponse<MLPipelineConfig & { pipeline_id: string }>> {
    this.validateRequired({ pipelineId }, ['pipelineId']);
    return this.get<MLPipelineConfig & { pipeline_id: string }>(`/pipelines/${pipelineId}`);
  }

  /**
   * Update ML pipeline configuration
   */
  async updatePipeline(
    pipelineId: string, 
    updates: Partial<MLPipelineConfig>
  ): Promise<APIResponse<MLPipelineConfig & { pipeline_id: string }>> {
    this.validateRequired({ pipelineId }, ['pipelineId']);
    return this.patch<MLPipelineConfig & { pipeline_id: string }>(`/pipelines/${pipelineId}`, {
      params: updates
    });
  }

  /**
   * Delete ML pipeline
   */
  async deletePipeline(pipelineId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ pipelineId }, ['pipelineId']);
    return this.delete<{ message: string }>(`/pipelines/${pipelineId}`);
  }

  /**
   * List ML pipelines
   */
  async listPipelines(params?: {
    page?: number;
    pageSize?: number;
    taskType?: MLTaskType;
    modelType?: ModelType;
  }): Promise<APIResponse<Array<MLPipelineConfig & { pipeline_id: string }>>> {
    return this.paginatedRequest('/pipelines', params);
  }

  /**
   * Train ML model
   */
  async trainModel(
    pipelineId: string,
    trainingData: File | string,
    options: {
      validationData?: File | string;
      testData?: File | string;
      hyperparameterConfig?: HyperparameterConfig;
      featureEngineering?: FeatureEngineering;
      crossValidation?: CrossValidationConfig;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<TrainingJob>> {
    this.validateRequired({ pipelineId }, ['pipelineId']);

    let params: Record<string, unknown> = {
      pipeline_id: pipelineId,
      hyperparameter_config: options.hyperparameterConfig,
      feature_engineering: options.featureEngineering,
      cross_validation: options.crossValidation
    };

    // Handle training data
    if (typeof trainingData === 'string') {
      params.training_data_url = trainingData;
    } else {
      // Upload training file
      const uploadResponse = await this.uploadFile('/upload', trainingData, {
        data_type: 'training'
      }, options.onProgress);
      
      if (!this.isSuccess(uploadResponse)) {
        throw new Error(`Training data upload failed: ${this.getErrorMessage(uploadResponse)}`);
      }
      
      params.training_data_path = uploadResponse.data.url;
    }

    // Handle validation data if provided
    if (options.validationData) {
      if (typeof options.validationData === 'string') {
        params.validation_data_url = options.validationData;
      } else {
        const validationUpload = await this.uploadFile('/upload', options.validationData, {
          data_type: 'validation'
        });
        if (this.isSuccess(validationUpload)) {
          params.validation_data_path = validationUpload.data.url;
        }
      }
    }

    // Handle test data if provided
    if (options.testData) {
      if (typeof options.testData === 'string') {
        params.test_data_url = options.testData;
      } else {
        const testUpload = await this.uploadFile('/upload', options.testData, {
          data_type: 'test'
        });
        if (this.isSuccess(testUpload)) {
          params.test_data_path = testUpload.data.url;
        }
      }
    }

    return this.post<TrainingJob>('/train', { params });
  }

  /**
   * Get training job status
   */
  async getTrainingStatus(jobId: string): Promise<APIResponse<TrainingJob>> {
    this.validateRequired({ jobId }, ['jobId']);
    return this.get<TrainingJob>(`/train/${jobId}`);
  }

  /**
   * Wait for training completion
   */
  async waitForTraining(
    jobId: string,
    pollInterval = 5000,
    maxWaitTime = 3600000 // 1 hour
  ): Promise<APIResponse<TrainingJob>> {
    return super.waitForJob<TrainingJob>(
      jobId,
      `/ml/train/${jobId}`,
      pollInterval,
      maxWaitTime
    );
  }

  /**
   * Cancel training job
   */
  async cancelTraining(jobId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ jobId }, ['jobId']);
    return this.delete<{ message: string }>(`/train/${jobId}`);
  }

  /**
   * Get training job results
   */
  async getTrainingResults(jobId: string): Promise<APIResponse<MLPipelineResult>> {
    this.validateRequired({ jobId }, ['jobId']);
    return this.get<MLPipelineResult>(`/train/${jobId}/results`);
  }

  /**
   * Make prediction
   */
  async predict(request: PredictionRequest): Promise<APIResponse<PredictionResult>> {
    this.validateRequired(request, ['model_id', 'input_data']);
    return this.post<PredictionResult>('/predict', { params: request });
  }

  /**
   * Make batch predictions
   */
  async batchPredict(
    modelId: string,
    inputData: File | string,
    options: {
      outputPath?: string;
      returnProbabilities?: boolean;
      explainPredictions?: boolean;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<BatchPredictionJob>> {
    this.validateRequired({ modelId }, ['modelId']);

    let params: Record<string, unknown> = {
      model_id: modelId,
      output_path: options.outputPath,
      return_probabilities: options.returnProbabilities,
      explain_predictions: options.explainPredictions
    };

    if (typeof inputData === 'string') {
      params.input_url = inputData;
    } else {
      const uploadResponse = await this.uploadFile('/upload', inputData, {
        data_type: 'prediction_input'
      }, options.onProgress);
      
      if (!this.isSuccess(uploadResponse)) {
        throw new Error(`Input data upload failed: ${this.getErrorMessage(uploadResponse)}`);
      }
      
      params.input_path = uploadResponse.data.url;
    }

    return this.post<BatchPredictionJob>('/batch-predict', { params });
  }

  /**
   * Get batch prediction job status
   */
  async getBatchPredictionStatus(jobId: string): Promise<APIResponse<BatchPredictionJob>> {
    this.validateRequired({ jobId }, ['jobId']);
    return this.get<BatchPredictionJob>(`/batch-predict/${jobId}`);
  }

  /**
   * List models
   */
  async listModels(params?: {
    page?: number;
    pageSize?: number;
    taskType?: MLTaskType;
    modelType?: ModelType;
    status?: string;
  }): Promise<APIResponse<ModelInfo[]>> {
    return this.paginatedRequest('/models', params);
  }

  /**
   * Get model information
   */
  async getModel(modelId: string): Promise<APIResponse<ModelInfo>> {
    this.validateRequired({ modelId }, ['modelId']);
    return this.get<ModelInfo>(`/models/${modelId}`);
  }

  /**
   * Update model metadata
   */
  async updateModel(
    modelId: string,
    updates: {
      name?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<APIResponse<ModelInfo>> {
    this.validateRequired({ modelId }, ['modelId']);
    return this.patch<ModelInfo>(`/models/${modelId}`, { params: updates });
  }

  /**
   * Delete model
   */
  async deleteModel(modelId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ modelId }, ['modelId']);
    return this.delete<{ message: string }>(`/models/${modelId}`);
  }

  /**
   * Deploy model
   */
  async deployModel(config: DeploymentConfig): Promise<APIResponse<{
    deployment_id: string;
    endpoint_url: string;
    status: string;
  }>> {
    this.validateRequired(config, ['deployment_name', 'model_id']);
    return this.post<{
      deployment_id: string;
      endpoint_url: string;
      status: string;
    }>('/deploy', { params: config });
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<APIResponse<{
    deployment_id: string;
    model_id: string;
    status: string;
    endpoint_url: string;
    health_status: string;
    metrics?: ModelMonitoring;
  }>> {
    this.validateRequired({ deploymentId }, ['deploymentId']);
    return this.get(`/deployments/${deploymentId}`);
  }

  /**
   * Update deployment
   */
  async updateDeployment(
    deploymentId: string,
    updates: {
      minInstances?: number;
      maxInstances?: number;
      instanceType?: string;
    }
  ): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ deploymentId }, ['deploymentId']);
    return this.patch<{ message: string }>(`/deployments/${deploymentId}`, { params: updates });
  }

  /**
   * Undeploy model
   */
  async undeployModel(deploymentId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ deploymentId }, ['deploymentId']);
    return this.delete<{ message: string }>(`/deployments/${deploymentId}`);
  }

  /**
   * List deployments
   */
  async listDeployments(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    environment?: string;
  }): Promise<APIResponse<Array<{
    deployment_id: string;
    deployment_name: string;
    model_id: string;
    status: string;
    environment: string;
    created_at: string;
  }>>> {
    return this.paginatedRequest('/deployments', params);
  }

  /**
   * Get model metrics
   */
  async getModelMetrics(modelId: string): Promise<APIResponse<ModelMetrics>> {
    this.validateRequired({ modelId }, ['modelId']);
    return this.get<ModelMetrics>(`/models/${modelId}/metrics`);
  }

  /**
   * Explain model predictions
   */
  async explainPrediction(request: ExplainabilityRequest): Promise<APIResponse<ExplainabilityResult>> {
    this.validateRequired(request, ['model_id', 'input_data', 'method']);
    return this.post<ExplainabilityResult>('/explain', { params: request });
  }

  /**
   * Run AutoML
   */
  async runAutoML(
    config: AutoMLConfig,
    trainingData: File | string,
    options: {
      validationData?: File | string;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<TrainingJob>> {
    this.validateRequired(config, ['task_type', 'target_column']);

    let params: Record<string, unknown> = { ...config };

    // Handle training data
    if (typeof trainingData === 'string') {
      params.training_data_path = trainingData;
    } else {
      const uploadResponse = await this.uploadFile('/upload', trainingData, {
        data_type: 'training'
      }, options.onProgress);
      
      if (!this.isSuccess(uploadResponse)) {
        throw new Error(`Training data upload failed: ${this.getErrorMessage(uploadResponse)}`);
      }
      
      params.training_data_path = uploadResponse.data.url;
    }

    // Handle validation data if provided
    if (options.validationData) {
      if (typeof options.validationData === 'string') {
        params.validation_data_path = options.validationData;
      } else {
        const validationUpload = await this.uploadFile('/upload', options.validationData, {
          data_type: 'validation'
        });
        if (this.isSuccess(validationUpload)) {
          params.validation_data_path = validationUpload.data.url;
        }
      }
    }

    return this.post<TrainingJob>('/automl', { params });
  }

  /**
   * Get feature importance
   */
  async getFeatureImportance(modelId: string): Promise<APIResponse<Record<string, number>>> {
    this.validateRequired({ modelId }, ['modelId']);
    return this.get<Record<string, number>>(`/models/${modelId}/feature-importance`);
  }

  /**
   * Download model artifact
   */
  getModelDownloadUrl(modelId: string, artifactType = 'model'): string {
    this.validateRequired({ modelId }, ['modelId']);
    return this.buildDownloadUrl(`/models/${modelId}/download`, { type: artifactType });
  }

  /**
   * Register model in model registry
   */
  async registerModel(entry: Omit<ModelRegistryEntry, 'created_at' | 'updated_at'>): Promise<APIResponse<ModelRegistryEntry>> {
    this.validateRequired(entry, ['model_id', 'name', 'version']);
    return this.post<ModelRegistryEntry>('/registry/models', { params: entry });
  }

  /**
   * Get registered model
   */
  async getRegisteredModel(modelId: string, version?: string): Promise<APIResponse<ModelRegistryEntry>> {
    this.validateRequired({ modelId }, ['modelId']);
    const path = version ? `/registry/models/${modelId}/versions/${version}` : `/registry/models/${modelId}`;
    return this.get<ModelRegistryEntry>(path);
  }

  /**
   * Update model stage in registry
   */
  async updateModelStage(
    modelId: string,
    version: string,
    stage: 'development' | 'staging' | 'production' | 'archived'
  ): Promise<APIResponse<ModelRegistryEntry>> {
    this.validateRequired({ modelId, version, stage }, ['modelId', 'version', 'stage']);
    return this.patch<ModelRegistryEntry>(`/registry/models/${modelId}/versions/${version}`, {
      params: { stage }
    });
  }

  /**
   * List training jobs
   */
  async listTrainingJobs(params?: {
    page?: number;
    pageSize?: number;
    status?: TrainingStatus;
    pipelineId?: string;
  }): Promise<APIResponse<TrainingJob[]>> {
    return this.paginatedRequest('/train', params);
  }

  /**
   * Get ML framework capabilities
   */
  async getCapabilities(): Promise<APIResponse<{
    supported_tasks: MLTaskType[];
    supported_models: ModelType[];
    supported_frameworks: string[];
    max_features: number;
    max_training_time: number;
  }>> {
    return this.get('/capabilities');
  }
}

export default MLPipelineAPI;