import Link from 'next/link'
import { ArrowRightIcon, CloudIcon, CogIcon, ChartBarIcon, ShieldCheckIcon, CommandLineIcon } from '@heroicons/react/24/outline'

export default function GoSDKPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Go SDK</h1>
        <p className="text-xl text-gray-600 mb-6">
          Cloud-native Go SDK optimized for Kubernetes, microservices, and enterprise environments. 
          Built with full observability, resilience patterns, and production-ready features.
        </p>
        
        <div className="flex gap-4">
          <Link
            href="https://pkg.go.dev/github.com/schlep-engine/go-sdk"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Package Documentation
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/schlep-engine/go-sdk"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View on GitHub
          </Link>
        </div>
      </div>

      {/* Installation */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Installation</h2>
        
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <code className="text-green-400">go get github.com/schlep-engine/go-sdk</code>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h3>
            <ul className="text-gray-600 space-y-2">
              <li>• Go 1.21 or later</li>
              <li>• Active Schlep-engine API key</li>
              <li>• Network access to api.schlep-engine.com</li>
            </ul>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Optional Dependencies</h3>
            <ul className="text-gray-600 space-y-2">
              <li>• Prometheus (for metrics)</li>
              <li>• OpenTelemetry (for tracing)</li>
              <li>• Docker/Kubernetes (for deployment)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Start</h2>
        
        <div className="bg-gray-900 rounded-lg p-6 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-100">
{`package main

import (
    "context"
    "log"

    "github.com/schlep-engine/go-sdk/pkg/client"
    "github.com/schlep-engine/go-sdk/pkg/config"
    "github.com/schlep-engine/go-sdk/pkg/models"
)

func main() {
    // Create configuration
    cfg := &config.Config{
        APIKey:                "your-api-key",
        BaseURL:              "https://api.schlep-engine.com",
        EnableMetrics:         true,
        EnableTracing:         true,
        ServiceName:           "my-service",
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
        WorkspaceID:    workspaceID,
        Name:          "My Data Analysis",
        Description:   stringPtr("Analyzing customer data"),
        DataSourceType: &models.DataSourceTypeFile,
    }

    ctx := context.Background()
    result, err := schlepClient.Data.CreateDataInvestigation(ctx, investigation)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Investigation created: %s", result.ID)
}`}
          </pre>
        </div>
      </section>

      {/* Key Features */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Key Features</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <CloudIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cloud-Native</h3>
            <p className="text-gray-600">
              Built specifically for Kubernetes deployments with proper health checks, graceful shutdowns, and container optimization.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <ChartBarIcon className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Full Observability</h3>
            <p className="text-gray-600">
              Integrated metrics (Prometheus), tracing (OpenTelemetry), and structured logging for complete visibility.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <ShieldCheckIcon className="h-8 w-8 text-purple-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Resilience Patterns</h3>
            <p className="text-gray-600">
              Built-in circuit breakers, retries, timeouts, and rate limiting for robust production deployments.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <CogIcon className="h-8 w-8 text-orange-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Context Support</h3>
            <p className="text-gray-600">
              Full Go context propagation for proper cancellation, timeouts, and request tracing across calls.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <CommandLineIcon className="h-8 w-8 text-red-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Streaming</h3>
            <p className="text-gray-600">
              WebSocket support for real-time data processing events with automatic reconnection.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">⚙️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration</h3>
            <p className="text-gray-600">
              Flexible configuration via environment variables, config files, and programmatic settings.
            </p>
          </div>
        </div>
      </section>

      {/* Configuration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Configuration</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Environment Variables</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# Authentication
export SCHLEP_API_KEY="your-api-key"

# Connection
export SCHLEP_BASE_URL="https://api.schlep-engine.com"
export SCHLEP_TIMEOUT_SECONDS="60"

# Retry & Circuit Breaker
export SCHLEP_MAX_RETRIES="5"
export SCHLEP_CIRCUIT_BREAKER_ENABLED="true"

# Observability
export SCHLEP_ENABLE_METRICS="true"
export SCHLEP_ENABLE_TRACING="true"
export LOG_LEVEL="info"
export SERVICE_NAME="my-service"`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Configuration File</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# schlep-engine.yaml
api_key: "your-api-key"
base_url: "https://api.schlep-engine.com"
timeout: 30s
max_retries: 3
circuit_breaker_enabled: true
enable_metrics: true
enable_tracing: true
log_level: "info"
service_name: "my-service"`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* API Clients */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">API Clients</h2>
        
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Processing Client</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`// Process a file
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
status, err := schlepClient.Data.GetDataInvestigation(ctx, investigation.ID.String())`}
              </pre>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">ML Pipeline Client</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`// Create ML pipeline
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
status, err := schlepClient.ML.GetTrainingJob(ctx, trainingJob.JobID)`}
              </pre>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Storage Client</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`// Upload file
upload, err := schlepClient.Storage.UploadFile(ctx, file, "data.csv", nil)

// Download file
data, err := schlepClient.Storage.DownloadFile(ctx, fileID)

// List files
files, err := schlepClient.Storage.ListFiles(ctx, &models.ListOptions{
    Page:    1,
    PerPage: 50,
})`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Kubernetes Integration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Kubernetes Integration</h2>
        
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <pre className="text-sm text-gray-100">
{`apiVersion: apps/v1
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
          periodSeconds: 5`}
          </pre>
        </div>
        
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">🚀 Production Ready</h3>
          <p className="text-orange-800">
            The Go SDK includes built-in health checks, graceful shutdown handling, and metrics endpoints 
            that work seamlessly with Kubernetes probes and service discovery.
          </p>
        </div>
      </section>

      {/* Observability */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Observability</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Metrics</h3>
            <div className="bg-gray-900 rounded p-3 mb-3">
              <code className="text-sm text-green-400">http.Handle("/metrics", promhttp.Handler())</code>
            </div>
            <p className="text-gray-600 text-sm">
              Automatic Prometheus metrics collection for requests, errors, latency, and business metrics.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Tracing</h3>
            <div className="bg-gray-900 rounded p-3 mb-3">
              <code className="text-sm text-green-400">ctx, span := tracer.StartSpan(ctx, "op")</code>
            </div>
            <p className="text-gray-600 text-sm">
              OpenTelemetry integration for distributed tracing across microservices.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Logging</h3>
            <div className="bg-gray-900 rounded p-3 mb-3">
              <code className="text-sm text-green-400">logger.WithContext(ctx).Info("msg")</code>
            </div>
            <p className="text-gray-600 text-sm">
              Structured logging with context propagation and configurable levels.
            </p>
          </div>
        </div>
      </section>

      {/* Error Handling */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Error Handling</h2>
        
        <div className="bg-gray-900 rounded-lg p-6">
          <pre className="text-sm text-gray-100">
{`result, err := client.Data.ProcessFile(ctx, request)
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
}`}
          </pre>
        </div>
      </section>

      {/* Resources */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resources</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Documentation</h3>
            <ul className="space-y-2">
              <li>
                <Link href="https://pkg.go.dev/github.com/schlep-engine/go-sdk" className="text-blue-600 hover:text-blue-700">
                  Go Package Documentation →
                </Link>
              </li>
              <li>
                <Link href="/api-reference" className="text-blue-600 hover:text-blue-700">
                  REST API Reference →
                </Link>
              </li>
              <li>
                <Link href="/guides/best-practices" className="text-blue-600 hover:text-blue-700">
                  Best Practices Guide →
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Examples</h3>
            <ul className="space-y-2">
              <li>
                <Link href="https://github.com/schlep-engine/go-sdk/tree/main/examples/microservice" className="text-blue-600 hover:text-blue-700">
                  Microservice Example →
                </Link>
              </li>
              <li>
                <Link href="https://github.com/schlep-engine/go-sdk/tree/main/examples/cloud-native" className="text-blue-600 hover:text-blue-700">
                  Cloud-Native Example →
                </Link>
              </li>
              <li>
                <Link href="https://github.com/schlep-engine/go-sdk/tree/main/examples/basic" className="text-blue-600 hover:text-blue-700">
                  Basic Usage Examples →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}