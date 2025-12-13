package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/igris-inertial/go-sdk/pkg/client"
	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// CloudNativeService demonstrates advanced cloud-native patterns
type CloudNativeService struct {
	schlepClient *client.Client
	server       *http.Server
	tracer       trace.Tracer
}

// NewCloudNativeService creates a cloud-native service with advanced features
func NewCloudNativeService() (*CloudNativeService, error) {
	// Load configuration with cloud-native defaults
	cfg := loadCloudNativeConfig()

	// Create Schlep-engine client
	schlepClient, err := client.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Schlep-engine client: %w", err)
	}

	// Create OpenTelemetry tracer for distributed tracing
	tracer := otel.Tracer("schlep-cloud-native-service")

	// Create HTTP server with cloud-native configuration
	mux := http.NewServeMux()
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", getEnvOrDefault("PORT", "8080")),
		Handler:      mux,
		ReadTimeout:  time.Duration(getEnvAsInt("READ_TIMEOUT_SECONDS", 30)) * time.Second,
		WriteTimeout: time.Duration(getEnvAsInt("WRITE_TIMEOUT_SECONDS", 30)) * time.Second,
		IdleTimeout:  time.Duration(getEnvAsInt("IDLE_TIMEOUT_SECONDS", 120)) * time.Second,
	}

	service := &CloudNativeService{
		schlepClient: schlepClient,
		server:       server,
		tracer:       tracer,
	}

	// Register cloud-native routes
	service.registerCloudNativeRoutes(mux)

	// Initialize WebSocket streaming if enabled
	if getEnvAsBool("ENABLE_STREAMING", true) {
		if err := service.initializeStreaming(); err != nil {
			schlepClient.GetLogger().WithError(err).Warn("Failed to initialize streaming, continuing without it")
		}
	}

	return service, nil
}

// loadCloudNativeConfig creates configuration optimized for cloud-native environments
func loadCloudNativeConfig() *config.Config {
	return &config.Config{
		// Authentication
		APIKey: getRequiredEnv("SCHLEP_API_KEY"),

		// Connection settings
		BaseURL: getEnvOrDefault("SCHLEP_BASE_URL", "https://api.igris-inertial.com"),
		Timeout: time.Duration(getEnvAsInt("SCHLEP_TIMEOUT_SECONDS", 60)) * time.Second,

		// Retry configuration (important for cloud environments)
		MaxRetries:         getEnvAsInt("SCHLEP_MAX_RETRIES", 5),
		RetryWaitTime:      time.Duration(getEnvAsInt("SCHLEP_RETRY_WAIT_SECONDS", 2)) * time.Second,
		RetryMaxWaitTime:   time.Duration(getEnvAsInt("SCHLEP_RETRY_MAX_WAIT_SECONDS", 30)) * time.Second,
		RetryBackoffFactor: getEnvAsFloat("SCHLEP_RETRY_BACKOFF_FACTOR", 2.0),

		// Circuit breaker (essential for cloud-native resilience)
		CircuitBreakerEnabled:          getEnvAsBool("SCHLEP_CIRCUIT_BREAKER_ENABLED", true),
		CircuitBreakerFailureThreshold: uint32(getEnvAsInt("SCHLEP_CB_FAILURE_THRESHOLD", 5)),
		CircuitBreakerTimeout:          time.Duration(getEnvAsInt("SCHLEP_CB_TIMEOUT_SECONDS", 60)) * time.Second,
		CircuitBreakerMaxRequests:      uint32(getEnvAsInt("SCHLEP_CB_MAX_REQUESTS", 3)),

		// Observability (critical for cloud-native)
		EnableMetrics:      getEnvAsBool("SCHLEP_ENABLE_METRICS", true),
		EnableTracing:      getEnvAsBool("SCHLEP_ENABLE_TRACING", true),
		EnableLogging:      getEnvAsBool("SCHLEP_ENABLE_LOGGING", true),
		LogLevel:          getEnvOrDefault("LOG_LEVEL", "info"),
		ServiceName:       getEnvOrDefault("SERVICE_NAME", "schlep-cloud-native-service"),
		ServiceVersion:    getEnvOrDefault("SERVICE_VERSION", "1.0.0"),

		// HTTP Client (optimized for cloud)
		MaxIdleConns:        getEnvAsInt("SCHLEP_MAX_IDLE_CONNS", 100),
		MaxIdleConnsPerHost: getEnvAsInt("SCHLEP_MAX_IDLE_CONNS_PER_HOST", 10),
		IdleConnTimeout:     time.Duration(getEnvAsInt("SCHLEP_IDLE_CONN_TIMEOUT_SECONDS", 90)) * time.Second,
		DisableKeepAlives:   getEnvAsBool("SCHLEP_DISABLE_KEEP_ALIVES", false),

		// Health checks
		EnableHealthChecks:     getEnvAsBool("SCHLEP_ENABLE_HEALTH_CHECKS", true),
		HealthCheckInterval:    time.Duration(getEnvAsInt("SCHLEP_HEALTH_CHECK_INTERVAL_SECONDS", 30)) * time.Second,
		HealthCheckTimeout:     time.Duration(getEnvAsInt("SCHLEP_HEALTH_CHECK_TIMEOUT_SECONDS", 10)) * time.Second,

		// Rate limiting (client-side protection)
		EnableRateLimit: getEnvAsBool("SCHLEP_ENABLE_RATE_LIMIT", false),
		RateLimit:      getEnvAsInt("SCHLEP_RATE_LIMIT_RPS", 100),
		RateBurst:      getEnvAsInt("SCHLEP_RATE_BURST", 200),

		// User Agent (for monitoring and support)
		UserAgent: fmt.Sprintf("schlep-cloud-native-service/%s (kubernetes)", getEnvOrDefault("SERVICE_VERSION", "1.0.0")),

		// Development settings
		Debug:                getEnvAsBool("DEBUG", false),
		InsecureSkipVerify:   getEnvAsBool("SCHLEP_INSECURE_SKIP_VERIFY", false),
	}
}

// registerCloudNativeRoutes sets up cloud-native optimized routes
func (s *CloudNativeService) registerCloudNativeRoutes(mux *http.ServeMux) {
	// Cloud-native health endpoints
	mux.HandleFunc("/health", s.handleHealthCheck)
	mux.HandleFunc("/health/live", s.handleLivenessProbe)
	mux.HandleFunc("/health/ready", s.handleReadinessProbe)
	mux.HandleFunc("/health/startup", s.handleStartupProbe)

	// Observability endpoints
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/debug/config", s.handleDebugConfig)
	mux.HandleFunc("/debug/sdk-info", s.handleSDKInfo)

	// Business API endpoints with cloud-native patterns
	mux.HandleFunc("/api/v1/data/investigations", s.handleDataInvestigations)
	mux.HandleFunc("/api/v1/data/investigations/", s.handleDataInvestigationByID)
	mux.HandleFunc("/api/v1/data/jobs", s.handleProcessingJobs)
	mux.HandleFunc("/api/v1/data/jobs/", s.handleProcessingJobByID)
	mux.HandleFunc("/api/v1/streaming/events", s.handleStreamingEvents)

	// Add cloud-native specific health checks
	s.addCloudNativeHealthChecks()
}

// initializeStreaming sets up WebSocket streaming for real-time events
func (s *CloudNativeService) initializeStreaming() error {
	ctx := context.Background()

	// Connect to streaming with automatic reconnection
	if err := s.schlepClient.Streaming.ConnectWithReconnect(ctx); err != nil {
		return fmt.Errorf("failed to connect to streaming: %w", err)
	}

	// Subscribe to relevant event channels
	channels := []string{"data.processing", "jobs.status", "system.health"}
	for _, channel := range channels {
		if err := s.schlepClient.Streaming.Subscribe(ctx, channel); err != nil {
			s.schlepClient.GetLogger().WithError(err).WithFields(map[string]interface{}{
				"channel": channel,
			}).Warn("Failed to subscribe to channel")
		}
	}

	// Register event handlers
	s.schlepClient.Streaming.On(models.EventTypeJobCreated, s.handleJobCreatedEvent)
	s.schlepClient.Streaming.On(models.EventTypeJobCompleted, s.handleJobCompletedEvent)
	s.schlepClient.Streaming.On(models.EventTypeJobFailed, s.handleJobFailedEvent)
	s.schlepClient.Streaming.On(models.EventTypeSystemHealth, s.handleSystemHealthEvent)

	s.schlepClient.GetLogger().Info("Streaming initialized successfully")
	return nil
}

// addCloudNativeHealthChecks adds comprehensive health checks for cloud environments
func (s *CloudNativeService) addCloudNativeHealthChecks() {
	// Kubernetes readiness check - checks if service is ready to handle traffic
	s.schlepClient.AddHealthCheck("kubernetes_readiness", func() error {
		// Check if Schlep-engine API is reachable
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := s.schlepClient.Auth.TestConnection(ctx); err != nil {
			return fmt.Errorf("igris-inertial API not reachable: %w", err)
		}

		// Check if streaming is connected (if enabled)
		if getEnvAsBool("ENABLE_STREAMING", true) {
			if !s.schlepClient.Streaming.IsConnected() {
				return fmt.Errorf("streaming connection not available")
			}
		}

		return nil
	})

	// Kubernetes liveness check - checks if service is alive
	s.schlepClient.AddHealthCheck("kubernetes_liveness", func() error {
		// Check if we can authenticate with Schlep-engine
		if !s.schlepClient.IsAuthenticated() {
			return fmt.Errorf("not authenticated with igris-inertial")
		}

		// Check memory usage
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		metrics, err := s.schlepClient.Monitor.GetMetrics(ctx)
		if err != nil {
			return fmt.Errorf("failed to get system metrics: %w", err)
		}

		// Check if system is not in critical state
		if metrics.System.MemoryUsage > 95.0 {
			return fmt.Errorf("memory usage critical: %.1f%%", metrics.System.MemoryUsage)
		}

		return nil
	})

	// Resource availability check
	s.schlepClient.AddHealthCheck("resource_availability", func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		metrics, err := s.schlepClient.Monitor.GetMetrics(ctx)
		if err != nil {
			return fmt.Errorf("failed to get metrics: %w", err)
		}

		// Check resource thresholds
		maxCPU := getEnvAsFloat("HEALTH_CHECK_MAX_CPU", 85.0)
		maxMemory := getEnvAsFloat("HEALTH_CHECK_MAX_MEMORY", 90.0)

		if metrics.System.CPUUsage > maxCPU {
			return fmt.Errorf("CPU usage high: %.1f%% (max: %.1f%%)", metrics.System.CPUUsage, maxCPU)
		}

		if metrics.System.MemoryUsage > maxMemory {
			return fmt.Errorf("memory usage high: %.1f%% (max: %.1f%%)", metrics.System.MemoryUsage, maxMemory)
		}

		return nil
	})

	// Circuit breaker health check
	s.schlepClient.AddHealthCheck("circuit_breaker", func() error {
		// In a real implementation, you'd check the circuit breaker state
		// For now, we'll just return healthy
		return nil
	})
}

// Cloud-native health check handlers (Kubernetes probes)

func (s *CloudNativeService) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	s.schlepClient.HealthCheck(w, r)
}

func (s *CloudNativeService) handleLivenessProbe(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "liveness_probe")
	defer span.End()

	// Simple liveness check - is the service process alive?
	span.SetAttributes(attribute.String("probe.type", "liveness"))
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "alive",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *CloudNativeService) handleReadinessProbe(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "readiness_probe")
	defer span.End()

	span.SetAttributes(attribute.String("probe.type", "readiness"))

	// Check if service is ready to handle traffic
	if !s.schlepClient.IsAuthenticated() {
		span.SetAttributes(attribute.Bool("ready", false))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "not_ready",
			"reason": "not_authenticated",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
		return
	}

	// Quick API connectivity check
	testCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := s.schlepClient.Auth.TestConnection(testCtx); err != nil {
		span.SetAttributes(attribute.Bool("ready", false))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "not_ready",
			"reason": "api_unreachable",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
		return
	}

	span.SetAttributes(attribute.Bool("ready", true))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ready",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *CloudNativeService) handleStartupProbe(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "startup_probe")
	defer span.End()

	span.SetAttributes(attribute.String("probe.type", "startup"))

	// Check if service has completed startup
	// For this example, we'll check if we can authenticate and get basic metrics
	if !s.schlepClient.IsAuthenticated() {
		span.SetAttributes(attribute.Bool("started", false))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "starting",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
		return
	}

	span.SetAttributes(attribute.Bool("started", true))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "started",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// Business API handlers with cloud-native patterns

func (s *CloudNativeService) handleDataInvestigations(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "handle_data_investigations")
	defer span.End()

	span.SetAttributes(attribute.String("http.method", r.Method))

	switch r.Method {
	case http.MethodGet:
		s.listDataInvestigations(w, r.WithContext(ctx))
	case http.MethodPost:
		s.createDataInvestigation(w, r.WithContext(ctx))
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *CloudNativeService) listDataInvestigations(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "list_data_investigations")
	defer span.End()

	// Extract query parameters
	workspaceID := r.URL.Query().Get("workspace_id")
	
	var workspacePtr *string
	if workspaceID != "" {
		workspacePtr = &workspaceID
		span.SetAttributes(attribute.String("workspace_id", workspaceID))
	}

	// List investigations
	investigations, err := s.schlepClient.Data.ListDataInvestigations(ctx, workspacePtr, nil)
	if err != nil {
		span.RecordError(err)
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to list data investigations")
		http.Error(w, fmt.Sprintf("Failed to list investigations: %v", err), http.StatusInternalServerError)
		return
	}

	span.SetAttributes(attribute.Int("investigation_count", len(investigations)))

	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"success": true,
		"investigations": investigations,
		"count": len(investigations),
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to encode response")
	}
}

func (s *CloudNativeService) createDataInvestigation(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "create_data_investigation")
	defer span.End()

	var req models.DataInvestigationCreate
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		span.RecordError(err)
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	span.SetAttributes(
		attribute.String("investigation.name", req.Name),
		attribute.String("workspace_id", req.WorkspaceID.String()),
	)

	// Create investigation
	investigation, err := s.schlepClient.Data.CreateDataInvestigation(ctx, &req)
	if err != nil {
		span.RecordError(err)
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to create data investigation")
		http.Error(w, fmt.Sprintf("Failed to create investigation: %v", err), http.StatusInternalServerError)
		return
	}

	span.SetAttributes(attribute.String("investigation.id", investigation.ID.String()))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	response := map[string]interface{}{
		"success": true,
		"investigation": investigation,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		s.schlepClient.GetLogger().WithContext(ctx).WithError(err).Error("Failed to encode response")
	}
}

// WebSocket event handlers

func (s *CloudNativeService) handleJobCreatedEvent(event *models.Event) error {
	s.schlepClient.GetLogger().WithFields(map[string]interface{}{
		"event_type": event.Type,
		"job_id":     event.JobID,
		"source":     event.Source,
	}).Info("Job created event received")

	// In a real application, you might:
	// - Update a cache
	// - Send notifications
	// - Update metrics
	// - Trigger other workflows

	return nil
}

func (s *CloudNativeService) handleJobCompletedEvent(event *models.Event) error {
	s.schlepClient.GetLogger().WithFields(map[string]interface{}{
		"event_type": event.Type,
		"job_id":     event.JobID,
		"source":     event.Source,
	}).Info("Job completed event received")

	// Record custom metrics
	s.schlepClient.GetMetrics().RecordCustomMetric(
		context.Background(),
		"job_completed_events_total",
		1,
		[]attribute.KeyValue{
			attribute.String("source", event.Source),
		},
	)

	return nil
}

func (s *CloudNativeService) handleJobFailedEvent(event *models.Event) error {
	s.schlepClient.GetLogger().WithFields(map[string]interface{}{
		"event_type": event.Type,
		"job_id":     event.JobID,
		"source":     event.Source,
	}).Warn("Job failed event received")

	// Record custom metrics
	s.schlepClient.GetMetrics().RecordCustomMetric(
		context.Background(),
		"job_failed_events_total",
		1,
		[]attribute.KeyValue{
			attribute.String("source", event.Source),
		},
	)

	return nil
}

func (s *CloudNativeService) handleSystemHealthEvent(event *models.Event) error {
	s.schlepClient.GetLogger().WithFields(map[string]interface{}{
		"event_type": event.Type,
		"source":     event.Source,
	}).Debug("System health event received")

	return nil
}

// Debug and monitoring handlers

func (s *CloudNativeService) handleDebugConfig(w http.ResponseWriter, r *http.Request) {
	if !getEnvAsBool("DEBUG", false) {
		http.Error(w, "Debug mode not enabled", http.StatusForbidden)
		return
	}

	config := s.schlepClient.GetConfig()
	
	// Create a safe version of config without sensitive data
	safeConfig := map[string]interface{}{
		"base_url":            config.BaseURL,
		"timeout":            config.Timeout.String(),
		"max_retries":        config.MaxRetries,
		"enable_metrics":     config.EnableMetrics,
		"enable_tracing":     config.EnableTracing,
		"enable_logging":     config.EnableLogging,
		"service_name":       config.ServiceName,
		"service_version":    config.ServiceVersion,
		"circuit_breaker_enabled": config.CircuitBreakerEnabled,
		"has_api_key":        config.APIKey != "",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(safeConfig)
}

func (s *CloudNativeService) handleSDKInfo(w http.ResponseWriter, r *http.Request) {
	info := config.GetSDKInfo()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

func (s *CloudNativeService) handleStreamingEvents(w http.ResponseWriter, r *http.Request) {
	// Simple endpoint to check streaming status
	w.Header().Set("Content-Type", "application/json")
	
	response := map[string]interface{}{
		"streaming_enabled": getEnvAsBool("ENABLE_STREAMING", true),
		"connected": s.schlepClient.Streaming.IsConnected(),
	}
	
	json.NewEncoder(w).Encode(response)
}

// Placeholder handlers for processing jobs
func (s *CloudNativeService) handleProcessingJobs(w http.ResponseWriter, r *http.Request) {
	// Implementation would be similar to data investigations
	http.Error(w, "Not implemented", http.StatusNotImplemented)
}

func (s *CloudNativeService) handleProcessingJobByID(w http.ResponseWriter, r *http.Request) {
	// Implementation would extract ID from path and handle CRUD operations
	http.Error(w, "Not implemented", http.StatusNotImplemented)
}

func (s *CloudNativeService) handleDataInvestigationByID(w http.ResponseWriter, r *http.Request) {
	// Implementation would extract ID from path and handle CRUD operations
	http.Error(w, "Not implemented", http.StatusNotImplemented)
}

// Service lifecycle methods

func (s *CloudNativeService) Start() error {
	logger := s.schlepClient.GetLogger()
	
	logger.WithFields(map[string]interface{}{
		"service_name":    s.schlepClient.GetConfig().ServiceName,
		"service_version": s.schlepClient.GetConfig().ServiceVersion,
		"addr":            s.server.Addr,
		"pid":             os.Getpid(),
		"kubernetes":      os.Getenv("KUBERNETES_SERVICE_HOST") != "",
	}).Info("Starting cloud-native service")

	// Start server
	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.WithError(err).Fatal("HTTP server failed")
		}
	}()

	logger.Info("Cloud-native service started successfully")
	return nil
}

func (s *CloudNativeService) Stop() error {
	logger := s.schlepClient.GetLogger()
	
	logger.Info("Shutting down cloud-native service...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := s.server.Shutdown(ctx); err != nil {
		logger.WithError(err).Error("Failed to shutdown HTTP server")
		return err
	}

	// Close Schlep-engine client (includes streaming)
	if err := s.schlepClient.Close(); err != nil {
		logger.WithError(err).Error("Failed to close Schlep-engine client")
		return err
	}

	logger.Info("Cloud-native service stopped successfully")
	return nil
}

func main() {
	// Validate required environment variables
	if err := validateRequiredEnv(); err != nil {
		log.Fatalf("Environment validation failed: %v", err)
	}

	// Create service
	service, err := NewCloudNativeService()
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}

	// Start service
	if err := service.Start(); err != nil {
		log.Fatalf("Failed to start service: %v", err)
	}

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Print startup information
	fmt.Printf("🚀 Schlep-engine Cloud-Native Service\n")
	fmt.Printf("   Service: %s v%s\n", 
		getEnvOrDefault("SERVICE_NAME", "schlep-cloud-native-service"),
		getEnvOrDefault("SERVICE_VERSION", "1.0.0"))
	fmt.Printf("   Port: %s\n", getEnvOrDefault("PORT", "8080"))
	fmt.Printf("   PID: %d\n", os.Getpid())
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		fmt.Printf("   Environment: Kubernetes\n")
		fmt.Printf("   Namespace: %s\n", getEnvOrDefault("KUBERNETES_NAMESPACE", "default"))
		fmt.Printf("   Pod: %s\n", getEnvOrDefault("HOSTNAME", "unknown"))
	}
	
	fmt.Println("\n📊 Cloud-Native Endpoints:")
	fmt.Println("   GET  /health               - Comprehensive health check")
	fmt.Println("   GET  /health/live          - Liveness probe (Kubernetes)")
	fmt.Println("   GET  /health/ready         - Readiness probe (Kubernetes)")  
	fmt.Println("   GET  /health/startup       - Startup probe (Kubernetes)")
	fmt.Println("   GET  /metrics              - Prometheus metrics")
	fmt.Println("   GET  /debug/config         - Configuration (debug mode)")
	fmt.Println("   GET  /debug/sdk-info       - SDK information")
	
	fmt.Println("\n🔗 Business API Endpoints:")
	fmt.Println("   GET  /api/v1/data/investigations        - List data investigations")
	fmt.Println("   POST /api/v1/data/investigations        - Create data investigation")
	fmt.Println("   GET  /api/v1/streaming/events          - Streaming status")
	
	if getEnvAsBool("ENABLE_STREAMING", true) {
		fmt.Println("\n📡 Real-time Streaming: ENABLED")
	} else {
		fmt.Println("\n📡 Real-time Streaming: DISABLED")
	}
	
	fmt.Println("\n🛑 Send SIGTERM or SIGINT to shutdown gracefully...")

	// Wait for shutdown signal
	<-sigChan

	// Graceful shutdown
	fmt.Println("\n🔄 Shutting down gracefully...")
	if err := service.Stop(); err != nil {
		log.Printf("Shutdown error: %v", err)
		os.Exit(1)
	}

	fmt.Println("✅ Service stopped successfully")
}

// Environment helper functions

func getRequiredEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return value
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func validateRequiredEnv() error {
	required := []string{"SCHLEP_API_KEY"}
	
	for _, key := range required {
		if os.Getenv(key) == "" {
			return fmt.Errorf("required environment variable %s is not set", key)
		}
	}
	
	return nil
}