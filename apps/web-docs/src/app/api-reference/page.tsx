import Link from 'next/link'
import { ArrowRightIcon, CloudArrowUpIcon, CpuChipIcon, DocumentArrowDownIcon, ClockIcon } from '@heroicons/react/24/outline'
import { ApiLayout } from '@/components/ui/ApiLayout'

export default function ApiReferencePage() {
  const endpoints = [
    {
      method: 'POST',
      path: '/api/v1/upload',
      description: 'Upload datasets for processing and analysis',
      href: '/api-reference/upload',
      icon: CloudArrowUpIcon,
    },
    {
      method: 'GET',
      path: '/api/v1/datasets',
      description: 'List datasets and their processing status',
      href: '/api-reference/datasets',
      icon: CpuChipIcon,
    },
    {
      method: 'POST',
      path: '/api/v1/data-processing/processing/investigations/',
      description: 'Create AI-powered data investigations and quality assessments',
      href: '/api-reference/data-processing',
      icon: CpuChipIcon,
    },
    {
      method: 'POST',
      path: '/api/v1/ml-pipeline/pipelines/',
      description: 'Create automated ML pipelines with model training and deployment',
      href: '/api-reference/ml-pipeline',
      icon: CpuChipIcon,
    },
    {
      method: 'GET',
      path: '/api/v1/analytics/time-savings',
      description: 'Track time savings and team productivity metrics',
      href: '/api-reference/analytics',
      icon: ClockIcon,
    },
    {
      method: 'POST',
      path: '/api/v1/analytics/webhooks',
      description: 'Configure webhook notifications for pipeline events',
      href: '/api-reference/analytics',
      icon: ClockIcon,
    },
    {
      method: 'GET',
      path: '/api/v1/billing/usage',
      description: 'Get current usage and billing information with LemonSqueezy',
      href: '/api-reference/billing',
      icon: DocumentArrowDownIcon,
    },
    {
      method: 'GET',
      path: '/api/v1/metrics',
      description: 'Get Prometheus system metrics and health status',
      href: '/api-reference/metrics',
      icon: ClockIcon,
    },
  ]

  const codeExamples = [
    {
      language: 'python',
      label: 'Python SDK',
      code: `from schlep_engine import SchlepClient

# Initialize client
client = SchlepClient(api_key="your_api_key")

# Upload and process data in one step
job = client.upload_csv("customer_data.csv", 
                       name="Customer Data Analysis")

# Get processing results with auto-insights
result = client.process(job.id, 
                       auto_clean=True,
                       generate_insights=True)

# Download as pandas DataFrame
df = client.download_pandas(result.id)
print(f"Processed {len(df)} rows with quality score: {result.quality_score}")`
    },
    {
      language: 'javascript',
      label: 'JavaScript SDK',
      code: `import { SchlepClient } from '@schlep-engine/js-sdk';

// Initialize client
const client = new SchlepClient({ apiKey: 'your_api_key' });

// Upload and process with streaming progress
const job = await client.uploadCSV('customer_data.csv', {
  name: 'Customer Data Analysis',
  onProgress: (progress) => console.log(\`\${progress}% complete\`)
});

// Process with AI auto-clean
const result = await client.process(job.id, {
  autoClean: true,
  generateInsights: true
});

// Download processed data
const data = await client.download(result.id);
console.log(\`Quality improved from \${job.quality_score} to \${result.quality_score}\`);`
    },
    {
      language: 'cli',
      label: 'CLI Tool',
      code: `# Install CLI
pip install schlep-engine-cli

# Upload and process in one command
schlep process customer_data.csv \\
  --name "Customer Data Analysis" \\
  --auto-clean \\
  --generate-insights \\
  --output processed_data.parquet \\
  --format parquet

# Watch directory for batch processing
schlep watch ./data_pipeline \\
  --auto-process \\
  --notify-webhook https://your-app.com/webhook

# Output: Processed 45,000 rows | Quality: 89% | Time: 2.3s`
    },
    {
      language: 'r',
      label: 'R Package',
      code: `library(schlepengine)

# Initialize client
client <- schlep_client(api_key = "your_api_key")

# Upload CSV with R data.frame
job <- upload_dataframe(client, customer_data, 
                       name = "Customer Data Analysis")

# Process with AI insights
result <- process_data(client, job$id, 
                      auto_clean = TRUE,
                      generate_insights = TRUE)

# Get results as data.frame
df <- download_dataframe(client, result$id)
cat("Quality score improved to:", result$quality_score)`
    }
  ]

  return (
    <ApiLayout 
      title="API Reference"
      description="The Schlep Engine API is organized around REST. Our API has predictable resource-oriented URLs, accepts form-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes, authentication, and verbs."
      codeExamples={codeExamples}
    >
      <div className="prose prose-gray max-w-none mb-8">
        <p>
          You can use the Schlep Engine API in test mode, which doesn&apos;t affect your live data or consume your quota. 
          The API key you use to <Link href="/api-reference/authentication" className="text-blue-600 hover:text-blue-700">authenticate</Link> the request determines whether the request is live mode or test mode.
        </p>
        
        <p>
          The Schlep Engine API processes one dataset per request for optimal performance and reliability. 
          Bulk operations are supported through our batch processing endpoints.
        </p>
        
        <p>
          The Schlep Engine API is continuously updated with new <Link href="/changelog" className="text-blue-600 hover:text-blue-700">versions</Link> and 
          tailored functionality. Your API key determines which features you have access to based on your subscription plan.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-3">Just getting started?</h3>
        <p className="text-blue-800 mb-4">
          Check out our <Link href="/introduction/quickstart" className="font-medium text-blue-700 hover:text-blue-800">development quickstart</Link> guide.
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-3">Not a developer?</h3>
        <p className="text-gray-700">
          Use Schlep Engine&apos;s <Link href="/integrations" className="font-medium text-blue-600 hover:text-blue-700">no-code integrations</Link> or 
          apps from <Link href="/marketplace" className="font-medium text-blue-600 hover:text-blue-700">our partners</Link> to 
          get started with AI-powered data processing—no code required.
        </p>
      </div>


      {/* Authentication */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-2">Authentication Required</h3>
        <p className="text-blue-800 mb-4">
          All API requests require authentication using API keys in the Authorization header.
        </p>
        <Link 
          href="/api-reference/authentication"
          className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 font-medium"
        >
          Learn about authentication
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>

      {/* Core Endpoints */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Core Endpoints</h2>
        <div className="space-y-4">
          {endpoints.map((endpoint, index) => (
            <Link 
              key={index}
              href={endpoint.href}
              className="block border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <endpoint.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      endpoint.method === 'GET' ? 'bg-green-100 text-green-800' : 
                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {endpoint.method}
                    </span>
                    <code className="font-mono text-gray-900">{endpoint.path}</code>
                  </div>
                  <p className="text-gray-600">{endpoint.description}</p>
                </div>
                <div className="flex-shrink-0">
                  <ArrowRightIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Data Processing Pipeline */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Data Processing Pipeline</h2>
        <p className="text-gray-600 mb-6">
          Understanding the typical flow of data through our API:
        </p>
        
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              1
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link href="/api-reference/upload" className="hover:text-blue-600">
                  Data Upload
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">
                Upload CSV, JSON, Excel files, or connect to databases and APIs. Our system automatically detects formats and begins initial analysis.
              </p>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 mr-2">CSV</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 mr-2">JSON</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 mr-2">Excel</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800">Databases</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link href="/api-reference/profiling" className="hover:text-blue-600">
                  Smart Profiling
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">
                AI analyzes your data to detect types, quality issues, patterns, and structural anomalies. Generate comprehensive data profiles automatically.
              </p>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 mr-2">Quality Score</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 mr-2">Data Types</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800">Issue Detection</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link href="/api-reference/processing" className="hover:text-blue-600">
                  AI Processing
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">
                Apply intelligent transformations, clean data, handle missing values, normalize formats, and prepare for ML frameworks.
              </p>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800 mr-2">Auto Clean</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800 mr-2">Outlier Detection</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800">ML Ready</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              4
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link href="/api-reference/export" className="hover:text-blue-600">
                  Export & Download
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">
                Download processed data in multiple formats or export directly to your preferred ML framework with automated train/test splits.
              </p>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-800 mr-2">TensorFlow</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-800 mr-2">PyTorch</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-800">Parquet</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start with SDKs */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Get Started with SDKs</h2>
        <p className="text-gray-600 mb-6">
          Choose your preferred language and get up and running in minutes with our purpose-built client libraries.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Python SDK</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">v2.1.0</span>
            </div>
            <p className="text-gray-600 mb-4">Perfect for data scientists and ML engineers with pandas integration.</p>
            <div className="bg-gray-900 rounded-lg p-3 mb-3">
              <code className="text-green-400 text-sm">pip install schlep-engine</code>
            </div>
            <Link href="/sdks/python" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              View Python docs →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">JavaScript SDK</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">v1.8.2</span>
            </div>
            <p className="text-gray-600 mb-4">For Node.js and browser environments with TypeScript support.</p>
            <div className="bg-gray-900 rounded-lg p-3 mb-3">
              <code className="text-green-400 text-sm">npm install @schlep-engine/js-sdk</code>
            </div>
            <Link href="/sdks/javascript" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              View JavaScript docs →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">R Package</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">v0.9.1</span>
            </div>
            <p className="text-gray-600 mb-4">Native R integration with data.frame and ggplot2 support.</p>
            <div className="bg-gray-900 rounded-lg p-3 mb-3">
              <code className="text-green-400 text-sm">install.packages("schlepengine")</code>
            </div>
            <Link href="/sdks/r" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              View R docs →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">CLI Tool</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">v1.5.0</span>
            </div>
            <p className="text-gray-600 mb-4">Command-line interface for batch processing and automation.</p>
            <div className="bg-gray-900 rounded-lg p-3 mb-3">
              <code className="text-green-400 text-sm">pip install schlep-engine-cli</code>
            </div>
            <Link href="/sdks/cli" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              View CLI docs →
            </Link>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Need raw HTTP access?</h3>
          <p className="text-blue-800 mb-3">
            View detailed REST API endpoints with cURL examples in our individual endpoint documentation.
          </p>
          <Link 
            href="/api-reference/upload" 
            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 font-medium"
          >
            Browse API endpoints
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* Additional Resources */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Additional Resources</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Link 
            href="/api-reference/rate-limits"
            className="block p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rate Limits</h3>
            <p className="text-gray-600">
              Understanding API quotas, rate limiting, and how to handle throttling.
            </p>
          </Link>
          
          <Link 
            href="/api-reference/errors"
            className="block p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Handling</h3>
            <p className="text-gray-600">
              Complete error code reference and best practices for error handling.
            </p>
          </Link>
          
          <Link 
            href="/api-reference/webhooks"
            className="block p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Webhooks</h3>
            <p className="text-gray-600">
              Real-time notifications for processing completion and status updates.
            </p>
          </Link>
          
          <Link 
            href="/sdks"
            className="block p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">SDKs & Libraries</h3>
            <p className="text-gray-600">
              Python, JavaScript, R packages and CLI tools for easier integration.
            </p>
          </Link>
        </div>
      </section>

      {/* Response Standards */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Response Standards</h2>
        <p className="text-gray-600 mb-4">
          All API responses follow consistent patterns with proper HTTP status codes and structured JSON.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Success Response (200)</h3>
            <div className="bg-gray-900 rounded p-3 text-sm overflow-x-auto">
              <pre className="text-green-400">
{`{
  "status": "success",
  "data": { ... },
  "message": "Operation completed"
}`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Error Response (4xx/5xx)</h3>
            <div className="bg-gray-900 rounded p-3 text-sm overflow-x-auto">
              <pre className="text-red-400">
{`{
  "status": "error",
  "code": "INVALID_FILE_FORMAT",
  "message": "Unsupported file type",
  "details": { ... }
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </ApiLayout>
  )
}