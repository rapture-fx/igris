'use client'

import { useState } from 'react'
import { 
  ArrowRight, 
  Book, 
  Code, 
  Database, 
  Zap, 
  Shield, 
  Copy,
  Brain,
  Upload,
  BarChart3,
  Settings,
  Globe,
  Search,
  CheckCircle,
  AlertCircle,
  Key,
  Clock,
  Terminal,
  Sparkles,
  TrendingUp,
  Layers,
  Filter,
  Download
} from 'lucide-react'
import { Footer } from '@/components/layout/Footer'

interface CodeExample {
  language: string
  title: string
  description: string
  code: string
  response?: string
}

interface APIEndpoint {
  method: string
  path: string
  description: string
  parameters?: Array<{
    name: string
    type: string
    required: boolean
    description: string
  }>
}

export default function DocumentationPage() {
  const [selectedSection, setSelectedSection] = useState('introduction')
  const [selectedLanguage, setSelectedLanguage] = useState('curl')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Documentation sections
  const docsSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      items: [
        { id: 'introduction', label: 'Introduction', icon: <Book className="w-4 h-4" /> },
        { id: 'quickstart', label: 'Quickstart', icon: <Zap className="w-4 h-4" /> },
        { id: 'authentication', label: 'Authentication', icon: <Shield className="w-4 h-4" /> },
        { id: 'errors', label: 'Error Handling', icon: <AlertCircle className="w-4 h-4" /> },
      ]
    },
    {
      id: 'core-concepts',
      title: 'Core Concepts',
      items: [
        { id: 'data-processing', label: 'Data Processing', icon: <Brain className="w-4 h-4" /> },
        { id: 'transformations', label: 'Transformations', icon: <Settings className="w-4 h-4" /> },
        { id: 'quality-scoring', label: 'Quality Scoring', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'anomaly-detection', label: 'Anomaly Detection', icon: <Filter className="w-4 h-4" /> },
      ]
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      items: [
        { id: 'upload-api', label: 'Upload API', icon: <Upload className="w-4 h-4" /> },
        { id: 'analysis-api', label: 'Analysis API', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'transformation-api', label: 'Transformation API', icon: <Sparkles className="w-4 h-4" /> },
        { id: 'export-api', label: 'Export API', icon: <Download className="w-4 h-4" /> },
        { id: 'jobs-api', label: 'Jobs API', icon: <Clock className="w-4 h-4" /> },
      ]
    },
    {
      id: 'sdks-libraries',
      title: 'SDKs & Libraries',
      items: [
        { id: 'python-sdk', label: 'Python SDK', icon: <Code className="w-4 h-4" /> },
        { id: 'javascript-sdk', label: 'JavaScript SDK', icon: <Code className="w-4 h-4" /> },
        { id: 'rest-api', label: 'REST API', icon: <Globe className="w-4 h-4" /> },
        { id: 'webhooks', label: 'Webhooks', icon: <Settings className="w-4 h-4" /> },
      ]
    },
    {
      id: 'guides-tutorials',
      title: 'Guides & Tutorials',
      items: [
        { id: 'complete-pipeline', label: 'Complete Pipeline', icon: <Layers className="w-4 h-4" /> },
        { id: 'ml-integration', label: 'ML Integration', icon: <Brain className="w-4 h-4" /> },
        { id: 'production-tips', label: 'Production Tips', icon: <CheckCircle className="w-4 h-4" /> },
        { id: 'best-practices', label: 'Best Practices', icon: <CheckCircle className="w-4 h-4" /> },
      ]
    }
  ]

  // API endpoints
  const apiEndpoints: Record<string, APIEndpoint[]> = {
    'upload-api': [
      {
        method: 'POST',
        path: '/v1/data/upload',
        description: 'Upload a dataset for processing',
        parameters: [
          { name: 'file', type: 'file', required: true, description: 'CSV, JSON, or Parquet file' },
          { name: 'auto_analyze', type: 'boolean', required: false, description: 'Auto-run analysis' },
          { name: 'encoding', type: 'string', required: false, description: 'File encoding (utf-8, latin-1)' }
        ]
      },
      {
        method: 'GET',
        path: '/v1/data/datasets',
        description: 'List all uploaded datasets',
        parameters: [
          { name: 'limit', type: 'integer', required: false, description: 'Number of results (max 100)' },
          { name: 'offset', type: 'integer', required: false, description: 'Pagination offset' }
        ]
      }
    ],
    'analysis-api': [
      {
        method: 'POST',
        path: '/v1/analysis/analyze',
        description: 'Run AI analysis on a dataset',
        parameters: [
          { name: 'dataset_id', type: 'string', required: true, description: 'ID of uploaded dataset' },
          { name: 'include_ml_insights', type: 'boolean', required: false, description: 'Include ML predictions' },
          { name: 'detect_anomalies', type: 'boolean', required: false, description: 'Detect data anomalies' }
        ]
      },
      {
        method: 'GET',
        path: '/v1/analysis/{analysis_id}',
        description: 'Get analysis results',
        parameters: [
          { name: 'analysis_id', type: 'string', required: true, description: 'Analysis ID' }
        ]
      }
    ],
    'transformation-api': [
      {
        method: 'POST',
        path: '/v1/transform/apply',
        description: 'Apply transformations to a dataset',
        parameters: [
          { name: 'dataset_id', type: 'string', required: true, description: 'ID of dataset to transform' },
          { name: 'transformations', type: 'array', required: true, description: 'List of transformation rules' },
          { name: 'validate', type: 'boolean', required: false, description: 'Validate before applying' }
        ]
      }
    ],
    'export-api': [
      {
        method: 'POST',
        path: '/v1/export/download',
        description: 'Export processed data',
        parameters: [
          { name: 'dataset_id', type: 'string', required: true, description: 'ID of dataset to export' },
          { name: 'format', type: 'string', required: true, description: 'Output format (csv, json, parquet)' },
          { name: 'include_metadata', type: 'boolean', required: false, description: 'Include processing metadata' }
        ]
      }
    ],
    'jobs-api': [
      {
        method: 'GET',
        path: '/v1/jobs/{job_id}',
        description: 'Get job status and results',
        parameters: [
          { name: 'job_id', type: 'string', required: true, description: 'Job ID' }
        ]
      }
    ]
  }

  // Code examples
  const codeExamples: Record<string, CodeExample[]> = {
    quickstart: [
      {
        language: 'curl',
        title: 'Upload Your First Dataset',
        description: 'Get started by uploading a CSV file',
        code: `curl -X POST "https://api.pollarbase.com/v1/data/upload" \\
  -H "Authorization: Bearer sk-abc123..." \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@customer_data.csv" \\
  -F "auto_analyze=true"`,
        response: `{
  "dataset_id": "ds_7Qj2mK8fN3xB",
  "status": "processing",
  "name": "customer_data.csv",
  "size_bytes": 524288,
  "rows": 10000,
  "columns": 12,
  "analysis_job_id": "job_3fD8kL1mP7nX"
}`
      },
      {
        language: 'python',
        title: 'Python Quick Start',
        description: 'Complete data processing pipeline',
        code: `import pollarbase

# Initialize client
client = pollarbase.Client(api_key="sk-abc123...")

# Upload and analyze
dataset = client.upload_file("data.csv", auto_analyze=True)
print(f"Dataset ID: {dataset.id}")

# Wait for analysis
analysis = dataset.wait_for_analysis()
print(f"Quality Score: {analysis.quality_score}/100")

# Get cleaning suggestions
suggestions = analysis.get_suggestions()
for suggestion in suggestions:
    print(f"• {suggestion.description}")

# Apply transformations
cleaned = dataset.apply_transformations([
    pollarbase.RemoveDuplicates(),
    pollarbase.FillMissing(strategy="mean"),
    pollarbase.FixFormats()
])

# Export results
cleaned.export("cleaned_data.csv")`,
        response: `Dataset ID: ds_7Qj2mK8fN3xB
Quality Score: 87/100
• Remove 23 duplicate rows
• Fill 156 missing values in 'age' column
• Standardize date formats in 'created_at'
• Fix email format issues in 'email' column
Export completed: cleaned_data.csv`
      },
      {
        language: 'javascript',
        title: 'JavaScript/Node.js',
        description: 'Client-side data processing',
        code: `import Pollarbase from '@pollarbase/js';

const client = new Pollarbase('sk-abc123...');

async function processData() {
  try {
    // Upload file
    const dataset = await client.upload({
      file: fileInput.files[0],
      autoAnalyze: true
    });
    
    // Get analysis results
    const analysis = await dataset.waitForAnalysis();
    console.log(\`Quality: \${analysis.qualityScore}%\`);
    
    // Apply AI suggestions
    const cleaned = await dataset.applySuggestions({
      removeDuplicates: true,
      fillMissing: 'smart',
      fixFormats: true
    });
    
    // Download cleaned data
    const blob = await cleaned.download('csv');
    downloadFile(blob, 'cleaned_data.csv');
    
  } catch (error) {
    console.error('Processing failed:', error);
  }
}`
      }
    ],
    authentication: [
      {
        language: 'curl',
        title: 'API Key Authentication',
        description: 'All API requests require authentication',
        code: `# Include your API key in the Authorization header
curl -H "Authorization: Bearer sk-abc123..." \\
  https://api.pollarbase.com/v1/data/datasets`,
        response: `{
  "datasets": [
    {
      "id": "ds_7Qj2mK8fN3xB",
      "name": "customer_data.csv",
      "created_at": "2024-06-28T10:30:00Z",
      "status": "processed"
    }
  ]
}`
      },
      {
        language: 'python',
        title: 'SDK Authentication',
        description: 'Set up authentication in Python SDK',
        code: `import pollarbase
import os

# Option 1: Direct API key
client = pollarbase.Client(api_key="sk-abc123...")

# Option 2: Environment variable (recommended)
os.environ['POLLARBASE_API_KEY'] = 'sk-abc123...'
client = pollarbase.Client()  # Auto-detects from env

# Option 3: Configuration file
client = pollarbase.Client.from_config('~/.pollarbase/config.json')`
      }
    ],
    'python-sdk': [
      {
        language: 'bash',
        title: 'Installation',
        description: 'Install the Python SDK',
        code: `# Install via pip
pip install pollarbase

# Or with conda
conda install -c pollarbase pollarbase

# Development version
pip install git+https://github.com/pollarbase/python-sdk.git`
      },
      {
        language: 'python',
        title: 'Complete Example',
        description: 'End-to-end data processing workflow',
        code: `import pollarbase
import pandas as pd
from pathlib import Path

# Initialize
client = pollarbase.Client()

# Upload multiple files
datasets = []
for file_path in Path("data/").glob("*.csv"):
    dataset = client.upload_file(file_path)
    datasets.append(dataset)

# Batch analysis
analyses = client.analyze_batch(datasets, 
    include_ml_insights=True,
    detect_anomalies=True
)

# Process results
for analysis in analyses:
    print(f"Dataset: {analysis.dataset.name}")
    print(f"Quality: {analysis.quality_score}%")
    
    if analysis.quality_score < 80:
        # Auto-fix low quality data
        cleaned = analysis.apply_auto_fixes()
        cleaned.export(f"cleaned_{analysis.dataset.name}")
    
    # Extract insights
    insights = analysis.ml_insights
    print(f"Predicted trends: {insights.trends}")
    print(f"Anomalies found: {len(insights.anomalies)}")
    print("---")`
      }
    ],
    errors: [
      {
        language: 'json',
        title: 'Error Response Format',
        description: 'All errors return a consistent JSON structure',
        code: `{
  "error": {
    "type": "validation_error",
    "code": "INVALID_FILE_FORMAT",
    "message": "Unsupported file format. Please upload CSV, JSON, or Parquet files.",
    "details": {
      "file_extension": ".xlsx",
      "supported_formats": ["csv", "json", "parquet"]
    },
    "request_id": "req_7Qj2mK8fN3xB"
  }
}`
      },
      {
        language: 'python',
        title: 'Error Handling in Python',
        description: 'Proper error handling with the Python SDK',
        code: `import pollarbase

client = pollarbase.Client(api_key="sk-abc123...")

try:
    dataset = client.upload_file("data.csv")
    analysis = dataset.analyze()
    
except pollarbase.ValidationError as e:
    print(f"Validation failed: {e.message}")
    print(f"Details: {e.details}")
    
except pollarbase.RateLimitError as e:
    print(f"Rate limit exceeded. Retry after: {e.retry_after}s")
    
except pollarbase.APIError as e:
    print(f"API error [{e.code}]: {e.message}")
    print(f"Request ID: {e.request_id}")
    
except Exception as e:
    print(f"Unexpected error: {e}")`
      }
    ]
  }

  const copyToClipboard = (text: string, title: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(title)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const renderCodeBlock = (example: CodeExample) => (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 mb-6">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-200">{example.title}</span>
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">{example.language}</span>
        </div>
        <button
          onClick={() => copyToClipboard(example.code, example.title)}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <Copy className="w-4 h-4" />
          <span className="text-xs">{copiedCode === example.title ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-400 mb-3">{example.description}</p>
        <pre className="text-sm text-gray-100 overflow-x-auto">
          <code>{example.code}</code>
        </pre>
        {example.response && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Response:</p>
            <pre className="text-sm text-green-400 overflow-x-auto">
              <code>{example.response}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )

  const renderAPIEndpoint = (endpoint: APIEndpoint) => (
    <div className="border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center space-x-3 mb-4">
        <span className={`px-3 py-1 rounded text-xs font-mono font-bold ${
          endpoint.method === 'GET' ? 'bg-green-100 text-green-700' :
          endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' :
          endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {endpoint.method}
        </span>
        <code className="text-lg font-mono text-gray-800 bg-gray-50 px-3 py-1 rounded">{endpoint.path}</code>
      </div>
      <p className="text-gray-600 mb-6 text-lg">{endpoint.description}</p>
      
      {endpoint.parameters && endpoint.parameters.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-4 text-lg">Parameters</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            {endpoint.parameters.map((param, index) => (
              <div key={index} className="flex items-start space-x-4 mb-4 last:mb-0 pb-4 last:pb-0 border-b border-gray-200 last:border-b-0">
                <code className="text-sm bg-white px-3 py-2 rounded border font-mono text-blue-600 font-semibold">
                  {param.name}
                </code>
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">{param.type}</span>
                    {param.required && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">required</span>
                    )}
                  </div>
                  <p className="text-gray-600">{param.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderContent = () => {
    switch (selectedSection) {
      case 'introduction':
        return (
          <div className="max-w-4xl">
            <div className="mb-12">
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Pollarbase API Documentation
              </h1>
              <p className="text-2xl text-gray-600 leading-relaxed mb-8">
                The complete reference for Pollarbase's data processing API. 
                <br />
                <strong>Handle the schlep so you don't have to.</strong>
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 mb-12">
              <div className="flex items-start space-x-4">
                <Sparkles className="w-8 h-8 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-blue-900 mb-3">What is Pollarbase?</h3>
                  <p className="text-blue-800 leading-relaxed text-lg">
                    Pollarbase is the <strong>Stripe for data</strong> - a comprehensive API platform that automatically 
                    identifies data types, detects anomalies, suggests transformations, and outputs 
                    ML-ready datasets. <strong>Spend 80% less time on data preparation.</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-16">
              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Zap className="w-6 h-6 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Quick to Start</h3>
                </div>
                <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                  Upload your data and get insights in seconds. No complex setup required.
                </p>
                <button 
                   onClick={() => setSelectedSection('quickstart')}
                   className="text-blue-600 hover:text-blue-700 font-semibold flex items-center text-lg">
                  Get started <ArrowRight className="w-5 h-5 ml-2" />
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Brain className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">AI-Powered</h3>
                </div>
                <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                  Advanced ML models automatically detect patterns and suggest improvements.
                </p>
                <button 
                   onClick={() => setSelectedSection('analysis-api')}
                   className="text-blue-600 hover:text-blue-700 font-semibold flex items-center text-lg">
                  Explore AI features <ArrowRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-10">
              <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">Core Features</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg mb-3">Automatic Type Detection</h4>
                  <p className="text-gray-600">Smart identification of data types and formats</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg mb-3">Quality Scoring</h4>
                  <p className="text-gray-600">Comprehensive quality metrics and insights</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg mb-3">Smart Transformations</h4>
                  <p className="text-gray-600">AI-suggested data cleaning and formatting</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'quickstart':
        return (
          <div className="max-w-5xl">
            <div className="mb-12">
              <h1 className="text-5xl font-bold text-gray-900 mb-6">Quickstart Guide</h1>
              <p className="text-2xl text-gray-600">
                Get up and running with Pollarbase in under 5 minutes.
              </p>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-8 mb-12">
              <div className="flex items-start space-x-4">
                <Key className="w-8 h-8 text-yellow-600 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-yellow-900 mb-3">Get Your API Key</h3>
                  <p className="text-yellow-800 mb-4 text-lg">
                    First, sign up for a free account and get your API key from the dashboard.
                  </p>
                  <a href="/dashboard/api-keys" 
                     className="inline-flex items-center px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold">
                    Get API Key <ArrowRight className="w-5 h-5 ml-2" />
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Step 1: Choose Your Language</h2>
                <div className="flex space-x-4 mb-8">
                  {['curl', 'python', 'javascript'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`px-6 py-3 rounded-lg font-semibold transition-colors text-lg ${
                        selectedLanguage === lang
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>
                
                {codeExamples.quickstart
                  ?.filter(example => example.language === selectedLanguage)
                  .map((example, index) => (
                    <div key={index}>
                      {renderCodeBlock(example)}
                    </div>
                  ))}
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-8 h-8 text-green-600 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-green-900 mb-4">Next Steps</h3>
                    <ul className="text-green-800 space-y-2 text-lg">
                      <li>• Explore the <button onClick={() => setSelectedSection('python-sdk')} className="font-semibold underline hover:text-green-900">Python SDK</button> for advanced features</li>
                      <li>• Learn about <button onClick={() => setSelectedSection('data-processing')} className="font-semibold underline hover:text-green-900">data processing concepts</button></li>
                      <li>• Check out <button onClick={() => setSelectedSection('complete-pipeline')} className="font-semibold underline hover:text-green-900">complete pipeline examples</button></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'authentication':
        return (
          <div className="max-w-4xl">
            <div className="mb-12">
              <h1 className="text-5xl font-bold text-gray-900 mb-6">Authentication</h1>
              <p className="text-2xl text-gray-600">
                Secure your API requests with proper authentication.
              </p>
            </div>

            <div className="space-y-8">
              {codeExamples.authentication?.map((example, index) => (
                <div key={index}>
                  {renderCodeBlock(example)}
                </div>
              ))}

              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-8">
                <div className="flex items-start space-x-4">
                  <Shield className="w-8 h-8 text-red-600 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-red-900 mb-4">Security Best Practices</h3>
                    <ul className="text-red-800 space-y-3 text-lg">
                      <li>• Never expose API keys in client-side code</li>
                      <li>• Use environment variables to store API keys</li>
                      <li>• Rotate your API keys regularly</li>
                      <li>• Use different keys for development and production</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'errors':
        return (
          <div className="max-w-4xl">
            <div className="mb-12">
              <h1 className="text-5xl font-bold text-gray-900 mb-6">Error Handling</h1>
              <p className="text-2xl text-gray-600">
                Understand and handle API errors gracefully.
              </p>
            </div>

            <div className="space-y-8">
              {codeExamples.errors?.map((example, index) => (
                <div key={index}>
                  {renderCodeBlock(example)}
                </div>
              ))}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-8">
                <h3 className="text-xl font-bold text-blue-900 mb-4">Common Error Codes</h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <code className="bg-white px-3 py-2 rounded border text-sm font-mono text-red-600">400</code>
                    <div>
                      <h4 className="font-semibold text-blue-900">Bad Request</h4>
                      <p className="text-blue-800">Invalid request parameters or malformed data</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <code className="bg-white px-3 py-2 rounded border text-sm font-mono text-red-600">401</code>
                    <div>
                      <h4 className="font-semibold text-blue-900">Unauthorized</h4>
                      <p className="text-blue-800">Invalid or missing API key</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <code className="bg-white px-3 py-2 rounded border text-sm font-mono text-red-600">429</code>
                    <div>
                      <h4 className="font-semibold text-blue-900">Rate Limited</h4>
                      <p className="text-blue-800">Too many requests, please slow down</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'upload-api':
      case 'analysis-api':
      case 'transformation-api':
      case 'export-api':
      case 'jobs-api':
        return (
          <div className="max-w-5xl">
            <div className="mb-12">
              <h1 className="text-5xl font-bold text-gray-900 mb-6">
                {selectedSection.split('-').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </h1>
              <p className="text-2xl text-gray-600">
                Complete API reference for {selectedSection.replace('-', ' ')}.
              </p>
            </div>

            <div className="space-y-8">
              {apiEndpoints[selectedSection]?.map((endpoint, index) => (
                <div key={index}>
                  {renderAPIEndpoint(endpoint)}
                </div>
              ))}
            </div>
          </div>
        )

      case 'python-sdk':
        return (
          <div className="max-w-5xl">
            <div className="mb-12">
              <h1 className="text-5xl font-bold text-gray-900 mb-6">Python SDK</h1>
              <p className="text-2xl text-gray-600">
                The most powerful way to use Pollarbase in Python applications.
              </p>
            </div>

            <div className="space-y-8">
              {codeExamples['python-sdk']?.map((example, index) => (
                <div key={index}>
                  {renderCodeBlock(example)}
                </div>
              ))}
            </div>
          </div>
        )

      default:
        return (
          <div className="max-w-4xl">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              {selectedSection.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </h1>
            <p className="text-2xl text-gray-600 mb-12">
              Documentation for this section is coming soon.
            </p>
            <div className="bg-gray-50 rounded-xl p-12 text-center">
              <Book className="w-16 h-16 text-gray-400 mx-auto mb-6" />
              <p className="text-gray-500 text-lg">
                This section is currently being written. Check back soon!
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <a href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">Pollarbase</span>
                <span className="text-lg text-gray-500 border-l border-gray-300 pl-4">Docs</span>
              </a>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-3 w-80 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                />
              </div>
              <a href="/dashboard" 
                 className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-80 shrink-0 py-12 pr-12 border-r border-gray-200">
            <nav className="space-y-10">
              {docsSections.map((section) => (
                <div key={section.id}>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => setSelectedSection(item.id)}
                          className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors text-lg ${
                            selectedSection === item.id
                              ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600 font-semibold'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 py-12 pl-12">
            {renderContent()}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
} 