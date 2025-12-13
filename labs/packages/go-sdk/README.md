# Schlep-engine Go SDK

[![Go Version](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Go Reference](https://pkg.go.dev/badge/github.com/igris-inertial/go-sdk.svg)](https://pkg.go.dev/github.com/igris-inertial/go-sdk)
[![Go Report Card](https://goreportcard.com/badge/github.com/igris-inertial/go-sdk)](https://goreportcard.com/report/github.com/igris-inertial/go-sdk)

The official Go SDK for [Schlep-engine](https://igris-inertial.com) - a comprehensive cloud-native data processing and ML platform. This SDK is designed specifically for cloud-native applications and microservices, providing robust observability, resilience patterns, and enterprise-grade features.

## 🚀 Features

- **Cloud-Native Ready**: Built for Kubernetes, Docker, and microservices
- **Full Observability**: Metrics (Prometheus), tracing (OpenTelemetry), structured logging
- **Resilience Patterns**: Circuit breakers, retries, timeouts, rate limiting
- **Real-time Streaming**: WebSocket support for real-time data processing events
- **Context Support**: Full Go context propagation for cancellation and timeouts
- **Health Checks**: Comprehensive health monitoring for Kubernetes probes
- **Configuration Management**: Environment variables, config files, and sensible defaults
- **Type Safety**: Comprehensive Go types for all API endpoints and data models

## 📦 Installation

```bash
go get github.com/igris-inertial/go-sdk
```

## 🏃 Quick Start

```go
package main

import (
    "context"
    "log"

    "github.com/igris-inertial/go-sdk/pkg/client"
    "github.com/igris-inertial/go-sdk/pkg/config"
    "github.com/igris-inertial/go-sdk/pkg/models"
)

func main() {
    // Create configuration
    cfg := &config.Config{
        APIKey:                "your-api-key",
        BaseURL:              "https://api.igris-inertial.com",
        EnableMetrics:         true,
        EnableTracing:         true,
        EnableLogging:         true,
        ServiceName:           "my-service",
        ServiceVersion:        "1.0.0",
        CircuitBreakerEnabled: true,
    }

    // Create client
    schlepClient, err := client.NewClient(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer schlepClient.Close()

    // Create a data investigation
    investigation := &models.DataInvestigationCreate{
        WorkspaceID:  workspaceID, // uuid.UUID
        Name:         "My Data Analysis",
        Description:  stringPtr("Analyzing customer data"),
        DataSourceType: &models.DataSourceTypeFile,
    }

    ctx := context.Background()
    result, err := schlepClient.Data.CreateDataInvestigation(ctx, investigation)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Investigation created: %s", result.ID)
}

func stringPtr(s string) *string {
    return &s
}
```

## 📖 Documentation

### Configuration

The SDK can be configured through multiple methods:

#### Environment Variables

```bash
# Authentication
export SCHLEP_API_KEY="your-api-key"

# Connection
export SCHLEP_BASE_URL="https://api.igris-inertial.com"
export SCHLEP_TIMEOUT_SECONDS="60"

# Retry & Circuit Breaker
export SCHLEP_MAX_RETRIES="5"
export SCHLEP_CIRCUIT_BREAKER_ENABLED="true"

# Observability
export SCHLEP_ENABLE_METRICS="true"
export SCHLEP_ENABLE_TRACING="true"
export LOG_LEVEL="info"
export SERVICE_NAME="my-service"
```

#### Configuration File

Create a `igris-inertial.yaml` file:

```yaml
api_key: "your-api-key"
base_url: "https://api.igris-inertial.com"
timeout: 30s
max_retries: 3
circuit_breaker_enabled: true
enable_metrics: true
enable_tracing: true
log_level: "info"
service_name: "my-service"
```

#### Programmatic Configuration

```go
cfg := &config.Config{
    APIKey:                "your-api-key",
    BaseURL:              "https://api.igris-inertial.com",
    Timeout:              30 * time.Second,
    MaxRetries:           3,
    CircuitBreakerEnabled: true,
    EnableMetrics:        true,
    EnableTracing:        true,
    LogLevel:            "info",
    ServiceName:         "my-service",
}
```

### API Clients

The SDK provides several specialized clients:

#### Data Processing Client

```go
// Process a file
result, err := schlepClient.Data.ProcessFile(ctx, &models.ProcessFileRequest{
    FileURL:      "https://example.com/data.csv",
    DataFormat:   models.DataFormatCSV,
    OutputFormat: models.DataFormatJSON,
    Async:        true,
})

// Create data investigation
investigation, err := schlepClient.Data.CreateDataInvestigation(ctx, &models.DataInvestigationCreate{
    WorkspaceID:    workspaceID,
    Name:          "Analysis",
    Description:   stringPtr("Customer data analysis"),
})

// Get investigation status
status, err := schlepClient.Data.GetDataInvestigation(ctx, investigation.ID.String())
```

#### ML Pipeline Client

```go
// Create ML pipeline
pipeline, err := schlepClient.ML.CreatePipeline(ctx, &models.MLPipeline{
    Name:        "Customer Churn Prediction",
    Type:        models.ModelTypeClassification,
    Framework:   models.MLFrameworkScikit,
})

// Train model
trainingJob, err := schlepClient.ML.TrainModel(ctx, &models.TrainingRequest{
    PipelineID:     pipeline.ID,
    DatasetID:      datasetID,
    TargetColumn:   "churn",
})

// Get training status
status, err := schlepClient.ML.GetTrainingJob(ctx, trainingJob.JobID)
```

#### Storage Client

```go
// Upload file
upload, err := schlepClient.Storage.UploadFile(ctx, file, "data.csv", nil)

// Download file
data, err := schlepClient.Storage.DownloadFile(ctx, fileID)

// List files
files, err := schlepClient.Storage.ListFiles(ctx, &models.ListOptions{
    Page:    1,
    PerPage: 50,
})
```

### Real-time Streaming

The SDK supports WebSocket streaming for real-time events:

```go
// Connect to streaming
err := schlepClient.Streaming.ConnectWithReconnect(ctx)
if err != nil {
    log.Fatal(err)
}

// Subscribe to channels
err = schlepClient.Streaming.Subscribe(ctx, "data.processing")
err = schlepClient.Streaming.Subscribe(ctx, "jobs.status")

// Register event handlers
schlepClient.Streaming.On(models.EventTypeJobCompleted, func(event *models.Event) error {
    log.Printf("Job %s completed", event.JobID)
    return nil
})

schlepClient.Streaming.On(models.EventTypeJobFailed, func(event *models.Event) error {
    log.Printf("Job %s failed", event.JobID)
    return nil
})
```

### Health Checks

Perfect for Kubernetes deployments:

```go
// Add custom health checks
schlepClient.AddHealthCheck("database", func() error {
    return checkDatabaseConnection()
})

schlepClient.AddHealthCheck("external_service", func() error {
    return checkExternalService()
})

// Use with HTTP server
http.HandleFunc("/health", schlepClient.HealthCheck)
http.HandleFunc("/health/live", func(w http.ResponseWriter, r *http.Request) {
    // Liveness probe - is the service alive?
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
})
```

### Observability

#### Metrics (Prometheus)

```go
// Metrics are automatically collected
// Expose them via HTTP
http.Handle("/metrics", promhttp.Handler())

// Custom metrics
schlepClient.GetMetrics().RecordCustomMetric(
    ctx,
    "business_events_total",
    1,
    []attribute.KeyValue{
        attribute.String("event_type", "user_signup"),
    },
)
```

#### Distributed Tracing

```go
// Tracing is automatically integrated
// Just use contexts properly
ctx, span := schlepClient.GetTracer().StartSpan(ctx, "business_operation")
defer span.End()

// Add attributes
span.SetAttributes(
    attribute.String("user_id", userID),
    attribute.String("operation", "data_processing"),
)

// Child operations will automatically inherit the trace
result, err := schlepClient.Data.ProcessFile(ctx, request)
```

#### Structured Logging

```go
// Get logger with context
logger := schlepClient.GetLogger()

// Log with fields
logger.WithFields(map[string]interface{}{
    "user_id":    "123",
    "operation":  "data_upload",
    "file_size":  1024,
}).Info("File uploaded successfully")

// Log with context (includes trace IDs)
logger.WithContext(ctx).WithFields(map[string]interface{}{
    "job_id": jobID,
}).Info("Processing started")
```

## 🏗️ Cloud-Native Features

### Kubernetes Integration

The SDK is optimized for Kubernetes deployments:

#### Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        env:
        - name: SCHLEP_API_KEY
          valueFrom:
            secretKeyRef:
              name: schlep-secret
              key: api-key
        - name: SCHLEP_ENABLE_METRICS
          value: "true"
        - name: SERVICE_NAME
          value: "my-app"
        
        # Kubernetes probes
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service Monitor (Prometheus)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
  - port: http
    path: /metrics
```

### Docker Support

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM scratch
COPY --from=builder /app/main /main
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["/main"]
```

## 📊 Examples

### Microservice Example

See the complete microservice example in [`examples/microservice/`](examples/microservice/) which demonstrates:

- HTTP API server with Schlep-engine integration
- Health checks for Kubernetes probes
- Prometheus metrics exposure
- Graceful shutdown
- Configuration management
- Error handling and logging

### Cloud-Native Example

See the advanced cloud-native example in [`examples/cloud-native/`](examples/cloud-native/) featuring:

- Kubernetes-optimized configuration
- Advanced observability (metrics, tracing, logging)
- WebSocket streaming
- Circuit breakers and retries
- Complete Kubernetes manifests
- Docker Compose setup for local development
- Prometheus and Grafana integration

### Simple Data Processing

```go
func processCustomerData(ctx context.Context, client *client.Client) error {
    // Upload data file
    file, err := os.Open("customers.csv")
    if err != nil {
        return err
    }
    defer file.Close()

    upload, err := client.Storage.UploadFile(ctx, file, "customers.csv", nil)
    if err != nil {
        return err
    }

    // Process the file
    result, err := client.Data.ProcessFile(ctx, &models.ProcessFileRequest{
        FilePath:     upload.Path,
        DataFormat:   models.DataFormatCSV,
        OutputFormat: models.DataFormatJSON,
        Transformations: []models.TransformationRule{
            {
                Name:    "remove_pii",
                Type:    "filter",
                Enabled: true,
                Parameters: map[string]interface{}{
                    "exclude_columns": []string{"ssn", "email"},
                },
            },
        },
        Async: true,
    })
    
    if err != nil {
        return err
    }

    // Monitor processing
    for {
        job, err := client.Data.GetJobStatus(ctx, result.JobID)
        if err != nil {
            return err
        }

        if job.Status == models.JobStatusCompleted {
            log.Printf("Processing completed: %+v", job)
            break
        } else if job.Status == models.JobStatusFailed {
            return fmt.Errorf("processing failed: %s", *job.ErrorMessage)
        }

        time.Sleep(5 * time.Second)
    }

    return nil
}
```

## 🔧 Advanced Configuration

### Circuit Breaker

```go
cfg := &config.Config{
    CircuitBreakerEnabled:          true,
    CircuitBreakerFailureThreshold: 5,     // Open after 5 failures
    CircuitBreakerTimeout:          60 * time.Second, // Try again after 60s
    CircuitBreakerMaxRequests:      3,     // Allow 3 requests when half-open
}
```

### Retry Configuration

```go
cfg := &config.Config{
    MaxRetries:         5,
    RetryWaitTime:      2 * time.Second,
    RetryMaxWaitTime:   30 * time.Second,
    RetryBackoffFactor: 2.0, // Exponential backoff
}
```

### HTTP Client Optimization

```go
cfg := &config.Config{
    MaxIdleConns:        100,
    MaxIdleConnsPerHost: 10,
    IdleConnTimeout:     90 * time.Second,
    DisableKeepAlives:   false,
}
```

## 🛡️ Security

### TLS Configuration

```go
cfg := &config.Config{
    InsecureSkipVerify: false, // Always verify TLS certificates in production
}
```

### API Key Management

Store your API key securely:

```bash
# Kubernetes Secret
kubectl create secret generic schlep-secret \
  --from-literal=api-key="your-api-key"

# Environment variable
export SCHLEP_API_KEY="your-api-key"
```

## 🐛 Error Handling

The SDK provides comprehensive error handling:

```go
result, err := client.Data.ProcessFile(ctx, request)
if err != nil {
    // Check for specific error types
    if apiErr, ok := err.(*models.APIError); ok {
        switch apiErr.Code {
        case "QUOTA_EXCEEDED":
            // Handle quota exceeded
        case "INVALID_FORMAT":
            // Handle format error
        default:
            // Handle other API errors
        }
    } else if errors.Is(err, context.DeadlineExceeded) {
        // Handle timeout
    } else {
        // Handle other errors
    }
}
```

## 📈 Performance

### Connection Pooling

The SDK uses connection pooling by default for optimal performance:

```go
cfg := &config.Config{
    MaxIdleConns:        100, // Total idle connections
    MaxIdleConnsPerHost: 10,  // Idle connections per host
    IdleConnTimeout:     90 * time.Second,
}
```

### Batch Operations

Use batch operations for better performance:

```go
// Process multiple files
batchResult, err := client.Data.ProcessBatch(ctx, &models.ProcessBatchRequest{
    Files: []models.ProcessFileRequest{
        {FileURL: "file1.csv", DataFormat: models.DataFormatCSV},
        {FileURL: "file2.csv", DataFormat: models.DataFormatCSV},
    },
    ParallelJobs: 3,
})
```

## 🔍 Debugging

Enable debug mode:

```go
cfg := &config.Config{
    Debug: true, // Enables detailed logging
}

// Or via environment
// DEBUG=true
```

View SDK information:

```go
info := config.GetSDKInfo()
fmt.Printf("SDK Version: %s\n", info["version"])
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: https://docs.igris-inertial.com/sdk/go
- **Support Portal**: https://support.igris-inertial.com
- **GitHub Issues**: https://github.com/igris-inertial/go-sdk/issues
- **Community Discord**: https://discord.gg/igris-inertial

## 🙏 Acknowledgments

Built with ❤️ by the Schlep-engine team for the Go community.

---

**Made for Cloud-Native Applications** | **Enterprise Ready** | **Production Tested**