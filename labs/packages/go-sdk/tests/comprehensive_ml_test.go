package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/client"
	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/igris-inertial/go-sdk/pkg/models/common"
	"github.com/igris-inertial/go-sdk/pkg/models/ml"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMLPipelineClient(t *testing.T) {
	t.Run("Create Pipeline Success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines", r.URL.Path)

			var requestBody ml.PipelineCreateRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "Customer Churn Prediction", requestBody.Name)
			assert.Equal(t, "random_forest", requestBody.ModelType)

			pipeline := ml.Pipeline{
				PipelineID:  "pipeline-123",
				Name:        "Customer Churn Prediction",
				Description: "ML pipeline for predicting customer churn",
				ModelType:   "random_forest",
				Status:      "active",
				CreatedAt:   time.Now().Format(time.RFC3339),
				UpdatedAt:   time.Now().Format(time.RFC3339),
				Config: ml.ModelConfig{
					Algorithm: "random_forest",
					HyperParameters: ml.HyperParameters{
						"n_estimators":      100,
						"max_depth":         10,
						"min_samples_split": 2,
					},
					Features: ml.FeatureConfig{
						FeatureColumns:   []string{"age", "income", "usage"},
						TargetColumn:     "churned",
						EncodingStrategy: "auto",
					},
				},
				Metrics: &ml.ModelMetrics{
					Accuracy:  0.92,
					Precision: 0.89,
					Recall:    0.94,
					F1Score:   0.91,
					AUCScore:  0.88,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    pipeline,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		pipelineConfig := ml.PipelineCreateRequest{
			Name:        "Customer Churn Prediction",
			Description: "ML pipeline for predicting customer churn",
			ModelType:   "random_forest",
			Config: ml.ModelConfig{
				Algorithm: "random_forest",
				HyperParameters: ml.HyperParameters{
					"n_estimators":      100,
					"max_depth":         10,
					"min_samples_split": 2,
				},
				Features: ml.FeatureConfig{
					FeatureColumns:   []string{"age", "income", "usage"},
					TargetColumn:     "churned",
					EncodingStrategy: "auto",
				},
			},
		}

		pipeline, err := mlClient.CreatePipeline(context.Background(), pipelineConfig)
		require.NoError(t, err)
		
		assert.Equal(t, "pipeline-123", pipeline.PipelineID)
		assert.Equal(t, "Customer Churn Prediction", pipeline.Name)
		assert.Equal(t, 0.92, pipeline.Metrics.Accuracy)
	})

	t.Run("Get Pipeline", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123", r.URL.Path)

			pipeline := ml.Pipeline{
				PipelineID:  "pipeline-123",
				Name:        "Test Pipeline",
				Description: "Test ML pipeline",
				ModelType:   "xgboost",
				Status:      "active",
				CreatedAt:   time.Now().Format(time.RFC3339),
				UpdatedAt:   time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    pipeline,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		pipeline, err := mlClient.GetPipeline(context.Background(), "pipeline-123")
		require.NoError(t, err)
		
		assert.Equal(t, "pipeline-123", pipeline.PipelineID)
		assert.Equal(t, "Test Pipeline", pipeline.Name)
		assert.Equal(t, "xgboost", pipeline.ModelType)
	})

	t.Run("List Pipelines", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines", r.URL.Path)
			
			query := r.URL.Query()
			assert.Equal(t, "active", query.Get("status"))
			assert.Equal(t, "1", query.Get("page"))
			assert.Equal(t, "10", query.Get("per_page"))

			pipelines := []ml.Pipeline{
				{
					PipelineID:  "pipeline-1",
					Name:        "Pipeline 1",
					ModelType:   "random_forest",
					Status:      "active",
					CreatedAt:   time.Now().Format(time.RFC3339),
				},
				{
					PipelineID:  "pipeline-2",
					Name:        "Pipeline 2",
					ModelType:   "xgboost",
					Status:      "active",
					CreatedAt:   time.Now().Format(time.RFC3339),
				},
			}

			pipelineListResponse := ml.PipelineListResponse{
				Pipelines: pipelines,
				Pagination: common.PaginationInfo{
					Page:    1,
					PerPage: 10,
					Total:   2,
					Pages:   1,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    pipelineListResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		listOptions := ml.PipelineListOptions{
			Status:  "active",
			Page:    1,
			PerPage: 10,
		}

		result, err := mlClient.ListPipelines(context.Background(), listOptions)
		require.NoError(t, err)
		
		assert.Len(t, result.Pipelines, 2)
		assert.Equal(t, 1, result.Pagination.Page)
		assert.Equal(t, 2, result.Pagination.Total)
	})

	t.Run("Update Pipeline", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "PUT", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123", r.URL.Path)

			var requestBody ml.PipelineUpdateRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "Updated description", requestBody.Description)

			updatedPipeline := ml.Pipeline{
				PipelineID:  "pipeline-123",
				Name:        "Test Pipeline",
				Description: "Updated description",
				ModelType:   "xgboost",
				Status:      "active",
				CreatedAt:   time.Now().Add(-time.Hour).Format(time.RFC3339),
				UpdatedAt:   time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    updatedPipeline,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		updateRequest := ml.PipelineUpdateRequest{
			Description: "Updated description",
		}

		pipeline, err := mlClient.UpdatePipeline(context.Background(), "pipeline-123", updateRequest)
		require.NoError(t, err)
		
		assert.Equal(t, "pipeline-123", pipeline.PipelineID)
		assert.Equal(t, "Updated description", pipeline.Description)
	})

	t.Run("Delete Pipeline", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "DELETE", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123", r.URL.Path)

			response := common.APIResponse{
				Success: true,
				Message: "Pipeline deleted successfully",
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		err := mlClient.DeletePipeline(context.Background(), "pipeline-123")
		require.NoError(t, err)
	})
}

func TestModelTraining(t *testing.T) {
	t.Run("Train Model Success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/train", r.URL.Path)

			var requestBody ml.TrainingRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "dataset-123", requestBody.TrainingData)

			trainingJob := ml.TrainingJob{
				JobID:               "train-job-123",
				PipelineID:          "pipeline-123",
				Status:              "running",
				Progress:            map[string]interface{}{"current_epoch": 10, "total_epochs": 100},
				StartedAt:           time.Now().Format(time.RFC3339),
				EstimatedCompletion: time.Now().Add(time.Hour).Format(time.RFC3339),
				Metrics: &ml.ModelMetrics{
					Accuracy:  0.85,
					Precision: 0.82,
					Recall:    0.87,
					F1Score:   0.84,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    trainingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		trainingRequest := ml.TrainingRequest{
			TrainingData: "dataset-123",
			Config: map[string]interface{}{
				"batch_size":    32,
				"learning_rate": 0.001,
				"epochs":        100,
			},
		}

		job, err := mlClient.TrainModel(context.Background(), "pipeline-123", trainingRequest)
		require.NoError(t, err)
		
		assert.Equal(t, "train-job-123", job.JobID)
		assert.Equal(t, "running", job.Status)
		assert.Equal(t, 0.85, job.Metrics.Accuracy)
	})

	t.Run("Get Training Status", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/ml/training/train-job-123", r.URL.Path)

			trainingJob := ml.TrainingJob{
				JobID:      "train-job-123",
				PipelineID: "pipeline-123",
				Status:     "running",
				Progress:   map[string]interface{}{"current_epoch": 75, "total_epochs": 100},
				StartedAt:  time.Now().Add(-45 * time.Minute).Format(time.RFC3339),
				Metrics: &ml.ModelMetrics{
					Accuracy: 0.89,
					F1Score:  0.87,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    trainingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		job, err := mlClient.GetTrainingStatus(context.Background(), "train-job-123")
		require.NoError(t, err)
		
		assert.Equal(t, "train-job-123", job.JobID)
		assert.Equal(t, "running", job.Status)
		assert.Equal(t, 0.89, job.Metrics.Accuracy)
	})

	t.Run("Wait for Training Completion", func(t *testing.T) {
		callCount := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			callCount++
			
			var status string
			var progress map[string]interface{}
			var completedAt string
			var metrics *ml.ModelMetrics

			switch callCount {
			case 1:
				status = "running"
				progress = map[string]interface{}{"current_epoch": 25, "total_epochs": 100}
				metrics = &ml.ModelMetrics{Accuracy: 0.82}
			case 2:
				status = "running"
				progress = map[string]interface{}{"current_epoch": 75, "total_epochs": 100}
				metrics = &ml.ModelMetrics{Accuracy: 0.88}
			default:
				status = "completed"
				progress = map[string]interface{}{"current_epoch": 100, "total_epochs": 100}
				completedAt = time.Now().Format(time.RFC3339)
				metrics = &ml.ModelMetrics{
					Accuracy:  0.92,
					Precision: 0.89,
					Recall:    0.94,
					F1Score:   0.91,
				}
			}

			trainingJob := ml.TrainingJob{
				JobID:       "train-job-123",
				PipelineID:  "pipeline-123",
				Status:      status,
				Progress:    progress,
				StartedAt:   time.Now().Add(-time.Hour).Format(time.RFC3339),
				CompletedAt: completedAt,
				Metrics:     metrics,
			}

			response := common.APIResponse{
				Success: true,
				Data:    trainingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		job, err := mlClient.WaitForTrainingCompletion(context.Background(), "train-job-123", ml.WaitOptions{
			Timeout:      10 * time.Second,
			PollInterval: 100 * time.Millisecond,
		})
		require.NoError(t, err)
		
		assert.Equal(t, "completed", job.Status)
		assert.Equal(t, 0.92, job.Metrics.Accuracy)
		assert.True(t, callCount >= 3)
	})

	t.Run("Cancel Training", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/training/train-job-123/cancel", r.URL.Path)

			response := common.APIResponse{
				Success: true,
				Message: "Training job cancelled successfully",
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		err := mlClient.CancelTraining(context.Background(), "train-job-123")
		require.NoError(t, err)
	})
}

func TestHyperparameterTuning(t *testing.T) {
	t.Run("Start Hyperparameter Tuning", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/tune", r.URL.Path)

			var requestBody ml.TuningRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "f1_score", requestBody.OptimizationMetric)
			assert.Equal(t, 20, requestBody.MaxTrials)

			tuningJob := ml.TrainingJob{
				JobID:      "tune-job-123",
				PipelineID: "pipeline-123",
				Status:     "running",
				Progress:   map[string]interface{}{"completed_trials": 5, "total_trials": 20},
				StartedAt:  time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    tuningJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		tuningRequest := ml.TuningRequest{
			ParameterSpace: map[string]interface{}{
				"n_estimators":      []int{50, 100, 200},
				"max_depth":         []int{5, 10, 15},
				"min_samples_split": []int{2, 5, 10},
			},
			OptimizationMetric: "f1_score",
			CVFolds:            5,
			MaxTrials:          20,
		}

		job, err := mlClient.TuneHyperparameters(context.Background(), "pipeline-123", tuningRequest)
		require.NoError(t, err)
		
		assert.Equal(t, "tune-job-123", job.JobID)
		assert.Equal(t, "running", job.Status)
	})

	t.Run("Get Tuning Results", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/ml/tuning/tune-job-123/results", r.URL.Path)

			tuningResults := ml.TuningResults{
				BestParameters: ml.HyperParameters{
					"n_estimators":      150,
					"max_depth":         8,
					"min_samples_split": 5,
				},
				BestScore: 0.94,
				Trials: []ml.TuningTrial{
					{Parameters: ml.HyperParameters{"n_estimators": 50, "max_depth": 5}, Score: 0.87},
					{Parameters: ml.HyperParameters{"n_estimators": 100, "max_depth": 10}, Score: 0.91},
					{Parameters: ml.HyperParameters{"n_estimators": 150, "max_depth": 8}, Score: 0.94},
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    tuningResults,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		results, err := mlClient.GetTuningResults(context.Background(), "tune-job-123")
		require.NoError(t, err)
		
		assert.Equal(t, 0.94, results.BestScore)
		assert.Equal(t, 150, results.BestParameters["n_estimators"])
		assert.Len(t, results.Trials, 3)
	})
}

func TestModelEvaluation(t *testing.T) {
	t.Run("Evaluate Model", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/evaluate", r.URL.Path)

			var requestBody ml.EvaluationRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "test-dataset-123", requestBody.TestData)

			evaluationResult := ml.EvaluationResult{
				Metrics: ml.ModelMetrics{
					Accuracy:        0.92,
					Precision:       0.89,
					Recall:          0.94,
					F1Score:         0.91,
					ConfusionMatrix: [][]int{{85, 5}, {3, 7}},
				},
				FeatureImportance: map[string]float64{
					"income": 0.45,
					"usage":  0.35,
					"age":    0.20,
				},
				CrossValidation: &ml.CrossValidationResult{
					CVScores:  []float64{0.90, 0.91, 0.93, 0.89, 0.92},
					MeanScore: 0.91,
					StdScore:  0.015,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    evaluationResult,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		evalRequest := ml.EvaluationRequest{
			TestData: "test-dataset-123",
			Metrics:  []string{"accuracy", "precision", "recall", "f1_score"},
			IncludeFeatureImportance: true,
			CrossValidation: &ml.CrossValidationConfig{
				Folds: 5,
			},
		}

		result, err := mlClient.EvaluateModel(context.Background(), "pipeline-123", evalRequest)
		require.NoError(t, err)
		
		assert.Equal(t, 0.92, result.Metrics.Accuracy)
		assert.Equal(t, 0.45, result.FeatureImportance["income"])
		assert.Equal(t, 0.91, result.CrossValidation.MeanScore)
	})

	t.Run("Compare Models", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/compare", r.URL.Path)

			var requestBody ml.ComparisonRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Len(t, requestBody.PipelineIDs, 3)
			assert.Equal(t, "f1_score", requestBody.PrimaryMetric)

			comparisonResult := ml.ComparisonResult{
				Models: []ml.ModelComparison{
					{PipelineID: "pipeline-1", Name: "Random Forest", Metrics: ml.ModelMetrics{Accuracy: 0.92, F1Score: 0.91}},
					{PipelineID: "pipeline-2", Name: "XGBoost", Metrics: ml.ModelMetrics{Accuracy: 0.94, F1Score: 0.93}},
					{PipelineID: "pipeline-3", Name: "SVM", Metrics: ml.ModelMetrics{Accuracy: 0.89, F1Score: 0.87}},
				},
				BestModel: "pipeline-2",
				Ranking:   []string{"pipeline-2", "pipeline-1", "pipeline-3"},
			}

			response := common.APIResponse{
				Success: true,
				Data:    comparisonResult,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		compRequest := ml.ComparisonRequest{
			PipelineIDs:   []string{"pipeline-1", "pipeline-2", "pipeline-3"},
			TestData:      "test-dataset-123",
			PrimaryMetric: "f1_score",
		}

		result, err := mlClient.CompareModels(context.Background(), compRequest)
		require.NoError(t, err)
		
		assert.Equal(t, "pipeline-2", result.BestModel)
		assert.Len(t, result.Models, 3)
		assert.Equal(t, []string{"pipeline-2", "pipeline-1", "pipeline-3"}, result.Ranking)
	})
}

func TestPredictions(t *testing.T) {
	t.Run("Make Prediction", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/predict", r.URL.Path)

			var requestBody ml.PredictionRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Len(t, requestBody.InputData, 2)

			predictionResult := ml.PredictionResult{
				Predictions:   []float64{0.2, 0.8},
				Probabilities: [][]float64{{0.8, 0.2}, {0.2, 0.8}},
				Confidence:    []float64{0.85, 0.92},
			}

			response := common.APIResponse{
				Success: true,
				Data:    predictionResult,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		predRequest := ml.PredictionRequest{
			InputData: []map[string]interface{}{
				{"age": 25, "income": 50000, "usage": 120},
				{"age": 35, "income": 75000, "usage": 200},
			},
		}

		result, err := mlClient.MakePrediction(context.Background(), "pipeline-123", predRequest)
		require.NoError(t, err)
		
		assert.Len(t, result.Predictions, 2)
		assert.Equal(t, 0.2, result.Predictions[0])
		assert.Equal(t, 0.92, result.Confidence[1])
	})

	t.Run("Batch Prediction", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/predict/batch", r.URL.Path)

			var requestBody ml.BatchPredictionRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "dataset-456", requestBody.DataSource)
			assert.Equal(t, "s3://bucket/predictions.csv", requestBody.OutputLocation)

			predictionJob := ml.PredictionJob{
				JobID:           "pred-job-123",
				PipelineID:      "pipeline-123",
				Status:          "running",
				Progress:        map[string]interface{}{"processed": 500, "total": 1000},
				CreatedAt:       time.Now().Format(time.RFC3339),
				OutputLocation:  "s3://bucket/predictions.csv",
			}

			response := common.APIResponse{
				Success: true,
				Data:    predictionJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		batchRequest := ml.BatchPredictionRequest{
			DataSource:     "dataset-456",
			OutputLocation: "s3://bucket/predictions.csv",
			BatchSize:      1000,
		}

		job, err := mlClient.BatchPredict(context.Background(), "pipeline-123", batchRequest)
		require.NoError(t, err)
		
		assert.Equal(t, "pred-job-123", job.JobID)
		assert.Equal(t, "running", job.Status)
		assert.Equal(t, "s3://bucket/predictions.csv", job.OutputLocation)
	})

	t.Run("Get Prediction Status", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/ml/predictions/pred-job-123", r.URL.Path)

			predictionJob := ml.PredictionJob{
				JobID:           "pred-job-123",
				PipelineID:      "pipeline-123",
				Status:          "completed",
				Progress:        map[string]interface{}{"processed": 1000, "total": 1000},
				CreatedAt:       time.Now().Add(-15 * time.Minute).Format(time.RFC3339),
				CompletedAt:     time.Now().Format(time.RFC3339),
				OutputLocation:  "s3://bucket/predictions.csv",
			}

			response := common.APIResponse{
				Success: true,
				Data:    predictionJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		job, err := mlClient.GetPredictionStatus(context.Background(), "pred-job-123")
		require.NoError(t, err)
		
		assert.Equal(t, "pred-job-123", job.JobID)
		assert.Equal(t, "completed", job.Status)
		assert.Equal(t, "s3://bucket/predictions.csv", job.OutputLocation)
	})
}

func TestModelVersioning(t *testing.T) {
	t.Run("Get Model Versions", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/versions", r.URL.Path)

			versions := []ml.ModelVersion{
				{
					VersionID:   "v1.0",
					PipelineID:  "pipeline-123",
					Version:     "1.0",
					Status:      "active",
					CreatedAt:   time.Now().Add(-24 * time.Hour).Format(time.RFC3339),
					Metrics:     &ml.ModelMetrics{Accuracy: 0.90, F1Score: 0.88},
				},
				{
					VersionID:   "v1.1",
					PipelineID:  "pipeline-123",
					Version:     "1.1",
					Status:      "inactive",
					CreatedAt:   time.Now().Add(-12 * time.Hour).Format(time.RFC3339),
					Metrics:     &ml.ModelMetrics{Accuracy: 0.92, F1Score: 0.91},
				},
			}

			versionResponse := ml.ModelVersionsResponse{
				Versions: versions,
			}

			response := common.APIResponse{
				Success: true,
				Data:    versionResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		result, err := mlClient.GetModelVersions(context.Background(), "pipeline-123")
		require.NoError(t, err)
		
		assert.Len(t, result.Versions, 2)
		assert.Equal(t, "1.1", result.Versions[1].Version)
		assert.Equal(t, 0.92, result.Versions[1].Metrics.Accuracy)
	})

	t.Run("Create Model Version", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/versions", r.URL.Path)

			var requestBody ml.CreateVersionRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "2.0", requestBody.Version)
			assert.Equal(t, "Improved model with better features", requestBody.Description)

			newVersion := ml.ModelVersion{
				VersionID:   "v2.0",
				PipelineID:  "pipeline-123",
				Version:     "2.0",
				Status:      "active",
				CreatedAt:   time.Now().Format(time.RFC3339),
				Description: "Improved model with better features",
			}

			response := common.APIResponse{
				Success: true,
				Data:    newVersion,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		versionRequest := ml.CreateVersionRequest{
			Version:        "2.0",
			Description:    "Improved model with better features",
			ModelArtifacts: "s3://bucket/model-2.0.pkl",
		}

		version, err := mlClient.CreateModelVersion(context.Background(), "pipeline-123", versionRequest)
		require.NoError(t, err)
		
		assert.Equal(t, "v2.0", version.VersionID)
		assert.Equal(t, "2.0", version.Version)
		assert.Equal(t, "active", version.Status)
	})

	t.Run("Deploy Model Version", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/versions/v2.0/deploy", r.URL.Path)

			var requestBody ml.DeploymentRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "production", requestBody.Environment)

			deploymentResult := ml.DeploymentResult{
				DeploymentID: "deploy-123",
				VersionID:    "v2.0",
				Environment:  "production",
				Status:       "deploying",
				EndpointURL:  "https://api.igris-inertial.com/ml/pipeline-123/predict",
			}

			response := common.APIResponse{
				Success: true,
				Data:    deploymentResult,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		deployRequest := ml.DeploymentRequest{
			Environment: "production",
			Scaling: ml.ScalingConfig{
				MinInstances:           2,
				MaxInstances:           10,
				TargetCPUUtilization:   70,
			},
		}

		result, err := mlClient.DeployModel(context.Background(), "pipeline-123", "v2.0", deployRequest)
		require.NoError(t, err)
		
		assert.Equal(t, "deploy-123", result.DeploymentID)
		assert.Equal(t, "deploying", result.Status)
		assert.Contains(t, result.EndpointURL, "pipeline-123")
	})
}

func TestAdvancedFeatures(t *testing.T) {
	t.Run("Generate Features", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/features/generate", r.URL.Path)

			var requestBody ml.FeatureGenerationRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.True(t, requestBody.EnableAutoFeatures)
			assert.Equal(t, 100, requestBody.MaxFeatures)

			engineeredFeatures := ml.FeatureGenerationResult{
				OriginalFeatures:  []string{"age", "income"},
				GeneratedFeatures: []string{"age_squared", "age_income_ratio", "income_log"},
				FeatureImportance: map[string]float64{
					"age":              0.3,
					"income":           0.4,
					"age_squared":      0.3,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    engineeredFeatures,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		featureRequest := ml.FeatureGenerationRequest{
			EnableAutoFeatures: true,
			FeatureTypes:       []string{"polynomial", "interaction", "statistical"},
			MaxFeatures:        100,
		}

		result, err := mlClient.GenerateFeatures(context.Background(), "pipeline-123", featureRequest)
		require.NoError(t, err)
		
		assert.Len(t, result.GeneratedFeatures, 3)
		assert.Equal(t, 0.4, result.FeatureImportance["income"])
	})

	t.Run("Explain Prediction", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/explain", r.URL.Path)

			var requestBody ml.ExplanationRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Len(t, requestBody.InputData, 1)

			explanationResult := ml.ExplanationResult{
				GlobalImportance: map[string]float64{
					"income": 0.45,
					"age":    0.35,
					"usage":  0.20,
				},
				LocalExplanations: []ml.LocalExplanation{
					{
						Prediction: 0.8,
						Features: map[string]float64{
							"income": 0.5,
							"age":    0.2,
							"usage":  0.1,
						},
					},
				},
				SHAPValues: [][]float64{{0.1, -0.05, 0.3}},
				LIMEExplanation: "High income (+0.5) and usage (+0.3) increase churn probability",
			}

			response := common.APIResponse{
				Success: true,
				Data:    explanationResult,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		explainRequest := ml.ExplanationRequest{
			InputData: []map[string]interface{}{
				{"age": 25, "income": 50000, "usage": 120},
			},
		}

		result, err := mlClient.ExplainPrediction(context.Background(), "pipeline-123", explainRequest)
		require.NoError(t, err)
		
		assert.Equal(t, 0.45, result.GlobalImportance["income"])
		assert.Len(t, result.LocalExplanations, 1)
		assert.Len(t, result.SHAPValues[0], 3)
	})

	t.Run("Model Monitoring", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/monitoring", r.URL.Path)

			monitoringMetrics := ml.MonitoringMetrics{
				DriftDetection: ml.DriftMetrics{
					FeatureDrift: map[string]float64{
						"income": 0.15,
						"age":    0.05,
					},
					PredictionDrift: 0.08,
					DriftThreshold:  0.1,
				},
				PerformanceMetrics: ml.ModelMetrics{
					Accuracy:  0.89,
					Precision: 0.86,
					Recall:    0.92,
					F1Score:   0.89,
				},
				Alerts: []ml.Alert{
					{Type: "feature_drift", Feature: "income", Severity: "medium"},
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    monitoringMetrics,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		metrics, err := mlClient.GetModelMonitoring(context.Background(), "pipeline-123")
		require.NoError(t, err)
		
		assert.Equal(t, 0.15, metrics.DriftDetection.FeatureDrift["income"])
		assert.Equal(t, 0.89, metrics.PerformanceMetrics.Accuracy)
		assert.Len(t, metrics.Alerts, 1)
	})

	t.Run("Incremental Learning", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/ml/pipelines/pipeline-123/incremental", r.URL.Path)

			var requestBody ml.IncrementalTrainingRequest
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.True(t, requestBody.Incremental)
			assert.Equal(t, "v1.0", requestBody.BaseModelVersion)

			incrementalJob := ml.TrainingJob{
				JobID:        "incremental-job-123",
				PipelineID:   "pipeline-123",
				Status:       "running",
				Progress:     map[string]interface{}{"current_epoch": 5, "total_epochs": 10},
				StartedAt:    time.Now().Format(time.RFC3339),
				TrainingType: "incremental",
			}

			response := common.APIResponse{
				Success: true,
				Data:    incrementalJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		incrementalRequest := ml.IncrementalTrainingRequest{
			Incremental:      true,
			BaseModelVersion: "v1.0",
			LearningRate:     0.001,
			Epochs:           10,
			NewData:          "incremental-dataset-123",
		}

		job, err := mlClient.IncrementalTraining(context.Background(), "pipeline-123", incrementalRequest)
		require.NoError(t, err)
		
		assert.Equal(t, "incremental-job-123", job.JobID)
		assert.Equal(t, "incremental", job.TrainingType)
	})
}

func TestErrorHandling(t *testing.T) {
	t.Run("Pipeline Not Found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(common.APIError{
				Success: false,
				Message: "Pipeline not found",
				Code:    "PIPELINE_NOT_FOUND",
			})
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		_, err := mlClient.GetPipeline(context.Background(), "nonexistent-pipeline")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Pipeline not found")
	})

	t.Run("Training Failure", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(common.APIError{
				Success: false,
				Message: "Training failed: insufficient memory",
				Code:    "TRAINING_FAILED",
			})
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		trainingRequest := ml.TrainingRequest{
			TrainingData: "dataset-123",
		}

		_, err := mlClient.TrainModel(context.Background(), "pipeline-123", trainingRequest)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Training failed: insufficient memory")
	})

	t.Run("Invalid Prediction Input", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(common.APIError{
				Success: false,
				Message: "Invalid input features",
				Code:    "INVALID_INPUT",
			})
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		predRequest := ml.PredictionRequest{
			InputData: []map[string]interface{}{
				{"invalid_feature": "value"},
			},
		}

		_, err := mlClient.MakePrediction(context.Background(), "pipeline-123", predRequest)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Invalid input features")
	})
}

func TestPerformanceAndConcurrency(t *testing.T) {
	t.Run("Concurrent Pipeline Operations", func(t *testing.T) {
		requestCount := 0
		mu := sync.Mutex{}
		
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			requestCount++
			currentCount := requestCount
			mu.Unlock()

			pipeline := ml.Pipeline{
				PipelineID:  fmt.Sprintf("concurrent-pipeline-%d", currentCount),
				Name:        fmt.Sprintf("Concurrent Pipeline %d", currentCount),
				ModelType:   "random_forest",
				Status:      "active",
				CreatedAt:   time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    pipeline,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		const concurrentRequests = 20
		
		var wg sync.WaitGroup
		results := make([]*ml.Pipeline, concurrentRequests)
		errors := make([]error, concurrentRequests)

		startTime := time.Now()

		for i := 0; i < concurrentRequests; i++ {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()
				pipeline, err := mlClient.GetPipeline(context.Background(), fmt.Sprintf("pipeline-%d", index))
				results[index] = pipeline
				errors[index] = err
			}(i)
		}

		wg.Wait()
		duration := time.Since(startTime)

		// All requests should succeed
		for i := 0; i < concurrentRequests; i++ {
			require.NoError(t, errors[i])
			require.NotNil(t, results[i])
		}

		// Should complete within reasonable time
		assert.Less(t, duration, 3*time.Second)
		
		t.Logf("Concurrent ML operations: %d completed in %v", concurrentRequests, duration)
	})

	t.Run("Parallel Model Training", func(t *testing.T) {
		configs := []string{"random_forest", "xgboost", "svm"}
		
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Simulate training time
			time.Sleep(10 * time.Millisecond)

			trainingJob := ml.TrainingJob{
				JobID:      fmt.Sprintf("parallel-train-%d", time.Now().Nanosecond()),
				PipelineID: "pipeline-123",
				Status:     "running",
				Progress:   map[string]interface{}{"current_epoch": 0, "total_epochs": 100},
				StartedAt:  time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    trainingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		mlClient := client.NewMLClient(cfg)
		
		var wg sync.WaitGroup
		results := make([]*ml.TrainingJob, len(configs))
		errors := make([]error, len(configs))

		startTime := time.Now()

		for i, config := range configs {
			wg.Add(1)
			go func(index int, algorithm string) {
				defer wg.Done()
				
				trainingRequest := ml.TrainingRequest{
					TrainingData: "training-set-123",
					Config: map[string]interface{}{
						"algorithm": algorithm,
					},
				}
				
				job, err := mlClient.TrainModel(context.Background(), "pipeline-123", trainingRequest)
				results[index] = job
				errors[index] = err
			}(i, config)
		}

		wg.Wait()
		duration := time.Since(startTime)

		// All should succeed
		for i := 0; i < len(configs); i++ {
			require.NoError(t, errors[i])
			require.NotNil(t, results[i])
		}

		t.Logf("Parallel training: %d models started in %v", len(configs), duration)
	})
}

// Benchmark tests
func BenchmarkMLClient_GetPipeline(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pipeline := ml.Pipeline{
			PipelineID: "benchmark-pipeline",
			Name:       "Benchmark Pipeline",
			ModelType:  "random_forest",
			Status:     "active",
			CreatedAt:  time.Now().Format(time.RFC3339),
		}

		response := common.APIResponse{
			Success: true,
			Data:    pipeline,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	cfg := &config.Config{
		BaseURL: server.URL,
		APIKey:  "test-api-key",
	}

	mlClient := client.NewMLClient(cfg)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := mlClient.GetPipeline(context.Background(), "benchmark-pipeline")
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkMLClient_MakePrediction(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		predictionResult := ml.PredictionResult{
			Predictions: []float64{0.8},
			Confidence:  []float64{0.92},
		}

		response := common.APIResponse{
			Success: true,
			Data:    predictionResult,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	cfg := &config.Config{
		BaseURL: server.URL,
		APIKey:  "test-api-key",
	}

	mlClient := client.NewMLClient(cfg)

	predRequest := ml.PredictionRequest{
		InputData: []map[string]interface{}{
			{"age": 25, "income": 50000},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := mlClient.MakePrediction(context.Background(), "benchmark-pipeline", predRequest)
		if err != nil {
			b.Fatal(err)
		}
	}
}