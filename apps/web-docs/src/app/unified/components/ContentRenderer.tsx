'use client'

import { useState, useEffect } from 'react'
import { 
  ArrowRightIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  PlayIcon,
  CodeBracketIcon,
  CubeIcon,
  RocketLaunchIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  ChartBarIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'
import { EnhancedEndpointCard } from './EnhancedEndpointCard'
import { InteractiveAPIExplorer } from './InteractiveAPIExplorer'

interface ContentRendererProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function ContentRenderer({ activeSection, onSectionChange }: ContentRendererProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

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

  const renderContent = () => {
    switch (activeSection) {
      case 'getting-started/overview':
        return (
          <div className="max-w-4xl">
            {/* Hero Section */}
            <div className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl mb-6">
                Welcome to Schlep Engine
              </h1>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl">
                Transform raw, messy datasets into ML-ready formats through intelligent pattern recognition 
                and automated preprocessing workflows. Eliminate 80% of data preparation time.
              </p>
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => onSectionChange('getting-started/installation')}
                  className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors flex items-center gap-2"
                >
                  Get Started
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => onSectionChange('api-reference/core-endpoints')}
                  className="text-sm font-semibold leading-6 text-white hover:text-blue-400 transition-colors"
                >
                  View API Reference <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            {/* Key Benefits */}
            <div className="mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-6">
                Why Choose Schlep Engine?
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                Focus on building models that drive business value, not on data cleaning
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="flex flex-col">
                  <div className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white mb-4">
                    <RocketLaunchIcon className="h-5 w-5 flex-none text-blue-600" />
                    Lightning Fast
                  </div>
                  <p className="text-base leading-7 text-gray-300">
                    Reduce data prep time from weeks to hours with AI-powered automation
                  </p>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white mb-4">
                    <CpuChipIcon className="h-5 w-5 flex-none text-blue-600" />
                    AI-Driven Accuracy
                  </div>
                  <p className="text-base leading-7 text-gray-300">
                    Catch data quality issues human reviewers miss with advanced ML detection
                  </p>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white mb-4">
                    <ChartBarIcon className="h-5 w-5 flex-none text-blue-600" />
                    Enterprise Scale
                  </div>
                  <p className="text-base leading-7 text-gray-300">
                    Handle datasets from gigabytes to petabytes with cloud-native architecture
                  </p>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white mb-4">
                    <ShieldCheckIcon className="h-5 w-5 flex-none text-blue-600" />
                    Learning System
                  </div>
                  <p className="text-base leading-7 text-gray-300">
                    Gets smarter with each dataset, building institutional knowledge
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Start Preview */}
            <div className="mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-6">
                Get started in minutes
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                Install our SDK and transform your first dataset with just a few lines of code
              </p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CodeExampleCard 
                  title="Python SDK"
                  language="python"
                  code={`# Install the SDK
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
client.export_tensorflow(result.id)`}
                  onCopy={(code) => handleCopyCode(code, 'python-example')}
                  copied={copiedCode === 'python-example'}
                />

                <CodeExampleCard 
                  title="JavaScript SDK"
                  language="javascript"
                  code={`// Install the SDK
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
const processedData = await client.download(result.id);`}
                  onCopy={(code) => handleCopyCode(code, 'js-example')}
                  copied={copiedCode === 'js-example'}
                />
              </div>
            </div>

            {/* What's Next */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">What's Next?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                  onClick={() => onSectionChange('getting-started/installation')}
                  className="text-left p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <RocketLaunchIcon className="h-5 w-5" />
                    <span className="font-medium">Installation</span>
                  </div>
                  <p className="text-sm text-gray-300">Set up your development environment</p>
                </button>
                <button 
                  onClick={() => onSectionChange('getting-started/authentication')}
                  className="text-left p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <ShieldCheckIcon className="h-5 w-5" />
                    <span className="font-medium">Authentication</span>
                  </div>
                  <p className="text-sm text-gray-300">Learn about API keys and security</p>
                </button>
                <button 
                  onClick={() => onSectionChange('getting-started/first-call')}
                  className="text-left p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <PlayIcon className="h-5 w-5" />
                    <span className="font-medium">First API Call</span>
                  </div>
                  <p className="text-sm text-gray-300">Make your first request to the API</p>
                </button>
              </div>
            </div>
          </div>
        )

      case 'api-reference/core-endpoints':
        return (
          <div className="max-w-4xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-4">API Reference</h1>
              <p className="text-xl text-gray-300 mb-6">
                Complete reference for the Schlep Engine REST API. All endpoints, parameters, 
                responses, and examples you need to integrate AI-powered data processing.
              </p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => onSectionChange('getting-started/overview')}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Quick Start Guide
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => onSectionChange('getting-started/authentication')}
                  className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Authentication
                </button>
              </div>
            </div>

            {/* Base URL */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">Base URL</h2>
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <code className="text-lg font-mono text-white">https://api.schlep-engine.com</code>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Authentication Required</h3>
                <p className="text-blue-800 text-sm mb-2">
                  All API requests require authentication using API keys in the Authorization header.
                </p>
                <button 
                  onClick={() => onSectionChange('getting-started/authentication')}
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 text-sm font-medium"
                >
                  Learn about authentication
                  <ArrowRightIcon className="h-3 w-3" />
                </button>
              </div>
            </section>

            {/* Core Endpoints */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Core Endpoints</h2>
              <div className="space-y-4">
                <EnhancedEndpointCard 
                  method="POST"
                  path="/v1/upload"
                  description="Upload datasets for processing"
                  icon={CloudArrowUpIcon}
                  onClick={() => onSectionChange('api-reference/data-upload')}
                />
                <EnhancedEndpointCard 
                  method="POST"
                  path="/v1/profile"
                  description="Generate intelligent data profiles"
                  icon={CpuChipIcon}
                  onClick={() => onSectionChange('api-reference/processing-pipeline')}
                />
                <EnhancedEndpointCard 
                  method="POST"
                  path="/v1/process"
                  description="Transform and clean your data"
                  icon={CpuChipIcon}
                  onClick={() => onSectionChange('api-reference/processing-pipeline')}
                />
                <EnhancedEndpointCard 
                  method="GET"
                  path="/v1/jobs/{id}"
                  description="Monitor processing status"
                  icon={ClockIcon}
                  onClick={() => onSectionChange('api-reference/processing-pipeline')}
                />
                <EnhancedEndpointCard 
                  method="GET"
                  path="/v1/download/{id}"
                  description="Download processed datasets"
                  icon={DocumentArrowDownIcon}
                  onClick={() => onSectionChange('api-reference/export-download')}
                />
              </div>
            </section>

            {/* Quick Example */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">Quick Example</h2>
              <p className="text-gray-300 mb-4">
                Here's a simple example to upload and process a dataset:
              </p>
              
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-gray-100">
{`curl -X POST "https://api.schlep-engine.com/v1/upload" \\
  -H "Authorization: Bearer your_api_key" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@dataset.csv" \\
  -F "options={\\"auto_profile\\": true}"

# Response
{
  "job_id": "job_123abc",
  "status": "processing",
  "estimated_time": "2-5 minutes"
}`}
                </pre>
              </div>
            </section>
          </div>
        )

      case 'getting-started/installation':
        return (
          <div className="max-w-4xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-4">Installation & Setup</h1>
              <p className="text-xl text-gray-300 mb-6">
                Get started with Schlep Engine by installing our SDKs and setting up your development environment.
              </p>
            </div>

            {/* Python SDK Installation */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Python SDK</h2>
              <p className="text-gray-300 mb-4">
                Install the Python SDK using pip. Requires Python 3.7 or higher.
              </p>
              
              <CodeExampleCard 
                title="Install Python SDK"
                language="bash"
                code={`# Install the latest version
pip install schlep-engine

# Or install a specific version
pip install schlep-engine==1.2.0

# Install with additional dependencies for ML frameworks
pip install schlep-engine[ml]`}
                onCopy={(code) => handleCopyCode(code, 'python-install')}
                copied={copiedCode === 'python-install'}
              />

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Test</h3>
                <CodeExampleCard 
                  title="Verify Installation"
                  language="python"
                  code={`import schlep_engine
from schlep_engine import SchlepClient

# Check version
print(schlep_engine.__version__)

# Initialize client (requires API key)
client = SchlepClient(api_key="your_api_key_here")
print("✓ Schlep Engine Python SDK ready!")`}
                  onCopy={(code) => handleCopyCode(code, 'python-test')}
                  copied={copiedCode === 'python-test'}
                />
              </div>
            </section>

            {/* JavaScript SDK Installation */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">JavaScript SDK</h2>
              <p className="text-gray-300 mb-4">
                Install the JavaScript SDK using npm or yarn. Works in Node.js and browser environments.
              </p>
              
              <CodeExampleCard 
                title="Install JavaScript SDK"
                language="bash"
                code={`# Using npm
npm install @schlep-engine/js-sdk

# Using yarn
yarn add @schlep-engine/js-sdk

# Using pnpm
pnpm add @schlep-engine/js-sdk`}
                onCopy={(code) => handleCopyCode(code, 'js-install')}
                copied={copiedCode === 'js-install'}
              />

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Test</h3>
                <CodeExampleCard 
                  title="Verify Installation"
                  language="javascript"
                  code={`import { SchlepClient } from '@schlep-engine/js-sdk';

// Initialize client
const client = new SchlepClient({
  apiKey: 'your_api_key_here'
});

// Test connection
console.log('✓ Schlep Engine JavaScript SDK ready!');
console.log('SDK Version:', client.version);`}
                  onCopy={(code) => handleCopyCode(code, 'js-test')}
                  copied={copiedCode === 'js-test'}
                />
              </div>
            </section>

            {/* Environment Setup */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Environment Setup</h2>
              <p className="text-gray-300 mb-4">
                Configure your environment variables and API credentials.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Get Your API Key</h3>
                <p className="text-blue-800 text-sm mb-2">
                  You'll need an API key to authenticate with Schlep Engine. Get yours from the dashboard.
                </p>
                <button 
                  onClick={() => onSectionChange('getting-started/authentication')}
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 text-sm font-medium"
                >
                  Learn about API Keys
                  <ArrowRightIcon className="h-3 w-3" />
                </button>
              </div>

              <CodeExampleCard 
                title="Environment Variables"
                language="bash"
                code={`# Create .env file in your project root
echo "SCHLEP_ENGINE_API_KEY=your_api_key_here" > .env

# For production environments
export SCHLEP_ENGINE_API_KEY="your_production_api_key"
export SCHLEP_ENGINE_BASE_URL="https://api.schlep-engine.com"`}
                onCopy={(code) => handleCopyCode(code, 'env-setup')}
                copied={copiedCode === 'env-setup'}
              />
            </section>

            {/* What's Next */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">What's Next?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => onSectionChange('getting-started/authentication')}
                  className="text-left p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <ShieldCheckIcon className="h-5 w-5" />
                    <span className="font-medium">Authentication</span>
                  </div>
                  <p className="text-sm text-gray-300">Set up API keys and learn about security</p>
                </button>
                <button 
                  onClick={() => onSectionChange('getting-started/first-call')}
                  className="text-left p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <PlayIcon className="h-5 w-5" />
                    <span className="font-medium">First API Call</span>
                  </div>
                  <p className="text-sm text-gray-300">Make your first request to the API</p>
                </button>
              </div>
            </div>
          </div>
        )

      case 'getting-started/authentication':
        return (
          <div className="max-w-4xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-4">Authentication</h1>
              <p className="text-xl text-gray-300 mb-6">
                Learn how to authenticate with the Schlep Engine API using API keys and best security practices.
              </p>
            </div>

            {/* API Keys Overview */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">API Keys</h2>
              <p className="text-gray-300 mb-6">
                Schlep Engine uses API keys to authenticate requests. Your API keys carry many privileges, 
                so be sure to keep them secure! Do not share your secret API keys in publicly accessible 
                areas such as GitHub, client-side code, and so forth.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-900 mb-2">🔒 Security Best Practices</h3>
                <ul className="text-yellow-800 text-sm space-y-1">
                  <li>• Store API keys in environment variables, not in code</li>
                  <li>• Use different keys for development and production</li>
                  <li>• Rotate your API keys regularly</li>
                  <li>• Never commit API keys to version control</li>
                </ul>
              </div>

              <CodeExampleCard 
                title="Authentication Header"
                language="bash"
                code={`# All API requests must include the Authorization header
curl -H "Authorization: Bearer your_api_key" \\
  https://api.schlep-engine.com/v1/upload`}
                onCopy={(code) => handleCopyCode(code, 'auth-header')}
                copied={copiedCode === 'auth-header'}
              />
            </section>

            {/* SDK Authentication */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">SDK Authentication</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CodeExampleCard 
                  title="Python SDK"
                  language="python"
                  code={`import os
from schlep_engine import SchlepClient

# Method 1: Environment variable (recommended)
client = SchlepClient()  # Reads SCHLEP_ENGINE_API_KEY

# Method 2: Direct initialization
client = SchlepClient(api_key="your_api_key")

# Method 3: From config file
client = SchlepClient.from_config("config.json")`}
                  onCopy={(code) => handleCopyCode(code, 'python-auth')}
                  copied={copiedCode === 'python-auth'}
                />

                <CodeExampleCard 
                  title="JavaScript SDK"
                  language="javascript"
                  code={`import { SchlepClient } from '@schlep-engine/js-sdk';

// Method 1: Environment variable (Node.js)
const client = new SchlepClient({
  apiKey: process.env.SCHLEP_ENGINE_API_KEY
});

// Method 2: Direct initialization
const client = new SchlepClient({
  apiKey: 'your_api_key'
});`}
                  onCopy={(code) => handleCopyCode(code, 'js-auth')}
                  copied={copiedCode === 'js-auth'}
                />
              </div>
            </section>

            {/* Error Handling */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Authentication Errors</h2>
              <p className="text-gray-300 mb-6">
                Handle authentication errors gracefully in your applications.
              </p>

              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto mb-6">
                <pre className="text-sm text-gray-100">
{`# Common authentication error responses

# 401 Unauthorized - Invalid or missing API key
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key provided",
    "type": "authentication_error"
  }
}

# 403 Forbidden - Valid key but insufficient permissions
{
  "error": {
    "code": "FORBIDDEN", 
    "message": "Insufficient permissions for this operation",
    "type": "permission_error"
  }
}`}
                </pre>
              </div>

              <CodeExampleCard 
                title="Error Handling Example"
                language="python"
                code={`from schlep_engine import SchlepClient, AuthenticationError

try:
    client = SchlepClient(api_key="your_api_key")
    result = client.upload_csv("data.csv")
except AuthenticationError as e:
    print(f"Authentication failed: {e.message}")
    # Handle authentication error
except Exception as e:
    print(f"Unexpected error: {e}")
    # Handle other errors`}
                onCopy={(code) => handleCopyCode(code, 'error-handling')}
                copied={copiedCode === 'error-handling'}
              />
            </section>
          </div>
        )

      case 'api-reference/interactive':
        return <InteractiveAPIExplorer />

      default:
        return (
          <div className="max-w-4xl">
            <div className="text-center py-12">
              <h1 className="text-2xl font-semibold text-white mb-4">
                Content Coming Soon
              </h1>
              <p className="text-gray-300 mb-6">
                This section is being prepared. Check back soon for comprehensive documentation.
              </p>
              <button 
                onClick={() => onSectionChange('getting-started/overview')}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Overview
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="prose prose-lg max-w-none">
      {renderContent()}
    </div>
  )
}

interface CodeExampleCardProps {
  title: string
  language: string
  code: string
  onCopy: (code: string) => void
  copied: boolean
}

function CodeExampleCard({ title, language, code, onCopy, copied }: CodeExampleCardProps) {
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

  return (
    <div className="bg-gray-700 rounded-lg shadow-sm border border-gray-600 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button
          onClick={() => onCopy(code)}
          className="flex items-center gap-2 px-3 py-1 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-100 rounded-md transition-colors"
        >
          {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="relative">
        <pre className="p-4 overflow-x-auto font-mono text-sm leading-relaxed bg-gray-800 rounded-md">
          <code 
            dangerouslySetInnerHTML={{__html: formatCode(code, language)}}
          />
        </pre>
      </div>
    </div>
  )
}