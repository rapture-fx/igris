# Igris-engine Java SDK

**Status:** 🚧 In Development - Planned for Future Release

## Overview

The Igris-engine Java SDK is currently under development and not yet ready for production use.

## Planned Features

- Java 11+ compatibility
- Fluent API with builder pattern
- Async support with CompletableFuture
- Spring Boot integration
- Jackson for JSON serialization
- Comprehensive JavaDoc documentation

## Installation (Coming Soon)

### Maven

```xml
<dependency>
    <groupId>com.igris</groupId>
    <artifactId>igris-java-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

```gradle
implementation 'com.igris:igris-java-sdk:1.0.0'
```

## Planned Usage

```java
import com.igris.Igris;
import com.igris.models.InferRequest;
import com.igris.models.InferResponse;
import com.igris.models.Message;

public class Example {
    public static void main(String[] args) {
        Igris client = Igris.builder()
            .baseUrl("http://localhost:8081")
            .apiKey("your-api-key")
            .build();

        InferRequest request = InferRequest.builder()
            .model("gpt-4")
            .addMessage(Message.user("Hello, world!"))
            .maxTokens(100)
            .build();

        InferResponse response = client.infer(request);
        System.out.println(response.getChoices().get(0).getMessage().getContent());
    }
}
```

## Current Status

This SDK is in the planning phase. We are designing the API and dependency structure.

## Contributing

Interested in contributing to the Java SDK? Please see our [Contributing Guide](https://github.com/igris-inertial/igris-inertial/blob/main/CONTRIBUTING.md).

## Timeline

- **Q2 2026**: Alpha release for Java 11+
- **Q3 2026**: Beta release with Spring Boot support
- **Q4 2026**: v1.0 stable release

## Alternative Solutions

While we work on the official Java SDK, you can use:
- Direct HTTP requests with OkHttp or Apache HttpClient
- The Python or JavaScript SDKs via JNI
- Community-maintained Java clients (not officially supported)

## Contact

For questions or to express interest in early access:
- Email: hello@igris-inertial.com
- GitHub: https://github.com/igris-inertial/igris-inertial/issues

---

**Igris-engine** - Intelligent AI Routing and Cost Optimization
