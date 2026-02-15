# JavaScript SDK Quickstart

Get started with the Igris Inertial JavaScript/TypeScript SDK in minutes.

## Installation

Install via npm, yarn, or pnpm:

```bash
npm install igris
# or
yarn add igris
# or
pnpm add igris
```

## Quick Start

### TypeScript/ESM

```typescript
import { Igris } from 'igris';

// Initialize the client
const client = new Igris({
  baseUrl: 'http://localhost:8081'
});

// Make an inference request
const response = await client.infer({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello, world!' }
  ],
  max_tokens: 100
});

// Print the response
console.log(response.choices[0].message.content);
```

### CommonJS (Node.js)

```javascript
const { Igris } = require('igris');

const client = new Igris({
  baseUrl: 'http://localhost:8081'
});

async function main() {
  const response = await client.infer({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  });

  console.log(response.choices[0].message.content);
}

main();
```

### With Authentication

```typescript
import { Igris } from 'igris';

const client = new Igris({
  baseUrl: 'https://api.igris-inertial.com',
  apiKey: 'your-api-key-here'
});

const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Explain AI' }]
});
```

## BYOK (Bring Your Own Key) Configuration

Igris Inertial supports BYOK for using your own provider API keys:

### Using the CLI

```bash
# Install CLI
pip install igris-cli

# Configure
igris login --url http://localhost:8081

# Add provider keys
igris add-key --provider openai --key sk-...
igris add-key --provider anthropic --key sk-ant-...
```

### Using the SDK

```typescript
import { Igris } from 'igris';

// SDK routes to the best provider automatically
const client = new Igris({
  baseUrl: 'http://localhost:8081'
});

// Igris Inertial intelligently routes to available providers
const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Common Examples

### Chat Conversation

```typescript
import { Igris, type Message } from 'igris';

const client = new Igris({ baseUrl: 'http://localhost:8081' });

// Multi-turn conversation
const messages: Message[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is machine learning?' }
];

const response = await client.infer({
  model: 'gpt-4',
  messages,
  max_tokens: 200,
  temperature: 0.7
});

// Add assistant response
messages.push({
  role: 'assistant',
  content: response.choices[0].message.content
});

// Continue conversation
messages.push({
  role: 'user',
  content: 'Can you give me an example?'
});

const response2 = await client.infer({ model: 'gpt-4', messages });
console.log(response2.choices[0].message.content);
```

### List Available Models

```typescript
import { Igris } from 'igris';

const client = new Igris({ baseUrl: 'http://localhost:8081' });

// Get all available models
const models = await client.listModels();

console.log('Available models:');
models.data.forEach(model => {
  console.log(`  - ${model.id}`);
});
```

### Health Check

```typescript
import { Igris } from 'igris';

const client = new Igris({ baseUrl: 'http://localhost:8081' });

// Check API health
const health = await client.health();

console.log(`Status: ${health.status}`);
if (health.status === 'healthy') {
  console.log('API is operational');
}
```

### Error Handling

```typescript
import {
  Igris,
  IgrisError,
  AuthenticationError,
  NetworkError
} from 'igris';

const client = new Igris({ baseUrl: 'http://localhost:8081' });

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
  } else if (error instanceof IgrisError) {
    console.error(`API error: ${error.message} (${error.statusCode})`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Configuration Options

### Client Configuration

```typescript
import { Igris, type ClientConfig } from 'igris';

const config: ClientConfig = {
  baseUrl: 'http://localhost:8081',  // API endpoint
  apiKey: 'your-api-key',            // Optional authentication
  timeout: 60000,                    // Timeout in milliseconds
  headers: {                         // Custom headers
    'X-Custom-Header': 'value'
  }
};

const client = new Igris(config);
```

### Inference Parameters

```typescript
import { Igris, type InferRequest } from 'igris';

const client = new Igris();

const request: InferRequest = {
  model: 'gpt-4',                    // Model name
  messages: [...],                   // Conversation messages
  max_tokens: 500,                   // Maximum response length
  temperature: 0.7,                  // Randomness (0.0 - 2.0)
  top_p: 0.9,                       // Nucleus sampling
  // Additional provider-specific parameters
};

const response = await client.infer(request);
```

## Framework Integration

### Next.js API Route

```typescript
// app/api/chat/route.ts
import { Igris } from 'igris';
import { NextRequest, NextResponse } from 'next/server';

const client = new Igris({
  baseUrl: process.env.IGRIS_API_URL || 'http://localhost:8081',
  apiKey: process.env.IGRIS_API_KEY
});

export async function POST(request: NextRequest) {
  const { message } = await request.json();

  try {
    const response = await client.infer({
      model: 'gpt-4',
      messages: [{ role: 'user', content: message }],
      max_tokens: 200
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Express.js

```typescript
import express from 'express';
import { Igris } from 'igris';

const app = express();
app.use(express.json());

const client = new Igris({
  baseUrl: process.env.IGRIS_API_URL || 'http://localhost:8081'
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    const response = await client.infer({
      model: 'gpt-4',
      messages: [{ role: 'user', content: message }]
    });

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### React Component

```typescript
import { useState } from 'react';

function ChatComponent() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      setResponse(data.choices[0].message.content);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask a question..."
      />
      <button disabled={loading}>
        {loading ? 'Loading...' : 'Send'}
      </button>
      {response && <div>{response}</div>}
    </form>
  );
}
```

## Example: Real-time Chat CLI

```typescript
import { Igris, type Message } from 'igris';
import * as readline from 'readline';

async function chatLoop() {
  const client = new Igris({ baseUrl: 'http://localhost:8081' });

  const messages: Message[] = [
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('Chat started. Type "quit" to exit.\n');

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'quit') {
        rl.close();
        return;
      }

      messages.push({ role: 'user', content: input });

      try {
        const response = await client.infer({
          model: 'gpt-4',
          messages,
          max_tokens: 300
        });

        const assistantMessage = response.choices[0].message.content;
        messages.push({ role: 'assistant', content: assistantMessage });

        console.log(`\nAssistant: ${assistantMessage}\n`);
      } catch (error) {
        console.error(`\nError: ${error.message}\n`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

chatLoop();
```

## Environment Variables

```bash
# .env
IGRIS_API_URL=http://localhost:8081
IGRIS_API_KEY=your-api-key
```

```typescript
import { Igris } from 'igris';

const client = new Igris({
  baseUrl: process.env.IGRIS_API_URL,
  apiKey: process.env.IGRIS_API_KEY
});
```

## Next Steps

- Read the [JavaScript SDK Reference](/docs/api/javascript_reference.md)
- Explore [TypeScript Examples](/docs/examples/typescript/)
- Learn about [BYOK configuration](/docs/byok.md)
- See [Next.js Integration Guide](/docs/integrations/nextjs.md)

## Support

- GitHub Issues: https://github.com/igris-inertial/igris-inertial/issues
- Email: hello@igris-inertial.com
- Documentation: https://github.com/igris-inertial/igris-inertial

---

**Igris Inertial** - Intelligent AI Routing and Cost Optimization
