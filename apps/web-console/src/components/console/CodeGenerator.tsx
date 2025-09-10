'use client'

import React, { useState } from 'react'
import { Copy, CheckCircle, Code } from 'lucide-react'

interface APITest {
  id: string
  name: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  sampleRequest?: any
}

interface CodeGeneratorProps {
  test: APITest | null
  onClose: () => void
}

export default function CodeGenerator({ test, onClose }: CodeGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'python' | 'javascript' | 'curl'>('python')
  const [copied, setCopied] = useState(false)

  if (!test) return null

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generatePythonCode = () => {
    const hasBody = test.method !== 'GET' && test.sampleRequest
    
    return `import requests
import json

# Schlep-Engine API Configuration
BASE_URL = "http://localhost:3001"
API_TOKEN = "your_token_here"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_TOKEN}"
}

# ${test.name}
url = f"{BASE_URL}${test.endpoint}"
${hasBody ? `
data = ${JSON.stringify(test.sampleRequest, null, 2)}

response = requests.${test.method.toLowerCase()}(url, headers=headers, json=data)` : `
response = requests.${test.method.toLowerCase()}(url, headers=headers)`}

if response.status_code == 200:
    result = response.json()
    print("Success:", json.dumps(result, indent=2))
else:
    print(f"Error {response.status_code}: {response.text}")
`
  }

  const generateJavaScriptCode = () => {
    const hasBody = test.method !== 'GET' && test.sampleRequest
    
    return `// Schlep-Engine API Configuration
const BASE_URL = 'http://localhost:3001';
const API_TOKEN = 'your_token_here';

// ${test.name}
const ${test.id.replace(/-/g, '_')} = async () => {
  try {
    const response = await fetch(\`\${BASE_URL}${test.endpoint}\`, {
      method: '${test.method}',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${API_TOKEN}\`
      }${hasBody ? `,
      body: JSON.stringify(${JSON.stringify(test.sampleRequest, null, 2)})` : ''}
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    const result = await response.json();
    console.log('Success:', result);
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

// Call the function
${test.id.replace(/-/g, '_')}();`
  }

  const generateCurlCode = () => {
    const hasBody = test.method !== 'GET' && test.sampleRequest
    
    return `# ${test.name}
curl -X ${test.method} \\
  http://localhost:3001${test.endpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your_token_here"${hasBody ? ` \\
  -d '${JSON.stringify(test.sampleRequest, null, 2)}'` : ''}`
  }

  const getCode = () => {
    switch (activeTab) {
      case 'python':
        return generatePythonCode()
      case 'javascript':
        return generateJavaScriptCode()
      case 'curl':
        return generateCurlCode()
      default:
        return ''
    }
  }

  const getLanguage = () => {
    switch (activeTab) {
      case 'python':
        return 'python'
      case 'javascript':
        return 'javascript'
      case 'curl':
        return 'bash'
      default:
        return 'text'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Code className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Code Generator
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {test.name}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => copyToClipboard(getCode())}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(['python', 'javascript', 'curl'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'python' && 'Python'}
              {tab === 'javascript' && 'JavaScript'}
              {tab === 'curl' && 'cURL'}
            </button>
          ))}
        </div>

        {/* Code Display */}
        <div className="p-0">
          <div className="bg-gray-900 text-gray-100 p-6 overflow-auto max-h-[60vh]">
            <pre className="text-sm">
              <code className={`language-${getLanguage()}`}>
                {getCode()}
              </code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Replace &quot;your_token_here&quot; with your actual API token</span>
          </div>
        </div>
      </div>
    </div>
  )
}