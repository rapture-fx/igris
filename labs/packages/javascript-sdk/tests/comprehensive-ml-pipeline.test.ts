/**
 * Comprehensive ML pipeline tests for Igris-engine JavaScript SDK
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IgrisClient } from '../src/client/igris-inertial';
import { MLPipelineAPI } from '../src/api/ml-pipeline';
import { APIError, ValidationError, TimeoutError } from '../src/utils/errors';
import { 
  MLPipeline, 
  TrainingJob, 
  ModelConfig, 
  HyperParameters,
  ModelMetrics,
  PredictionJob,
  ModelVersion,
  FeatureConfig
} from '../src/types/ml';
import { mockResponse, mockApiError } from './setup';

// Mock fetch globally
global.fetch = jest.fn();

describe('MLPipelineAPI', () => {
  let client: IgrisClient;
  let mlAPI: MLPipelineAPI;

  beforeEach(() => {
    client = new IgrisClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com'
    });
    mlAPI = client.ml;
    jest.clearAllMocks();
  });

  const mockPipeline: MLPipeline = {
    pipeline_id: 'pipeline-123',
    name: 'Customer Churn Prediction',
    description: 'ML pipeline for predicting customer churn',
    model_type: 'random_forest',
    status: 'active',
    created_at: '2024-01-01T12:00:00Z',
    updated_at: '2024-01-01T12:00:00Z',
    config: {
      algorithm: 'random_forest',
      hyperparameters: {
        n_estimators: 100,
        max_depth: 10,
        min_samples_split: 2
      },
      features: {
        feature_columns: ['age', 'income', 'usage'],
        target_column: 'churned',
        encoding_strategy: 'auto'
      }
    },
    metrics: {
      accuracy: 0.92,
      precision: 0.89,
      recall: 0.94,
      f1_score: 0.91,
      auc_score: 0.88
    }
  };

  const mockTrainingJob: TrainingJob = {
    job_id: 'train-job-123',
    pipeline_id: 'pipeline-123',
    status: 'running',
    progress: { current_epoch: 10, total_epochs: 100 },
    started_at: '2024-01-01T12:00:00Z',
    estimated_completion: '2024-01-01T13:00:00Z',
    metrics: {
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.87,
      f1_score: 0.84
    }
  };

  describe('pipeline management', () => {
    test('should create pipeline successfully', async () => {
      const pipelineConfig = {
        name: 'Customer Churn Prediction',
        description: 'ML pipeline for predicting customer churn',
        model_type: 'random_forest',
        config: mockPipeline.config
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(mockPipeline))
      });

      const result = await mlAPI.createPipeline(pipelineConfig);

      expect(result.pipeline_id).toBe('pipeline-123');
      expect(result.name).toBe('Customer Churn Prediction');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/ml/pipelines',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(pipelineConfig)
        })
      );
    });

    test('should handle invalid pipeline configuration', async () => {
      const invalidConfig = {
        name: '', // Invalid: empty name
        model_type: 'unsupported_model'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Invalid configuration', 400))
      });

      await expect(mlAPI.createPipeline(invalidConfig)).rejects.toThrow(APIError);
    });

    test('should get pipeline by ID', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(mockPipeline))
      });

      const result = await mlAPI.getPipeline('pipeline-123');

      expect(result.pipeline_id).toBe('pipeline-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/ml/pipelines/pipeline-123',
        expect.any(Object)
      );
    });

    test('should list pipelines with filtering', async () => {
      const pipelinesResponse = {
        pipelines: [mockPipeline],
        pagination: {
          page: 1,
          per_page: 10,
          total: 1,
          pages: 1
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(pipelinesResponse))
      });

      const result = await mlAPI.listPipelines({
        status: 'active',
        page: 1,
        perPage: 10
      });

      expect(result.pipelines).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=active&page=1&per_page=10'),
        expect.any(Object)
      );
    });

    test('should update pipeline configuration', async () => {
      const updates = {
        description: 'Updated description',
        config: {
          algorithm: 'xgboost',
          hyperparameters: {
            n_estimators: 200,
            max_depth: 8
          }
        }
      };

      const updatedPipeline = {
        ...mockPipeline,
        description: 'Updated description'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(updatedPipeline))
      });

      const result = await mlAPI.updatePipeline('pipeline-123', updates);

      expect(result.description).toBe('Updated description');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/ml/pipelines/pipeline-123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates)
        })
      );
    });

    test('should delete pipeline', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({ message: 'Pipeline deleted' }))
      });

      const result = await mlAPI.deletePipeline('pipeline-123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/ml/pipelines/pipeline-123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('model training', () => {
    test('should train model successfully', async () => {
      const trainingConfig = {
        training_data: 'dataset-123',
        config: {
          batch_size: 32,
          learning_rate: 0.001,
          epochs: 100
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(mockTrainingJob))
      });

      const result = await mlAPI.trainModel('pipeline-123', trainingConfig);

      expect(result.job_id).toBe('train-job-123');
      expect(result.status).toBe('running');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/ml/pipelines/pipeline-123/train',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(trainingConfig)
        })
      );
    });

    test('should get training status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(mockTrainingJob))
      });

      const result = await mlAPI.getTrainingStatus('train-job-123');

      expect(result.job_id).toBe('train-job-123');
      expect(result.progress.current_epoch).toBe(10);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/ml/training/train-job-123',
        expect.any(Object)
      );
    });

    test('should wait for training completion', async () => {
      const trainingStates = [
        { ...mockTrainingJob, progress: { current_epoch: 25, total_epochs: 100 } },
        { ...mockTrainingJob, progress: { current_epoch: 75, total_epochs: 100 } },
        { 
          ...mockTrainingJob, 
          status: 'completed' as const,
          progress: { current_epoch: 100, total_epochs: 100 },
          completed_at: '2024-01-01T13:00:00Z',
          metrics: {
            accuracy: 0.92,
            precision: 0.89,
            recall: 0.94,
            f1_score: 0.91
          }
        }
      ];

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        const response = trainingStates[Math.min(callCount, trainingStates.length - 1)];
        callCount++;
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockResponse(response))
        });
      });

      const result = await mlAPI.waitForTrainingCompletion('train-job-123', {
        timeout: 10000,
        pollInterval: 100
      });

      expect(result.status).toBe('completed');
      expect(result.metrics?.accuracy).toBe(0.92);
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    test('should timeout waiting for training', async () => {
      const runningJob = { ...mockTrainingJob, status: 'running' as const };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(runningJob))
      });

      await expect(mlAPI.waitForTrainingCompletion('train-job-123', {
        timeout: 200,
        pollInterval: 50
      })).rejects.toThrow(TimeoutError);
    });

    test('should cancel training job', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({ message: 'Training cancelled' }))
      });

      const result = await mlAPI.cancelTraining('train-job-123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/ml/training/train-job-123/cancel',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('hyperparameter tuning', () => {
    test('should start hyperparameter tuning', async () => {
      const tuningConfig = {
        parameter_space: {
          n_estimators: [50, 100, 200],
          max_depth: [5, 10, 15],
          min_samples_split: [2, 5, 10]
        },
        optimization_metric: 'f1_score',
        cv_folds: 5,
        max_trials: 20
      };

      const tuningJob = {
        ...mockTrainingJob,
        job_id: 'tune-job-123',
        progress: { completed_trials: 5, total_trials: 20 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(tuningJob))
      });

      const result = await mlAPI.tuneHyperparameters('pipeline-123', tuningConfig);

      expect(result.job_id).toBe('tune-job-123');
      expect(result.progress.total_trials).toBe(20);
    });

    test('should get tuning results', async () => {
      const tuningResults = {
        best_parameters: {
          n_estimators: 150,
          max_depth: 8,
          min_samples_split: 5
        },
        best_score: 0.94,
        trials: [
          { parameters: { n_estimators: 50, max_depth: 5 }, score: 0.87 },
          { parameters: { n_estimators: 100, max_depth: 10 }, score: 0.91 },
          { parameters: { n_estimators: 150, max_depth: 8 }, score: 0.94 }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(tuningResults))
      });

      const result = await mlAPI.getTuningResults('tune-job-123');

      expect(result.best_score).toBe(0.94);
      expect(result.best_parameters.n_estimators).toBe(150);
      expect(result.trials).toHaveLength(3);
    });
  });

  describe('model evaluation', () => {
    test('should evaluate model performance', async () => {
      const evaluationResult = {
        metrics: {
          accuracy: 0.92,
          precision: 0.89,
          recall: 0.94,
          f1_score: 0.91,
          confusion_matrix: [[85, 5], [3, 7]]
        },
        feature_importance: {
          income: 0.45,
          usage: 0.35,
          age: 0.20
        },
        cross_validation: {
          cv_scores: [0.90, 0.91, 0.93, 0.89, 0.92],
          mean_score: 0.91,
          std_score: 0.015
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(evaluationResult))
      });

      const result = await mlAPI.evaluateModel('pipeline-123', {
        test_data: 'test-dataset-123',
        metrics: ['accuracy', 'precision', 'recall', 'f1_score'],
        include_feature_importance: true,
        cross_validation: { folds: 5 }
      });

      expect(result.metrics.accuracy).toBe(0.92);
      expect(result.feature_importance.income).toBe(0.45);
      expect(result.cross_validation.mean_score).toBe(0.91);
    });

    test('should compare models', async () => {
      const comparisonResult = {
        models: [
          { pipeline_id: 'pipeline-1', name: 'Random Forest', metrics: { accuracy: 0.92, f1_score: 0.91 } },
          { pipeline_id: 'pipeline-2', name: 'XGBoost', metrics: { accuracy: 0.94, f1_score: 0.93 } },
          { pipeline_id: 'pipeline-3', name: 'SVM', metrics: { accuracy: 0.89, f1_score: 0.87 } }
        ],
        best_model: 'pipeline-2',
        ranking: ['pipeline-2', 'pipeline-1', 'pipeline-3']
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(comparisonResult))
      });

      const result = await mlAPI.compareModels(['pipeline-1', 'pipeline-2', 'pipeline-3'], {
        test_data: 'test-dataset-123',
        primary_metric: 'f1_score'
      });

      expect(result.best_model).toBe('pipeline-2');
      expect(result.models).toHaveLength(3);
      expect(result.ranking[0]).toBe('pipeline-2');
    });
  });

  describe('predictions', () => {
    test('should make single prediction', async () => {
      const inputData = [
        { age: 25, income: 50000, usage: 120 },
        { age: 35, income: 75000, usage: 200 }
      ];

      const predictionResult = {
        predictions: [0.2, 0.8],
        probabilities: [[0.8, 0.2], [0.2, 0.8]],
        confidence: [0.85, 0.92]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(predictionResult))
      });

      const result = await mlAPI.makePrediction('pipeline-123', inputData);

      expect(result.predictions).toHaveLength(2);
      expect(result.predictions[0]).toBe(0.2);
      expect(result.confidence[1]).toBe(0.92);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/ml/pipelines/pipeline-123/predict',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ input_data: inputData })
        })
      );
    });

    test('should handle batch prediction', async () => {
      const batchConfig = {
        data_source: 'dataset-456',
        output_location: 's3://bucket/predictions.csv',
        batch_size: 1000
      };

      const predictionJob: PredictionJob = {
        job_id: 'pred-job-123',
        pipeline_id: 'pipeline-123',
        status: 'running',
        progress: { processed: 500, total: 1000 },
        created_at: '2024-01-01T12:00:00Z'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(predictionJob))
      });

      const result = await mlAPI.batchPredict('pipeline-123', batchConfig);

      expect(result.job_id).toBe('pred-job-123');
      expect(result.progress.total).toBe(1000);
    });

    test('should get batch prediction status', async () => {
      const predictionJob: PredictionJob = {
        job_id: 'pred-job-123',
        pipeline_id: 'pipeline-123',
        status: 'completed',
        progress: { processed: 1000, total: 1000 },
        created_at: '2024-01-01T12:00:00Z',
        completed_at: '2024-01-01T12:15:00Z',
        output_location: 's3://bucket/predictions.csv'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(predictionJob))
      });

      const result = await mlAPI.getPredictionStatus('pred-job-123');

      expect(result.status).toBe('completed');
      expect(result.output_location).toBe('s3://bucket/predictions.csv');
    });
  });

  describe('model versioning', () => {
    test('should get model versions', async () => {
      const versions: ModelVersion[] = [
        {
          version_id: 'v1.0',
          pipeline_id: 'pipeline-123',
          version: '1.0',
          status: 'active',
          created_at: '2024-01-01T12:00:00Z',
          metrics: { accuracy: 0.90, f1_score: 0.88 }
        },
        {
          version_id: 'v1.1',
          pipeline_id: 'pipeline-123',
          version: '1.1',
          status: 'inactive',
          created_at: '2024-01-02T12:00:00Z',
          metrics: { accuracy: 0.92, f1_score: 0.91 }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({ versions }))
      });

      const result = await mlAPI.getModelVersions('pipeline-123');

      expect(result.versions).toHaveLength(2);
      expect(result.versions[1].metrics?.accuracy).toBe(0.92);
    });

    test('should create model version', async () => {
      const versionConfig = {
        version: '2.0',
        description: 'Improved model with better features',
        model_artifacts: 's3://bucket/model-2.0.pkl'
      };

      const newVersion: ModelVersion = {
        version_id: 'v2.0',
        pipeline_id: 'pipeline-123',
        version: '2.0',
        status: 'active',
        created_at: '2024-01-03T12:00:00Z',
        description: 'Improved model with better features'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(newVersion))
      });

      const result = await mlAPI.createModelVersion('pipeline-123', versionConfig);

      expect(result.version).toBe('2.0');
      expect(result.status).toBe('active');
    });

    test('should deploy model version', async () => {
      const deploymentConfig = {
        environment: 'production',
        scaling: {
          min_instances: 2,
          max_instances: 10,
          target_cpu_utilization: 70
        }
      };

      const deploymentResult = {
        deployment_id: 'deploy-123',
        version_id: 'v2.0',
        environment: 'production',
        status: 'deploying',
        endpoint_url: 'https://api.igris-inertial.com/ml/pipeline-123/predict'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(deploymentResult))
      });

      const result = await mlAPI.deployModel('pipeline-123', 'v2.0', deploymentConfig);

      expect(result.deployment_id).toBe('deploy-123');
      expect(result.status).toBe('deploying');
      expect(result.endpoint_url).toContain('pipeline-123');
    });
  });

  describe('advanced features', () => {
    test('should generate automated features', async () => {
      const featureConfig = {
        enable_auto_features: true,
        feature_types: ['polynomial', 'interaction', 'statistical'],
        max_features: 100
      };

      const engineeredFeatures = {
        original_features: ['age', 'income'],
        generated_features: ['age_squared', 'age_income_ratio', 'income_log'],
        feature_importance: { age: 0.3, income: 0.4, age_squared: 0.3 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(engineeredFeatures))
      });

      const result = await mlAPI.generateFeatures('pipeline-123', featureConfig);

      expect(result.generated_features).toHaveLength(3);
      expect(result.feature_importance.income).toBe(0.4);
    });

    test('should explain model predictions', async () => {
      const inputData = [{ age: 25, income: 50000, usage: 120 }];

      const explanationResult = {
        global_importance: { income: 0.45, age: 0.35, usage: 0.20 },
        local_explanations: [
          {
            prediction: 0.8,
            features: { income: 0.5, age: 0.2, usage: 0.1 }
          }
        ],
        shap_values: [[0.1, -0.05, 0.3]],
        lime_explanation: 'High income (+0.5) and usage (+0.3) increase churn probability'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(explanationResult))
      });

      const result = await mlAPI.explainPrediction('pipeline-123', inputData);

      expect(result.global_importance.income).toBe(0.45);
      expect(result.local_explanations).toHaveLength(1);
      expect(result.shap_values[0]).toHaveLength(3);
    });

    test('should monitor model performance', async () => {
      const monitoringMetrics = {
        drift_detection: {
          feature_drift: { income: 0.15, age: 0.05 },
          prediction_drift: 0.08,
          drift_threshold: 0.1
        },
        performance_metrics: {
          accuracy: 0.89,
          precision: 0.86,
          recall: 0.92,
          f1_score: 0.89
        },
        alerts: [
          { type: 'feature_drift', feature: 'income', severity: 'medium' }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(monitoringMetrics))
      });

      const result = await mlAPI.getModelMonitoring('pipeline-123');

      expect(result.drift_detection.feature_drift.income).toBe(0.15);
      expect(result.performance_metrics.accuracy).toBe(0.89);
      expect(result.alerts).toHaveLength(1);
    });

    test('should perform incremental learning', async () => {
      const incrementalConfig = {
        incremental: true,
        base_model_version: 'v1.0',
        learning_rate: 0.001,
        epochs: 10,
        new_data: 'incremental-dataset-123'
      };

      const incrementalJob = {
        ...mockTrainingJob,
        job_id: 'incremental-job-123',
        training_type: 'incremental'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(incrementalJob))
      });

      const result = await mlAPI.incrementalTraining('pipeline-123', incrementalConfig);

      expect(result.job_id).toBe('incremental-job-123');
      expect(result.training_type).toBe('incremental');
    });
  });

  describe('error handling', () => {
    test('should handle training failures', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Training failed: insufficient memory', 500))
      });

      await expect(mlAPI.trainModel('pipeline-123', {
        training_data: 'dataset-123'
      })).rejects.toThrow('Training failed: insufficient memory');
    });

    test('should handle prediction errors', async () => {
      const invalidInput = [{ invalid_feature: 'value' }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Invalid input features', 400))
      });

      await expect(mlAPI.makePrediction('pipeline-123', invalidInput))
        .rejects.toThrow('Invalid input features');
    });

    test('should handle pipeline not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Pipeline not found', 404))
      });

      await expect(mlAPI.getPipeline('nonexistent-pipeline'))
        .rejects.toThrow('Pipeline not found');
    });

    test('should validate model configuration', async () => {
      const invalidConfig = {
        algorithm: 'unknown_algorithm',
        hyperparameters: {
          invalid_param: -1
        }
      };

      await expect(mlAPI.createPipeline({
        name: 'Test',
        model_type: 'custom',
        config: invalidConfig
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('performance optimization', () => {
    test('should handle concurrent training jobs', async () => {
      const configs = [
        { algorithm: 'random_forest', n_estimators: 100 },
        { algorithm: 'xgboost', n_estimators: 100 },
        { algorithm: 'svm', kernel: 'rbf' }
      ];

      const trainingJobs = configs.map((config, i) => ({
        ...mockTrainingJob,
        job_id: `train-job-${i}`,
        config
      }));

      (global.fetch as jest.Mock).mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue(
            mockResponse(trainingJobs[Math.floor(Math.random() * trainingJobs.length)])
          )
        })
      );

      const promises = configs.map(config => 
        mlAPI.trainModel('pipeline-123', { config })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.job_id).toMatch(/train-job-\d+/);
      });
    });

    test('should implement prediction caching', async () => {
      const inputData = [{ age: 25, income: 50000 }];
      const cachedResult = { predictions: [0.2], cached: true };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(cachedResult))
      });

      // First call
      const result1 = await mlAPI.makePrediction('pipeline-123', inputData);
      
      // Second identical call (should use cache)
      const result2 = await mlAPI.makePrediction('pipeline-123', inputData);

      expect(result1).toEqual(result2);
      // In a real implementation, this would verify cache usage
    });
  });
});

describe('ML Pipeline Integration', () => {
  let client: IgrisClient;

  beforeEach(() => {
    client = new IgrisClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com'
    });
    jest.clearAllMocks();
  });

  test('should handle complete ML lifecycle', async () => {
    // Mock the complete ML workflow
    (global.fetch as jest.Mock)
      // Create pipeline
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({
          pipeline_id: 'ml-pipeline-123',
          name: 'Lifecycle Test Pipeline',
          status: 'active'
        }))
      })
      // Train model
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({
          job_id: 'train-job-456',
          pipeline_id: 'ml-pipeline-123',
          status: 'running'
        }))
      })
      // Check training status (completed)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({
          job_id: 'train-job-456',
          status: 'completed',
          metrics: { accuracy: 0.95, f1_score: 0.93 }
        }))
      })
      // Evaluate model
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({
          metrics: { accuracy: 0.94, precision: 0.91 },
          feature_importance: { feature1: 0.6, feature2: 0.4 }
        }))
      })
      // Make prediction
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({
          predictions: [0.85],
          confidence: [0.92]
        }))
      });

    // Create pipeline
    const pipeline = await client.ml.createPipeline({
      name: 'Lifecycle Test Pipeline',
      model_type: 'random_forest',
      config: {
        algorithm: 'random_forest',
        hyperparameters: { n_estimators: 100 },
        features: {
          feature_columns: ['feature1', 'feature2'],
          target_column: 'target'
        }
      }
    });

    // Train model
    const trainingJob = await client.ml.trainModel(pipeline.pipeline_id, {
      training_data: 'training-set-123'
    });

    // Wait for training completion
    const completedTraining = await client.ml.waitForTrainingCompletion(trainingJob.job_id, {
      timeout: 5000,
      pollInterval: 100
    });

    // Evaluate model
    const evaluation = await client.ml.evaluateModel(pipeline.pipeline_id, {
      test_data: 'test-set-123'
    });

    // Make prediction
    const prediction = await client.ml.makePrediction(pipeline.pipeline_id, [
      { feature1: 0.5, feature2: 0.8 }
    ]);

    expect(pipeline.pipeline_id).toBe('ml-pipeline-123');
    expect(completedTraining.status).toBe('completed');
    expect(evaluation.metrics.accuracy).toBe(0.94);
    expect(prediction.predictions[0]).toBe(0.85);
  });
});