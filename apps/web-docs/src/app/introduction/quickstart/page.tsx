'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircleIcon, ClipboardDocumentIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

export default function QuickStart() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = (code: string, id: string) => {
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
    } else if (language === 'bash' || language === 'shell') {
      return code
        .replace(/(curl|npm|pip|git|cd|ls|mkdir|cp|mv|rm|chmod|chown|grep|find|sed|awk|sort|uniq|head|tail|cat|less|more)\b/g, '<span style="color: #7c3aed; font-weight: 600;">$1</span>')
        .replace(/(-[a-zA-Z]+|--[a-zA-Z-]+)/g, '<span style="color: #dc2626; font-weight: 600;">$1</span>')
        .replace(/(['"])(.*?)\1/g, '<span style="color: #059669;">$1$2$1</span>')
        .replace(/(#.*$)/gm, '<span style="color: #6b7280; font-style: italic;">$1</span>')
    }
    return code
  }

  const pythonInstall = `pip install schlep-engine`
  
  const pythonCode = `from schlep_engine import SchlepClient

# Initialize client with your API key
client = SchlepClient(api_key="your_api_key_here")

# Upload your dataset
job = client.upload_csv("your_dataset.csv")
print(f"Upload job created: {job.id}")

# Process the data with AI-powered cleaning
result = client.process(job.id, {
    "auto_clean": True,
    "detect_outliers": True,
    "ml_ready": True,
    "target_format": "tensorflow"
})

print(f"Processing completed: {result.status}")
print(f"Data quality score: {result.quality_score}/100")

# Download the cleaned dataset
cleaned_data = client.download(result.id, format="parquet")
print("Clean data ready for ML training!")`

  const jsCode = `import { SchlepClient } from '@schlep-engine/js-sdk';

// Initialize client
const client = new SchlepClient({
  apiKey: 'your_api_key_here'
});

// Upload and process your data
async function processData() {
  // Upload dataset
  const job = await client.uploadCSV('your_dataset.csv');
  console.log(\`Upload job created: \${job.id}\`);

  // Process with AI cleaning
  const result = await client.process(job.id, {
    autoClean: true,
    detectOutliers: true,
    mlReady: true,
    targetFormat: 'json'
  });

  console.log(\`Processing completed: \${result.status}\`);
  console.log(\`Data quality score: \${result.qualityScore}/100\`);

  // Download processed data
  const cleanedData = await client.download(result.id);
  console.log('Clean data ready!');
  
  return cleanedData;
}

processData().catch(console.error);`

  const curlCode = `# 1. Upload your dataset
curl -X POST "https://api.schlep-engine.com/v1/upload" \\
  -H "Authorization: Bearer your_api_key_here" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@your_dataset.csv" \\
  -F "options={\\"auto_profile\\": true}"

# Response: {"job_id": "job_123abc", "status": "processing"}

# 2. Process the data
curl -X POST "https://api.schlep-engine.com/v1/process" \\
  -H "Authorization: Bearer your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "job_123abc",
    "auto_clean": true,
    "detect_outliers": true,
    "ml_ready": true,
    "target_format": "parquet"
  }'

# 3. Check status and download
curl -X GET "https://api.schlep-engine.com/v1/jobs/job_123abc/result" \\
  -H "Authorization: Bearer your_api_key_here"`

  return (
    <div className="max-w-4xl mx-auto px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Quick Start Guide</h1>
        <p className="text-xl text-gray-600 mb-6">
          Get up and running with Schlep Engine in under 5 minutes. Transform your first dataset 
          with just a few lines of code.
        </p>
      </div>

      {/* Prerequisites */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Prerequisites</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Get Your API Key</h3>
              <p className="text-blue-800 text-sm mb-2">
                You'll need an API key to authenticate your requests.
              </p>
              <Link 
                href="/introduction/api-keys"
                className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 text-sm font-medium"
              >
                Get API Key
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className="text-gray-600">Python 3.7+ or Node.js 14+ (for SDK usage)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className="text-gray-600">A dataset to clean (CSV, JSON, or Excel)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className="text-gray-600">Internet connection for API requests</span>
          </div>
        </div>
      </section>

      {/* Installation */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Installation</h2>
        
        <div className="space-y-6">
          {/* Python SDK */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Python SDK</h3>
            <div className="relative">
              <div className="relative my-6">
                <div className="mb-2 text-gray-600 text-sm font-medium">Terminal</div>
                <button
                  onClick={() => copyToClipboard(pythonInstall, 'python-install')}
                  className="absolute top-2 right-4 p-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors opacity-75 hover:opacity-100"
                >
                  {copiedCode === 'python-install' ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  )}
                </button>
                <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
                  <code style={{color: '#7c3aed', fontSize: '18px', fontWeight: '600'}}>{pythonInstall}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* JavaScript SDK */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">JavaScript SDK</h3>
            <div className="relative">
              <div className="relative my-6">
                <div className="mb-2 text-gray-600 text-sm font-medium">Terminal</div>
                <button
                  onClick={() => copyToClipboard('npm install @schlep-engine/js-sdk', 'js-install')}
                  className="absolute top-2 right-4 p-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors opacity-75 hover:opacity-100"
                >
                  {copiedCode === 'js-install' ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  )}
                </button>
                <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
                  <code style={{color: '#7c3aed', fontSize: '18px', fontWeight: '600'}}>npm install @schlep-engine/js-sdk</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Your First API Call */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your First API Call</h2>
        <p className="text-gray-600 mb-6">
          Let's start with a simple example that uploads a CSV file, processes it with AI-powered cleaning, 
          and downloads the cleaned result.
        </p>

        <div className="space-y-8">
          {/* Python Example */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">Python</span>
              Complete Example
            </h3>
            <div className="relative my-6">
              <div className="mb-2 text-gray-600 text-sm font-medium">main.py</div>
              <button
                onClick={() => copyToClipboard(pythonCode, 'python-code')}
                className="absolute top-2 right-4 p-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors opacity-75 hover:opacity-100 z-10"
              >
                {copiedCode === 'python-code' ? (
                  <CheckCircleIcon className="h-4 w-4" />
                ) : (
                  <ClipboardDocumentIcon className="h-4 w-4" />
                )}
              </button>
              <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
                <code 
                  style={{fontSize: '18px', lineHeight: '1.7'}}
                  dangerouslySetInnerHTML={{__html: formatCode(pythonCode, 'python')}}
                />
              </pre>
            </div>
          </div>

          {/* JavaScript Example */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">JavaScript</span>
              Complete Example
            </h3>
            <div className="relative my-6">
              <div className="mb-2 text-gray-600 text-sm font-medium">index.js</div>
              <button
                onClick={() => copyToClipboard(jsCode, 'js-code')}
                className="absolute top-2 right-4 p-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors opacity-75 hover:opacity-100 z-10"
              >
                {copiedCode === 'js-code' ? (
                  <CheckCircleIcon className="h-4 w-4" />
                ) : (
                  <ClipboardDocumentIcon className="h-4 w-4" />
                )}
              </button>
              <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
                <code 
                  style={{fontSize: '18px', lineHeight: '1.7'}}
                  dangerouslySetInnerHTML={{__html: formatCode(jsCode, 'javascript')}}
                />
              </pre>
            </div>
          </div>

          {/* cURL Example */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">REST API</span>
              Raw HTTP Requests
            </h3>
            <div className="relative my-6">
              <div className="mb-2 text-gray-600 text-sm font-medium">Terminal</div>
              <button
                onClick={() => copyToClipboard(curlCode, 'curl-code')}
                className="absolute top-2 right-4 p-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors opacity-75 hover:opacity-100 z-10"
              >
                {copiedCode === 'curl-code' ? (
                  <CheckCircleIcon className="h-4 w-4" />
                ) : (
                  <ClipboardDocumentIcon className="h-4 w-4" />
                )}
              </button>
              <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
                <code 
                  style={{fontSize: '18px', lineHeight: '1.7'}}
                  dangerouslySetInnerHTML={{__html: formatCode(curlCode, 'bash')}}
                />
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Expected Response */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Expected Response</h2>
        <p className="text-gray-600 mb-4">
          After processing completes, you'll receive a response with data quality metrics and processing details:
        </p>
        
        <div className="relative my-6">
          <div className="mb-2 text-gray-600 text-sm font-medium">JSON Response</div>
          <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
{`{
  "job_id": "job_123abc",
  "status": "completed",
  "quality_score": 87,
  "processing_time": "2.3s",
  "records_processed": 10000,
  "issues_found": 15,
  "issues_fixed": 15,
  "transformations_applied": [
    "removed_duplicates",
    "filled_missing_values", 
    "normalized_formats",
    "detected_outliers"
  ],
  "download_url": "https://api.schlep-engine.com/v1/download/result_xyz789",
  "expires_at": "2024-01-20T10:30:00Z"
}`}
          </pre>
        </div>
      </section>

      {/* Next Steps */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🎉 Congratulations!</h2>
        <p className="text-gray-600 mb-4">
          You've successfully processed your first dataset with Schlep Engine. Here's what to explore next:
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Link 
            href="/api-reference"
            className="block p-4 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-2">📚 Explore the API</h3>
            <p className="text-gray-600 text-sm">
              Discover all available endpoints, parameters, and advanced features.
            </p>
          </Link>
          
          <Link 
            href="/sdks"
            className="block p-4 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-2">🛠 SDK Documentation</h3>
            <p className="text-gray-600 text-sm">
              Deep dive into Python, JavaScript, and R SDKs with detailed examples.
            </p>
          </Link>
          
          <Link 
            href="/use-cases"
            className="block p-4 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-2">💡 Use Cases</h3>
            <p className="text-gray-600 text-sm">
              See real-world examples and implementation patterns for common scenarios.
            </p>
          </Link>
          
          <Link 
            href="/integrations"
            className="block p-4 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-2">🔗 Integrations</h3>
            <p className="text-gray-600 text-sm">
              Connect with Jupyter, Airflow, Snowflake, and other popular platforms.
            </p>
          </Link>
        </div>

        <div className="flex gap-4">
          <Link
            href="/api-reference/upload"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Data Upload API
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/introduction/first-call"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Detailed First Call Guide
          </Link>
        </div>
      </section>
    </div>
  )
}