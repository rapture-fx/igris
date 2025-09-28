import Link from 'next/link'
import { ArrowRightIcon, CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function CSharpSDKPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          C# / .NET SDK
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Modern .NET SDK for Schlep Engine - Built for .NET 6+, ASP.NET Core, and Azure applications with dependency injection, configuration, and comprehensive async support.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Latest: v1.1.0
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            .NET 6+
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            Async/Await
          </span>
        </div>

        <div className="flex gap-4">
          <Link
            href="https://www.nuget.org/packages/SchlepEngine.Client/"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View on NuGet
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/schlep-engine/dotnet-sdk"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            GitHub Repository
          </Link>
        </div>
      </div>

      <div className="prose prose-lg max-w-none">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            .NET Ecosystem Integration
          </h3>
          <p className="text-blue-700">
            Seamlessly integrates with ASP.NET Core, dependency injection, configuration, logging, and health checks.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Package Manager Console</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`Install-Package SchlepEngine.Client

# Optional: ASP.NET Core extensions
Install-Package SchlepEngine.Extensions.AspNetCore

# Optional: Azure integration
Install-Package SchlepEngine.Extensions.Azure`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">dotnet CLI</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`dotnet add package SchlepEngine.Client

# With extensions
dotnet add package SchlepEngine.Extensions.AspNetCore
dotnet add package SchlepEngine.Extensions.Azure`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">PackageReference</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`<PackageReference Include="SchlepEngine.Client" Version="1.1.0" />
<PackageReference Include="SchlepEngine.Extensions.AspNetCore" Version="1.1.0" />
<PackageReference Include="SchlepEngine.Extensions.Azure" Version="1.1.0" />`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Start</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Basic Usage</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`using SchlepEngine.Client;
using SchlepEngine.Client.Models;

// Initialize client
var config = new SchlepEngineClientOptions
{
    ApiKey = "your-api-key-here",
    BaseUrl = "https://api.schlep-engine.com",
    Timeout = TimeSpan.FromSeconds(30)
};

var client = new SchlepEngineClient(config);

// Process data
var request = new DataProcessingRequest
{
    FilePath = "data/sales.csv",
    OutputFormat = DataFormat.Json,
    Transformations = new List<Transformation>
    {
        new FilterTransformation { Condition = "age > 18" },
        new AggregateTransformation
        {
            Column = "revenue",
            Operation = AggregateOperation.Sum
        }
    }
};

var result = await client.Data.ProcessFileAsync(request);
Console.WriteLine($"Job ID: {result.JobId}");`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">ASP.NET Core Integration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`// Program.cs (.NET 6+)
using SchlepEngine.Extensions.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add Schlep Engine services
builder.Services.AddSchlepEngine(options =>
{
    options.ApiKey = builder.Configuration["SchlepEngine:ApiKey"];
    options.BaseUrl = builder.Configuration["SchlepEngine:BaseUrl"];
    options.Timeout = TimeSpan.FromMinutes(2);
});

// Add health checks
builder.Services.AddHealthChecks()
    .AddSchlepEngine();

var app = builder.Build();

// Use health checks
app.MapHealthChecks("/health");

app.Run();

// appsettings.json
{
  "SchlepEngine": {
    "ApiKey": "your-api-key",
    "BaseUrl": "https://api.schlep-engine.com",
    "RetryPolicy": {
      "MaxRetries": 3,
      "BackoffDelay": "00:00:01"
    }
  }
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibant mt-8 mb-4">Dependency Injection</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`[ApiController]
[Route("api/[controller]")]
public class DataController : ControllerBase
{
    private readonly ISchlepEngineClient _schlepClient;
    private readonly ILogger<DataController> _logger;

    public DataController(
        ISchlepEngineClient schlepClient,
        ILogger<DataController> logger)
    {
        _schlepClient = schlepClient;
        _logger = logger;
    }

    [HttpPost("process")]
    public async Task<ActionResult<DataProcessingResult>> ProcessData(
        [FromBody] DataProcessingRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Starting data processing for file: {FilePath}",
                request.FilePath);

            var result = await _schlepClient.Data
                .ProcessFileAsync(request, cancellationToken);

            _logger.LogInformation("Data processing started with job ID: {JobId}",
                result.JobId);

            return Ok(result);
        }
        catch (SchlepEngineException ex)
        {
            _logger.LogError(ex, "Failed to process data: {Message}", ex.Message);
            return BadRequest(new { error = ex.Message });
        }
    }
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Key Features</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Dependency Injection</h4>
              <p className="text-gray-600">Full DI container support with service registration</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Configuration</h4>
              <p className="text-gray-600">IConfiguration integration and options pattern</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Health Checks</h4>
              <p className="text-gray-600">Built-in health check support for monitoring</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibant text-gray-900">Azure Integration</h4>
              <p className="text-gray-600">Azure Key Vault, Service Bus, and storage support</p>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Core Features</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Machine Learning Pipeline</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`using SchlepEngine.Client.ML;

// Create ML pipeline configuration
var config = new MLPipelineConfig
{
    Name = "Customer Churn Prediction",
    TaskType = MLTaskType.Classification,
    ModelType = ModelType.GradientBoosting,
    TargetColumn = "churned",
    FeatureColumns = new[] { "age", "tenure", "usage", "support_calls" },
    AutoHyperparameterTuning = true,
    ValidationSplit = 0.2m
};

// Create and train pipeline
var pipeline = await client.ML.CreatePipelineAsync(config);
var trainingJob = await client.ML.TrainPipelineAsync(pipeline.Id);

// Monitor training with progress reporting
await foreach (var progress in client.ML.MonitorTrainingAsync(trainingJob.JobId))
{
    Console.WriteLine($"Training progress: {progress.Percentage:F1}%");

    if (progress.IsCompleted)
    {
        Console.WriteLine($"Training completed. Model accuracy: {progress.Metrics.Accuracy:F2}%");
        break;
    }
}

// Make predictions
var predictions = await client.ML.PredictAsync(trainingJob.ModelId, new[]
{
    new Dictionary<string, object>
    {
        ["age"] = 35,
        ["tenure"] = 24,
        ["usage"] = 450,
        ["support_calls"] = 2
    }
});

foreach (var prediction in predictions.Results)
{
    Console.WriteLine($"Prediction: {prediction.Class} (confidence: {prediction.Probability:F2})");
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibant mt-8 mb-4">Error Handling and Resilience</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`using SchlepEngine.Client.Exceptions;
using Polly;
using Polly.Extensions.Http;

// Configure resilience policies
services.AddSchlepEngine(options =>
{
    options.ApiKey = "your-api-key";
    options.RetryPolicy = new RetryPolicyOptions
    {
        MaxRetries = 5,
        BackoffDelay = TimeSpan.FromSeconds(1),
        UseExponentialBackoff = true
    };
})
.AddPolicyHandler(GetRetryPolicy())
.AddPolicyHandler(GetCircuitBreakerPolicy());

static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError()
        .OrResult(msg => msg.StatusCode == HttpStatusCode.TooManyRequests)
        .WaitAndRetryAsync(
            retryCount: 3,
            sleepDurationProvider: retryAttempt =>
                TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
            onRetry: (outcome, timespan, retryCount, context) =>
            {
                Console.WriteLine($"Retry {retryCount} after {timespan} seconds");
            });
}

// Handle specific exceptions
try
{
    var result = await client.Data.ProcessFileAsync(request);
}
catch (AuthenticationException ex)
{
    _logger.LogError("Authentication failed: {Message}", ex.Message);
    // Handle authentication error
}
catch (ValidationException ex)
{
    _logger.LogError("Validation failed: {Errors}",
        string.Join(", ", ex.ValidationErrors));
    // Handle validation errors
}
catch (RateLimitException ex)
{
    _logger.LogWarning("Rate limited. Retry after {RetryAfter} seconds",
        ex.RetryAfter);
    // Implement backoff strategy
}
catch (SchlepEngineException ex)
{
    _logger.LogError(ex, "API error ({StatusCode}): {Message}",
        ex.StatusCode, ex.Message);
    // Handle general API errors
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibant mt-8 mb-4">Azure Integration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`using SchlepEngine.Extensions.Azure;
using Azure.Identity;

// Azure Key Vault integration
builder.Services.AddSchlepEngine()
    .ConfigureFromKeyVault(keyVaultUrl: "https://your-vault.vault.azure.net/")
    .AddAzureServiceBusIntegration(serviceBusConnectionString)
    .AddAzureBlobStorageIntegration(storageConnectionString);

// Managed identity authentication
builder.Services.AddSchlepEngine(options =>
{
    options.Credential = new DefaultAzureCredential();
    options.ApiKeyFromKeyVault = "schlep-engine-api-key";
});

// Service Bus message processing
[ServiceBusProcessor("data-processing-queue")]
public class DataProcessingHandler
{
    private readonly ISchlepEngineClient _client;

    public DataProcessingHandler(ISchlepEngineClient client)
    {
        _client = client;
    }

    public async Task ProcessMessage(
        ServiceBusReceivedMessage message,
        CancellationToken cancellationToken)
    {
        var request = JsonSerializer.Deserialize<DataProcessingRequest>(
            message.Body.ToString());

        var result = await _client.Data.ProcessFileAsync(request, cancellationToken);

        // Send result to another queue or storage
        await NotifyProcessingComplete(result);
    }
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibant mt-12 mb-6">Configuration</h2>

        <h3 className="text-2xl font-semibant mt-8 mb-4">appsettings.json</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`{
  "SchlepEngine": {
    "ApiKey": "your-api-key",
    "BaseUrl": "https://api.schlep-engine.com",
    "Timeout": "00:02:00",
    "MaxConcurrentRequests": 10,
    "RetryPolicy": {
      "MaxRetries": 3,
      "BackoffDelay": "00:00:01",
      "UseExponentialBackoff": true,
      "RetryOnStatusCodes": [429, 502, 503, 504]
    },
    "CircuitBreaker": {
      "FailureThreshold": 5,
      "RecoveryTimeout": "00:00:30",
      "SamplingDuration": "00:01:00"
    }
  },
  "Logging": {
    "LogLevel": {
      "SchlepEngine": "Information"
    }
  }
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibant mt-8 mb-4">Options Pattern</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`// Custom options class
public class CustomSchlepEngineOptions : SchlepEngineClientOptions
{
    public string Environment { get; set; } = "Production";
    public bool EnableDetailedLogging { get; set; } = false;
    public Dictionary<string, string> CustomHeaders { get; set; } = new();
}

// Configuration
builder.Services.Configure<CustomSchlepEngineOptions>(
    builder.Configuration.GetSection("SchlepEngine"));

builder.Services.AddSchlepEngine<CustomSchlepEngineOptions>();

// Usage in service
public class DataService
{
    private readonly ISchlepEngineClient _client;
    private readonly IOptionsMonitor<CustomSchlepEngineOptions> _options;

    public DataService(
        ISchlepEngineClient client,
        IOptionsMonitor<CustomSchlepEngineOptions> options)
    {
        _client = client;
        _options = options;
    }

    public async Task ProcessData()
    {
        var currentOptions = _options.CurrentValue;

        if (currentOptions.EnableDetailedLogging)
        {
            // Enhanced logging logic
        }

        // Use client with current configuration
        await _client.Data.ProcessFileAsync(request);
    }
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibant mt-12 mb-6">Testing</h2>

        <h3 className="text-2xl font-semibant mt-8 mb-4">Unit Testing with Moq</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`using Moq;
using Xunit;
using SchlepEngine.Client.Abstractions;

public class DataServiceTests
{
    [Fact]
    public async Task ProcessData_ValidRequest_ReturnsJobId()
    {
        // Arrange
        var mockClient = new Mock<ISchlepEngineClient>();
        var mockDataService = new Mock<IDataService>();

        mockClient.Setup(x => x.Data).Returns(mockDataService.Object);

        var expectedResult = new DataProcessingResult { JobId = "test-job-123" };
        mockDataService
            .Setup(x => x.ProcessFileAsync(It.IsAny<DataProcessingRequest>(), default))
            .ReturnsAsync(expectedResult);

        var service = new DataProcessor(mockClient.Object);
        var request = new DataProcessingRequest { FilePath = "test.csv" };

        // Act
        var result = await service.ProcessFileAsync(request);

        // Assert
        Assert.Equal("test-job-123", result.JobId);
        mockDataService.Verify(
            x => x.ProcessFileAsync(It.IsAny<DataProcessingRequest>(), default),
            Times.Once);
    }
}

// Integration testing with WebApplicationFactory
public class DataControllerIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public DataControllerIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ProcessData_ValidRequest_ReturnsOk()
    {
        // Arrange
        var client = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                // Replace with test implementation
                services.AddSingleton<ISchlepEngineClient, TestSchlepEngineClient>();
            });
        }).CreateClient();

        var request = new DataProcessingRequest { FilePath = "test.csv" };

        // Act
        var response = await client.PostAsJsonAsync("/api/data/process", request);

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<DataProcessingResult>();
        Assert.NotNull(result?.JobId);
    }
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibant mt-12 mb-6">Requirements</h2>

        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>.NET 6.0 or later</li>
          <li>ASP.NET Core 6.0+ (for web integration)</li>
          <li>System.Text.Json or Newtonsoft.Json</li>
          <li>Microsoft.Extensions.Http (for HTTP client factory)</li>
        </ul>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <DocumentTextIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-gray-600 mb-4">
              Complete API documentation with XML documentation and IntelliSense.
            </p>
            <Link href="/api-reference" className="text-blue-600 hover:text-blue-700 font-medium">
              View API Docs →
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">🔧</div>
            <h3 className="text-lg font-semibant text-gray-900 mb-2">Examples</h3>
            <p className="text-gray-600 mb-4">
              ASP.NET Core examples and Azure integration samples.
            </p>
            <Link href="https://github.com/schlep-engine/dotnet-sdk-examples" className="text-blue-600 hover:text-blue-700 font-medium">
              View Examples →
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">☁️</div>
            <h3 className="text-lg font-semibant text-gray-900 mb-2">Azure Guide</h3>
            <p className="text-gray-600 mb-4">
              Best practices for Azure deployment and integration.
            </p>
            <Link href="/guides/azure-integration" className="text-blue-600 hover:text-blue-700 font-medium">
              View Azure Guide →
            </Link>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
          <h3 className="text-lg font-semibant text-blue-800 mb-2">
            Ready for .NET Development?
          </h3>
          <p className="text-blue-700 mb-4">
            Integrate Schlep Engine into your .NET applications with modern patterns and Azure cloud services.
          </p>
          <div className="flex gap-4">
            <Link
              href="/introduction/quickstart"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Quick Start Guide
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/api-reference"
              className="inline-flex items-center gap-2 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              API Reference
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}