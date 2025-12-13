package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/igris-inertial/go-sdk/pkg/client"
	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/igris-inertial/go-sdk/pkg/models"
)

// DataProcessingService demonstrates a microservice using Schlep-engine SDK
type DataProcessingService struct {
	schlepClient *client.Client
	server       *http.Server
}

// NewDataProcessingService creates a new data processing service
func NewDataProcessingService() (*DataProcessingService, error) {
	// Load configuration from environment
	cfg := &config.Config{
		APIKey:                os.Getenv("SCHLEP_API_KEY"),
		BaseURL:              getEnvOrDefault("SCHLEP_BASE_URL", "https://api.igris-inertial.com"),
		EnableMetrics:         true,
		EnableTracing:         true,
		EnableLogging:         true,
		LogLevel:              getEnvOrDefault("LOG_LEVEL", "info"),
		ServiceName:           getEnvOrDefault("SERVICE_NAME", "data-processing-microservice"),
		ServiceVersion:        getEnvOrDefault("SERVICE_VERSION", "1.0.0"),
		MaxRetries:            3,
		Timeout:               30 * time.Second,
		CircuitBreakerEnabled: true,
		EnableHealthChecks:    true,
		HealthCheckInterval:   30 * time.Second,
	}

	// Create Schlep-engine client
	schlepClient, err := client.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Schlep-engine client: %w", err)
	}

	// Create HTTP server
	mux := http.NewServeMux()
	server := &http.Server{
		Addr:         getEnvOrDefault("PORT", ":8080"),
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	service := &DataProcessingService{
		schlepClient: schlepClient,
		server:       server,
	}

	// Register routes
	service.registerRoutes(mux)

	return service, nil
}

// registerRoutes sets up HTTP routes for the microservice
func (s *DataProcessingService) registerRoutes(mux *http.ServeMux) {
	// Health check endpoint (using Schlep-engine SDK)
	mux.HandleFunc("/health", s.schlepClient.HealthCheck)

	// Prometheus metrics endpoint
	mux.Handle("/metrics", promhttp.Handler())

	// Business logic endpoints
	mux.HandleFunc("/api/v1/process", s.handleProcessData)
	mux.HandleFunc("/api/v1/jobs/", s.handleGetJob)
	mux.HandleFunc("/api/v1/status", s.handleServiceStatus)

	// Add custom health checks
	s.addCustomHealthChecks()
}

// addCustomHealthChecks adds custom health checks to the Schlep-engine client
func (s *DataProcessingService) addCustomHealthChecks() {
	// Database connectivity check (example)
	s.schlepClient.AddHealthCheck("database", func() error {
		// In a real microservice, you'd check your database connection
		// For this example, we'll just simulate a check
		return nil
	})

	// External service check
	s.schlepClient.AddHealthCheck("external_service", func() error {
		// Check if we can reach another service
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get("https://httpbin.org/status/200")
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		
		if resp.StatusCode >= 400 {
			return fmt.Errorf("external service returned status %d", resp.StatusCode)
		}
		
		return nil
	})

	// Custom business logic check
	s.schlepClient.AddHealthCheck("processing_capacity", func() error {
		// Check if we have processing capacity
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		metrics, err := s.schlepClient.Monitor.GetMetrics(ctx)
		if err != nil {
			return fmt.Errorf("failed to get metrics: %w", err)
		}
		
		// Check if system is not overloaded
		if metrics.System.CPUUsage > 80.0 {
			return fmt.Errorf("CPU usage too high: %.1f%%", metrics.System.CPUUsage)
		}
		
		if metrics.System.MemoryUsage > 85.0 {
			return fmt.Errorf("memory usage too high: %.1f%%", metrics.System.MemoryUsage)
		}
		
		return nil
	})
}

// handleProcessData processes incoming data using Schlep-engine
func (s *DataProcessingService) handleProcessData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	
	// Parse request
	var req struct {
		DataURL         string                        `json:"data_url"`
		DataFormat      models.DataFormat             `json:"data_format"`
		OutputFormat    models.DataFormat             `json:"output_format"`
		Transformations []models.TransformationRule   `json:"transformations"`
		Priority        int                           `json:"priority"`
		Tags            []string                      `json:"tags"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate request
	if req.DataURL == "" {
		http.Error(w, "data_url is required", http.StatusBadRequest)
		return
	}

	// Create processing request
	processReq := &models.ProcessFileRequest{
		FileURL:         req.DataURL,
		DataFormat:      req.DataFormat,
		OutputFormat:    req.OutputFormat,
		Transformations: req.Transformations,
		Priority:        req.Priority,
		Tags:            req.Tags,
		Async:           true, // Always async in microservice
	}

	// Process data using Schlep-engine
	result, err := s.schlepClient.Data.ProcessFile(ctx, processReq)
	if err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to process data")
		http.Error(w, fmt.Sprintf("Processing failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Return response
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"success": true,
		"job_id":  result.JobID,
		"status":  result.Status,
		"message": "Data processing started successfully",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to encode response")
	}

	s.schlepClient.GetLogger().WithContext(ctx).WithFields(map[string]interface{}{
		"job_id":      result.JobID,
		"data_url":    req.DataURL,
		"priority":    req.Priority,
		"client_ip":   r.RemoteAddr,
		"user_agent":  r.UserAgent(),
	}).Info("Data processing request completed")
}

// handleGetJob retrieves job status
func (s *DataProcessingService) handleGetJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract job ID from URL path
	jobID := r.URL.Path[len("/api/v1/jobs/"):]
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Get job status
	job, err := s.schlepClient.Data.GetJobStatus(ctx, jobID)
	if err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to get job status")
		http.Error(w, fmt.Sprintf("Failed to get job: %v", err), http.StatusInternalServerError)
		return
	}

	// Return job information
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"success": true,
		"job":     job,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to encode response")
	}
}

// handleServiceStatus returns service status and metrics
func (s *DataProcessingService) handleServiceStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	// Get system metrics
	metrics, err := s.schlepClient.Monitor.GetMetrics(ctx)
	if err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to get metrics")
		http.Error(w, fmt.Sprintf("Failed to get metrics: %v", err), http.StatusInternalServerError)
		return
	}

	// Get health status
	health, err := s.schlepClient.Monitor.GetHealth(ctx)
	if err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to get health")
		http.Error(w, fmt.Sprintf("Failed to get health: %v", err), http.StatusInternalServerError)
		return
	}

	// Return comprehensive status
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"service": map[string]interface{}{
			"name":    s.schlepClient.GetConfig().ServiceName,
			"version": s.schlepClient.GetConfig().ServiceVersion,
			"status":  "running",
		},
		"health":  health,
		"metrics": metrics,
		"sdk_info": map[string]interface{}{
			"metrics_enabled": s.schlepClient.GetMetrics().IsEnabled(),
			"tracing_enabled": s.schlepClient.GetTracer().IsEnabled(),
			"authenticated":   s.schlepClient.IsAuthenticated(),
		},
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to encode response")
	}
}

// Start starts the microservice
func (s *DataProcessingService) Start() error {
	logger := s.schlepClient.GetLogger()
	
	logger.WithFields(map[string]interface{}{
		"service_name": s.schlepClient.GetConfig().ServiceName,
		"addr":         s.server.Addr,
	}).Info("Starting data processing microservice")

	// Start server in a goroutine
	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.WithError(err).Fatal("Failed to start HTTP server")
		}
	}()

	logger.Info("Data processing microservice started successfully")
	return nil
}

// Stop stops the microservice gracefully
func (s *DataProcessingService) Stop() error {
	logger := s.schlepClient.GetLogger()
	
	logger.Info("Stopping data processing microservice...")

	// Create context with timeout for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := s.server.Shutdown(ctx); err != nil {
		logger.WithError(err).Error("Failed to shutdown HTTP server gracefully")
		return err
	}

	// Close Schlep-engine client
	if err := s.schlepClient.Close(); err != nil {
		logger.WithError(err).Error("Failed to close Schlep-engine client")
		return err
	}

	logger.Info("Data processing microservice stopped successfully")
	return nil
}

func main() {
	// Create service
	service, err := NewDataProcessingService()
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}

	// Start service
	if err := service.Start(); err != nil {
		log.Fatalf("Failed to start service: %v", err)
	}

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	fmt.Printf("🚀 Data Processing Microservice is running on %s\n", service.server.Addr)
	fmt.Println("📊 Available endpoints:")
	fmt.Println("   GET  /health              - Health check")
	fmt.Println("   GET  /metrics             - Prometheus metrics")
	fmt.Println("   POST /api/v1/process      - Process data")
	fmt.Println("   GET  /api/v1/jobs/{id}    - Get job status")
	fmt.Println("   GET  /api/v1/status       - Service status")
	fmt.Println("\n🛑 Press Ctrl+C to stop...")

	// Block until signal received
	<-sigChan

	// Graceful shutdown
	fmt.Println("\n🔄 Shutting down gracefully...")
	if err := service.Stop(); err != nil {
		log.Fatalf("Failed to stop service: %v", err)
	}

	fmt.Println("✅ Service stopped successfully")
}

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}