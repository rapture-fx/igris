package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/client"
	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/igris-inertial/go-sdk/pkg/models/common"
	"github.com/igris-inertial/go-sdk/pkg/models/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDataProcessingClient(t *testing.T) {
	t.Run("Process File Success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/data/process", r.URL.Path)
			assert.Contains(t, r.Header.Get("Content-Type"), "multipart/form-data")

			processingJob := data.ProcessingJob{
				JobID:     "job-123",
				Status:    "running",
				Progress:  map[string]interface{}{"current": 50, "total": 100},
				CreatedAt: time.Now().Format(time.RFC3339),
				Config: data.ProcessingConfig{
					OutputFormat:        data.FormatJSON,
					BatchSize:          1000,
					ParallelProcessing: true,
					QualityChecks:      true,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    processingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		fileContent := strings.NewReader("id,name,value\n1,Alice,100\n2,Bob,200")
		
		config := data.ProcessingConfig{
			OutputFormat: data.FormatJSON,
			BatchSize:    1000,
		}

		job, err := dataClient.ProcessFile(context.Background(), fileContent, "test.csv", config)
		require.NoError(t, err)
		
		assert.Equal(t, "job-123", job.JobID)
		assert.Equal(t, "running", job.Status)
	})

	t.Run("Process Large File with Chunking", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/api/v1/data/upload/initiate":
				response := common.APIResponse{
					Success: true,
					Data:    map[string]interface{}{"upload_id": "upload-123"},
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)

			case "/api/v1/data/upload/complete":
				processingJob := data.ProcessingJob{
					JobID:     "large-job-123",
					Status:    "running",
					Progress:  map[string]interface{}{"current": 0, "total": 100},
					CreatedAt: time.Now().Format(time.RFC3339),
				}

				response := common.APIResponse{
					Success: true,
					Data:    processingJob,
				}

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)

			default:
				if strings.Contains(r.URL.Path, "/api/v1/data/upload/upload-123/chunk/") {
					response := common.APIResponse{
						Success: true,
						Data:    map[string]interface{}{"chunk_uploaded": true},
					}
					w.Header().Set("Content-Type", "application/json")
					json.NewEncoder(w).Encode(response)
				}
			}
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		// Create large content (>100MB)
		largeContent := strings.Repeat("large data content\n", 6*1024*1024) // ~114MB
		fileReader := strings.NewReader(largeContent)
		
		config := data.ProcessingConfig{
			OutputFormat: data.FormatJSON,
		}

		job, err := dataClient.ProcessFile(context.Background(), fileReader, "large.csv", config)
		require.NoError(t, err)
		
		assert.Equal(t, "large-job-123", job.JobID)
		assert.Equal(t, "running", job.Status)
	})

	t.Run("Get Job Status", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/data/jobs/job-123", r.URL.Path)

			processingJob := data.ProcessingJob{
				JobID:              "job-123",
				Status:             "completed",
				Progress:           map[string]interface{}{"current": 100, "total": 100},
				CreatedAt:          time.Now().Add(-time.Hour).Format(time.RFC3339),
				CompletedAt:        time.Now().Format(time.RFC3339),
				EstimatedCompletion: time.Now().Add(time.Minute).Format(time.RFC3339),
				Result: &data.ProcessingResult{
					OutputURL: "https://storage.com/result.json",
					QualityMetrics: &data.QualityMetrics{
						Completeness: 0.95,
						Accuracy:     0.98,
						Consistency:  0.92,
					},
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    processingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		job, err := dataClient.GetJobStatus(context.Background(), "job-123")
		require.NoError(t, err)
		
		assert.Equal(t, "job-123", job.JobID)
		assert.Equal(t, "completed", job.Status)
		assert.NotNil(t, job.Result)
		assert.Equal(t, 0.95, job.Result.QualityMetrics.Completeness)
	})

	t.Run("Wait for Completion", func(t *testing.T) {
		callCount := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			callCount++
			
			var status string
			var progress map[string]interface{}
			var result *data.ProcessingResult

			switch callCount {
			case 1:
				status = "running"
				progress = map[string]interface{}{"current": 25, "total": 100}
			case 2:
				status = "running"
				progress = map[string]interface{}{"current": 75, "total": 100}
			default:
				status = "completed"
				progress = map[string]interface{}{"current": 100, "total": 100}
				result = &data.ProcessingResult{
					OutputURL: "https://storage.com/result.json",
					QualityMetrics: &data.QualityMetrics{
						Completeness: 0.95,
						Accuracy:     0.98,
						Consistency:  0.92,
					},
				}
			}

			processingJob := data.ProcessingJob{
				JobID:     "job-123",
				Status:    status,
				Progress:  progress,
				CreatedAt: time.Now().Format(time.RFC3339),
				Result:    result,
			}

			response := common.APIResponse{
				Success: true,
				Data:    processingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		job, err := dataClient.WaitForCompletion(context.Background(), "job-123", data.WaitOptions{
			Timeout:      10 * time.Second,
			PollInterval: 100 * time.Millisecond,
		})
		require.NoError(t, err)
		
		assert.Equal(t, "completed", job.Status)
		assert.NotNil(t, job.Result)
		assert.True(t, callCount >= 3)
	})

	t.Run("Wait for Completion Timeout", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			processingJob := data.ProcessingJob{
				JobID:     "slow-job-123",
				Status:    "running",
				Progress:  map[string]interface{}{"current": 50, "total": 100},
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    processingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		_, err := dataClient.WaitForCompletion(context.Background(), "slow-job-123", data.WaitOptions{
			Timeout:      200 * time.Millisecond,
			PollInterval: 50 * time.Millisecond,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "timeout")
	})

	t.Run("Cancel Job", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/data/jobs/job-123/cancel", r.URL.Path)

			response := common.APIResponse{
				Success: true,
				Message: "Job cancelled successfully",
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		err := dataClient.CancelJob(context.Background(), "job-123")
		require.NoError(t, err)
	})

	t.Run("List Jobs with Pagination", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/data/jobs", r.URL.Path)
			
			query := r.URL.Query()
			assert.Equal(t, "1", query.Get("page"))
			assert.Equal(t, "10", query.Get("per_page"))
			assert.Equal(t, "running", query.Get("status"))

			jobs := []data.ProcessingJob{
				{
					JobID:     "job-1",
					Status:    "running",
					Progress:  map[string]interface{}{"current": 50, "total": 100},
					CreatedAt: time.Now().Format(time.RFC3339),
				},
				{
					JobID:     "job-2",
					Status:    "completed",
					Progress:  map[string]interface{}{"current": 100, "total": 100},
					CreatedAt: time.Now().Add(-time.Hour).Format(time.RFC3339),
				},
			}

			jobsResponse := data.JobsListResponse{
				Jobs: jobs,
				Pagination: common.PaginationInfo{
					Page:    1,
					PerPage: 10,
					Total:   2,
					Pages:   1,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    jobsResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		listOptions := data.JobListOptions{
			Page:    1,
			PerPage: 10,
			Status:  "running",
		}

		result, err := dataClient.ListJobs(context.Background(), listOptions)
		require.NoError(t, err)
		
		assert.Len(t, result.Jobs, 2)
		assert.Equal(t, 1, result.Pagination.Page)
		assert.Equal(t, 2, result.Pagination.Total)
	})

	t.Run("Validate File", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/data/validate", r.URL.Path)

			validationResult := data.ValidationResult{
				IsValid: true,
				Errors:  []string{},
				Warnings: []string{
					"Column 'age' has missing values",
				},
				Suggestions: []string{
					"Consider filling missing values in 'age' column",
				},
			}

			dataSource := data.DataSource{
				SourceID:    "source-123",
				Name:        "test.csv",
				Format:      data.FormatCSV,
				SizeBytes:   1024,
				RowCount:    100,
				ColumnCount: 5,
				CreatedAt:   time.Now().Format(time.RFC3339),
			}

			validationResponse := data.FileValidationResponse{
				Validation: validationResult,
				Source:     dataSource,
			}

			response := common.APIResponse{
				Success: true,
				Data:    validationResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		fileContent := strings.NewReader("id,name,age\n1,Alice,25\n2,Bob,")
		
		result, err := dataClient.ValidateFile(context.Background(), fileContent, "test.csv")
		require.NoError(t, err)
		
		assert.True(t, result.Validation.IsValid)
		assert.Len(t, result.Validation.Warnings, 1)
		assert.Equal(t, "source-123", result.Source.SourceID)
	})

	t.Run("Batch Process Files", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/data/batch-process", r.URL.Path)

			batchJob := data.ProcessingJob{
				JobID:     "batch-job-123",
				Status:    "running",
				Progress:  map[string]interface{}{"current": 0, "total": 3},
				CreatedAt: time.Now().Format(time.RFC3339),
				Config: data.ProcessingConfig{
					OutputFormat: data.FormatJSON,
					BatchSize:    1000,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    batchJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		files := []data.FileInput{
			{Reader: strings.NewReader("id,name\n1,Alice"), Filename: "file1.csv"},
			{Reader: strings.NewReader("id,name\n2,Bob"), Filename: "file2.csv"},
			{Reader: strings.NewReader("id,name\n3,Charlie"), Filename: "file3.csv"},
		}
		
		config := data.ProcessingConfig{
			OutputFormat: data.FormatJSON,
			BatchSize:    1000,
		}

		job, err := dataClient.BatchProcessFiles(context.Background(), files, config)
		require.NoError(t, err)
		
		assert.Equal(t, "batch-job-123", job.JobID)
		assert.Equal(t, "running", job.Status)
	})

	t.Run("Download Result", func(t *testing.T) {
		resultContent := `[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]`
		
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/data/jobs/job-123/result", r.URL.Path)

			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(resultContent))
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		content, err := dataClient.DownloadResult(context.Background(), "job-123")
		require.NoError(t, err)
		
		assert.Equal(t, resultContent, string(content))
	})
}

func TestDataTransformation(t *testing.T) {
	t.Run("Apply Transformations", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/data/transform", r.URL.Path)

			var requestBody map[string]interface{}
			json.NewDecoder(r.Body).Decode(&requestBody)
			
			assert.Equal(t, "source-123", requestBody["source_id"])

			transformJob := data.ProcessingJob{
				JobID:     "transform-job-123",
				Status:    "running",
				Progress:  map[string]interface{}{"current": 0, "total": 100},
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    transformJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		transformConfig := data.TransformationConfig{
			Transformations: []data.Transformation{
				{Type: "normalize", Column: "age"},
				{Type: "encode", Column: "category", Method: "one_hot"},
			},
		}

		job, err := dataClient.ApplyTransformations(context.Background(), "source-123", transformConfig)
		require.NoError(t, err)
		
		assert.Equal(t, "transform-job-123", job.JobID)
		assert.Equal(t, "running", job.Status)
	})

	t.Run("Get Transformation Templates", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/data/transform/templates", r.URL.Path)

			templates := []data.TransformationTemplate{
				{
					ID:          "clean-data",
					Name:        "Data Cleaning",
					Description: "Basic data cleaning pipeline",
					Transformations: []data.Transformation{
						{Type: "remove_nulls"},
						{Type: "deduplicate"},
					},
				},
			}

			templatesResponse := data.TransformationTemplatesResponse{
				Templates: templates,
			}

			response := common.APIResponse{
				Success: true,
				Data:    templatesResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		result, err := dataClient.GetTransformationTemplates(context.Background())
		require.NoError(t, err)
		
		assert.Len(t, result.Templates, 1)
		assert.Equal(t, "Data Cleaning", result.Templates[0].Name)
	})
}

func TestDataQuality(t *testing.T) {
	t.Run("Analyze Data Quality", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/data/quality/analyze", r.URL.Path)

			qualityReport := data.QualityReport{
				OverallScore: 0.85,
				Metrics: data.QualityMetrics{
					Completeness: 0.95,
					Accuracy:     0.80,
					Consistency:  0.90,
					Validity:     0.75,
				},
				Issues: []data.QualityIssue{
					{Column: "age", Issue: "missing_values", Count: 15},
					{Column: "email", Issue: "invalid_format", Count: 3},
				},
				Recommendations: []string{
					"Fill missing age values using median",
					"Validate and correct email formats",
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    qualityReport,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		analysisConfig := data.QualityAnalysisConfig{
			IncludeRecommendations: true,
			DetailedAnalysis:       true,
		}

		report, err := dataClient.AnalyzeDataQuality(context.Background(), "source-123", analysisConfig)
		require.NoError(t, err)
		
		assert.Equal(t, 0.85, report.OverallScore)
		assert.Len(t, report.Issues, 2)
		assert.Len(t, report.Recommendations, 2)
	})

	t.Run("Generate Data Profile", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/data/profile", r.URL.Path)

			profilingReport := data.DataProfile{
				RowCount:    10000,
				ColumnCount: 15,
				Columns: []data.ColumnProfile{
					{
						Name: "age",
						Type: "numeric",
						Stats: map[string]interface{}{
							"min":        18,
							"max":        65,
							"mean":       35.5,
							"median":     34,
							"std_dev":    12.3,
							"null_count": 25,
						},
					},
					{
						Name: "category",
						Type: "categorical",
						Stats: map[string]interface{}{
							"unique_count": 5,
							"most_frequent": "A",
							"frequency_distribution": map[string]int{
								"A": 4000, "B": 3000, "C": 2000, "D": 800, "E": 200,
							},
						},
					},
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    profilingReport,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		profile, err := dataClient.GenerateDataProfile(context.Background(), "source-123")
		require.NoError(t, err)
		
		assert.Equal(t, 10000, profile.RowCount)
		assert.Len(t, profile.Columns, 2)
		assert.Equal(t, "age", profile.Columns[0].Name)
		assert.Equal(t, "numeric", profile.Columns[0].Type)
	})
}

func TestRealTimeProcessing(t *testing.T) {
	t.Run("Start Real-time Processing", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v1/data/stream/start", r.URL.Path)

			streamJob := data.StreamJob{
				StreamID:         "stream-123",
				Status:           "running",
				ProcessedRecords: 1500,
				ErrorCount:       2,
				Throughput:       150.5,
			}

			response := common.APIResponse{
				Success: true,
				Data:    streamJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		streamConfig := data.StreamConfig{
			InputSource:        "kafka://topic",
			OutputDestination:  "s3://bucket/stream-output",
			ProcessingRules: []data.ProcessingRule{
				{Type: "filter", Condition: "age > 18"},
				{Type: "transform", Field: "name", Operation: "uppercase"},
			},
		}

		stream, err := dataClient.StartRealTimeProcessing(context.Background(), streamConfig)
		require.NoError(t, err)
		
		assert.Equal(t, "stream-123", stream.StreamID)
		assert.Equal(t, "running", stream.Status)
		assert.Equal(t, 150.5, stream.Throughput)
	})

	t.Run("Monitor Stream", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/data/stream/stream-123/metrics", r.URL.Path)

			metrics := data.StreamMetrics{
				StreamID:           "stream-123",
				UptimeSeconds:      3600,
				RecordsProcessed:   50000,
				RecordsPerSecond:   13.9,
				ErrorRate:          0.001,
				MemoryUsageMB:      256,
				CPUUsagePercent:    45.2,
			}

			response := common.APIResponse{
				Success: true,
				Data:    metrics,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		metrics, err := dataClient.GetStreamMetrics(context.Background(), "stream-123")
		require.NoError(t, err)
		
		assert.Equal(t, "stream-123", metrics.StreamID)
		assert.Equal(t, 50000, metrics.RecordsProcessed)
		assert.Equal(t, 0.001, metrics.ErrorRate)
	})
}

func TestErrorHandling(t *testing.T) {
	t.Run("File Processing Error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(common.APIError{
				Success: false,
				Message: "Unsupported file format",
				Code:    "UNSUPPORTED_FORMAT",
			})
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		fileContent := strings.NewReader("binary content")
		config := data.ProcessingConfig{OutputFormat: data.FormatJSON}

		_, err := dataClient.ProcessFile(context.Background(), fileContent, "test.bin", config)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Unsupported file format")
	})

	t.Run("Job Not Found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(common.APIError{
				Success: false,
				Message: "Job not found",
				Code:    "JOB_NOT_FOUND",
			})
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		_, err := dataClient.GetJobStatus(context.Background(), "nonexistent-job")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Job not found")
	})

	t.Run("Rate Limiting", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTooManyRequests)
			w.Header().Set("Retry-After", "5")
			json.NewEncoder(w).Encode(common.APIError{
				Success: false,
				Message: "Rate limit exceeded",
				Code:    "RATE_LIMIT_EXCEEDED",
			})
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		fileContent := strings.NewReader("test content")
		config := data.ProcessingConfig{OutputFormat: data.FormatJSON}

		_, err := dataClient.ProcessFile(context.Background(), fileContent, "test.csv", config)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Rate limit exceeded")
	})

	t.Run("Network Error with Retry", func(t *testing.T) {
		attemptCount := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			attemptCount++
			
			if attemptCount < 3 {
				// Simulate network error by closing connection
				hj, ok := w.(http.Hijacker)
				if ok {
					conn, _, _ := hj.Hijack()
					conn.Close()
				}
				return
			}

			// Success on third attempt
			processingJob := data.ProcessingJob{
				JobID:     "retry-job-123",
				Status:    "running",
				Progress:  map[string]interface{}{"current": 0, "total": 100},
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    processingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL:    server.URL,
			APIKey:     "test-api-key",
			MaxRetries: 3,
		}

		dataClient := client.NewDataClient(cfg)
		
		_, err := dataClient.GetJobStatus(context.Background(), "retry-job-123")
		require.NoError(t, err)
		assert.Equal(t, 3, attemptCount)
	})
}

func TestPerformanceAndConcurrency(t *testing.T) {
	t.Run("Concurrent Requests", func(t *testing.T) {
		requestCount := 0
		mu := sync.Mutex{}
		
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			requestCount++
			currentCount := requestCount
			mu.Unlock()

			processingJob := data.ProcessingJob{
				JobID:     fmt.Sprintf("concurrent-job-%d", currentCount),
				Status:    "completed",
				Progress:  map[string]interface{}{"current": 100, "total": 100},
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    processingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		const concurrentRequests = 50
		
		var wg sync.WaitGroup
		results := make([]*data.ProcessingJob, concurrentRequests)
		errors := make([]error, concurrentRequests)

		startTime := time.Now()

		for i := 0; i < concurrentRequests; i++ {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()
				job, err := dataClient.GetJobStatus(context.Background(), fmt.Sprintf("job-%d", index))
				results[index] = job
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
		assert.Less(t, duration, 5*time.Second)
		
		// Calculate requests per second
		rps := float64(concurrentRequests) / duration.Seconds()
		assert.Greater(t, rps, 10.0) // Should achieve at least 10 RPS
		
		t.Logf("Concurrent requests: %d completed in %v (%.2f RPS)", concurrentRequests, duration, rps)
	})

	t.Run("Large File Processing Performance", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Simulate processing time based on content size
			time.Sleep(10 * time.Millisecond)

			processingJob := data.ProcessingJob{
				JobID:     "large-file-job",
				Status:    "running",
				Progress:  map[string]interface{}{"current": 0, "total": 100},
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			response := common.APIResponse{
				Success: true,
				Data:    processingJob,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		dataClient := client.NewDataClient(cfg)
		
		// Create large content (10MB)
		largeContent := strings.Repeat("large data content line\n", 400000)
		fileReader := strings.NewReader(largeContent)
		
		config := data.ProcessingConfig{OutputFormat: data.FormatJSON}

		startTime := time.Now()
		job, err := dataClient.ProcessFile(context.Background(), fileReader, "large.csv", config)
		duration := time.Since(startTime)

		require.NoError(t, err)
		assert.Equal(t, "large-file-job", job.JobID)
		
		// Should handle large file efficiently
		assert.Less(t, duration, 5*time.Second)
		
		t.Logf("Large file processing: %d bytes in %v", len(largeContent), duration)
	})
}

// Benchmark tests
func BenchmarkDataClient_GetJobStatus(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		processingJob := data.ProcessingJob{
			JobID:     "benchmark-job",
			Status:    "completed",
			Progress:  map[string]interface{}{"current": 100, "total": 100},
			CreatedAt: time.Now().Format(time.RFC3339),
		}

		response := common.APIResponse{
			Success: true,
			Data:    processingJob,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	cfg := &config.Config{
		BaseURL: server.URL,
		APIKey:  "test-api-key",
	}

	dataClient := client.NewDataClient(cfg)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := dataClient.GetJobStatus(context.Background(), "benchmark-job")
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkDataClient_ProcessFile(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		processingJob := data.ProcessingJob{
			JobID:     "benchmark-process-job",
			Status:    "running",
			Progress:  map[string]interface{}{"current": 0, "total": 100},
			CreatedAt: time.Now().Format(time.RFC3339),
		}

		response := common.APIResponse{
			Success: true,
			Data:    processingJob,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	cfg := &config.Config{
		BaseURL: server.URL,
		APIKey:  "test-api-key",
	}

	dataClient := client.NewDataClient(cfg)
	config := data.ProcessingConfig{OutputFormat: data.FormatJSON}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		fileContent := strings.NewReader("id,name,value\n1,Alice,100")
		_, err := dataClient.ProcessFile(context.Background(), fileContent, "benchmark.csv", config)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Test utilities
func createMultipartRequest(content string, filename string) (*bytes.Buffer, string, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, "", err
	}

	if _, err := io.Copy(part, strings.NewReader(content)); err != nil {
		return nil, "", err
	}

	if err := writer.Close(); err != nil {
		return nil, "", err
	}

	return &buf, writer.FormDataContentType(), nil
}