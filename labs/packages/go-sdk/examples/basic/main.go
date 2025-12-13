package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/client"
	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/igris-inertial/go-sdk/pkg/models"
)

func main() {
	// Initialize client with configuration
	cfg := &config.Config{
		APIKey:           os.Getenv("SCHLEP_API_KEY"),
		BaseURL:          "https://api.igris-inertial.com",
		EnableMetrics:    true,
		EnableTracing:    true,
		EnableLogging:    true,
		LogLevel:         "info",
		ServiceName:      "basic-example",
		ServiceVersion:   "1.0.0",
		MaxRetries:       3,
		Timeout:          30 * time.Second,
		CircuitBreakerEnabled: true,
	}

	// Create client
	schlepClient, err := client.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer schlepClient.Close()

	ctx := context.Background()

	// Test authentication
	if !schlepClient.IsAuthenticated() {
		log.Fatal("Client is not authenticated. Please set SCHLEP_API_KEY environment variable.")
	}

	fmt.Println("🚀 Basic Schlep-engine Go SDK Example")
	fmt.Println("=====================================")

	// Example 1: Health Check
	fmt.Println("\n1. Health Check")
	health, err := schlepClient.Monitor.GetHealth(ctx)
	if err != nil {
		log.Printf("Health check failed: %v", err)
	} else {
		fmt.Printf("   Status: %s\n", health.Status)
		fmt.Printf("   Checks: %d\n", len(health.Checks))
	}

	// Example 2: Process a file
	fmt.Println("\n2. File Processing")
	processReq := &models.ProcessFileRequest{
		FilePath:     "sample-data.csv",
		DataFormat:   models.DataFormatCSV,
		OutputFormat: models.DataFormatJSON,
		Transformations: []models.TransformationRule{
			{
				Name:    "clean_data",
				Type:    "clean",
				Enabled: true,
				Order:   1,
			},
		},
		Priority: 5,
		Async:    true,
	}

	result, err := schlepClient.Data.ProcessFile(ctx, processReq)
	if err != nil {
		log.Printf("File processing failed: %v", err)
	} else {
		fmt.Printf("   Job ID: %s\n", result.JobID)
		fmt.Printf("   Status: %s\n", result.Status)
		fmt.Printf("   Input Records: %d\n", result.InputRecords)
		fmt.Printf("   Output Records: %d\n", result.OutputRecords)
	}

	// Example 3: Monitor job progress
	if result != nil && result.JobID != "" {
		fmt.Println("\n3. Monitor Job Progress")
		fmt.Print("   Waiting for completion")
		
		for {
			job, err := schlepClient.Data.GetJobStatus(ctx, result.JobID)
			if err != nil {
				log.Printf("Failed to get job status: %v", err)
				break
			}

			fmt.Printf(".")
			
			if job.Status.IsCompleted() {
				fmt.Printf("\n   Final Status: %s\n", job.Status)
				fmt.Printf("   Progress: %.1f%%\n", job.Progress)
				if job.ProcessingTime != nil {
					fmt.Printf("   Processing Time: %.2f seconds\n", *job.ProcessingTime)
				}
				break
			}

			time.Sleep(2 * time.Second)
		}
	}

	// Example 4: List recent jobs
	fmt.Println("\n4. List Recent Jobs")
	jobs, err := schlepClient.Data.ListJobs(ctx, &models.ListOptions{
		Page:      1,
		PerPage:   5,
		SortBy:    "created_at",
		SortOrder: "desc",
	})
	if err != nil {
		log.Printf("Failed to list jobs: %v", err)
	} else {
		fmt.Printf("   Total Jobs: %d\n", jobs.Pagination.Total)
		fmt.Printf("   Page: %d of %d\n", jobs.Pagination.Page, jobs.Pagination.TotalPages)
	}

	// Example 5: Get system metrics
	fmt.Println("\n5. System Metrics")
	metrics, err := schlepClient.Monitor.GetMetrics(ctx)
	if err != nil {
		log.Printf("Failed to get metrics: %v", err)
	} else {
		fmt.Printf("   CPU Usage: %.1f%%\n", metrics.System.CPUUsage)
		fmt.Printf("   Memory Usage: %.1f%%\n", metrics.System.MemoryUsage)
		fmt.Printf("   Active Jobs: %d\n", metrics.Jobs.ActiveJobs)
		fmt.Printf("   Requests/sec: %.1f\n", metrics.API.RequestsPerSecond)
	}

	// Example 6: Create ML Pipeline (if available)
	fmt.Println("\n6. ML Pipeline Creation")
	mlPipeline := &models.MLPipeline{
		Name:        "Basic Classification Pipeline",
		Description: stringPtr("A simple classification pipeline for demonstration"),
		Type:        models.ModelTypeClassification,
		Framework:   models.MLFrameworkScikit,
		Configuration: models.MLPipelineConfig{
			AutoML:               true,
			ExperimentTracking:   true,
			HyperparameterTuning: true,
			FeatureSelection:     true,
			CrossValidation:      true,
		},
		ModelConfig: models.ModelConfiguration{
			Algorithm: "random_forest",
			Hyperparameters: map[string]interface{}{
				"n_estimators": 100,
				"max_depth":    10,
			},
		},
		TrainingConfig: models.TrainingConfiguration{
			TrainTestSplit:  0.8,
			ValidationSplit: 0.2,
			RandomSeed:      intPtr(42),
		},
		ValidationConfig: models.ValidationConfiguration{
			Method:               "cross_validation",
			CrossValidationFolds: intPtr(5),
			Metrics:              []string{"accuracy", "precision", "recall", "f1"},
		},
		IsActive: true,
	}

	createdPipeline, err := schlepClient.ML.CreatePipeline(ctx, mlPipeline)
	if err != nil {
		log.Printf("Failed to create ML pipeline: %v", err)
	} else {
		fmt.Printf("   Pipeline ID: %s\n", createdPipeline.ID)
		fmt.Printf("   Pipeline Name: %s\n", createdPipeline.Name)
		fmt.Printf("   Status: %s\n", createdPipeline.Status)
	}

	fmt.Println("\n✅ Basic example completed successfully!")
	fmt.Println("\n📊 SDK Configuration:")
	fmt.Printf("   Service Name: %s\n", cfg.ServiceName)
	fmt.Printf("   Base URL: %s\n", cfg.BaseURL)
	fmt.Printf("   Metrics Enabled: %t\n", cfg.EnableMetrics)
	fmt.Printf("   Tracing Enabled: %t\n", cfg.EnableTracing)
	fmt.Printf("   Circuit Breaker: %t\n", cfg.CircuitBreakerEnabled)
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}