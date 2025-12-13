# Schlep-engine Java SDK

Official Java SDK for the Schlep-engine API platform.

[![Maven Central](https://img.shields.io/maven-central/v/io.schlepengine/igris-inertial.svg)](https://search.maven.org/artifact/io.schlepengine/igris-inertial)
[![Javadoc](https://javadoc.io/badge2/io.schlepengine/igris-inertial/javadoc.svg)](https://javadoc.io/doc/io.schlepengine/igris-inertial)
[![License](https://img.shields.io/github/license/igris-inertial/java-sdk.svg)](LICENSE)

## Features

- 🚀 **High Performance**: Built on OkHttp for efficient HTTP operations
- 🔒 **Type-safe**: Full type safety with Jackson for JSON serialization
- 🛡️ **Error Handling**: Comprehensive exception types with detailed messages
- 📡 **Async Support**: CompletableFuture for asynchronous operations
- 🔑 **Authentication**: Bearer token authentication with environment variable support
- 📚 **Well Documented**: Extensive Javadoc and examples
- ☕ **Java 11+**: Compatible with Java 11 and higher
- 🎯 **Complete API Coverage**: All 9 API modules fully implemented

## API Modules

The SDK provides comprehensive clients for all Schlep-engine API modules:

- **Data Processing** (`client.data()`) - Process, transform, and manage data
- **ML Pipeline** (`client.ml()`) - Create, train, and deploy ML models
- **Analytics** (`client.analytics()`) - Run analytics queries and generate insights
- **Document Extraction** (`client.document()`) - Extract text, tables, and metadata from documents
- **Data Quality** (`client.quality()`) - Assess and monitor data quality
- **Storage** (`client.storage()`) - File storage and management
- **Monitoring** (`client.monitoring()`) - System monitoring and health checks
- **Users** (`client.users()`) - User management and profiles
- **Admin** (`client.admin()`) - Administrative functions (requires admin privileges)

## Installation

### Maven

Add this dependency to your `pom.xml`:

```xml
<dependency>
    <groupId>io.schlepengine</groupId>
    <artifactId>igris-inertial</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

Add this to your `build.gradle`:

```gradle
implementation 'io.schlepengine:igris-inertial:1.0.0'
```

## Quick Start

### Basic Usage

```java
import io.schlepengine.SchlepClient;
import io.schlepengine.types.*;

public class Example {
    public static void main(String[] args) throws Exception {
        // Create client with API key
        SchlepClient client = new SchlepClient("your-api-key");

        // Or from environment variable SCHLEP_API_KEY
        SchlepClient client = SchlepClient.fromEnv();

        try {
            // Upload data
            UploadResponse uploadResult = client.upload("Hello, world!");
            System.out.println("Upload job ID: " + uploadResult.getJobId());

            // Train a model
            TrainConfig config = new TrainConfig()
                .setModelType("classification")
                .setDatasetId(uploadResult.getJobId());
            TrainResponse trainResult = client.train(config);

            // Deploy model
            if (trainResult.getModelId() != null) {
                DeployResponse deployResult = client.deploy(trainResult.getModelId());
                System.out.println("Model deployed at: " + deployResult.getEndpointUrl());
            }
        } finally {
            client.close();
        }
    }
}
```

### Using API Modules

```java
import io.schlepengine.SchlepClient;
import io.schlepengine.api.*;
import io.schlepengine.types.*;
import java.io.File;
import java.util.*;

public class ModulesExample {
    public static void main(String[] args) throws Exception {
        SchlepClient client = new SchlepClient("your-api-key");

        // Data Processing
        DataProcessingClient dataClient = client.data();
        File csvFile = new File("data.csv");
        DataProcessingResult result = dataClient.processFile(
            csvFile,
            DataFormat.CSV,
            DataFormat.JSON
        );

        // ML Pipeline
        MLPipelineClient mlClient = client.ml();
        Map<String, Object> pipelineConfig = new HashMap<>();
        pipelineConfig.put("name", "My Pipeline");
        pipelineConfig.put("task_type", "classification");
        Map<String, Object> pipeline = mlClient.createPipeline(pipelineConfig);

        // Analytics
        AnalyticsClient analyticsClient = client.analytics();
        List<Map<String, Object>> datasets = analyticsClient.getDatasets();

        // Document Extraction
        DocumentClient docClient = client.document();
        File pdfFile = new File("document.pdf");
        Map<String, Object> text = docClient.extractText(pdfFile);

        // Storage
        StorageClient storageClient = client.storage();
        FileUpload upload = storageClient.uploadFile(new File("data.csv"));

        // Monitoring
        MonitoringClient monitoringClient = client.monitoring();
        Map<String, Object> health = monitoringClient.getSystemHealth();

        // Users
        UsersClient usersClient = client.users();
        Map<String, Object> profile = usersClient.getProfile();

        client.close();
    }
}
```

## API Reference

### Client Creation

```java
// With API key
SchlepClient client = new SchlepClient("your-api-key");

// From environment variable
SchlepClient client = SchlepClient.fromEnv();

// With custom base URL
SchlepClient client = new SchlepClient("your-api-key", "https://custom.api.com/v1");
```

### Upload Data

```java
UploadResponse result = client.upload("your data here");
System.out.println("Job ID: " + result.getJobId());
```

### Train Model

```java
// Using TrainConfig object
TrainConfig config = new TrainConfig()
    .setModelType("classification")
    .setDatasetId("upload_job_123")
    .addParameter("algorithm", "random_forest");
TrainResponse result = client.train(config);

// Using JSON string
String configJson = """
    {
        "model_type": "classification",
        "dataset_id": "upload_job_123",
        "parameters": {
            "algorithm": "random_forest"
        }
    }
    """;
TrainResponse result = client.train(configJson);
```

### Deploy Model

```java
DeployResponse result = client.deploy("model_456");
System.out.println("Endpoint: " + result.getEndpointUrl());
```

### Check Status

```java
StatusResponse status = client.status("job_123");
System.out.println("Status: " + status.getStatus());
if (status.getProgress() != null) {
    System.out.println("Progress: " + status.getProgress() + "%");
}
```

### Stream Events

```java
StreamConfig config = new StreamConfig()
    .addEventType("training")
    .addEventType("deployment")
    .addFilter("user_id", "123");

client.stream(config);
```

## Error Handling

The SDK provides comprehensive error handling:

```java
try {
    UploadResponse result = client.upload("data");
    System.out.println("Success: " + result.getJobId());
} catch (ApiException e) {
    System.err.println("API error " + e.getStatusCode() + ": " + e.getMessage());

    // Handle specific error codes
    switch (e.getStatusCode()) {
        case 401:
            System.err.println("Authentication failed");
            break;
        case 429:
            System.err.println("Rate limit exceeded");
            break;
        default:
            System.err.println("Unexpected error");
    }
} catch (ConfigurationException e) {
    System.err.println("Configuration error: " + e.getMessage());
} catch (IOException e) {
    System.err.println("Network error: " + e.getMessage());
}
```

## Environment Variables

- `SCHLEP_API_KEY`: Your Schlep-engine API key

## Build and Test

```bash
# Build the project
mvn compile

# Run tests
mvn test

# Run example (set SCHLEP_API_KEY first)
export SCHLEP_API_KEY=your-api-key-here
mvn exec:java -Dexec.mainClass="io.schlepengine.examples.BasicUsageExample"

# Generate documentation
mvn javadoc:javadoc

# Create JAR with dependencies
mvn package
```

## Testing

The SDK includes comprehensive tests with mocked HTTP responses:

```bash
# Run all tests
mvn test

# Run specific test class
mvn test -Dtest=SchlepClientTest

# Run tests with detailed output
mvn test -X
```

## Logging

The SDK uses SLF4J for logging. To see debug logs, configure your logging framework:

### Logback (logback.xml)
```xml
<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <logger name="io.schlepengine" level="DEBUG"/>

    <root level="INFO">
        <appender-ref ref="STDOUT"/>
    </root>
</configuration>
```

## API Client Documentation

### Data Processing API

Process, transform, and manage data:

```java
DataProcessingClient dataClient = client.data();

// Process a file
File csvFile = new File("data.csv");
DataProcessingResult result = dataClient.processFile(csvFile, DataFormat.CSV, DataFormat.JSON);

// Check job status
JobInfo status = dataClient.getJobStatus(result.getJobId());

// List jobs
List<JobInfo> jobs = dataClient.listJobs(1, 20);

// Create and run pipelines
Map<String, Object> pipelineConfig = new HashMap<>();
dataClient.createPipeline(pipelineConfig);
```

### ML Pipeline API

Create, train, and deploy ML models:

```java
MLPipelineClient mlClient = client.ml();

// Create pipeline
Map<String, Object> config = new HashMap<>();
config.put("name", "My Pipeline");
config.put("task_type", MLTaskType.CLASSIFICATION.getValue());
Map<String, Object> pipeline = mlClient.createPipeline(config);

// Train model
String pipelineId = (String) pipeline.get("pipeline_id");
TrainingJob job = mlClient.trainPipeline(pipelineId, null, null);

// Make predictions
Map<String, Object> prediction = mlClient.predict(modelId, inputData);

// List models
List<ModelInfo> models = mlClient.listModels(1, 10);
```

### Analytics API

Run analytics queries:

```java
AnalyticsClient analyticsClient = client.analytics();

// Get available datasets
List<Map<String, Object>> datasets = analyticsClient.getDatasets();

// Run query
Map<String, Object> query = new HashMap<>();
query.put("dataset", "sales_data");
query.put("metrics", Arrays.asList("sum", "average"));
Map<String, Object> results = analyticsClient.query(query);
```

### Document Extraction API

Extract text, tables, and metadata from documents:

```java
DocumentClient docClient = client.document();

// Extract text from PDF
File pdfFile = new File("document.pdf");
Map<String, Object> text = docClient.extractText(pdfFile, true, false);

// Extract tables
Map<String, Object> tables = docClient.extractTables(pdfFile);
```

### Data Quality API

Assess and monitor data quality:

```java
QualityClient qualityClient = client.quality();

// Assess data quality
List<String> checks = Arrays.asList("completeness", "validity", "uniqueness");
Map<String, Object> report = qualityClient.assessQuality("s3://bucket/data.csv", checks);

// Get quality report
Map<String, Object> detailedReport = qualityClient.getReport(reportId);
```

### Storage API

File storage and management:

```java
StorageClient storageClient = client.storage();

// Upload file
File file = new File("data.csv");
FileUpload upload = storageClient.uploadFile(file, "datasets");

// List files
List<FileUpload> files = storageClient.listFiles("datasets", 1, 20);

// Delete file
storageClient.deleteFile(fileId);
```

### Monitoring API

System monitoring and health checks:

```java
MonitoringClient monitoringClient = client.monitoring();

// Get system health
Map<String, Object> health = monitoringClient.getSystemHealth();

// Get metrics
List<String> metrics = Arrays.asList("cpu_usage", "memory_usage");
Map<String, Object> metricsData = monitoringClient.getMetrics(metrics, null);
```

### Users API

User management and profiles:

```java
UsersClient usersClient = client.users();

// Get user profile
Map<String, Object> profile = usersClient.getProfile();

// Update profile
Map<String, Object> updates = new HashMap<>();
updates.put("name", "New Name");
Map<String, Object> updated = usersClient.updateProfile(updates);
```

### Admin API

Administrative functions (requires admin privileges):

```java
AdminClient adminClient = client.admin();

// Get system statistics
Map<String, Object> stats = adminClient.getSystemStats();

// List all users
List<Map<String, Object>> users = adminClient.listUsers(1, 50);
```

## Async Operations

The SDK supports asynchronous operations using CompletableFuture:

```java
// Async data processing
CompletableFuture<DataProcessingResult> futureResult =
    dataClient.processDataAsync(request);

futureResult.thenAccept(result -> {
    System.out.println("Processing completed: " + result.getJobId());
});

// Async ML training
CompletableFuture<TrainingJob> futureJob =
    mlClient.trainPipelineAsync(pipelineId, null, null);

futureJob.thenAccept(job -> {
    System.out.println("Training started: " + job.getJobId());
});
```

## Examples

Check out the [examples](src/main/java/io/schlepengine/examples/) directory:

- [BasicUsageExample](src/main/java/io/schlepengine/examples/BasicUsageExample.java) - Complete workflow from upload to deployment
- [ComprehensiveExample](src/main/java/io/schlepengine/examples/ComprehensiveExample.java) - Demonstrates all API modules

## Java Version Compatibility

- **Java 11+**: Fully supported
- **Java 8**: Not supported (use version 0.x for Java 8 compatibility)

## Dependencies

- [OkHttp](https://square.github.io/okhttp/) - HTTP client
- [Jackson](https://github.com/FasterXML/jackson) - JSON processing
- [SLF4J](http://www.slf4j.org/) - Logging facade

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://docs.igris-inertial.com/sdk/java)
- 🐛 [Issues](https://github.com/igris-inertial/java-sdk/issues)
- 💬 [Support](https://support.igris-inertial.com)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository
2. Ensure you have Java 11+ and Maven 3.6+
3. Run `mvn clean compile` to build
4. Run `mvn test` to execute tests

### Code Style

This project follows standard Java conventions:
- Use 4 spaces for indentation
- Maximum line length of 120 characters
- Comprehensive Javadoc for all public APIs