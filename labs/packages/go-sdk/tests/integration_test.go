package tests

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/client"
	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/igris-inertial/go-sdk/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIntegration runs integration tests against the actual API
// These tests require a valid API key and should only run when explicitly enabled
func TestIntegration(t *testing.T) {
	// Skip integration tests unless explicitly enabled
	if os.Getenv("RUN_INTEGRATION_TESTS") != "true" {
		t.Skip("Integration tests disabled. Set RUN_INTEGRATION_TESTS=true to enable.")
	}

	// Ensure API key is available
	apiKey := os.Getenv("SCHLEP_API_KEY")
	if apiKey == "" {
		t.Skip("SCHLEP_API_KEY environment variable required for integration tests")
	}

	// Create test configuration
	cfg := &config.Config{
		APIKey:           apiKey,
		BaseURL:          getTestBaseURL(),
		EnableMetrics:    true,
		EnableTracing:    true,
		EnableLogging:    true,
		LogLevel:         "debug",
		ServiceName:      "go-sdk-integration-test",
		ServiceVersion:   "1.0.0",
		MaxRetries:       3,
		Timeout:          30 * time.Second,
		CircuitBreakerEnabled: true,
	}

	// Create client
	schlepClient, err := client.NewClient(cfg)
	require.NoError(t, err, "Failed to create client")
	defer schlepClient.Close()

	ctx := context.Background()

	t.Run("Authentication", func(t *testing.T) {
		assert.True(t, schlepClient.IsAuthenticated(), "Client should be authenticated")
	})

	t.Run("Health Check", func(t *testing.T) {
		health, err := schlepClient.Monitor.GetHealth(ctx)
		require.NoError(t, err, "Health check should succeed")
		assert.NotEmpty(t, health.Status, "Health status should not be empty")
		assert.NotZero(t, health.Timestamp, "Health timestamp should be set")
	})

	t.Run("System Metrics", func(t *testing.T) {
		metrics, err := schlepClient.Monitor.GetMetrics(ctx)
		require.NoError(t, err, "Metrics retrieval should succeed")
		assert.NotNil(t, metrics, "Metrics should not be nil")
		assert.NotZero(t, metrics.Timestamp, "Metrics timestamp should be set")
	})

	t.Run("List Jobs", func(t *testing.T) {
		jobs, err := schlepClient.Data.ListJobs(ctx, &models.ListOptions{
			Page:    1,
			PerPage: 10,
		})
		require.NoError(t, err, "List jobs should succeed")
		assert.NotNil(t, jobs, "Jobs response should not be nil")
		assert.True(t, jobs.Success, "Jobs response should be successful")
		assert.GreaterOrEqual(t, jobs.Pagination.Total, 0, "Total jobs should be non-negative")
	})

	t.Run("Process File (if test data available)", func(t *testing.T) {
		// This test is conditional on having test data available
		testDataURL := os.Getenv("TEST_DATA_URL")
		if testDataURL == "" {
			t.Skip("TEST_DATA_URL not provided, skipping file processing test")
		}

		processReq := &models.ProcessFileRequest{
			FileURL:      testDataURL,
			DataFormat:   models.DataFormatCSV,
			OutputFormat: models.DataFormatJSON,
			Async:        true,
			Priority:     5,
			Tags:         []string{"integration-test"},
		}

		result, err := schlepClient.Data.ProcessFile(ctx, processReq)
		require.NoError(t, err, "File processing should succeed")
		assert.NotEmpty(t, result.JobID, "Job ID should be generated")
		assert.True(t, result.Status.IsValid(), "Job status should be valid")

		// Wait a bit and check job status
		time.Sleep(2 * time.Second)
		job, err := schlepClient.Data.GetJobStatus(ctx, result.JobID)
		require.NoError(t, err, "Job status check should succeed")
		assert.Equal(t, result.JobID, job.ID, "Job IDs should match")
	})

	t.Run("ML Pipeline Operations", func(t *testing.T) {
		// Create a simple ML pipeline
		pipeline := &models.MLPipeline{
			Name:        "Integration Test Pipeline",
			Description: stringPtr("Test pipeline created during integration testing"),
			Type:        models.ModelTypeClassification,
			Framework:   models.MLFrameworkScikit,
			Configuration: models.MLPipelineConfig{
				AutoML: true,
			},
			ModelConfig: models.ModelConfiguration{
				Algorithm: "random_forest",
			},
			TrainingConfig: models.TrainingConfiguration{
				TrainTestSplit: 0.8,
				RandomSeed:     intPtr(42),
			},
			ValidationConfig: models.ValidationConfiguration{
				Method:  "holdout",
				Metrics: []string{"accuracy"},
			},
			IsActive: true,
		}

		createdPipeline, err := schlepClient.ML.CreatePipeline(ctx, pipeline)
		if err != nil {
			// ML pipeline creation might not be available in all environments
			t.Logf("ML pipeline creation failed (may not be available): %v", err)
		} else {
			assert.NotEmpty(t, createdPipeline.ID, "Pipeline ID should be generated")
			assert.Equal(t, pipeline.Name, createdPipeline.Name, "Pipeline names should match")

			// List pipelines to verify it was created
			pipelines, err := schlepClient.ML.ListModels(ctx, &models.ListOptions{
				Page:    1,
				PerPage: 10,
			})
			if err == nil {
				assert.NotNil(t, pipelines, "Pipelines list should not be nil")
			}
		}
	})

	t.Run("Error Handling", func(t *testing.T) {
		// Test with invalid job ID
		_, err := schlepClient.Data.GetJobStatus(ctx, "invalid-job-id")
		assert.Error(t, err, "Invalid job ID should return error")

		// Test with malformed request
		invalidReq := &models.ProcessFileRequest{
			// Missing required fields
			DataFormat:   models.DataFormatCSV,
			OutputFormat: models.DataFormatJSON,
		}
		_, err = schlepClient.Data.ProcessFile(ctx, invalidReq)
		assert.Error(t, err, "Invalid request should return error")
	})

	t.Run("Client Configuration", func(t *testing.T) {
		clientConfig := schlepClient.GetConfig()
		assert.Equal(t, cfg.APIKey, clientConfig.APIKey, "API keys should match")
		assert.Equal(t, cfg.BaseURL, clientConfig.BaseURL, "Base URLs should match")
		assert.Equal(t, cfg.ServiceName, clientConfig.ServiceName, "Service names should match")
		assert.True(t, clientConfig.EnableMetrics, "Metrics should be enabled")
		assert.True(t, clientConfig.EnableTracing, "Tracing should be enabled")
	})

	t.Run("Observability Components", func(t *testing.T) {
		// Test logger
		logger := schlepClient.GetLogger()
		assert.NotNil(t, logger, "Logger should be available")
		assert.True(t, logger.IsDebugEnabled(), "Debug logging should be enabled")

		// Test metrics collector
		metrics := schlepClient.GetMetrics()
		assert.NotNil(t, metrics, "Metrics collector should be available")
		assert.True(t, metrics.IsEnabled(), "Metrics should be enabled")

		// Test tracer
		tracer := schlepClient.GetTracer()
		assert.NotNil(t, tracer, "Tracer should be available")
		assert.True(t, tracer.IsEnabled(), "Tracing should be enabled")
	})
}

// TestClientLifecycle tests the full lifecycle of a client
func TestClientLifecycle(t *testing.T) {
	cfg := &config.Config{
		APIKey:      "test-api-key",
		BaseURL:     "https://api.igris-inertial.com",
		ServiceName: "lifecycle-test",
		Timeout:     10 * time.Second,
	}

	// Create client
	schlepClient, err := client.NewClient(cfg)
	require.NoError(t, err, "Client creation should succeed")

	// Test client is properly initialized
	assert.NotNil(t, schlepClient.GetConfig(), "Config should be available")
	assert.NotNil(t, schlepClient.GetLogger(), "Logger should be available")
	assert.NotNil(t, schlepClient.GetMetrics(), "Metrics should be available")
	assert.NotNil(t, schlepClient.GetTracer(), "Tracer should be available")

	// Test API clients are initialized
	assert.NotNil(t, schlepClient.Data, "Data client should be available")
	assert.NotNil(t, schlepClient.ML, "ML client should be available")
	assert.NotNil(t, schlepClient.Storage, "Storage client should be available")
	assert.NotNil(t, schlepClient.Monitor, "Monitor client should be available")
	assert.NotNil(t, schlepClient.Auth, "Auth client should be available")

	// Test authentication status
	assert.True(t, schlepClient.IsAuthenticated(), "Client should be authenticated with API key")

	// Test graceful shutdown
	err = schlepClient.Close()
	assert.NoError(t, err, "Client shutdown should succeed")

	// Test that client is properly closed
	// Note: In a real implementation, you might want to add a method to check if closed
}

// TestConcurrency tests concurrent usage of the client
func TestConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping concurrency test in short mode")
	}

	cfg := &config.Config{
		APIKey:      "test-api-key",
		BaseURL:     "https://api.igris-inertial.com",
		ServiceName: "concurrency-test",
		Timeout:     10 * time.Second,
	}

	schlepClient, err := client.NewClient(cfg)
	require.NoError(t, err)
	defer schlepClient.Close()

	ctx := context.Background()
	numGoroutines := 10
	results := make(chan error, numGoroutines)

	// Launch multiple goroutines making concurrent requests
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			// Test concurrent health checks
			_, err := schlepClient.Monitor.GetHealth(ctx)
			results <- err
		}(i)
	}

	// Collect results
	for i := 0; i < numGoroutines; i++ {
		err := <-results
		// Note: These might fail due to network/auth issues, but shouldn't panic
		if err != nil {
			t.Logf("Goroutine %d failed: %v", i, err)
		}
	}
}

// Helper functions
func getTestBaseURL() string {
	if url := os.Getenv("SCHLEP_TEST_BASE_URL"); url != "" {
		return url
	}
	return "https://api.igris-inertial.com"
}

func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}