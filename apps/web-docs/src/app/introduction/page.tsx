'use client'

import { useState } from 'react'
import { 
  ArrowRightIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  RocketLaunchIcon,
  CpuChipIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  PlayIcon
} from '@heroicons/react/24/outline'

export default function Introduction() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto px-6">
      {/* Hero Section */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-4">
          Introduction to Schlep Engine
        </h1>
        <p className="text-sm text-[#999999] mb-6 max-w-3xl">
          Transform raw, messy datasets into ML-ready formats through intelligent pattern recognition 
          and automated preprocessing workflows. Eliminate 80% of data preparation time.
        </p>
      </div>

      {/* Key Benefits */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-4">
          Why Choose Schlep Engine?
        </h2>
        <p className="text-sm text-[#999999] mb-6">
          Focus on building models that drive business value, not on data cleaning
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex flex-col">
            <div className="flex items-center gap-x-3 text-sm font-semibold leading-7 text-[#999999] mb-4">
              <RocketLaunchIcon className="h-5 w-5 flex-none text-blue-600" />
              Lightning Fast
            </div>
            <p className="text-sm leading-7 text-[#999999]">
              Reduce data prep time from weeks to hours with AI-powered automation
            </p>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-x-3 text-sm font-semibold leading-7 text-[#999999] mb-4">
              <CpuChipIcon className="h-5 w-5 flex-none text-blue-600" />
              AI-Driven Accuracy
            </div>
            <p className="text-sm leading-7 text-[#999999]">
              Catch data quality issues human reviewers miss with advanced ML detection
            </p>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-x-3 text-sm font-semibold leading-7 text-[#999999] mb-4">
              <ChartBarIcon className="h-5 w-5 flex-none text-blue-600" />
              Enterprise Scale
            </div>
            <p className="text-sm leading-7 text-[#999999]">
              Handle datasets from gigabytes to petabytes with cloud-native architecture
            </p>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-x-3 text-sm font-semibold leading-7 text-[#999999] mb-4">
              <ShieldCheckIcon className="h-5 w-5 flex-none text-blue-600" />
              Learning System
            </div>
            <p className="text-sm leading-7 text-[#999999]">
              Gets smarter with each dataset, building institutional knowledge
            </p>
          </div>
        </div>
      </div>

      {/* Quick Start Preview */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-4">
          Get started in minutes
        </h2>
        <p className="text-sm text-[#999999] mb-6">
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

      {/* Core Features */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-4">
          Core Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🤖 Intelligent Data Profiling</h3>
            <p className="text-sm text-[#999999] dark:text-[#999999] mb-3">
              Automatically detect data types, patterns, and quality issues in your datasets with AI-powered analysis.
            </p>
            <ul className="text-sm text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Automatic schema detection</li>
              <li>• Data quality scoring</li>
              <li>• Pattern recognition</li>
            </ul>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🔧 Smart Data Cleaning</h3>
            <p className="text-sm text-[#999999] dark:text-[#999999] mb-3">
              Advanced algorithms handle duplicates, missing values, and inconsistencies automatically.
            </p>
            <ul className="text-sm text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Duplicate detection & removal</li>
              <li>• Missing value imputation</li>
              <li>• Outlier identification</li>
            </ul>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🏷️ Auto-Labeling & Categorization</h3>
            <p className="text-sm text-[#999999] dark:text-[#999999] mb-3">
              ML-powered labeling system categorizes and enriches your data automatically.
            </p>
            <ul className="text-sm text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Unsupervised classification</li>
              <li>• Entity recognition</li>
              <li>• Semantic enrichment</li>
            </ul>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🚀 ML Framework Export</h3>
            <p className="text-sm text-[#999999] dark:text-[#999999] mb-3">
              Export clean, processed data directly to your favorite ML frameworks and platforms.
            </p>
            <ul className="text-sm text-[#999999] dark:text-[#999999] space-y-1">
              <li>• TensorFlow & PyTorch ready</li>
              <li>• scikit-learn compatibility</li>
              <li>• Custom format support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Overview */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-4">
          API Overview
        </h2>
        <p className="text-sm text-[#999999] mb-6">
          Our REST API provides simple, powerful endpoints for all your data processing needs.
        </p>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-[#999999] dark:text-[#999999]">
                <strong>Base URL:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-xs">https://api.schlep-engine.com</code>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📤 Upload & Process</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /v1/upload</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Upload datasets and start processing</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📊 Data Profiling</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /v1/profile</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Generate intelligent data profiles</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">⚙️ Transform Data</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /v1/process</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Clean and transform your data</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📥 Download Results</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">GET /v1/download/&#123;id&#125;</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Download processed datasets</p>
          </div>
        </div>
      </div>

      {/* What's Next */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What's Next?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a 
            href="/introduction/quickstart"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <RocketLaunchIcon className="h-5 w-5" />
              <span className="font-medium">Quick Start</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Set up your development environment</p>
          </a>
          <a 
            href="/introduction/api-keys"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <ShieldCheckIcon className="h-5 w-5" />
              <span className="font-medium">Authentication</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Learn about API keys and security</p>
          </a>
          <a 
            href="/introduction/first-call"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <PlayIcon className="h-5 w-5" />
              <span className="font-medium">First API Call</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Make your first request to the API</p>
          </a>
        </div>
      </div>
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
        .replace(/(from|import|def|class|if|else|elif|try|except|finally|with|as|return|yield|break|continue|pass|global|nonlocal|assert|del|lambda|and|or|not|in|is)\b/g, '<span style="color: #8b5cf6;">$1</span>')
        .replace(/(True|False|None)\b/g, '<span style="color: #f59e0b;">$1</span>')
        .replace(/(['"])(.*?)\1/g, '<span style="color: #10b981;">$1$2$1</span>')
        .replace(/(#.*$)/gm, '<span style="color: #6b7280;">$1</span>')
        .replace(/(\d+)/g, '<span style="color: #f59e0b;">$1</span>')
    } else if (language === 'javascript' || language === 'js') {
      return code
        .replace(/(const|let|var|function|class|if|else|for|while|do|switch|case|default|try|catch|finally|throw|return|break|continue|new|this|super|extends|import|export|from|async|await)\b/g, '<span style="color: #8b5cf6;">$1</span>')
        .replace(/(true|false|null|undefined)\b/g, '<span style="color: #f59e0b;">$1</span>')
        .replace(/(['"`])(.*?)\1/g, '<span style="color: #10b981;">$1$2$1</span>')
        .replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span style="color: #6b7280;">$1</span>')
        .replace(/(\d+)/g, '<span style="color: #f59e0b;">$1</span>')
    }
    return code
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Terminal Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-300 text-sm font-medium ml-3">{title}</span>
        </div>
        <button
          onClick={() => onCopy(code)}
          className="flex items-center gap-2 px-3 py-1 text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          {copied ? <CheckIcon className="h-3 w-3" /> : <ClipboardDocumentIcon className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      
      {/* Terminal Content */}
      <div className="p-4">
        <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-gray-100">
          <code 
            dangerouslySetInnerHTML={{__html: formatCode(code, language)}}
          />
        </pre>
      </div>
    </div>
  )
}