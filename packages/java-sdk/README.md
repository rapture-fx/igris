# Schlep-engine Java SDK

Official Java SDK for the Schlep-engine API platform.

[![Maven Central](https://img.shields.io/maven-central/v/io.schlepengine/schlep-engine.svg)](https://search.maven.org/artifact/io.schlepengine/schlep-engine)
[![Javadoc](https://javadoc.io/badge2/io.schlepengine/schlep-engine/javadoc.svg)](https://javadoc.io/doc/io.schlepengine/schlep-engine)
[![License](https://img.shields.io/github/license/schlep-engine/java-sdk.svg)](LICENSE)

## Features

- 🚀 **High Performance**: Built on OkHttp for efficient HTTP operations
- 🔒 **Type-safe**: Full type safety with Jackson for JSON serialization
- 🛡️ **Error Handling**: Comprehensive exception types with detailed messages
- 📡 **Streaming**: WebSocket support for real-time events
- 🔑 **Authentication**: Bearer token authentication with environment variable support
- 📚 **Well Documented**: Extensive Javadoc and examples
- ☕ **Java 11+**: Compatible with Java 11 and higher

## Installation

### Maven

Add this dependency to your `pom.xml`:

```xml
<dependency>
    <groupId>io.schlepengine</groupId>
    <artifactId>schlep-engine</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

Add this to your `build.gradle`:

```gradle
implementation 'io.schlepengine:schlep-engine:1.0.0'
```

## Quick Start

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

## Examples

Check out the [examples](src/main/java/io/schlepengine/examples/) directory:

- [BasicUsageExample](src/main/java/io/schlepengine/examples/BasicUsageExample.java) - Complete workflow from upload to deployment

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

- 📖 [Documentation](https://docs.schlep-engine.com/sdk/java)
- 🐛 [Issues](https://github.com/schlep-engine/java-sdk/issues)
- 💬 [Support](https://support.schlep-engine.com)

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