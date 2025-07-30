import Link from 'next/link'
import { ArrowRightIcon, ChartBarIcon, CpuChipIcon, ShieldCheckIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'

export default function Home() {
  const formatCode = (code: string, language: string) => {
    if (language === 'python') {
      return code
        .replace(/(from|import|def|class|if|else|elif|try|except|finally|with|as|return|yield|break|continue|pass|global|nonlocal|assert|del|lambda|and|or|not|in|is)\b/g, '<span style="color: #7c3aed; font-weight: 600;">$1</span>')
        .replace(/(True|False|None)\b/g, '<span style="color: #dc2626; font-weight: 600;">$1</span>')
        .replace(/(['"])(.*?)\1/g, '<span style="color: #059669;">$1$2$1</span>')
        .replace(/(#.*$)/gm, '<span style="color: #6b7280; font-style: italic;">$1</span>')
        .replace(/(\d+)/g, '<span style="color: #dc2626;">$1</span>')
    } else if (language === 'javascript' || language === 'js') {
      return code
        .replace(/(const|let|var|function|class|if|else|for|while|do|switch|case|default|try|catch|finally|throw|return|break|continue|new|this|super|extends|import|export|from|async|await)\b/g, '<span style="color: #7c3aed; font-weight: 600;">$1</span>')
        .replace(/(true|false|null|undefined)\b/g, '<span style="color: #dc2626; font-weight: 600;">$1</span>')
        .replace(/(['"`])(.*?)\1/g, '<span style="color: #059669;">$1$2$1</span>')
        .replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span style="color: #6b7280; font-style: italic;">$1</span>')
        .replace(/(\d+)/g, '<span style="color: #dc2626;">$1</span>')
    }
    return code
  }

  const pythonCode = `# Install the SDK
pip install schlep-engine

# Import and authenticate
from schlep_engine import SchlepClient

client = SchlepClient(api_key="your_api_key")

# Upload and process your data
job = client.upload_csv("messy_data.csv")
result = client.process(job.id, 
    auto_clean=True,
    ml_ready=True
)

# Export to your ML framework
client.export_tensorflow(result.id)`

  const jsCode = `// Install the SDK
npm install @schlep-engine/js-sdk

// Import and authenticate
import { SchlepClient } from '@schlep-engine/js-sdk';

const client = new SchlepClient({
  apiKey: 'your_api_key'
});

// Upload and process your data
const job = await client.uploadCSV('messy_data.csv');
const result = await client.process(job.id, {
  autoClean: true,
  mlReady: true
});

// Download processed data
const processedData = await client.download(result.id);`
  return (
    <div className="min-h-screen bg-[#161616]">
      {/* Hero Section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-4xl py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              AI-Powered Data Processing API
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
              Transform raw, messy datasets into ML-ready formats through intelligent pattern recognition 
              and automated preprocessing workflows. Eliminate 80% of data preparation time.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/introduction"
                className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors flex items-center gap-2"
              >
                Get Started
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/api-reference"
                className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600 transition-colors"
              >
                View API Reference <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Key Benefits */}
      <div className="py-16 sm:py-24 bg-[#161616]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Why Choose Schlep Engine?
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Focus on building models that drive business value, not on data cleaning
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <RocketLaunchIcon className="h-5 w-5 flex-none text-blue-600" />
                  Lightning Fast
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Reduce data prep time from weeks to hours with AI-powered automation
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <CpuChipIcon className="h-5 w-5 flex-none text-blue-600" />
                  AI-Driven Accuracy
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Catch data quality issues human reviewers miss with advanced ML detection
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <ChartBarIcon className="h-5 w-5 flex-none text-blue-600" />
                  Enterprise Scale
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Handle datasets from gigabytes to petabytes with cloud-native architecture
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <ShieldCheckIcon className="h-5 w-5 flex-none text-blue-600" />
                  Learning System
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Gets smarter with each dataset, building institutional knowledge
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Quick Start Code Example */}
      <div className="py-16 sm:py-24 bg-[#161616]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Get started in minutes
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Install our SDK and transform your first dataset with just a few lines of code
            </p>
          </div>
          
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Python SDK</h3>
              <div className="relative my-6">
                <div className="mb-2 text-gray-600 text-sm font-medium">Python SDK</div>
                <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
                  <code 
                    style={{fontSize: '18px', lineHeight: '1.7'}}
                    dangerouslySetInnerHTML={{__html: formatCode(pythonCode, 'python')}}
                  />
                </pre>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">JavaScript SDK</h3>
              <div className="relative my-6">
                <div className="mb-2 text-gray-600 text-sm font-medium">JavaScript SDK</div>
                <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
                  <code 
                    style={{fontSize: '18px', lineHeight: '1.7'}}
                    dangerouslySetInnerHTML={{__html: formatCode(jsCode, 'javascript')}}
                  />
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Capabilities */}
      <div className="py-16 sm:py-24 bg-[#161616]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Comprehensive Data Processing Pipeline
            </h2>
          </div>
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Profiling</h3>
              <p className="text-gray-600">Automatically detect data types, quality issues, and structural patterns</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔧</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Transformation</h3>
              <p className="text-gray-600">Intelligent cleaning rules and automated handling of inconsistencies</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏷️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Auto-Labeling</h3>
              <p className="text-gray-600">Unsupervised learning for categorization and outlier detection</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Framework Export</h3>
              <p className="text-gray-600">Direct export to TensorFlow, PyTorch, scikit-learn and more</p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-[#161616] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to accelerate your data pipeline?
            </h2>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Join thousands of data scientists who have eliminated data preparation bottlenecks
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/introduction"
                className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
              >
                Start Building
              </Link>
              <Link
                href="/use-cases"
                className="text-sm font-semibold leading-6 text-white hover:text-blue-100 transition-colors"
              >
                View Use Cases <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}