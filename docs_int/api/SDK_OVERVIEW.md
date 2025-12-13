# Schlep-engine SDK Overview

Complete guide to all Schlep-engine Software Development Kits (SDKs).

## Production-Ready SDKs

### Python SDK ✅

**Status:** Production Ready (v1.0.0-rc1)
**Package:** `schlep`
**Registry:** PyPI

Official Python SDK for Schlep-engine with minimal dependencies and full type hints.

**Installation:**
```bash
pip install schlep
```

**Quick Example:**
```python
from schlep import Client

client = Client(base_url="http://localhost:8081")
response = client.infer(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response["choices"][0]["message"]["content"])
```

**Features:**
- ✅ Full API coverage (/v1/infer, /v1/models, /v1/health)
- ✅ Minimal dependencies (requests only)
- ✅ Type hints for IDE support
- ✅ Context manager support
- ✅ Comprehensive error handling
- ✅ CLI integration (`schlep` command)
- ✅ Secure config storage (~/.schlep/config.json)

**Documentation:**
- [Python Quickstart](/docs/api/python_quickstart.md)
- [Python API Reference](/docs/api/python_reference.md)
- [Python SDK README](/internal/sdk/python/README.md)
- [CLI Documentation](/internal/cli/README.md)

---

### JavaScript/TypeScript SDK ✅

**Status:** Production Ready (v1.0.0-rc1)
**Package:** `schlep`
**Registry:** npm

Official JavaScript/TypeScript SDK with full type definitions and ESM/CJS support.

**Installation:**
```bash
npm install schlep
```

**Quick Example:**
```typescript
import { Schlep } from 'schlep';

const client = new Schlep({ baseUrl: 'http://localhost:8081' });
const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(response.choices[0].message.content);
```

**Features:**
- ✅ Full TypeScript support with type definitions
- ✅ ESM and CommonJS exports
- ✅ Minimal dependencies (node-fetch only)
- ✅ Works with Node.js, Next.js, Express, and more
- ✅ Comprehensive error handling
- ✅ Full API coverage

**Documentation:**
- [JavaScript Quickstart](/docs/api/javascript_quickstart.md)
- [JavaScript API Reference](/docs/api/javascript_reference.md)
- [JavaScript SDK README](/internal/sdk/javascript/README.md)

---

### Go SDK ✅

**Status:** Production Ready (v1.0.0-rc1)
**Module:** `github.com/igris-inertial/sdk-go`
**Package:** `schlep`

Official Go SDK for Schlep-engine with idiomatic Go patterns and minimal dependencies.

**Installation:**
```bash
go get github.com/igris-inertial/sdk-go
```

**Quick Example:**
```go
import "github.com/igris-inertial/sdk-go/schlep"

client := schlep.NewClient(&schlep.Config{
    BaseURL: "http://localhost:8081",
})

ctx := context.Background()
response, err := client.Infer(ctx, &schlep.InferRequest{
    Model: "gpt-4",
    Messages: []schlep.Message{
        {Role: "user", Content: "Hello!"},
    },
})
fmt.Println(response.Choices[0].Message.Content)
```

**Features:**
- ✅ Idiomatic Go with context.Context support
- ✅ Minimal dependencies (backoff only)
- ✅ Full type safety with structs
- ✅ Automatic retry logic with exponential backoff
- ✅ Comprehensive error handling
- ✅ GoDoc documentation
- ✅ Environment variable support

**Documentation:**
- [Go Quickstart](/docs/api/go_quickstart.md)
- [Go API Reference](/docs/api/go_reference.md)
- [Go SDK README](/internal/sdk/go/README.md)
- [GoDoc](https://pkg.go.dev/github.com/igris-inertial/sdk-go)

---

### JavaScript/TypeScript SDK ✅

**Status:** Production Ready (v1.0.0-rc1)
**Package:** `schlep`
**Registry:** npm

Official JavaScript/TypeScript SDK with full type definitions and ESM/CJS support.

**Installation:**
```bash
npm install schlep
```

**Quick Example:**
```typescript
import { Schlep } from 'schlep';

const client = new Schlep({ baseUrl: 'http://localhost:8081' });
const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(response.choices[0].message.content);
```

**Features:**
- ✅ Full TypeScript support with type definitions
- ✅ ESM and CommonJS exports
- ✅ Minimal dependencies (node-fetch only)
- ✅ Works with Node.js, Next.js, Express, and more
- ✅ Comprehensive error handling
- ✅ Full API coverage

**Documentation:**
- [JavaScript Quickstart](/docs/api/javascript_quickstart.md)
- [JavaScript API Reference](/docs/api/javascript_reference.md)
- [JavaScript SDK README](/internal/sdk/javascript/README.md)

---

## SDK Under Development

The following SDKs are planned for future release:

### Go SDK 🚧

**Status:** In Development
**Planned Release:** Q1 2026

Idiomatic Go SDK with context support and structured error handling.

**Planned Usage:**
```go
client := schlep.NewClient(schlep.Config{
    BaseURL: "http://localhost:8081",
})

resp, err := client.Infer(ctx, &schlep.InferRequest{
    Model: "gpt-4",
    Messages: []schlep.Message{{Role: "user", Content: "Hello!"}},
})
```

[Go SDK Details](/internal/sdk/legacy/go/README.md)

---

### Rust SDK 🚧

**Status:** In Development
**Planned Release:** Q2 2026

Type-safe Rust SDK with async/await support and zero-cost abstractions.

**Planned Usage:**
```rust
let client = Client::builder()
    .base_url("http://localhost:8081")
    .build()?;

let response = client.infer(
    InferRequest::builder()
        .model("gpt-4")
        .message(Message::user("Hello!"))
        .build()?
).await?;
```

[Rust SDK Details](/internal/sdk/legacy/rust/README.md)

---

### Java SDK 🚧

**Status:** In Development
**Planned Release:** Q2 2026

Java 11+ SDK with fluent API and Spring Boot integration.

**Planned Usage:**
```java
Schlep client = Schlep.builder()
    .baseUrl("http://localhost:8081")
    .build();

InferResponse response = client.infer(
    InferRequest.builder()
        .model("gpt-4")
        .addMessage(Message.user("Hello!"))
        .build()
);
```

[Java SDK Details](/internal/sdk/legacy/java/README.md)

---

### .NET SDK 🚧

**Status:** In Development
**Planned Release:** Q2 2026

.NET 6+ SDK with async/await and dependency injection support.

**Planned Usage:**
```csharp
var client = new SchlepClient(new SchlepClientOptions
{
    BaseUrl = "http://localhost:8081"
});

var response = await client.InferAsync(new InferRequest
{
    Model = "gpt-4",
    Messages = new[] { new Message { Role = "user", Content = "Hello!" } }
});
```

[.NET SDK Details](/internal/sdk/legacy/dotnet/README.md)

---

### Ruby SDK 🚧

**Status:** In Development
**Planned Release:** Q3 2026

Idiomatic Ruby SDK with Rails integration.

**Planned Usage:**
```ruby
client = Schlep::Client.new(base_url: 'http://localhost:8081')

response = client.infer(
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
)
```

[Ruby SDK Details](/internal/sdk/legacy/ruby/README.md)

---

## API Endpoints

All SDKs support the following Schlep-engine v1 API endpoints:

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/infer` | POST | Intelligent inference routing |
| `/v1/chat/completions` | POST | OpenAI-compatible endpoint |
| `/v1/models` | GET | List available models |
| `/v1/health` | GET | Health check |
| `/v1/providers/stats` | GET | Provider statistics |

### Multi-Tenancy Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/tenants` | POST | Create tenant (admin) |
| `/v1/vault/keys` | POST | Store provider keys (BYOK) |
| `/v1/auth/login` | POST | Authenticate with API key |
| `/v1/usage` | GET | Get usage metrics |
| `/v1/policy` | GET/PUT | Manage routing policies |

---

## Common Features

All production SDKs share these features:

### Authentication

```python
# Python
client = Client(api_key="your-key")
```

```typescript
// JavaScript
const client = new Schlep({ apiKey: 'your-key' });
```

### Error Handling

```python
# Python
from schlep import APIError, AuthenticationError, NetworkError

try:
    response = client.infer(...)
except AuthenticationError:
    print("Invalid API key")
except APIError as e:
    print(f"API error: {e.status_code}")
except NetworkError:
    print("Connection failed")
```

```typescript
// JavaScript
import { SchlepError, AuthenticationError, NetworkError } from 'schlep';

try {
  const response = await client.infer(...);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof NetworkError) {
    console.error('Connection failed');
  }
}
```

### BYOK (Bring Your Own Key)

All SDKs support BYOK via the server-side vault:

```bash
# Configure provider keys using CLI
schlep add-key --provider openai --key sk-...
schlep add-key --provider anthropic --key sk-ant-...
```

Then use the SDK normally - Schlep-engine routes to the best available provider:

```python
# Python
response = client.infer(
    model="gpt-4",  # Automatically routed to configured providers
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## Installation Quick Reference

| Language | Package Manager | Command |
|----------|----------------|---------|
| Python | pip | `pip install schlep` |
| JavaScript/TypeScript | npm | `npm install schlep` |
| JavaScript/TypeScript | yarn | `yarn add schlep` |
| JavaScript/TypeScript | pnpm | `pnpm add schlep` |
| Go | go get | Coming Soon |
| Rust | cargo | Coming Soon |
| Java | Maven/Gradle | Coming Soon |
| .NET | NuGet | Coming Soon |
| Ruby | gem | Coming Soon |

---

## Framework Integration

### Next.js (JavaScript)

```typescript
// app/api/chat/route.ts
import { Schlep } from 'schlep';

const client = new Schlep({
  baseUrl: process.env.SCHLEP_API_URL!
});

export async function POST(req: Request) {
  const { message } = await req.json();
  const response = await client.infer({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }]
  });
  return Response.json(response);
}
```

### FastAPI (Python)

```python
from fastapi import FastAPI
from schlep import Client

app = FastAPI()
client = Client(base_url="http://localhost:8081")

@app.post("/api/chat")
async def chat(message: str):
    response = client.infer(
        model="gpt-4",
        messages=[{"role": "user", "content": message}]
    )
    return response
```

### Express (JavaScript)

```typescript
import express from 'express';
import { Schlep } from 'schlep';

const app = express();
const client = new Schlep();

app.post('/api/chat', async (req, res) => {
  const response = await client.infer({
    model: 'gpt-4',
    messages: [{ role: 'user', content: req.body.message }]
  });
  res.json(response);
});
```

---

## Configuration

### Environment Variables

Both production SDKs support environment variable configuration:

```bash
# .env
SCHLEP_API_URL=http://localhost:8081
SCHLEP_API_KEY=your-api-key
```

**Python:**
```python
import os
from schlep import Client

client = Client(
    base_url=os.getenv("SCHLEP_API_URL"),
    api_key=os.getenv("SCHLEP_API_KEY")
)
```

**JavaScript:**
```typescript
const client = new Schlep({
  baseUrl: process.env.SCHLEP_API_URL,
  apiKey: process.env.SCHLEP_API_KEY
});
```

---

## CLI Tool

The Schlep CLI is integrated with the Python SDK:

```bash
# Install
pip install schlep-cli

# Configure
schlep login --url http://localhost:8081

# Add provider keys (BYOK)
schlep add-key --provider openai --key sk-...

# Test inference
schlep infer --prompt "Hello!"

# List models
schlep models

# View configuration
schlep config
```

[CLI Documentation](/internal/cli/README.md)

---

## Repository Structure

```
igris-inertial/
├── internal/
│   ├── sdk/
│   │   ├── python/          # Production Python SDK
│   │   ├── javascript/      # Production JavaScript SDK
│   │   └── legacy/          # SDKs in development
│   │       ├── go/
│   │       ├── rust/
│   │       ├── java/
│   │       ├── dotnet/
│   │       └── ruby/
│   └── cli/                 # Production CLI tool
└── docs/
    └── api/
        ├── SDK_OVERVIEW.md
        ├── python_quickstart.md
        ├── python_reference.md
        ├── javascript_quickstart.md
        └── javascript_reference.md
```

---

## Contributing

Interested in contributing to an SDK?

1. Check the [Contributing Guide](https://github.com/igris-inertial/igris-inertial/blob/main/CONTRIBUTING.md)
2. Review the SDK's README in `/internal/sdk/legacy/{language}/`
3. Open an issue to discuss your contribution
4. Submit a pull request

For early access to SDKs in development, contact hello@igris-inertial.com

---

## Support & Resources

### Documentation
- [Python Quickstart](/docs/api/python_quickstart.md)
- [Python Reference](/docs/api/python_reference.md)
- [JavaScript Quickstart](/docs/api/javascript_quickstart.md)
- [JavaScript Reference](/docs/api/javascript_reference.md)
- [CLI Documentation](/internal/cli/README.md)

### Community
- GitHub: https://github.com/igris-inertial/igris-inertial
- Issues: https://github.com/igris-inertial/igris-inertial/issues
- Email: hello@igris-inertial.com

### API Status
- Health: `GET /v1/health`
- Version: 1.0.0-rc1
- Base URL: http://localhost:8081 (local)

---

## Roadmap

### 2025-2026

| Quarter | Milestone |
|---------|-----------|
| Q4 2025 | Python & JavaScript SDKs v1.0 GA |
| Q1 2026 | Go SDK Alpha |
| Q2 2026 | Rust & Java SDKs Alpha |
| Q3 2026 | .NET SDK Alpha |
| Q4 2026 | Ruby SDK Alpha, Streaming support for all SDKs |

---

## License

All Schlep-engine SDKs are licensed under the MIT License.

---

**Schlep-engine** - Intelligent AI Routing and Cost Optimization

_Making AI accessible, affordable, and reliable._
