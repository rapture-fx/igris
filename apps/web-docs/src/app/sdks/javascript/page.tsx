import Link from 'next/link'
import { ArrowRightIcon, CheckCircleIcon, DocumentTextIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

export default function JavaScriptSDKPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          JavaScript/TypeScript SDK
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Official JavaScript/TypeScript SDK for Schlep Engine - Universal compatibility for browsers and Node.js environments with real-time streaming and full TypeScript support.
        </p>
        
        <div className="flex items-center gap-4 mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Latest: v1.8.2
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Node.js 16+
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            TypeScript Ready
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
            Browser Compatible
          </span>
        </div>

        <div className="flex gap-4">
          <Link
            href="https://www.npmjs.com/package/@schlep-engine/javascript-sdk"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View on NPM
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/schlep-engine/javascript-sdk"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            GitHub Repository
          </Link>
        </div>
      </div>

      <div className="prose prose-lg max-w-none">
        <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Quick Start
          </h3>
          <p className="text-green-700">
            Install with npm/yarn and start processing data in under 2 minutes with full TypeScript support and browser compatibility.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# npm
npm install @schlep-engine/javascript-sdk

# yarn
yarn add @schlep-engine/javascript-sdk

# pnpm
pnpm add @schlep-engine/javascript-sdk`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Start</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">API Key Authentication</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import { SchlepEngineClient, DataFormat } from '@schlep-engine/javascript-sdk';

const client = new SchlepEngineClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.schlep-engine.com'
});

// Process a file
const result = await client.data.processFile(file, {
  outputFormat: DataFormat.JSON,
  onProgress: (progress) => console.log(\`\${progress.percentage}% complete\`)
});`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">User Authentication</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`const client = new SchlepEngineClient();

// Login
await client.auth.login('user@example.com', 'password');

// Now you can make authenticated requests
const user = await client.auth.getCurrentUser();`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Data Processing</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`// Upload and process file
const result = await client.data.processFile(file, {
  dataFormat: DataFormat.CSV,
  processingMode: ProcessingMode.BATCH,
  transformations: [
    { name: 'clean_data', type: 'filter', parameters: { remove_nulls: true } },
    { name: 'normalize', type: 'map', parameters: { method: 'min_max' } }
  ],
  onProgress: (progress) => console.log(\`Processing: \${progress.percentage}%\`)
});

// Wait for job completion
const finalResult = await client.data.waitForJob(result.data.job_id);`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Key Features</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Universal Compatibility</h4>
              <p className="text-gray-600">Works in browsers and Node.js environments</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Full TypeScript Support</h4>
              <p className="text-gray-600">Complete type definitions and IntelliSense</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Real-time Streaming</h4>
              <p className="text-gray-600">WebSocket support for live data processing</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">File Upload</h4>
              <p className="text-gray-600">Progress tracking and resumable uploads</p>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Core Features</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Machine Learning</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import { MLTaskType, ModelType } from '@schlep-engine/javascript-sdk';

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
    onProgress: (progress) => console.log(\`Training: \${progress.percentage}%\`),
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
});`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Real-time Streaming</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import { StreamingManager } from '@schlep-engine/javascript-sdk';

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
});`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">API Reference</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Client Configuration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`const client = new SchlepEngineClient({
  apiKey?: string;           // API key for authentication
  baseUrl?: string;          // API base URL (default: production)
  timeout?: number;          // Request timeout in ms (default: 30000)
  retries?: number;          // Number of retry attempts (default: 3)
  retryDelay?: number;       // Initial retry delay in ms (default: 1000)
  debug?: boolean;           // Enable debug logging (default: false)
  environment?: 'development' | 'staging' | 'production';
  headers?: Record<string, string>; // Additional headers
});`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Data Processing API</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`// Process file with options
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
await client.data.createPipeline(pipelineConfig);`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Browser Usage</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Via CDN</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`<script src="https://unpkg.com/@schlep-engine/javascript-sdk/dist/index.umd.js"></script>
<script>
  const client = new SchlepEngine.SchlepEngineClient({
    apiKey: 'your-api-key'
  });
</script>`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">File Upload with Progress</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`const fileInput = document.querySelector('#file-input') as HTMLInputElement;
const file = fileInput.files?.[0];

if (file) {
  const result = await client.data.processFile(file, {
    onProgress: (progress) => {
      const progressBar = document.querySelector('#progress');
      progressBar.style.width = \`\${progress.percentage}%\`;
    }
  });
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Node.js Usage</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Environment Variables</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`export SCHLEP_API_KEY="your-api-key"
export SCHLEP_BASE_URL="https://api.schlep-engine.com"`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">File Processing</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import fs from 'fs';
import { SchlepEngineClient } from '@schlep-engine/javascript-sdk';

const client = new SchlepEngineClient({
  apiKey: process.env.SCHLEP_API_KEY
});

// Process local file
const fileBuffer = fs.readFileSync('./data.csv');
const file = new File([fileBuffer], 'data.csv', { type: 'text/csv' });

const result = await client.data.processFile(file);`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Error Handling</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import { 
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
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Testing</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`// Run tests
npm test

// Run with coverage
npm run test:coverage

// Run browser tests
npm run test:browser`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Mock Service Worker</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());`}</code></pre>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <DocumentTextIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-gray-600 mb-4">
              Complete TypeScript API documentation with type definitions.
            </p>
            <Link href="/api-reference" className="text-blue-600 hover:text-blue-700 font-medium">
              View API Docs →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">🌐</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Browser Examples</h3>
            <p className="text-gray-600 mb-4">
              Frontend integration examples and React components.
            </p>
            <Link href="https://github.com/schlep-engine/javascript-sdk/tree/main/examples" className="text-blue-600 hover:text-blue-700 font-medium">
              View Examples →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">💬</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Support</h3>
            <p className="text-gray-600 mb-4">
              Get help from our community and support team.
            </p>
            <Link href="https://support.schlep-engine.com" className="text-blue-600 hover:text-blue-700 font-medium">
              Get Support →
            </Link>
          </div>
        </div>

        <div className="bg-green-50 border-l-4 border-green-400 p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Ready to Get Started?
          </h3>
          <p className="text-green-700 mb-4">
            Install the JavaScript SDK and start building web applications with Schlep Engine.
          </p>
          <div className="flex gap-4">
            <Link
              href="/introduction/quickstart"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Quick Start Guide
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/use-cases"
              className="inline-flex items-center gap-2 border border-green-300 text-green-700 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              View Use Cases
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}