package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/auth"
	"github.com/igris-inertial/go-sdk/pkg/config"
	httpClient "github.com/igris-inertial/go-sdk/pkg/http"
	"github.com/igris-inertial/go-sdk/pkg/models"
	"github.com/igris-inertial/go-sdk/pkg/observability"
	"github.com/igris-inertial/go-sdk/pkg/websocket"
	"go.opentelemetry.io/otel/attribute"
)

// Client is the main Schlep-engine SDK client
type Client struct {
	config          *config.Config
	httpClient      *httpClient.Client
	authManager     *auth.Manager
	logger          *observability.Logger
	metrics         *observability.MetricsCollector
	tracer          *observability.Tracer
	
	// API clients
	Data      *DataClient
	ML        *MLClient
	Storage   *StorageClient
	Monitor   *MonitoringClient
	Auth      *AuthClient
	Analytics *AnalyticsClient
	Document  *DocumentClient
	Quality   *QualityClient
	Users     *UsersClient
	Admin     *AdminClient
	Streaming *websocket.StreamingClient
	
	// Health checks
	healthChecks map[string]func() error
	healthMu     sync.RWMutex
	
	// Lifecycle
	closed bool
	mu     sync.RWMutex
}

// NewClient creates a new Schlep-engine client
func NewClient(cfg *config.Config) (*Client, error) {
	if cfg == nil {
		var err error
		cfg, err = config.LoadConfig()
		if err != nil {
			return nil, fmt.Errorf("failed to load configuration: %w", err)
		}
	}

	// Initialize HTTP client
	httpClient, err := httpClient.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP client: %w", err)
	}

	// Initialize logger
	logger, err := observability.NewLogger(cfg.ServiceName, cfg.ServiceVersion, cfg.LogLevel, cfg.EnableLogging)
	if err != nil {
		return nil, fmt.Errorf("failed to create logger: %w", err)
	}

	// Initialize metrics collector
	metrics := observability.NewMetricsCollector(cfg.ServiceName, cfg.EnableMetrics)

	// Initialize tracer
	tracer, err := observability.NewTracer(observability.TracingConfig{
		Enabled:        cfg.EnableTracing,
		ServiceName:    cfg.ServiceName,
		ServiceVersion: cfg.ServiceVersion,
		SamplingRatio:  1.0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create tracer: %w", err)
	}

	// Create HTTP adapter for auth manager
	httpAdapter := &httpClientAdapter{
		client: httpClient,
		logger: logger,
		tracer: tracer,
	}

	// Initialize auth manager
	authManager := auth.NewManager(cfg.APIKey, httpAdapter)

	// Create main client
	client := &Client{
		config:       cfg,
		httpClient:   httpClient,
		authManager:  authManager,
		logger:       logger,
		metrics:      metrics,
		tracer:       tracer,
		healthChecks: make(map[string]func() error),
	}

	// Initialize API clients
	client.Data = NewDataClient(client)
	client.ML = NewMLClient(client)
	client.Storage = NewStorageClient(client)
	client.Monitor = NewMonitoringClient(client)
	client.Auth = NewAuthClient(client)
	client.Analytics = NewAnalyticsClient(client)
	client.Document = NewDocumentClient(client)
	client.Quality = NewQualityClient(client)
	client.Users = NewUsersClient(client)
	client.Admin = NewAdminClient(client)
	client.Streaming = websocket.NewStreamingClient(cfg, cfg.APIKey)

	// Add default health checks
	client.addDefaultHealthChecks()

	logger.WithFields(map[string]interface{}{
		"base_url":        cfg.BaseURL,
		"service_name":    cfg.ServiceName,
		"service_version": cfg.ServiceVersion,
		"metrics_enabled": cfg.EnableMetrics,
		"tracing_enabled": cfg.EnableTracing,
	}).Info("Schlep-engine client initialized")

	return client, nil
}

// Request makes an authenticated HTTP request
func (c *Client) Request(ctx context.Context, method, path string, body interface{}) (*httpClient.Response, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("client is closed")
	}
	c.mu.RUnlock()

	// Start tracing
	ctx, span := c.tracer.StartHTTPClientSpan(ctx, method, c.config.BaseURL+path)
	defer span.End()

	// Record request metrics
	c.metrics.RecordRequestInFlight(method, path, 1)
	defer c.metrics.RecordRequestInFlight(method, path, -1)

	start := time.Now()

	// Add authentication headers
	authHeaders := c.authManager.GetAuthHeaders()
	if len(authHeaders) > 0 {
		// Set headers on the HTTP client
		for key, value := range authHeaders {
			c.httpClient.(*httpClient.Client).SetHeader(key, value)
		}
	}

	// Make request
	var resp *httpClient.Response
	var err error

	switch method {
	case "GET":
		resp, err = c.httpClient.Get(ctx, path)
	case "POST":
		resp, err = c.httpClient.Post(ctx, path, body)
	case "PUT":
		resp, err = c.httpClient.Put(ctx, path, body)
	case "PATCH":
		resp, err = c.httpClient.Patch(ctx, path, body)
	case "DELETE":
		resp, err = c.httpClient.Delete(ctx, path)
	default:
		err = fmt.Errorf("unsupported HTTP method: %s", method)
	}

	duration := time.Since(start)

	// Record metrics
	statusCode := 0
	if resp != nil {
		statusCode = resp.StatusCode
	} else if err != nil {
		statusCode = 500
	}

	c.metrics.RecordHTTPRequest(method, path, statusCode, duration)

	// Record tracing
	if resp != nil {
		c.tracer.RecordHTTPResponse(span, resp.StatusCode, int64(len(resp.Body)))
	}

	// Log request
	c.logger.LogAPICall(ctx, method, path, statusCode, duration.Seconds()*1000, err)

	if err != nil {
		c.tracer.RecordError(span, err, "HTTP request failed")
		c.metrics.RecordError("http_request", "http_client")
		return nil, err
	}

	return resp, nil
}

// Get makes a GET request
func (c *Client) Get(ctx context.Context, path string) (*httpClient.Response, error) {
	return c.Request(ctx, "GET", path, nil)
}

// Post makes a POST request
func (c *Client) Post(ctx context.Context, path string, body interface{}) (*httpClient.Response, error) {
	return c.Request(ctx, "POST", path, body)
}

// Put makes a PUT request
func (c *Client) Put(ctx context.Context, path string, body interface{}) (*httpClient.Response, error) {
	return c.Request(ctx, "PUT", path, body)
}

// Patch makes a PATCH request
func (c *Client) Patch(ctx context.Context, path string, body interface{}) (*httpClient.Response, error) {
	return c.Request(ctx, "PATCH", path, body)
}

// Delete makes a DELETE request
func (c *Client) Delete(ctx context.Context, path string) (*httpClient.Response, error) {
	return c.Request(ctx, "DELETE", path, nil)
}

// IsAuthenticated checks if the client is authenticated
func (c *Client) IsAuthenticated() bool {
	return c.authManager.IsAuthenticated()
}

// HealthCheck performs a health check and returns HTTP handler
func (c *Client) HealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	// Start tracing
	ctx, span := c.tracer.StartSpan(ctx, "health_check")
	defer span.End()

	healthStatus := &models.HealthStatus{
		Status:    "healthy",
		Timestamp: time.Now(),
		Checks:    make(map[string]models.HealthCheck),
	}

	c.healthMu.RLock()
	checks := make(map[string]func() error)
	for name, check := range c.healthChecks {
		checks[name] = check
	}
	c.healthMu.RUnlock()

	// Run health checks
	overallHealthy := true
	for name, check := range checks {
		start := time.Now()
		err := check()
		duration := time.Since(start)

		checkResult := models.HealthCheck{
			Duration: duration,
		}

		if err != nil {
			checkResult.Status = "unhealthy"
			checkResult.Error = err.Error()
			overallHealthy = false
		} else {
			checkResult.Status = "healthy"
		}

		healthStatus.Checks[name] = checkResult
		
		// Record metrics
		c.metrics.RecordHealthCheck(name, err == nil)
		
		// Log health check
		c.logger.LogHealthCheck(ctx, name, err == nil, duration.Seconds()*1000, err)
	}

	if !overallHealthy {
		healthStatus.Status = "unhealthy"
	}

	// Record overall health
	c.tracer.AddEvent(span, "health_check_completed",
		attribute.Bool("healthy", overallHealthy),
		attribute.Int("check_count", len(checks)),
	)

	// Set response
	w.Header().Set("Content-Type", "application/json")
	if overallHealthy {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	json.NewEncoder(w).Encode(healthStatus)
}

// AddHealthCheck adds a custom health check
func (c *Client) AddHealthCheck(name string, check func() error) {
	c.healthMu.Lock()
	defer c.healthMu.Unlock()
	c.healthChecks[name] = check
}

// addDefaultHealthChecks adds default health checks
func (c *Client) addDefaultHealthChecks() {
	// API connectivity check
	c.AddHealthCheck("api_connectivity", func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		resp, err := c.Get(ctx, "/health")
		if err != nil {
			return fmt.Errorf("API connectivity failed: %w", err)
		}
		
		if resp.StatusCode >= 400 {
			return fmt.Errorf("API returned status %d", resp.StatusCode)
		}
		
		return nil
	})

	// Authentication check
	c.AddHealthCheck("authentication", func() error {
		if !c.authManager.IsAuthenticated() {
			return fmt.Errorf("client is not authenticated")
		}
		
		if c.authManager.IsTokenExpired() {
			return fmt.Errorf("authentication token is expired")
		}
		
		return nil
	})
}

// GetConfig returns the client configuration
func (c *Client) GetConfig() *config.Config {
	return c.config
}

// GetLogger returns the logger instance
func (c *Client) GetLogger() *observability.Logger {
	return c.logger
}

// GetMetrics returns the metrics collector
func (c *Client) GetMetrics() *observability.MetricsCollector {
	return c.metrics
}

// GetTracer returns the tracer instance
func (c *Client) GetTracer() *observability.Tracer {
	return c.tracer
}

// Close closes the client and cleans up resources
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}

	c.closed = true

	// Close HTTP client
	if err := c.httpClient.Close(); err != nil {
		c.logger.WithError(err).Error("Failed to close HTTP client")
	}

	// Close streaming client
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if c.Streaming != nil {
		if err := c.Streaming.Close(ctx); err != nil {
			c.logger.WithError(err).Error("Failed to close streaming client")
		}
	}

	// Close tracer
	if err := c.tracer.Close(ctx); err != nil {
		c.logger.WithError(err).Error("Failed to close tracer")
	}

	// Close auth manager
	c.authManager.Close()

	c.logger.Info("Schlep-engine client closed")
	return nil
}

// httpClientAdapter adapts the HTTP client for the auth manager
type httpClientAdapter struct {
	client *httpClient.Client
	logger *observability.Logger
	tracer *observability.Tracer
}

func (a *httpClientAdapter) Post(ctx context.Context, path string, body interface{}) ([]byte, error) {
	resp, err := a.client.Post(ctx, path, body)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}