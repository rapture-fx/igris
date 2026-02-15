# Igris-engine .NET SDK

**Status:** 🚧 In Development - Planned for Future Release

## Overview

The Igris-engine .NET SDK is currently under development and not yet ready for production use.

## Planned Features

- .NET 6+ and .NET Framework 4.8 support
- Async/await with Task-based API
- Dependency injection support
- Strong typing with nullable reference types
- XML documentation comments
- NuGet package distribution

## Installation (Coming Soon)

```bash
dotnet add package Igris
```

Or via Package Manager:

```powershell
Install-Package Igris
```

## Planned Usage

```csharp
using Igris;
using Igris.Models;

var client = new IgrisClient(new IgrisClientOptions
{
    BaseUrl = "http://localhost:8081",
    ApiKey = "your-api-key"
});

var response = await client.InferAsync(new InferRequest
{
    Model = "gpt-4",
    Messages = new[]
    {
        new Message { Role = "user", Content = "Hello, world!" }
    },
    MaxTokens = 100
});

Console.WriteLine(response.Choices[0].Message.Content);
```

## Dependency Injection

```csharp
// Startup.cs or Program.cs
services.AddIgris(options =>
{
    options.BaseUrl = Configuration["Igris:BaseUrl"];
    options.ApiKey = Configuration["Igris:ApiKey"];
});

// Controller
public class ChatController : ControllerBase
{
    private readonly IIgrisClient _igrisClient;

    public ChatController(IIgrisClient igrisClient)
    {
        _igrisClient = igrisClient;
    }

    [HttpPost]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        var response = await _igrisClient.InferAsync(new InferRequest
        {
            Model = "gpt-4",
            Messages = new[] { new Message { Role = "user", Content = request.Message } }
        });

        return Ok(response);
    }
}
```

## Current Status

This SDK is in the design phase. We are working on the architecture and ASP.NET Core integration.

## Contributing

Interested in contributing to the .NET SDK? Please see our [Contributing Guide](https://github.com/igris-inertial/igris-inertial/blob/main/CONTRIBUTING.md).

## Timeline

- **Q2 2026**: Alpha release for .NET 6+
- **Q3 2026**: Beta release with DI support
- **Q4 2026**: v1.0 stable release

## Alternative Solutions

While we work on the official .NET SDK, you can use:
- Direct HTTP requests with HttpClient
- RestSharp for simplified REST calls
- Community-maintained .NET clients (not officially supported)

## Contact

For questions or to express interest in early access:
- Email: hello@igris-inertial.com
- GitHub: https://github.com/igris-inertial/igris-inertial/issues

---

**Igris-engine** - Intelligent AI Routing and Cost Optimization
