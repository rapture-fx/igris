import Link from 'next/link'
import { ArrowRightIcon, ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

export default function SDKMigrationPage() {
  const migrationScenarios = [
    {
      from: 'Python SDK v1.x',
      to: 'Python SDK v2.x',
      difficulty: 'Medium',
      breakingChanges: 5,
      description: 'Major refactor with async/await support and enhanced error handling'
    },
    {
      from: 'REST API',
      to: 'Any SDK',
      difficulty: 'Easy',
      breakingChanges: 0,
      description: 'Wrapper around existing API calls with additional features'
    },
    {
      from: 'JavaScript SDK',
      to: 'Python SDK',
      difficulty: 'Medium',
      breakingChanges: 3,
      description: 'Language change with similar API patterns and functionality'
    },
    {
      from: 'CLI',
      to: 'Go SDK',
      difficulty: 'Hard',
      breakingChanges: 8,
      description: 'Different paradigm from command-line to programmatic API'
    }
  ]

  const compatibilityMatrix = [
    {
      feature: 'Data Processing',
      python: 'Full',
      javascript: 'Full', 
      go: 'Full',
      cli: 'Full',
      openapi: 'Full'
    },
    {
      feature: 'ML Pipelines',
      python: 'Full',
      javascript: 'Full',
      go: 'Full', 
      cli: 'Full',
      openapi: 'Full'
    },
    {
      feature: 'Real-time Streaming',
      python: 'Full',
      javascript: 'Full',
      go: 'Full',
      cli: 'Partial',
      openapi: 'Varies'
    },
    {
      feature: 'Authentication',
      python: 'API Key + OAuth',
      javascript: 'API Key + OAuth',
      go: 'API Key + OAuth', 
      cli: 'API Key + OAuth',
      openapi: 'API Key'
    },
    {
      feature: 'File Upload',
      python: 'Full',
      javascript: 'Full',
      go: 'Full',
      cli: 'Full', 
      openapi: 'Full'
    },
    {
      feature: 'Batch Operations',
      python: 'Full',
      javascript: 'Full',
      go: 'Full',
      cli: 'Full',
      openapi: 'Partial'
    }
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">SDK Migration & Compatibility Guide</h1>
        <p className="text-xl text-gray-600 mb-6">
          Complete guide for migrating between Schlep Engine SDKs, understanding compatibility, 
          and choosing the right SDK for your use case.
        </p>
      </div>

      {/* SDK Compatibility Matrix */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">SDK Feature Compatibility Matrix</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Python</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">JavaScript</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Go</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CLI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OpenAPI</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {compatibilityMatrix.map((row, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{row.feature}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">{row.python}</td>
                  <td className="px-6 py-4 text-sm">{row.javascript}</td>
                  <td className="px-6 py-4 text-sm">{row.go}</td>
                  <td className="px-6 py-4 text-sm">{row.cli}</td>
                  <td className="px-6 py-4 text-sm">{row.openapi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Full Support</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Partial Support</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span>Varies by Language</span>
          </div>
        </div>
      </section>

      {/* Migration Scenarios */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Migration Scenarios</h2>
        
        <div className="grid gap-6">
          {migrationScenarios.map((scenario, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {scenario.from} → {scenario.to}
                  </h3>
                  <p className="text-gray-600">{scenario.description}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    scenario.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                    scenario.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {scenario.difficulty}
                  </span>
                  <div className="text-sm text-gray-500 mt-1">
                    {scenario.breakingChanges} breaking changes
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Python SDK v1 to v2 Migration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Python SDK v1.x → v2.x Migration</h2>
        
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-6 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-orange-800 mb-2">Breaking Changes</h3>
              <p className="text-orange-700">
                The v2.0 release includes several breaking changes. Please review this guide carefully before upgrading.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Client Initialization</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-red-600 mb-2">❌ v1.x (deprecated)</h4>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-100">
{`from schlep_engine import SchlepClient

client = SchlepClient(api_key="your-key")`}
                  </pre>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-green-600 mb-2">✅ v2.x (new)</h4>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-100">
{`from schlep_engine import SchlepEngineClient

client = SchlepEngineClient(api_key="your-key")`}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Async/Await Support</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-red-600 mb-2">❌ v1.x (deprecated)</h4>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-100">
{`result = client.upload_csv("data.csv")
data = client.download_pandas(result.id)`}
                  </pre>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-green-600 mb-2">✅ v2.x (new)</h4>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-100">
{`result = await client.data.process_file("data.csv")
data = await client.data.download_result(result.job_id)`}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Response Objects</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-red-600 mb-2">❌ v1.x (deprecated)</h4>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-100">
{`result.id  # String ID
result.status  # String status`}
                  </pre>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-green-600 mb-2">✅ v2.x (new)</h4>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-100">
{`result.job_id  # UUID object
result.status  # Enum with type safety
result.metadata  # Rich metadata object`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Migration Checklist</h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              <span>Update import statements to use <code>SchlepEngineClient</code></span>
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              <span>Convert synchronous calls to async/await pattern</span>
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              <span>Update method names and response object properties</span>
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              <span>Update error handling to use new exception types</span>
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              <span>Test all functionality before deploying to production</span>
            </li>
          </ul>
        </div>
      </section>

      {/* REST API to SDK Migration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">REST API → SDK Migration</h2>
        
        <p className="text-gray-600 mb-6">
          If you're currently using direct REST API calls, migrating to an SDK provides significant benefits 
          including error handling, retry logic, type safety, and simplified authentication.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Before (Direct API)</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`import requests

headers = {
    "Authorization": "Bearer your-api-key",
    "Content-Type": "application/json"
}

response = requests.post(
    "https://api.schlep-engine.com/v1/data/process",
    headers=headers,
    json={"file_path": "data.csv"}
)

if response.status_code == 200:
    result = response.json()
    print(f"Job ID: {result['job_id']}")
else:
    print(f"Error: {response.status_code}")`}
              </pre>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">After (Python SDK)</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`from schlep_engine import SchlepEngineClient

client = SchlepEngineClient(api_key="your-api-key")

try:
    result = await client.data.process_file("data.csv")
    print(f"Job ID: {result.job_id}")
except Exception as e:
    print(f"Error: {e}")`}
              </pre>
            </div>
          </div>
        </div>

        <div className="border border-green-200 bg-green-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Benefits of Using SDKs</h3>
          <ul className="text-green-700 space-y-2">
            <li>• Automatic retry logic and error handling</li>
            <li>• Type safety and IDE autocompletion</li>
            <li>• Simplified authentication management</li>
            <li>• Built-in rate limiting and backoff</li>
            <li>• Consistent error handling patterns</li>
            <li>• Automatic request/response serialization</li>
          </ul>
        </div>
      </section>

      {/* Cross-Language Migration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Cross-Language Migration</h2>
        
        <p className="text-gray-600 mb-6">
          When migrating between different programming languages, the core concepts remain the same 
          but the syntax and patterns differ. Here's how common operations translate across languages:
        </p>

        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Initialization</h3>
            <div className="grid gap-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Python</h4>
                <div className="bg-gray-900 rounded p-3">
                  <code className="text-sm text-gray-100">
                    client = SchlepEngineClient(api_key="your-key")
                  </code>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2">JavaScript</h4>
                <div className="bg-gray-900 rounded p-3">
                  <code className="text-sm text-gray-100">
                    const client = new SchlepEngineClient({`{apiKey: "your-key"}`})
                  </code>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Go</h4>
                <div className="bg-gray-900 rounded p-3">
                  <code className="text-sm text-gray-100">
                    client, err := client.NewClient(&config.Config{`{APIKey: "your-key"}`})
                  </code>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">File Processing</h3>
            <div className="grid gap-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Python</h4>
                <div className="bg-gray-900 rounded p-3">
                  <code className="text-sm text-gray-100">
                    result = await client.data.process_file("data.csv")
                  </code>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2">JavaScript</h4>
                <div className="bg-gray-900 rounded p-3">
                  <code className="text-sm text-gray-100">
                    const result = await client.data.processFile(file)
                  </code>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Go</h4>
                <div className="bg-gray-900 rounded p-3">
                  <code className="text-sm text-gray-100">
                    result, err := client.Data.ProcessFile(ctx, request)
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Migration Best Practices</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">✅ Best Practices</h3>
            <ul className="text-blue-800 space-y-2">
              <li>• Test migrations in a staging environment first</li>
              <li>• Update dependencies gradually</li>
              <li>• Keep both old and new implementations during transition</li>
              <li>• Monitor error rates and performance after migration</li>
              <li>• Update documentation and team training materials</li>
              <li>• Use feature flags for gradual rollout</li>
            </ul>
          </div>
          
          <div className="border border-red-200 bg-red-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-3">❌ Common Pitfalls</h3>
            <ul className="text-red-800 space-y-2">
              <li>• Migrating everything at once without testing</li>
              <li>• Ignoring breaking changes in new versions</li>
              <li>• Not updating error handling patterns</li>
              <li>• Forgetting to update CI/CD pipelines</li>
              <li>• Missing authentication method changes</li>
              <li>• Overlooking rate limiting differences</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Migration Tools */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibent text-gray-900 mb-6">Migration Tools & Resources</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🔄 Migration Scripts</h3>
            <p className="text-gray-600 mb-4">
              Automated scripts to help convert code patterns between SDK versions.
            </p>
            <Link href="https://github.com/schlep-engine/migration-tools" className="text-blue-600 hover:text-blue-700 font-medium">
              View Migration Tools →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📚 Code Examples</h3>
            <p className="text-gray-600 mb-4">
              Side-by-side examples showing equivalent functionality across SDKs.
            </p>
            <Link href="/use-cases" className="text-blue-600 hover:text-blue-700 font-medium">
              View Examples →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">💬 Support</h3>
            <p className="text-gray-600 mb-4">
              Get help with migrations from our support team and community.
            </p>
            <Link href="mailto:support@schlep-engine.com" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact Support →
            </Link>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Resources</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">📖 Documentation</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/sdks" className="text-blue-600 hover:text-blue-700">
                  SDK Overview →
                </Link>
              </li>
              <li>
                <Link href="/api-reference" className="text-blue-600 hover:text-blue-700">
                  API Reference →
                </Link>
              </li>
              <li>
                <Link href="/guides/best-practices" className="text-blue-600 hover:text-blue-700">
                  Best Practices →
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-3">🎯 Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/changelog" className="text-blue-600 hover:text-blue-700">
                  Changelog →
                </Link>
              </li>
              <li>
                <Link href="/guides/troubleshooting" className="text-blue-600 hover:text-blue-700">
                  Troubleshooting →
                </Link>
              </li>
              <li>
                <Link href="/use-cases" className="text-blue-600 hover:text-blue-700">
                  Use Cases →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}