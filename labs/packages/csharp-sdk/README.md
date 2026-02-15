# Igris-engine .NET SDK

Official .NET SDK for the Igris-engine API platform.

[![NuGet](https://img.shields.io/nuget/v/Igris.SDK.svg)](https://www.nuget.org/packages/Igris.SDK)
[![Documentation](https://img.shields.io/badge/docs-online-blue.svg)](https://docs.igris-inertial.com/sdk/dotnet)
[![License](https://img.shields.io/github/license/igris-inertial/csharp-sdk.svg)](LICENSE)

## Features

- 🚀 **Async/Await**: Full async support with cancellation tokens
- 🔒 **Type-safe**: Complete type safety with System.Text.Json
- 🛡️ **Error Handling**: Comprehensive exception types with detailed messages
- 📡 **Streaming**: WebSocket support for real-time events (coming soon)
- 🔑 **Authentication**: Bearer token authentication with environment variable support
- 📚 **Well Documented**: Extensive XML documentation and examples
- ⚡ **Modern .NET**: Built for .NET 6+ with nullable reference types

## Installation

### Package Manager Console
```powershell
Install-Package Igris.SDK
```

### .NET CLI
```bash
dotnet add package Igris.SDK
```

### PackageReference
```xml
<PackageReference Include="Igris.SDK" Version="1.0.0" />
```

## Quick Start

```csharp
using Igris;
using Igris.Types;

// Create client with API key
var client = new IgrisClient("your-api-key");

// Or from environment variable IGRIS_API_KEY
var client = IgrisClient.FromEnvironment();

try
{
    // Upload data
    var uploadResult = await client.UploadAsync("Hello, world!");
    Console.WriteLine($"Upload job ID: {uploadResult.JobId}");

    // Train a model
    var config = new TrainConfig
    {
        ModelType = "classification",
        DatasetId = uploadResult.JobId
    };
    var trainResult = await client.TrainAsync(config);

    // Deploy model
    if (trainResult.ModelId != null)
    {
        var deployResult = await client.DeployAsync(trainResult.ModelId);
        Console.WriteLine($"Model deployed at: {deployResult.EndpointUrl}");
    }
}
finally
{
    client.Dispose();
}
```

## API Reference

### Client Creation

```csharp
// With API key
var client = new IgrisClient("your-api-key");

// From environment variable
var client = IgrisClient.FromEnvironment();

// With custom base URL
var client = new IgrisClient("your-api-key", "https://custom.api.com/v1");

// With dependency injection
services.AddHttpClient<IgrisClient>();
services.AddSingleton(provider =>
    new IgrisClient("your-api-key", provider.GetService<HttpClient>()));
```

### Upload Data

```csharp
var result = await client.UploadAsync("your data here");
Console.WriteLine($"Job ID: {result.JobId}");
```

### Train Model

```csharp
// Using TrainConfig object
var config = new TrainConfig
{
    ModelType = "classification",
    DatasetId = "upload_job_123",
    Parameters = new Dictionary<string, object>
    {
        { "algorithm", "random_forest" },
        { "test_size", 0.2 }
    }
};
var result = await client.TrainAsync(config);

// Using JSON string
var configJson = """
    {
        "model_type": "classification",
        "dataset_id": "upload_job_123",
        "parameters": {
            "algorithm": "random_forest"
        }
    }
    """;
var result = await client.TrainAsync(configJson);
```

### Deploy Model

```csharp
var result = await client.DeployAsync("model_456");
Console.WriteLine($"Endpoint: {result.EndpointUrl}");
```

### Check Status

```csharp
var status = await client.StatusAsync("job_123");
Console.WriteLine($"Status: {status.Status}");
if (status.Progress.HasValue)
{
    Console.WriteLine($"Progress: {status.Progress}%");
}
```

### Stream Events

```csharp
var config = new StreamConfig
{
    EventTypes = new List<string> { "training", "deployment" },
    Filters = new Dictionary<string, object> { { "user_id", "123" } }
};

await client.StreamAsync(config);
```

## Error Handling

The SDK provides comprehensive error handling:

```csharp
try
{
    var result = await client.UploadAsync("data");
    Console.WriteLine($"Success: {result.JobId}");
}
catch (ApiException ex)
{
    Console.WriteLine($"API error {ex.StatusCode}: {ex.Message}");

    // Handle specific error codes
    switch (ex.StatusCode)
    {
        case 401:
            Console.WriteLine("Authentication failed");
            break;
        case 429:
            Console.WriteLine("Rate limit exceeded");
            break;
        default:
            Console.WriteLine("Unexpected error");
            break;
    }
}
catch (ConfigurationException ex)
{
    Console.WriteLine($"Configuration error: {ex.Message}");
}
catch (HttpRequestException ex)
{
    Console.WriteLine($"Network error: {ex.Message}");
}
```

## Logging

The SDK integrates with Microsoft.Extensions.Logging:

```csharp
// Configure logging
var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
var logger = loggerFactory.CreateLogger<IgrisClient>();

// Create client with logger
var client = new IgrisClient("your-api-key", logger: logger);
```

### ASP.NET Core Integration

```csharp
// In Startup.cs or Program.cs
services.AddHttpClient<IgrisClient>();
services.AddSingleton<IgrisClient>(provider =>
{
    var httpClient = provider.GetService<HttpClient>();
    var logger = provider.GetService<ILogger<IgrisClient>>();
    return IgrisClient.FromEnvironment(httpClient, logger);
});
```

## Environment Variables

- `IGRIS_API_KEY`: Your Igris-engine API key

## Build and Test

```bash
# Build the project
dotnet build

# Run tests
dotnet test

# Run example (set IGRIS_API_KEY first)
$env:IGRIS_API_KEY="your-api-key-here"
dotnet run --project Examples

# Create NuGet package
dotnet pack
```

## Testing

The SDK includes comprehensive tests with mocked HTTP responses:

```bash
# Run all tests
dotnet test

# Run tests with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run specific test
dotnet test --filter "TestMethodName"
```

## Dependency Injection

The SDK works seamlessly with .NET's dependency injection:

```csharp
// Configure services
services.AddHttpClient<IgrisClient>();
services.Configure<IgrisClientOptions>(options =>
{
    options.ApiKey = "your-api-key";
    options.BaseUrl = "https://api.igris-inertial.com/v1";
});

// Register client
services.AddScoped<IgrisClient>(provider =>
{
    var options = provider.GetRequiredService<IOptions<IgrisClientOptions>>().Value;
    var httpClient = provider.GetRequiredService<HttpClient>();
    var logger = provider.GetRequiredService<ILogger<IgrisClient>>();

    return new IgrisClient(options.ApiKey, options.BaseUrl, httpClient, logger);
});

// Use in controller
[ApiController]
public class MyController : ControllerBase
{
    private readonly IgrisClient _igrisClient;

    public MyController(IgrisClient igrisClient)
    {
        _igrisClient = igrisClient;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload([FromBody] string data)
    {
        var result = await _igrisClient.UploadAsync(data);
        return Ok(result);
    }
}
```

## Target Frameworks

- **.NET 6.0**: Fully supported
- **.NET 7.0+**: Fully supported
- **.NET Framework**: Not supported (use .NET Core/.NET 5+)

## Dependencies

- [Microsoft.Extensions.Http](https://www.nuget.org/packages/Microsoft.Extensions.Http/) - HTTP client factory
- [System.Text.Json](https://www.nuget.org/packages/System.Text.Json/) - JSON serialization
- [Microsoft.Extensions.Logging](https://www.nuget.org/packages/Microsoft.Extensions.Logging.Abstractions/) - Logging abstractions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://docs.igris-inertial.com/sdk/dotnet)
- 🐛 [Issues](https://github.com/igris-inertial/csharp-sdk/issues)
- 💬 [Support](https://support.igris-inertial.com)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository
2. Ensure you have .NET 6 SDK or later
3. Run `dotnet restore` to restore packages
4. Run `dotnet build` to build
5. Run `dotnet test` to execute tests

### Code Style

This project follows standard .NET conventions:
- Use PascalCase for public members
- Use camelCase for private fields with underscore prefix
- Use C# nullable reference types
- Comprehensive XML documentation for all public APIs