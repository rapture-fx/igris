# Schlep-Engine SDK Comprehensive Guide

**Version:** 2.0.0
**Last Updated:** 2025-01-10
**Status:** ✅ Production Ready

## Overview

Schlep-engine provides **8 official SDKs** and a **comprehensive CLI tool** for seamless integration across all major programming languages and platforms. All SDKs provide complete feature parity with **10 API modules** covering data processing, machine learning, analytics, document extraction, data quality, storage, monitoring, user management, and administration.

---

## 🌐 Available SDKs

| SDK | Status | Version | Package Name | Documentation |
|-----|--------|---------|--------------|---------------|
| **Python** | ✅ Complete | 2.0.0 | `schlep-engine` | [Python Docs](#python-sdk) |
| **JavaScript/TypeScript** | ✅ Complete | 1.0.0 | `@schlep-engine/sdk` | [JS/TS Docs](#javascript--typescript-sdk) |
| **Ruby** | ✅ Complete | 2.0.0 | `schlep-engine` | [Ruby Docs](#ruby-sdk) |
| **Go** | ✅ Complete | 1.0.0 | `github.com/schlep-engine/go-sdk` | [Go Docs](#go-sdk) |
| **Java** | ✅ Complete | 1.0.0 | `io.schlepengine:schlep-engine-sdk` | [Java Docs](#java-sdk) |
| **Rust** | ✅ Complete | 1.0.0 | `schlep-engine` | [Rust Docs](#rust-sdk) |
| **C#** | ✅ Complete | 1.0.0 | `SchlepEngine.SDK` | [C# Docs](#c-sdk) |
| **CLI** | ✅ Complete | 1.0.0 | `schlep-engine-cli` | [CLI Docs](#cli-tool) |

---

## 📦 API Modules

All SDKs provide access to these 10 API modules:

### Core APIs
1. **Data Processing** - Upload, transform, validate data files
2. **ML Pipeline** - Create pipelines, train models, make predictions
3. **Analytics** - Execute queries, generate reports, manage datasets
4. **Document Extraction** - Extract text, tables, images, perform OCR

### Quality & Storage
5. **Data Quality** - Assess quality, create rules, validate data
6. **Storage** - Upload, download, list, delete files

### Operations
7. **Monitoring** - System health, metrics, alerts
8. **Users** - Profile management, API key operations
9. **Admin** - User management, system statistics (requires admin privileges)
10. **Authentication** - Login, logout, session management

---

## Python SDK

### Installation

```bash
pip install schlep-engine
```

### Quick Start

```python
from schlep_engine import SchlepEngineClient

# Initialize client
client = SchlepEngineClient(api_key="your-api-key")

# Or use environment variable
client = SchlepEngineClient.from_env()  # Uses SCHLEP_API_KEY

# Data Processing
job = client.data.process_file(file_data, format="csv")
print(f"Job ID: {job.job_id}")

# ML Pipeline
pipeline_config = {
    "name": "Fraud Detection",
    "task_type": "classification",
    "model_type": "random_forest"
}
pipeline = client.ml.create_pipeline(pipeline_config)

# Train model
training_config = {"epochs": 10, "batch_size": 32}
training_job = client.ml.train_pipeline(pipeline.pipeline_id, training_config)

# Analytics
query = {"sql": "SELECT * FROM users WHERE created_at > '2024-01-01'"}
results = client.analytics.execute_query(query)

# Document Extraction
with open("document.pdf", "rb") as f:
    text = client.document.extract_text(f.read(), format="pdf")

# Data Quality
assessment = client.quality.assess_quality(job.job_id)
print(f"Quality Score: {assessment.quality_score}")

# Storage
with open("data.csv", "rb") as f:
    file_response = client.storage.upload_file(f.read(), filename="data.csv")

# Monitoring
health = client.monitoring.get_health()
metrics = client.monitoring.get_metrics({"timeRange": "1h"})

# Users
profile = client.users.get_profile()
api_keys = client.users.list_api_keys()

# Admin (requires admin privileges)
users = client.admin.list_users()
stats = client.admin.get_system_stats()
```

### Features
- ✅ Async/await support with `asyncio`
- ✅ Type hints throughout
- ✅ Pydantic models for validation
- ✅ Comprehensive error handling
- ✅ Retry logic with exponential backoff
- ✅ File upload progress tracking
- ✅ Pagination support

---

## JavaScript / TypeScript SDK

### Installation

```bash
npm install @schlep-engine/sdk
# or
yarn add @schlep-engine/sdk
```

### Quick Start

```typescript
import { SchlepEngineClient } from '@schlep-engine/sdk';

// Initialize client
const client = new SchlepEngineClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.schlep-engine.com'
});

// Data Processing
const job = await client.data.processFile(fileBuffer, 'csv');
console.log(`Job ID: ${job.jobId}`);

// ML Pipeline
const pipeline = await client.ml.createPipeline({
  name: 'Fraud Detection',
  taskType: 'classification',
  modelType: 'random_forest'
});

const training = await client.ml.trainPipeline(pipeline.pipelineId, {
  epochs: 10,
  batchSize: 32
});

// Analytics
const results = await client.analytics.executeQuery({
  sql: "SELECT * FROM users WHERE created_at > '2024-01-01'"
});

// Document Extraction
const fileData = await fs.readFile('document.pdf');
const text = await client.document.extractText(fileData, 'pdf');

// Data Quality
const assessment = await client.quality.assessQuality(job.jobId);

// Storage
const uploadResult = await client.storage.uploadFile(fileBuffer, 'data.csv');

// Monitoring
const health = await client.monitoring.getHealth();
const metrics = await client.monitoring.getMetrics({ timeRange: '1h' });

// Users
const profile = await client.users.getProfile();
const apiKeys = await client.users.listApiKeys();

// Admin
const users = await client.admin.listUsers();
const stats = await client.admin.getSystemStats();

// Cleanup
await client.close();
```

### Features
- ✅ Full TypeScript support
- ✅ Promise-based async API
- ✅ Browser and Node.js compatible
- ✅ File upload with progress events
- ✅ Built-in retry logic
- ✅ EventEmitter for real-time updates
- ✅ Comprehensive type definitions

---

## Ruby SDK

### Installation

```bash
gem install schlep-engine
```

### Gemfile

```ruby
gem 'schlep-engine', '~> 2.0'
```

### Quick Start

```ruby
require 'schlep/engine'

# Initialize client
client = Schlep::Engine::Client.new('your-api-key')

# Or use environment variable
client = Schlep::Engine::Client.from_env  # Uses SCHLEP_API_KEY

# Data Processing
job = client.data.process_file(file_data, 'csv')
puts "Job ID: #{job['job_id']}"

# ML Pipeline
pipeline = client.ml.create_pipeline(
  name: 'Fraud Detection',
  task_type: 'classification',
  model_type: 'random_forest'
)

training = client.ml.train_pipeline(pipeline['pipeline_id'], epochs: 10)

# Analytics
results = client.analytics.execute_query(
  sql: "SELECT * FROM users WHERE created_at > '2024-01-01'"
)

# Document Extraction
file_data = File.read('document.pdf')
text = client.document.extract_text(file_data, 'pdf')

# Data Quality
assessment = client.quality.assess_quality(job['job_id'])

# Storage
upload_result = client.storage.upload_file(file_data, 'data.csv')

# Monitoring
health = client.monitoring.get_health
metrics = client.monitoring.get_metrics(time_range: '1h')

# Users
profile = client.users.get_profile
api_keys = client.users.list_api_keys

# Admin
users = client.admin.list_users
stats = client.admin.get_system_stats
```

### Features
- ✅ Ruby 2.7+ compatible
- ✅ Faraday-based HTTP client
- ✅ YARD documentation
- ✅ RSpec test suite
- ✅ Modular API design
- ✅ Lazy-loaded API clients

---

## Go SDK

### Installation

```bash
go get github.com/schlep-engine/go-sdk
```

### Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    schlep "github.com/schlep-engine/go-sdk/pkg/client"
)

func main() {
    // Initialize client
    client, err := schlep.NewClient("your-api-key")
    if err != nil {
        log.Fatal(err)
    }

    ctx := context.Background()

    // Data Processing
    job, err := client.Data.ProcessFile(ctx, fileData, "csv")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Job ID: %s\n", job.JobID)

    // ML Pipeline
    pipeline, err := client.ML.CreatePipeline(ctx, schlep.PipelineConfig{
        Name:      "Fraud Detection",
        TaskType:  "classification",
        ModelType: "random_forest",
    })

    training, err := client.ML.TrainPipeline(ctx, pipeline.PipelineID,
        schlep.TrainingConfig{Epochs: 10})

    // Analytics
    results, err := client.Analytics.ExecuteQuery(ctx, schlep.Query{
        SQL: "SELECT * FROM users WHERE created_at > '2024-01-01'",
    })

    // Document Extraction
    text, err := client.Document.ExtractText(ctx, fileData, "pdf")

    // Data Quality
    assessment, err := client.Quality.AssessQuality(ctx, job.JobID)

    // Storage
    upload, err := client.Storage.UploadFile(ctx, fileData, "data.csv")

    // Monitoring
    health, err := client.Monitoring.GetHealth(ctx)
    metrics, err := client.Monitoring.GetMetrics(ctx, schlep.MetricsParams{
        TimeRange: "1h",
    })

    // Users
    profile, err := client.Users.GetProfile(ctx)
    apiKeys, err := client.Users.ListAPIKeys(ctx)

    // Admin
    users, err := client.Admin.ListUsers(ctx, nil)
    stats, err := client.Admin.GetSystemStats(ctx)
}
```

### Features
- ✅ Go 1.18+ with generics support
- ✅ Context-aware API
- ✅ Structured error handling
- ✅ Comprehensive test coverage
- ✅ GoDoc documentation
- ✅ Thread-safe operations

---

## Java SDK

### Installation

**Maven:**
```xml
<dependency>
    <groupId>io.schlepengine</groupId>
    <artifactId>schlep-engine-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

**Gradle:**
```gradle
implementation 'io.schlepengine:schlep-engine-sdk:1.0.0'
```

### Quick Start

```java
import io.schlepengine.SchlepClient;
import io.schlepengine.types.*;
import java.util.concurrent.CompletableFuture;

public class Example {
    public static void main(String[] args) {
        // Initialize client
        SchlepClient client = new SchlepClient("your-api-key");

        try {
            // Data Processing
            ProcessingJobResponse job = client.data()
                .processFile(fileData, "csv");
            System.out.println("Job ID: " + job.getJobId());

            // ML Pipeline
            PipelineResponse pipeline = client.ml().createPipeline(config);
            TrainingJobResponse training = client.ml()
                .trainPipeline(pipeline.getPipelineId(), trainingConfig);

            // Analytics
            QueryResponse results = client.analytics()
                .executeQuery(queryConfig);

            // Document Extraction
            ExtractionResponse text = client.document()
                .extractText(fileData, "pdf");

            // Data Quality
            QualityAssessmentResponse assessment = client.quality()
                .assessQuality(job.getJobId());

            // Storage
            FileUploadResponse upload = client.storage()
                .uploadFile(fileData, "data.csv");

            // Monitoring
            HealthResponse health = client.monitoring().getHealth();
            MetricsResponse metrics = client.monitoring()
                .getMetrics(metricsParams);

            // Users
            UserProfile profile = client.users().getProfile();
            List<ApiKeyInfo> apiKeys = client.users().listApiKeys();

            // Admin
            List<UserSummary> users = client.admin().listUsers(params);
            SystemStats stats = client.admin().getSystemStats();

            // Async operations
            CompletableFuture<ProcessingJobResponse> futureJob =
                client.data().processFileAsync(fileData, "csv");

        } finally {
            client.close();
        }
    }
}
```

### Features
- ✅ Java 11+ compatible
- ✅ CompletableFuture async support
- ✅ Jackson for JSON serialization
- ✅ OkHttp for HTTP operations
- ✅ Comprehensive Javadoc
- ✅ Builder pattern for configurations

---

## Rust SDK

### Installation

**Cargo.toml:**
```toml
[dependencies]
schlep-engine = "1.0"
tokio = { version = "1", features = ["full"] }
```

### Quick Start

```rust
use schlep_engine::{SchlepClient, Result};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize client
    let client = SchlepClient::new("your-api-key")?;

    // Data Processing
    let file_data = std::fs::read("data.csv")?;
    let job = client.data().process_file(&file_data, "csv").await?;
    println!("Job ID: {}", job.job_id);

    // ML Pipeline
    let config = json!({
        "name": "Fraud Detection",
        "task_type": "classification",
        "model_type": "random_forest"
    });
    let pipeline = client.ml().create_pipeline(config).await?;

    let training_config = json!({"epochs": 10});
    let training = client.ml()
        .train_pipeline(&pipeline.pipeline_id, training_config).await?;

    // Analytics
    let query = json!({"sql": "SELECT * FROM users"});
    let results = client.analytics().execute_query(query).await?;

    // Document Extraction
    let doc_data = std::fs::read("document.pdf")?;
    let text = client.document().extract_text(&doc_data, "pdf").await?;

    // Data Quality
    let assessment = client.quality().assess_quality(&job.job_id).await?;

    // Storage
    let upload = client.storage()
        .upload_file(&file_data, "data.csv").await?;

    // Monitoring
    let health = client.monitoring().get_health().await?;
    let metrics = client.monitoring()
        .get_metrics(json!({"timeRange": "1h"})).await?;

    // Users
    let profile = client.users().get_profile().await?;
    let api_keys = client.users().list_api_keys().await?;

    // Admin
    let users = client.admin().list_users(None).await?;
    let stats = client.admin().get_system_stats().await?;

    Ok(())
}
```

### Features
- ✅ Rust 1.70+ with async/await
- ✅ Tokio runtime
- ✅ Reqwest HTTP client
- ✅ Serde for serialization
- ✅ Comprehensive rustdoc
- ✅ Zero-cost abstractions

---

## C# SDK

### Installation

**NuGet:**
```bash
dotnet add package SchlepEngine.SDK
```

**Package Manager:**
```powershell
Install-Package SchlepEngine.SDK
```

### Quick Start

```csharp
using SchlepEngine;
using SchlepEngine.Types;

// Initialize client
using var client = new SchlepClient("your-api-key");

// Data Processing
var fileData = await File.ReadAllBytesAsync("data.csv");
var job = await client.Data.ProcessFileAsync(fileData, "csv");
Console.WriteLine($"Job ID: {job.JobId}");

// ML Pipeline
var pipelineConfig = new {
    Name = "Fraud Detection",
    TaskType = "classification",
    ModelType = "random_forest"
};
var pipeline = await client.ML.CreatePipelineAsync(pipelineConfig);

var trainingConfig = new { Epochs = 10 };
var training = await client.ML.TrainPipelineAsync(
    pipeline.PipelineId, trainingConfig);

// Analytics
var query = new { Sql = "SELECT * FROM users" };
var results = await client.Analytics.ExecuteQueryAsync(query);

// Document Extraction
var docData = await File.ReadAllBytesAsync("document.pdf");
var text = await client.Document.ExtractTextAsync(docData, "pdf");

// Data Quality
var assessment = await client.Quality.AssessQualityAsync(job.JobId);

// Storage
var upload = await client.Storage.UploadFileAsync(fileData, "data.csv");

// Monitoring
var health = await client.Monitoring.GetHealthAsync();
var metrics = await client.Monitoring.GetMetricsAsync(
    new { TimeRange = "1h" });

// Users
var profile = await client.Users.GetProfileAsync();
var apiKeys = await client.Users.ListApiKeysAsync();

// Admin
var users = await client.Admin.ListUsersAsync();
var stats = await client.Admin.GetSystemStatsAsync();
```

### Features
- ✅ .NET 6.0+ compatible
- ✅ Async/await throughout
- ✅ Nullable reference types
- ✅ XML documentation
- ✅ IDisposable pattern
- ✅ CancellationToken support

---

## CLI Tool

### Installation

```bash
pip install schlep-engine-cli
```

### Quick Start

```bash
# Authentication
schlep auth login --api-key your-api-key
schlep auth status

# Data Processing
schlep process file data.csv --output processed.parquet
schlep process batch "data/*.csv" --parallel 4

# ML Pipeline
schlep ml create-pipeline "My Pipeline" --config pipeline.yml --auto-start
schlep ml train pipeline-123 --watch
schlep ml deploy model-456 --environment production
schlep ml predict https://api.../predict data.json --output predictions.json

# Analytics
schlep analytics query "SELECT * FROM users"
schlep analytics create-report "Monthly Report" --config report.yml
schlep analytics list-datasets

# Document Extraction
schlep document extract-text document.pdf --format pdf --output text.txt
schlep document extract-tables document.pdf --output tables.json
schlep document ocr image.png --language eng --output text.txt

# Data Quality
schlep quality assess job-123
schlep quality create-rule "completeness" --config rule.yml
schlep quality validate job-123 rule-1 rule-2

# Storage
schlep storage upload data.csv --public
schlep storage download file-123 --output data.csv
schlep storage list --limit 50

# Monitoring
schlep monitoring status --detailed
schlep monitoring metrics --watch --interval 5

# Users
schlep users profile
schlep users create-api-key "Production Key"
schlep users list-api-keys

# Admin (requires admin privileges)
schlep admin list-users --status active
schlep admin system-stats

# DevOps & CI/CD (existing features)
schlep devops deploy infrastructure/ --env production
schlep cicd setup-pipeline . --provider github
schlep batch submit-files "data/*.csv" --parallel-jobs 8
```

### Features
- ✅ Full API coverage with 16 command groups
- ✅ Beautiful terminal UI with Rich
- ✅ Progress bars and live dashboards
- ✅ Watch mode for real-time monitoring
- ✅ YAML/JSON configuration support
- ✅ Batch processing with parallelization
- ✅ CI/CD integration examples

---

## Feature Comparison Matrix

| Feature | Python | JS/TS | Ruby | Go | Java | Rust | C# | CLI |
|---------|--------|-------|------|----|----|------|-----|-----|
| Data Processing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ML Pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Document Extraction | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Data Quality | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Storage | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Monitoring | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Users | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Async/Await | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Type Safety | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | N/A |
| File Upload Progress | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Retry Logic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pagination | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Common Patterns

### Error Handling

**Python:**
```python
from schlep_engine.exceptions import ApiError, ConfigurationError

try:
    job = client.data.process_file(data, "csv")
except ApiError as e:
    print(f"API Error {e.status_code}: {e.message}")
except ConfigurationError as e:
    print(f"Config Error: {e}")
```

**JavaScript:**
```typescript
import { ApiError, ConfigurationError } from '@schlep-engine/sdk';

try {
    const job = await client.data.processFile(data, 'csv');
} catch (error) {
    if (error instanceof ApiError) {
        console.error(`API Error ${error.statusCode}: ${error.message}`);
    }
}
```

**Rust:**
```rust
use schlep_engine::Error;

match client.data().process_file(&data, "csv").await {
    Ok(job) => println!("Success: {}", job.job_id),
    Err(Error::ApiError(code, msg)) => eprintln!("API Error {}: {}", code, msg),
    Err(e) => eprintln!("Error: {}", e),
}
```

### Pagination

**Python:**
```python
params = {"page": 1, "page_size": 50}
jobs = client.data.list_jobs(params)
for job in jobs:
    print(job.job_id)
```

**Go:**
```go
params := &schlep.ListParams{Page: 1, PageSize: 50}
jobs, err := client.Data.ListJobs(ctx, params)
```

### File Upload with Progress

**Python:**
```python
def progress_callback(bytes_sent, total_bytes):
    percent = (bytes_sent / total_bytes) * 100
    print(f"Upload progress: {percent:.1f}%")

client.storage.upload_file(data, "large.csv", on_progress=progress_callback)
```

**JavaScript:**
```typescript
client.storage.uploadFile(file, 'large.csv', {
    onProgress: (sent, total) => {
        const percent = (sent / total) * 100;
        console.log(`Upload progress: ${percent.toFixed(1)}%`);
    }
});
```

---

## Migration Guide

### From v1.x to v2.0

The primary change in v2.0 is the introduction of **modular API clients**:

**v1.x (Legacy):**
```python
client.upload(data)
client.train(config)
client.deploy(model_id)
```

**v2.0 (Modular):**
```python
client.data.process_file(data, "csv")
client.ml.train_pipeline(pipeline_id, config)
client.ml.deploy_model(model_id)
```

Legacy methods are still supported for backward compatibility but are deprecated.

---

## Support & Resources

- **Documentation:** https://docs.schlep-engine.com
- **API Reference:** https://docs.schlep-engine.com/api
- **GitHub:** https://github.com/schlep-engine
- **Support:** support@schlep-engine.com
- **Community:** https://community.schlep-engine.com

---

## License

All SDKs are released under the MIT License.

---

**Made with ❤️ by the Schlep-engine Team**
