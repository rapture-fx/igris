# Schlep-engine .NET SDK

**Status:** 🚧 In Development - Planned for Future Release

## Overview

The Schlep-engine .NET SDK is currently under development and not yet ready for production use.

## Planned Features

- .NET 6+ and .NET Framework 4.8 support
- Async/await with Task-based API
- Dependency injection support
- Strong typing with nullable reference types
- XML documentation comments
- NuGet package distribution

## Installation (Coming Soon)

```bash
dotnet add package Schlep
```

Or via Package Manager:

```powershell
Install-Package Schlep
```

## Planned Usage

```csharp
using Schlep;
using Schlep.Models;

var client = new SchlepClient(new SchlepClientOptions
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
services.AddSchlep(options =>
{
    options.BaseUrl = Configuration["Schlep:BaseUrl"];
    options.ApiKey = Configuration["Schlep:ApiKey"];
});

// Controller
public class ChatController : ControllerBase
{
    private readonly ISchlepClient _schlepClient;

    public ChatController(ISchlepClient schlepClient)
    {
        _schlepClient = schlepClient;
    }

    [HttpPost]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        var response = await _schlepClient.InferAsync(new InferRequest
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

Interested in contributing to the .NET SDK? Please see our [Contributing Guide](https://github.com/schlep-engine/schlep-engine/blob/main/CONTRIBUTING.md).

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
- Email: hello@schlep-engine.com
- GitHub: https://github.com/schlep-engine/schlep-engine/issues

---

**Schlep-engine** - Intelligent AI Routing and Cost Optimization
