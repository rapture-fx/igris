# JavaScript SDK API Reference

Complete API reference for the Igris Inertial JavaScript/TypeScript SDK.

## Installation

```bash
npm install igris
```

## Import

### ES Modules (TypeScript/Modern JavaScript)

```typescript
import { Igris } from 'igris';
```

### CommonJS (Node.js)

```javascript
const { Igris } = require('igris');
```

## Class: `Igris`

Main client class for interacting with the Igris Inertial API.

### Constructor

```typescript
new Igris(config?: ClientConfig)
```

**Parameters:**
- `config` (ClientConfig, optional): Configuration object

**ClientConfig Interface:**
```typescript
interface ClientConfig {
  baseUrl?: string;        // API base URL (default: 'http://localhost:8081')
  apiKey?: string;         // API key for authentication
  timeout?: number;        // Request timeout in milliseconds (default: 30000)
  headers?: Record<string, string>;  // Custom headers
}
```

**Returns:** `Igris` instance

**Example:**
```typescript
// Basic
const client = new Igris();

// With configuration
const client = new Igris({
  baseUrl: 'https://api.igris-inertial.com',
  apiKey: 'your-api-key',
  timeout: 60000,
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

---

### Method: `infer()`

Make an inference request using Igris Inertial's intelligent routing.

```typescript
async infer(request: InferRequest): Promise<InferResponse>
```

**Parameters:**
- `request` (InferRequest, required): Inference request object

**InferRequest Interface:**
```typescript
interface InferRequest {
  model: string;              // Model identifier
  messages: Message[];        // Conversation messages
  max_tokens?: number;        // Maximum tokens in response
  temperature?: number;       // Sampling temperature (0.0-2.0)
  top_p?: number;            // Nucleus sampling parameter
  stream?: boolean;          // Stream response (future feature)
  [key: string]: any;        // Additional parameters
}
```

**Message Interface:**
```typescript
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

**Returns:** `Promise<InferResponse>`

**InferResponse Interface:**
```typescript
interface InferResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: any;
}
```

**Throws:**
- `AuthenticationError`: Authentication failed
- `IgrisError`: API request failed
- `NetworkError`: Network connection failed

**Example:**
```typescript
const response = await client.infer({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' }
  ],
  max_tokens: 100,
  temperature: 0.7
});

console.log(response.choices[0].message.content);

// Usage stats
if (response.usage) {
  console.log(`Tokens: ${response.usage.total_tokens}`);
}
```

---

### Method: `chatCompletion()`

OpenAI-compatible chat completion endpoint (alias for `infer()`).

```typescript
async chatCompletion(request: InferRequest): Promise<InferResponse>
```

**Parameters:**
- `request` (InferRequest, required): Chat completion request

**Returns:** `Promise<InferResponse>`

**Example:**
```typescript
const response = await client.chatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hi' }]
});
```

---

### Method: `listModels()`

List all available models.

```typescript
async listModels(): Promise<ModelsResponse>
```

**Parameters:** None

**Returns:** `Promise<ModelsResponse>`

**ModelsResponse Interface:**
```typescript
interface ModelsResponse {
  object: string;
  data: Model[];
}

interface Model {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  [key: string]: any;
}
```

**Example:**
```typescript
const models = await client.listModels();

models.data.forEach(model => {
  console.log(`${model.id} - owned by ${model.owned_by}`);
});
```

---

### Method: `health()`

Check API health status.

```typescript
async health(): Promise<HealthResponse>
```

**Parameters:** None

**Returns:** `Promise<HealthResponse>`

**HealthResponse Interface:**
```typescript
interface HealthResponse {
  status: string;
  version?: string;
  timestamp?: string;
  [key: string]: any;
}
```

**Example:**
```typescript
const health = await client.health();

if (health.status === 'healthy') {
  console.log(`API is healthy (v${health.version})`);
} else {
  console.error('API is unhealthy');
}
```

---

### Method: `providerStats()`

Get provider statistics.

```typescript
async providerStats(): Promise<ProviderStats>
```

**Parameters:** None

**Returns:** `Promise<ProviderStats>`

**ProviderStats Interface:**
```typescript
interface ProviderStats {
  [provider: string]: any;
}
```

**Example:**
```typescript
const stats = await client.providerStats();
console.log('Provider stats:', stats);
```

---

## Error Classes

### `IgrisError`

Base error class for all Igris SDK errors.

```typescript
class IgrisError extends Error {
  statusCode?: number;
  response?: any;

  constructor(message: string, statusCode?: number, response?: any);
}
```

**Properties:**
- `message` (string): Error message
- `name` (string): Error name ('IgrisError')
- `statusCode` (number, optional): HTTP status code
- `response` (any, optional): Full response data

**Example:**
```typescript
import { IgrisError } from 'igris';

try {
  const response = await client.infer(...);
} catch (error) {
  if (error instanceof IgrisError) {
    console.log(`Error ${error.statusCode}: ${error.message}`);
    console.log('Response:', error.response);
  }
}
```

---

### `AuthenticationError`

Authentication error (extends `IgrisError`).

```typescript
class AuthenticationError extends IgrisError {
  constructor(message?: string);
}
```

**Properties:**
- Inherits all properties from `IgrisError`
- `statusCode`: Always `401`
- `name`: 'AuthenticationError'

**Example:**
```typescript
import { AuthenticationError } from 'igris';

try {
  const response = await client.infer(...);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  }
}
```

---

### `NetworkError`

Network connection error (extends `IgrisError`).

```typescript
class NetworkError extends IgrisError {
  constructor(message: string);
}
```

**Properties:**
- Inherits all properties from `IgrisError`
- `name`: 'NetworkError'

**Example:**
```typescript
import { NetworkError } from 'igris';

try {
  const response = await client.health();
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Connection failed:', error.message);
  }
}
```

---

## TypeScript Types

All exported types and interfaces:

```typescript
import {
  // Main class
  Igris,

  // Configuration
  ClientConfig,

  // Request/Response
  InferRequest,
  InferResponse,
  Message,
  ModelsResponse,
  Model,
  HealthResponse,
  ProviderStats,

  // Errors
  IgrisError,
  AuthenticationError,
  NetworkError
} from 'igris';
```

---

## Complete Type Definitions

```typescript
// Client Configuration
interface ClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

// Message
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Inference Request
interface InferRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: any;
}

// Inference Response
interface InferResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: any;
}

// Models
interface Model {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  [key: string]: any;
}

interface ModelsResponse {
  object: string;
  data: Model[];
}

// Health
interface HealthResponse {
  status: string;
  version?: string;
  timestamp?: string;
  [key: string]: any;
}

// Provider Stats
interface ProviderStats {
  [provider: string]: any;
}
```

---

## Advanced Usage

### Type-Safe Inference

```typescript
import { Igris, type InferRequest, type InferResponse } from 'igris';

const client = new Igris();

const request: InferRequest = {
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' }
  ],
  max_tokens: 100
};

const response: InferResponse = await client.infer(request);

// TypeScript knows the structure
const content: string = response.choices[0].message.content;
const tokens: number | undefined = response.usage?.total_tokens;
```

### Error Handling with Types

```typescript
import {
  Igris,
  IgrisError,
  AuthenticationError,
  NetworkError
} from 'igris';

const client = new Igris();

try {
  const response = await client.infer({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  });

  console.log(response);

} catch (error: unknown) {
  if (error instanceof AuthenticationError) {
    // TypeScript knows this is AuthenticationError
    console.error('Auth failed:', error.message);
  } else if (error instanceof NetworkError) {
    // TypeScript knows this is NetworkError
    console.error('Network error:', error.message);
  } else if (error instanceof IgrisError) {
    // TypeScript knows this has statusCode and response
    console.error(`API error ${error.statusCode}:`, error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Custom Type Guards

```typescript
import { InferResponse } from 'igris';

function hasUsage(response: InferResponse): response is InferResponse & {
  usage: NonNullable<InferResponse['usage']>
} {
  return response.usage !== undefined;
}

const response = await client.infer(...);

if (hasUsage(response)) {
  // TypeScript knows usage is defined
  console.log(`Tokens used: ${response.usage.total_tokens}`);
}
```

---

## Environment Variables

Configure via environment variables:

```typescript
// .env
IGRIS_API_URL=http://localhost:8081
IGRIS_API_KEY=your-api-key
IGRIS_TIMEOUT=60000
```

```typescript
const client = new Igris({
  baseUrl: process.env.IGRIS_API_URL,
  apiKey: process.env.IGRIS_API_KEY,
  timeout: parseInt(process.env.IGRIS_TIMEOUT || '30000')
});
```

---

## Complete Example

```typescript
import {
  Igris,
  type InferRequest,
  type Message,
  IgrisError,
  AuthenticationError,
  NetworkError
} from 'igris';

async function main() {
  // Initialize client
  const client = new Igris({
    baseUrl: process.env.IGRIS_API_URL || 'http://localhost:8081',
    apiKey: process.env.IGRIS_API_KEY,
    timeout: 60000
  });

  try {
    // Check health
    const health = await client.health();
    console.log(`API Status: ${health.status}`);

    // List models
    const models = await client.listModels();
    console.log(`Available models: ${models.data.length}`);

    // Make inference
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Explain AI briefly.' }
    ];

    const request: InferRequest = {
      model: 'gpt-4',
      messages,
      max_tokens: 100,
      temperature: 0.7
    };

    const response = await client.infer(request);

    // Print response
    console.log('\nResponse:');
    console.log(response.choices[0].message.content);

    // Print usage
    if (response.usage) {
      console.log(`\nTokens used: ${response.usage.total_tokens}`);
    }

  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('Authentication failed');
    } else if (error instanceof NetworkError) {
      console.error('Network error:', error.message);
    } else if (error instanceof IgrisError) {
      console.error(`API error: ${error.message} (${error.statusCode})`);
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

main();
```

---

## Compatibility

- **Node.js**: >= 14.0.0
- **TypeScript**: >= 4.0.0
- **Bundlers**: Webpack, Vite, esbuild, Rollup
- **Frameworks**: Next.js, Express, NestJS, Fastify

---

## Support

- GitHub: https://github.com/igris-inertial/igris-inertial
- Issues: https://github.com/igris-inertial/igris-inertial/issues
- Email: hello@igris-inertial.com

---

**Igris Inertial** - Intelligent AI Routing and Cost Optimization
