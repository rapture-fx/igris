# JavaScript SDK Quickstart

Get started with the Schlep-engine JavaScript/TypeScript SDK in minutes.

## Installation

Install via npm, yarn, or pnpm:

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

// Initialize the client
const client = new Schlep({
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
const { Schlep } = require('schlep');

const client = new Schlep({
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
import { Schlep } from 'schlep';

const client = new Schlep({
  baseUrl: 'https://api.schlep.com',
  apiKey: 'your-api-key-here'
});

const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Explain AI' }]
});
```

## BYOK (Bring Your Own Key) Configuration

Schlep-engine supports BYOK for using your own provider API keys:

### Using the CLI

```bash
# Install CLI
pip install schlep-cli

# Configure
schlep login --url http://localhost:8081

# Add provider keys
schlep add-key --provider openai --key sk-...
schlep add-key --provider anthropic --key sk-ant-...
```

### Using the SDK

```typescript
import { Schlep } from 'schlep';

// SDK routes to the best provider automatically
const client = new Schlep({
  baseUrl: 'http://localhost:8081'
});

// Schlep-engine intelligently routes to available providers
const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Common Examples

### Chat Conversation

```typescript
import { Schlep, type Message } from 'schlep';

const client = new Schlep({ baseUrl: 'http://localhost:8081' });

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
import { Schlep } from 'schlep';

const client = new Schlep({ baseUrl: 'http://localhost:8081' });

// Get all available models
const models = await client.listModels();

console.log('Available models:');
models.data.forEach(model => {
  console.log(`  - ${model.id}`);
});
```

### Health Check

```typescript
import { Schlep } from 'schlep';

const client = new Schlep({ baseUrl: 'http://localhost:8081' });

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
  Schlep,
  SchlepError,
  AuthenticationError,
  NetworkError
} from 'schlep';

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
    console.error(`API error: ${error.message} (${error.statusCode})`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Configuration Options

### Client Configuration

```typescript
import { Schlep, type ClientConfig } from 'schlep';

const config: ClientConfig = {
  baseUrl: 'http://localhost:8081',  // API endpoint
  apiKey: 'your-api-key',            // Optional authentication
  timeout: 60000,                    // Timeout in milliseconds
  headers: {                         // Custom headers
    'X-Custom-Header': 'value'
  }
};

const client = new Schlep(config);
```

### Inference Parameters

```typescript
import { Schlep, type InferRequest } from 'schlep';

const client = new Schlep();

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
import { Schlep } from 'schlep';

const app = express();
app.use(express.json());

const client = new Schlep({
  baseUrl: process.env.SCHLEP_API_URL || 'http://localhost:8081'
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
import { Schlep, type Message } from 'schlep';
import * as readline from 'readline';

async function chatLoop() {
  const client = new Schlep({ baseUrl: 'http://localhost:8081' });

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
SCHLEP_API_URL=http://localhost:8081
SCHLEP_API_KEY=your-api-key
```

```typescript
import { Schlep } from 'schlep';

const client = new Schlep({
  baseUrl: process.env.SCHLEP_API_URL,
  apiKey: process.env.SCHLEP_API_KEY
});
```

## Next Steps

- Read the [JavaScript SDK Reference](/docs/api/javascript_reference.md)
- Explore [TypeScript Examples](/docs/examples/typescript/)
- Learn about [BYOK configuration](/docs/byok.md)
- See [Next.js Integration Guide](/docs/integrations/nextjs.md)

## Support

- GitHub Issues: https://github.com/schlep-engine/schlep-engine/issues
- Email: hello@schlep-engine.com
- Documentation: https://github.com/schlep-engine/schlep-engine

---

**Schlep-engine** - Intelligent AI Routing and Cost Optimization
