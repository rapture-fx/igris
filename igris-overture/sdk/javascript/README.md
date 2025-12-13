# Schlep JavaScript SDK

Official JavaScript/TypeScript SDK for Schlep-engine - Intelligent AI routing and cost optimization.

[![npm version](https://img.shields.io/npm/v/schlep.svg)](https://www.npmjs.com/package/schlep)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install schlep
# or
yarn add schlep
# or
pnpm add schlep
```

## Quick Start

### TypeScript/ESM

```typescript
import { Schlep } from 'schlep';

const client = new Schlep({
  baseUrl: 'http://localhost:8081',
  apiKey: 'your-api-key' // optional
});

const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello, world!' }],
  max_tokens: 100
});

console.log(response.choices[0].message.content);
```

### CommonJS

```javascript
const { Schlep } = require('schlep');

const client = new Schlep({
  baseUrl: 'http://localhost:8081'
});

async function main() {
  const response = await client.infer({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  });

  console.log(response);
}

main();
```

## Features

- ✅ Full TypeScript support with type definitions
- ✅ ESM and CommonJS compatibility
- ✅ Minimal dependencies (only node-fetch)
- ✅ Automatic error handling and retries
- ✅ OpenAI-compatible API
- ✅ Works with Node.js, Next.js, and modern bundlers

## API Reference

### Constructor

```typescript
const client = new Schlep(config?: ClientConfig)
```

**ClientConfig:**
- `baseUrl` (string, optional): API base URL (default: 'http://localhost:8081')
- `apiKey` (string, optional): API key for authentication
- `timeout` (number, optional): Request timeout in milliseconds (default: 30000)
- `headers` (object, optional): Custom headers to include in requests

### Methods

#### `infer(request: InferRequest): Promise<InferResponse>`

Make an inference request using Schlep-engine's intelligent routing.

```typescript
const response = await client.infer({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing in simple terms.' }
  ],
  max_tokens: 200,
  temperature: 0.7
});
```

**InferRequest:**
- `model` (string, required): Model to use (e.g., 'gpt-4', 'claude-3-opus')
- `messages` (Message[], required): Array of message objects
- `max_tokens` (number, optional): Maximum tokens in response
- `temperature` (number, optional): Sampling temperature (0.0 to 2.0)
- `top_p` (number, optional): Nucleus sampling parameter
- Additional provider-specific parameters

**InferResponse:**
```typescript
{
  model: string;
  choices: [{
    index: number;
    message: { role: string; content: string };
    finish_reason?: string;
  }];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

#### `listModels(): Promise<ModelsResponse>`

List available models.

```typescript
const models = await client.listModels();
console.log(models.data.map(m => m.id));
```

#### `health(): Promise<HealthResponse>`

Check API health status.

```typescript
const health = await client.health();
console.log(health.status); // 'healthy'
```

#### `providerStats(): Promise<ProviderStats>`

Get provider statistics.

```typescript
const stats = await client.providerStats();
console.log(stats);
```

## Usage Examples

### Basic Inference

```typescript
import { Schlep } from 'schlep';

const client = new Schlep({ baseUrl: 'http://localhost:8081' });

const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);
```

### With Authentication

```typescript
const client = new Schlep({
  baseUrl: 'https://api.schlep.com',
  apiKey: 'your-api-key-here'
});

const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Error Handling

```typescript
import { Schlep, SchlepError, AuthenticationError, NetworkError } from 'schlep';

const client = new Schlep({ baseUrl: 'http://localhost:8081' });

try {
  const response = await client.infer({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
  console.log(response);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof SchlepError) {
    console.error('API error:', error.message, error.statusCode);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Streaming Responses (Coming Soon)

```typescript
// Streaming support will be added in a future release
const stream = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Using with Next.js

```typescript
// app/api/chat/route.ts
import { Schlep } from 'schlep';
import { NextRequest, NextResponse } from 'next/server';

const client = new Schlep({
  baseUrl: process.env.SCHLEP_API_URL || 'http://localhost:8081',
  apiKey: process.env.SCHLEP_API_KEY
});

export async function POST(request: NextRequest) {
  const { message } = await request.json();

  try {
    const response = await client.infer({
      model: 'gpt-4',
      messages: [{ role: 'user', content: message }]
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Custom Timeout and Headers

```typescript
const client = new Schlep({
  baseUrl: 'http://localhost:8081',
  timeout: 60000, // 60 seconds
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

## BYOK (Bring Your Own Key)

Schlep-engine supports BYOK, allowing you to use your own API keys for providers:

```typescript
// Keys are managed server-side via the /v1/vault/keys endpoint
// Use the Schlep CLI to manage keys:
// $ schlep add-key --provider openai --key sk-...
```

## TypeScript Support

This package includes full TypeScript definitions. Import types as needed:

```typescript
import {
  Schlep,
  InferRequest,
  InferResponse,
  Message,
  ClientConfig,
  SchlepError
} from 'schlep';

const request: InferRequest = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
};

const client = new Schlep();
const response: InferResponse = await client.infer(request);
```

## Environment Variables

You can configure the SDK using environment variables:

```bash
SCHLEP_API_URL=http://localhost:8081
SCHLEP_API_KEY=your-api-key
```

```typescript
const client = new Schlep({
  baseUrl: process.env.SCHLEP_API_URL,
  apiKey: process.env.SCHLEP_API_KEY
});
```

## Compatibility

- **Node.js**: >= 14.0.0
- **TypeScript**: >= 4.0.0
- **Bundlers**: Webpack, Vite, esbuild, Rollup
- **Frameworks**: Next.js, Express, Fastify, NestJS

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test
```

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: https://github.com/igris-inertial/igris-inertial
- Issues: https://github.com/igris-inertial/igris-inertial/issues
- Email: hello@igris-inertial.com
