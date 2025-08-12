import Link from 'next/link'
import { ArrowRightIcon, CodeBracketIcon, CommandLineIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function SDKsPage() {
  const sdks = [
    {
      name: 'Python SDK',
      description: 'The primary SDK for data scientists and ML engineers. Comprehensive features with pandas integration.',
      href: '/sdks/python',
      icon: '🐍',
      language: 'Python',
      version: 'v2.1.0',
      features: ['Pandas Integration', 'Async Support', 'CLI Tools', 'Jupyter Widgets'],
      installation: 'pip install schlep-engine',
      quickExample: `from schlep_engine import SchlepClient

client = SchlepClient(api_key="your_key")
job = client.upload_csv("data.csv")
result = client.process(job.id, auto_clean=True)
data = client.download_pandas(result.id)`
    },
    {
      name: 'JavaScript SDK',
      description: 'Full-featured SDK for Node.js and browser environments. Perfect for web applications and serverless functions.',
      href: '/sdks/javascript',
      icon: '⚡',
      language: 'JavaScript',
      version: 'v1.8.2',
      features: ['Browser Support', 'TypeScript Types', 'Streaming', 'Promise-based'],
      installation: 'npm install @schlep-engine/js-sdk',
      quickExample: `import { SchlepClient } from '@schlep-engine/js-sdk';

const client = new SchlepClient({ apiKey: 'your_key' });
const job = await client.uploadCSV('data.csv');
const result = await client.process(job.id, { autoClean: true });
const data = await client.download(result.id);`
    },
    {
      name: 'R Package',
      description: 'Native R integration for statisticians and data analysts. Seamless integration with R data.frame objects.',
      href: '/sdks/r',
      icon: '📊',
      language: 'R',
      version: 'v0.9.1',
      features: ['data.frame Support', 'ggplot2 Integration', 'Shiny Compatible', 'CRAN Available'],
      installation: 'install.packages("schlepengine")',
      quickExample: `library(schlepengine)

client <- schlep_client(api_key = "your_key")
job <- upload_csv(client, "data.csv")
result <- process_data(client, job$id, auto_clean = TRUE)
data <- download_dataframe(client, result$id)`
    },
    {
      name: 'CLI Tool',
      description: 'Command-line interface for batch processing, automation, and CI/CD integration.',
      href: '/sdks/cli',
      icon: '🔧',
      language: 'CLI',
      version: 'v1.5.0',
      features: ['Batch Processing', 'Config Files', 'Progress Bars', 'CI/CD Ready'],
      installation: 'pip install schlep-engine-cli',
      quickExample: `# Upload and process in one command
schlep process data.csv \\
  --auto-clean \\
  --output processed_data.parquet \\
  --format parquet

# Watch directory for new files
schlep watch ./input --auto-process`
    }
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">SDKs & Libraries</h1>
        <p className="text-xl text-gray-600 mb-6">
          Official SDKs and libraries for integrating Schlep Engine into your data processing 
          workflows. Choose the best option for your programming language and environment.
        </p>
        
        <div className="flex gap-4">
          <Link
            href="/introduction/quickstart"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Quick Start Guide
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/api-reference"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            REST API Reference
          </Link>
        </div>
      </div>

      {/* SDK Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Choose Your SDK</h2>
        <div className="grid gap-8">
          {sdks.map((sdk, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
              <div className="flex items-start gap-4">
                <div className="text-3xl">{sdk.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{sdk.name}</h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {sdk.version}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{sdk.description}</p>
                  
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Features</h4>
                    <div className="flex flex-wrap gap-2">
                      {sdk.features.map((feature, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-sm">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Installation</h4>
                    <div className="bg-gray-900 rounded p-3">
                      <code className="text-green-400 text-sm">{sdk.installation}</code>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Quick Example</h4>
                    <div className="bg-gray-900 rounded p-3 overflow-x-auto">
                      <pre className="text-sm text-gray-100">{sdk.quickExample}</pre>
                    </div>
                  </div>
                  
                  <Link
                    href={sdk.href}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View {sdk.name} Documentation
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">SDK Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SDK</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Use Case</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Async</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Streaming</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Framework</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="mr-2">🐍</span>
                    <span className="font-medium text-gray-900">Python SDK</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Data Science & ML</td>
                <td className="px-6 py-4 text-sm text-green-600">✓</td>
                <td className="px-6 py-4 text-sm text-green-600">✓</td>
                <td className="px-6 py-4 text-sm text-green-600">✓</td>
                <td className="px-6 py-4 text-sm text-gray-600">Pandas, NumPy</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="mr-2">⚡</span>
                    <span className="font-medium text-gray-900">JavaScript</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Web & Serverless</td>
                <td className="px-6 py-4 text-sm text-green-600">✓</td>
                <td className="px-6 py-4 text-sm text-green-600">✓</td>
                <td className="px-6 py-4 text-sm text-gray-400">○</td>
                <td className="px-6 py-4 text-sm text-gray-600">Node.js, Browser</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="mr-2">📊</span>
                    <span className="font-medium text-gray-900">R Package</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Statistical Analysis</td>
                <td className="px-6 py-4 text-sm text-gray-400">○</td>
                <td className="px-6 py-4 text-sm text-gray-400">○</td>
                <td className="px-6 py-4 text-sm text-green-600">✓</td>
                <td className="px-6 py-4 text-sm text-gray-600">data.frame, ggplot2</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="mr-2">🔧</span>
                    <span className="font-medium text-gray-900">CLI Tool</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Automation & CI/CD</td>
                <td className="px-6 py-4 text-sm text-gray-400">○</td>
                <td className="px-6 py-4 text-sm text-gray-400">○</td>
                <td className="px-6 py-4 text-sm text-green-600">✓</td>
                <td className="px-6 py-4 text-sm text-gray-600">Command Line</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Common Patterns */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Integration Patterns</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <CodeBracketIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Jupyter Notebooks</h3>
            <p className="text-gray-600 mb-4">
              Interactive data exploration and cleaning in Jupyter environments with real-time feedback.
            </p>
            <Link href="/integrations/jupyter" className="text-blue-600 hover:text-blue-700 font-medium">
              View Integration Guide →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <CommandLineIcon className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Production Pipelines</h3>
            <p className="text-gray-600 mb-4">
              Automated data processing workflows with error handling and monitoring integration.
            </p>
            <Link href="/integrations/airflow" className="text-blue-600 hover:text-blue-700 font-medium">
              View Pipeline Guide →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <DocumentTextIcon className="h-8 w-8 text-purple-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Web Applications</h3>
            <p className="text-gray-600 mb-4">
              Client-side and server-side data processing for web apps with progress tracking.
            </p>
            <Link href="/sdks/javascript" className="text-blue-600 hover:text-blue-700 font-medium">
              View JavaScript SDK →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">📈</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Science Workflows</h3>
            <p className="text-gray-600 mb-4">
              Seamless integration with existing data science stacks and ML experiment tracking.
            </p>
            <Link href="/use-cases/ml-training" className="text-blue-600 hover:text-blue-700 font-medium">
              View ML Use Cases →
            </Link>
          </div>
        </div>
      </section>

      {/* Getting Help */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Need Help?</h2>
        <p className="text-gray-600 mb-4">
          Our SDKs come with comprehensive documentation, examples, and community support.
        </p>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-4">
            <div className="text-2xl mb-2">📚</div>
            <h3 className="font-medium text-gray-900 mb-1">Documentation</h3>
            <p className="text-sm text-gray-600">Detailed guides and API references</p>
          </div>
          
          <div className="text-center p-4">
            <div className="text-2xl mb-2">💬</div>
            <h3 className="font-medium text-gray-900 mb-1">Community</h3>
            <p className="text-sm text-gray-600">Discord community and GitHub discussions</p>
          </div>
          
          <div className="text-center p-4">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-medium text-gray-900 mb-1">Examples</h3>
            <p className="text-sm text-gray-600">Real-world examples and templates</p>
          </div>
        </div>
        
        <div className="mt-6 flex gap-4">
          <Link
            href="/introduction/quickstart"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/use-cases"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Examples
          </Link>
        </div>
      </section>
    </div>
  )
}