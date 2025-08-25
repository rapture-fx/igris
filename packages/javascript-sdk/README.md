# Schlep-engine JavaScript SDK

[![npm version](https://badge.fury.io/js/%40schlep-engine%2Fjavascript-sdk.svg)](https://badge.fury.io/js/%40schlep-engine%2Fjavascript-sdk)
[![TypeScript](https://badges.aleen42.io/src/typescript.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official JavaScript/TypeScript SDK for [Schlep-engine](https://schlep-engine.com) - Advanced data processing, machine learning, and analytics platform.

## 🚀 Features

- **Universal Compatibility**: Works in browsers and Node.js environments
- **Full TypeScript Support**: Complete type definitions and IntelliSense
- **Real-time Streaming**: WebSocket support for live data processing updates
- **File Upload**: Progress tracking and resumable uploads
- **Authentication**: API key and JWT authentication with automatic token refresh
- **Error Handling**: Comprehensive error handling with retry logic
- **Rate Limiting**: Built-in rate limiting with automatic backoff
- **Tree-shakable**: Optimized for modern bundlers

## 📦 Installation

```bash
npm install @schlep-engine/javascript-sdk
```

```bash
yarn add @schlep-engine/javascript-sdk
```

```bash
pnpm add @schlep-engine/javascript-sdk
```

## 🏃 Quick Start

### API Key Authentication

```typescript
import { SchlepEngineClient, DataFormat } from '@schlep-engine/javascript-sdk';

const client = new SchlepEngineClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.schlep-engine.com'
});

// Process a file
const result = await client.data.processFile(file, {
  outputFormat: DataFormat.JSON,
  onProgress: (progress) => console.log(`${progress.percentage}% complete`)
});
```

### User Authentication

```typescript
const client = new SchlepEngineClient();

// Login
await client.auth.login('user@example.com', 'password');

// Now you can make authenticated requests
const user = await client.auth.getCurrentUser();
```

### Data Processing

```typescript
// Upload and process file
const result = await client.data.processFile(file, {
  dataFormat: DataFormat.CSV,
  processingMode: ProcessingMode.BATCH,
  transformations: [
    { name: 'clean_data', type: 'filter', parameters: { remove_nulls: true } },
    { name: 'normalize', type: 'map', parameters: { method: 'min_max' } }
  ],
  onProgress: (progress) => console.log(`Processing: ${progress.percentage}%`)
});

// Wait for job completion
const finalResult = await client.data.waitForJob(result.data.job_id);
```

### Machine Learning

```typescript
import { MLTaskType, ModelType } from '@schlep-engine/javascript-sdk';

// Create ML pipeline
const pipeline = await client.ml.createPipeline({
  name: 'Sales Prediction',
  task_type: MLTaskType.REGRESSION,
  model_type: ModelType.RANDOM_FOREST,
  target_column: 'sales',
  feature_columns: ['price', 'marketing_spend', 'season']
});

// Train model
const trainingJob = await client.ml.trainModel(
  pipeline.data.pipeline_id,
  trainingFile,
  {
    onProgress: (progress) => console.log(`Training: ${progress.percentage}%`),
    featureEngineering: {
      auto_feature_selection: true,
      scaling_method: 'standard'
    }
  }
);

// Make predictions
const prediction = await client.ml.predict({
  model_id: 'model_123',
  input_data: { price: 29.99, marketing_spend: 1000, season: 'winter' },
  return_probabilities: true
});
```

### Real-time Streaming

```typescript
import { StreamingManager } from '@schlep-engine/javascript-sdk';

const streaming = new StreamingManager({
  baseUrl: 'https://api.schlep-engine.com',
  apiKey: 'your-api-key'
});

await streaming.initialize();

// Subscribe to job updates
streaming.subscribeToJob('job_123', {
  onEvent: (event) => console.log('Job update:', event),
  onError: (error) => console.error('Stream error:', error)
});

// Subscribe to ML training events
streaming.subscribeToMLTraining({
  onEvent: (event) => console.log('Training progress:', event)
});
```

## 📚 API Reference

### Client Configuration

```typescript
const client = new SchlepEngineClient({
  apiKey?: string;           // API key for authentication
  baseUrl?: string;          // API base URL (default: production)
  timeout?: number;          // Request timeout in ms (default: 30000)
  retries?: number;          // Number of retry attempts (default: 3)
  retryDelay?: number;       // Initial retry delay in ms (default: 1000)
  debug?: boolean;           // Enable debug logging (default: false)
  environment?: 'development' | 'staging' | 'production';
  headers?: Record<string, string>; // Additional headers
});
```

### Data Processing API

```typescript
// Process file with options
await client.data.processFile(file, {
  dataFormat?: DataFormat;
  processingMode?: ProcessingMode;
  transformations?: TransformationRule[];
  outputFormat?: DataFormat;
  onProgress?: (progress) => void;
});

// Process from URL
await client.data.processUrl(url, dataFormat, options);

// Get data quality report
await client.data.getDataQuality(source, { validationRules });

// Create processing pipeline
await client.data.createPipeline(pipelineConfig);
```

### ML Pipeline API

```typescript
// Create ML pipeline
await client.ml.createPipeline(config);

// Train model
await client.ml.trainModel(pipelineId, trainingData, options);

// Make predictions
await client.ml.predict(request);

// Deploy model
await client.ml.deployModel(deploymentConfig);

// Run AutoML
await client.ml.runAutoML(config, trainingData);
```

### Storage API

```typescript
// Upload file
await client.storage.uploadFile(file, {
  tags: ['dataset'],
  metadata: { source: 'upload' },
  onProgress: (progress) => console.log(progress)
});

// List files
await client.storage.listFiles({ tags: ['dataset'] });

// Create share link
await client.storage.createShareLink(fileId, { expiresAt });

// Get download URL
const url = client.storage.getDownloadUrl(fileId);
```

### Authentication API

```typescript
// Login/logout
await client.auth.login(email, password);
await client.auth.logout();

// Token management
await client.auth.refreshToken();

// User management
await client.auth.getCurrentUser();
await client.auth.updateProfile(updates);

// API keys
await client.auth.createApiKey(name, permissions);
await client.auth.listApiKeys();
```

### Monitoring API

```typescript
// System health
await client.monitoring.getHealth();
await client.monitoring.getRealtimeMetrics();

// Usage statistics
await client.monitoring.getUsageStats({ period: 'day' });

// Alerts
await client.monitoring.createAlert(alertConfig);
await client.monitoring.getActiveAlerts();
```

## 🌐 Browser Usage

### Via CDN

```html
<script src="https://unpkg.com/@schlep-engine/javascript-sdk/dist/index.umd.js"></script>
<script>
  const client = new SchlepEngine.SchlepEngineClient({
    apiKey: 'your-api-key'
  });
</script>
```

### File Upload with Progress

```typescript
const fileInput = document.querySelector('#file-input') as HTMLInputElement;
const file = fileInput.files?.[0];

if (file) {
  const result = await client.data.processFile(file, {
    onProgress: (progress) => {
      const progressBar = document.querySelector('#progress');
      progressBar.style.width = `${progress.percentage}%`;
    }
  });
}
```

## 🖥️ Node.js Usage

### Environment Variables

```bash
export SCHLEP_API_KEY="your-api-key"
export SCHLEP_BASE_URL="https://api.schlep-engine.com"
```

### File Processing

```typescript
import fs from 'fs';
import { SchlepEngineClient } from '@schlep-engine/javascript-sdk';

const client = new SchlepEngineClient({
  apiKey: process.env.SCHLEP_API_KEY
});

// Process local file
const fileBuffer = fs.readFileSync('./data.csv');
const file = new File([fileBuffer], 'data.csv', { type: 'text/csv' });

const result = await client.data.processFile(file);
```

## 🔧 Error Handling

```typescript
import { 
  SchlepEngineError, 
  APIError, 
  AuthenticationError, 
  RateLimitError 
} from '@schlep-engine/javascript-sdk';

try {
  const result = await client.data.processFile(file);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
    // Redirect to login
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded:', error.retryAfter);
    // Wait and retry
  } else if (error instanceof APIError) {
    console.error('API error:', error.statusCode, error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## 🔄 Retry Logic

The SDK includes automatic retry logic for transient errors:

```typescript
const client = new SchlepEngineClient({
  retries: 5,              // Number of retries
  retryDelay: 1000,        // Initial delay (ms)
  // Exponential backoff with jitter is applied automatically
});
```

## 📊 Rate Limiting

The SDK automatically handles rate limiting:

```typescript
// Check current rate limit status
const rateLimits = client.httpClient.getRateLimitInfo();
console.log('Requests remaining:', rateLimits.remaining);
console.log('Reset time:', rateLimits.resetTime);
```

## 🔐 Security

### Token Storage

- **Browser**: Uses `localStorage` for token storage
- **Node.js**: Uses secure file storage with proper permissions
- **Memory**: Available for temporary sessions

### HTTPS Only

The SDK enforces HTTPS in production environments and validates SSL certificates.

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run browser tests
npm run test:browser
```

### Mock Service Worker

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## 📖 Examples

Check out the [examples](./examples/) directory for comprehensive usage examples:

- [Basic Usage](./examples/basic-usage.ts) - Core functionality
- [Data Processing](./examples/data-processing.ts) - File processing workflows
- [Machine Learning](./examples/machine-learning.ts) - ML pipelines and training
- [Real-time Streaming](./examples/streaming.ts) - WebSocket integration
- [Browser Integration](./examples/browser.html) - Frontend usage
- [Node.js Scripts](./examples/node-scripts.ts) - Server-side automation

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.schlep-engine.com/sdk/javascript](https://docs.schlep-engine.com/sdk/javascript)
- **API Reference**: [https://api.schlep-engine.com/docs](https://api.schlep-engine.com/docs)
- **Support**: [support@schlep-engine.com](mailto:support@schlep-engine.com)
- **Issues**: [GitHub Issues](https://github.com/schlep-engine/javascript-sdk/issues)

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for details about changes in each version.

---

Built with ❤️ by the [Schlep-engine](https://schlep-engine.com) team