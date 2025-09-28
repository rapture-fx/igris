import Link from 'next/link'
import { ArrowRightIcon, CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function JavaSDKPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Java SDK
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Enterprise-grade Java SDK for Schlep Engine - Built for Spring Boot, JEE applications, and enterprise data processing with comprehensive observability and resilience patterns.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Latest: v1.2.0
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Java 11+
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            Spring Boot Ready
          </span>
        </div>

        <div className="flex gap-4">
          <Link
            href="https://central.sonatype.com/artifact/com.schlep-engine/java-sdk"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View on Maven Central
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/schlep-engine/java-sdk"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            GitHub Repository
          </Link>
        </div>
      </div>

      <div className="prose prose-lg max-w-none">
        <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Enterprise Ready
          </h3>
          <p className="text-green-700">
            Built for production enterprise environments with Spring Boot integration, circuit breakers, and comprehensive monitoring.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Maven</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`<dependency>
    <groupId>com.schlep-engine</groupId>
    <artifactId>java-sdk</artifactId>
    <version>1.2.0</version>
</dependency>

<!-- Optional: Spring Boot Starter -->
<dependency>
    <groupId>com.schlep-engine</groupId>
    <artifactId>spring-boot-starter</artifactId>
    <version>1.2.0</version>
</dependency>`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Gradle</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`implementation 'com.schlep-engine:java-sdk:1.2.0'

// Optional: Spring Boot Starter
implementation 'com.schlep-engine:spring-boot-starter:1.2.0'`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Start</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Basic Usage</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import com.schlepengine.client.SchlepEngineClient;
import com.schlepengine.client.config.ClientConfig;
import com.schlepengine.models.DataProcessingRequest;
import com.schlepengine.models.DataProcessingResult;

// Initialize client
ClientConfig config = ClientConfig.builder()
    .apiKey("your-api-key-here")
    .baseUrl("https://api.schlep-engine.com")
    .timeout(Duration.ofSeconds(30))
    .retryConfig(RetryConfig.defaultConfig())
    .build();

SchlepEngineClient client = new SchlepEngineClient(config);

// Process data
DataProcessingRequest request = DataProcessingRequest.builder()
    .filePath("data/sales.csv")
    .outputFormat(DataFormat.JSON)
    .transformations(List.of(
        Transformation.filter("age > 18"),
        Transformation.aggregate("revenue", AggregateFunction.SUM)
    ))
    .build();

DataProcessingResult result = client.data().processFile(request);
System.out.println("Job ID: " + result.getJobId());`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Spring Boot Integration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`// application.yml
schlep-engine:
  api-key: \${SCHLEP_ENGINE_API_KEY}
  base-url: https://api.schlep-engine.com
  timeout: 30s
  retry:
    max-attempts: 3
    backoff-delay: 1s

// Service class
@Service
public class DataProcessingService {

    @Autowired
    private SchlepEngineClient schlepEngineClient;

    public CompletableFuture<DataProcessingResult> processCustomerData(String filePath) {
        DataProcessingRequest request = DataProcessingRequest.builder()
            .filePath(filePath)
            .transformations(List.of(
                Transformation.clean("remove_nulls"),
                Transformation.validate("email_format")
            ))
            .build();

        return schlepEngineClient.data().processFileAsync(request);
    }
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Reactive Programming</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

// Reactive client
SchlepEngineReactiveClient reactiveClient =
    SchlepEngineReactiveClient.create(config);

// Reactive data processing
Mono<DataProcessingResult> resultMono = reactiveClient
    .data()
    .processFile(request)
    .doOnSuccess(result -> log.info("Processing complete: {}", result.getJobId()))
    .doOnError(error -> log.error("Processing failed", error));

// Streaming results
Flux<ProcessingUpdate> updates = reactiveClient
    .data()
    .streamProcessingUpdates(jobId)
    .takeUntil(update -> update.getStatus() == ProcessingStatus.COMPLETED);`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Key Features</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Spring Boot Ready</h4>
              <p className="text-gray-600">Auto-configuration and starter dependencies</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Reactive Support</h4>
              <p className="text-gray-600">WebFlux and Project Reactor integration</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Circuit Breaker</h4>
              <p className="text-gray-600">Built-in resilience patterns with Resilience4j</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Observability</h4>
              <p className="text-gray-600">Micrometer metrics and distributed tracing</p>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Core Features</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Machine Learning Pipeline</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import com.schlepengine.ml.MLPipelineConfig;
import com.schlepengine.ml.MLTaskType;
import com.schlepengine.ml.ModelType;

// Create ML pipeline
MLPipelineConfig config = MLPipelineConfig.builder()
    .name("Fraud Detection Model")
    .taskType(MLTaskType.CLASSIFICATION)
    .modelType(ModelType.GRADIENT_BOOSTING)
    .targetColumn("is_fraud")
    .featureColumns(List.of("amount", "merchant_category", "hour_of_day"))
    .autoHyperparameterTuning(true)
    .validationSplit(0.2)
    .build();

// Train model
MLPipeline pipeline = client.ml().createPipeline(config);
TrainingJob job = client.ml().trainPipeline(pipeline.getId());

// Monitor training progress
TrainingProgress progress = client.ml()
    .monitorTraining(job.getJobId())
    .block(); // Or use reactive approach

// Make predictions
List<PredictionInput> inputs = List.of(
    PredictionInput.builder()
        .feature("amount", 1500.00)
        .feature("merchant_category", "grocery")
        .feature("hour_of_day", 14)
        .build()
);

PredictionResult predictions = client.ml()
    .predict(job.getModelId(), inputs);`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Circuit Breaker Configuration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import java.time.Duration;

// Custom circuit breaker configuration
CircuitBreakerConfig circuitBreakerConfig = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)
    .waitDurationInOpenState(Duration.ofSeconds(30))
    .slidingWindowSize(10)
    .minimumNumberOfCalls(5)
    .build();

ClientConfig config = ClientConfig.builder()
    .apiKey("your-api-key")
    .circuitBreakerConfig(circuitBreakerConfig)
    .build();

SchlepEngineClient client = new SchlepEngineClient(config);

// The client will automatically apply circuit breaker patterns
try {
    DataProcessingResult result = client.data().processFile(request);
} catch (CircuitBreakerOpenException e) {
    log.warn("Service unavailable, circuit breaker is open");
    // Implement fallback logic
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Metrics and Monitoring</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`// Spring Boot with Micrometer
@Component
public class SchlepEngineMetrics {

    private final Counter requestCounter;
    private final Timer requestTimer;

    public SchlepEngineMetrics(MeterRegistry meterRegistry) {
        this.requestCounter = Counter.builder("schlep_engine_requests_total")
            .description("Total Schlep Engine API requests")
            .register(meterRegistry);

        this.requestTimer = Timer.builder("schlep_engine_request_duration")
            .description("Schlep Engine API request duration")
            .register(meterRegistry);
    }

    @EventListener
    public void handleApiRequest(SchlepEngineRequestEvent event) {
        requestCounter.increment(
            Tags.of(
                "endpoint", event.getEndpoint(),
                "status", event.getStatus().toString()
            )
        );

        requestTimer.record(event.getDuration(), TimeUnit.MILLISECONDS);
    }
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Error Handling</h2>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import com.schlepengine.exceptions.*;

try {
    DataProcessingResult result = client.data().processFile(request);
} catch (AuthenticationException e) {
    log.error("Authentication failed: {}", e.getMessage());
    // Handle authentication error
} catch (ValidationException e) {
    log.error("Validation failed: {}", e.getValidationErrors());
    // Handle validation errors
} catch (RateLimitException e) {
    log.warn("Rate limited. Retry after {} seconds", e.getRetryAfter());
    // Implement backoff strategy
} catch (SchlepEngineException e) {
    log.error("API error ({}): {}", e.getStatusCode(), e.getMessage());
    // Handle general API errors
} catch (Exception e) {
    log.error("Unexpected error", e);
    // Handle unexpected errors
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Configuration</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Application Properties</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# application.properties
schlep-engine.api-key=\${SCHLEP_ENGINE_API_KEY}
schlep-engine.base-url=https://api.schlep-engine.com
schlep-engine.timeout=30s
schlep-engine.max-retries=3
schlep-engine.retry-backoff-delay=1s

# Circuit breaker settings
schlep-engine.circuit-breaker.failure-rate-threshold=50
schlep-engine.circuit-breaker.wait-duration=30s
schlep-engine.circuit-breaker.sliding-window-size=10

# Connection pool settings
schlep-engine.connection-pool.max-connections=100
schlep-engine.connection-pool.connection-timeout=10s
schlep-engine.connection-pool.idle-timeout=5m`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Custom Configuration Bean</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`@Configuration
public class SchlepEngineConfig {

    @Bean
    @ConditionalOnMissingBean
    public SchlepEngineClient schlepEngineClient(
            SchlepEngineProperties properties,
            MeterRegistry meterRegistry) {

        ClientConfig config = ClientConfig.builder()
            .apiKey(properties.getApiKey())
            .baseUrl(properties.getBaseUrl())
            .timeout(properties.getTimeout())
            .retryConfig(createRetryConfig(properties))
            .circuitBreakerConfig(createCircuitBreakerConfig(properties))
            .meterRegistry(meterRegistry)
            .build();

        return new SchlepEngineClient(config);
    }

    @Bean
    public SchlepEngineHealthIndicator schlepEngineHealthIndicator(
            SchlepEngineClient client) {
        return new SchlepEngineHealthIndicator(client);
    }
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Requirements</h2>

        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>Java 11+ (Java 17+ recommended)</li>
          <li>Spring Boot 2.7+ or 3.x (for Spring integration)</li>
          <li>Maven 3.6+ or Gradle 7+</li>
          <li>Jackson 2.13+ (for JSON processing)</li>
        </ul>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <DocumentTextIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-gray-600 mb-4">
              Complete Javadoc documentation and API reference.
            </p>
            <Link href="/api-reference" className="text-blue-600 hover:text-blue-700 font-medium">
              View API Docs →
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">🔧</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Examples</h3>
            <p className="text-gray-600 mb-4">
              Spring Boot examples and enterprise integration patterns.
            </p>
            <Link href="https://github.com/schlep-engine/java-sdk-examples" className="text-blue-600 hover:text-blue-700 font-medium">
              View Examples →
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">📚</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Enterprise Guide</h3>
            <p className="text-gray-600 mb-4">
              Best practices for production enterprise deployments.
            </p>
            <Link href="/guides/enterprise-java" className="text-blue-600 hover:text-blue-700 font-medium">
              View Guide →
            </Link>
          </div>
        </div>

        <div className="bg-green-50 border-l-4 border-green-400 p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Ready to Get Started?
          </h3>
          <p className="text-green-700 mb-4">
            Add the Java SDK to your enterprise application and start processing data at scale.
          </p>
          <div className="flex gap-4">
            <Link
              href="/introduction/quickstart"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Quick Start Guide
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/api-reference"
              className="inline-flex items-center gap-2 border border-green-300 text-green-700 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              API Reference
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}