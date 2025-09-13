'use client'

import React, { useState } from 'react'
import { X, Copy, Check, Code2, Terminal, Globe, Zap } from 'lucide-react'

interface CodeSnippetGeneratorProps {
  isOpen: boolean
  onClose: () => void
  requestConfig: {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
  }
  response?: any
}

type CodeLanguage = 'curl' | 'python' | 'javascript' | 'go'

export function CodeSnippetGenerator({ 
  isOpen, 
  onClose, 
  requestConfig,
  response 
}: CodeSnippetGeneratorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>('curl')
  const [copiedLanguage, setCopiedLanguage] = useState<CodeLanguage | null>(null)

  if (!isOpen) return null

  const generateCurlCode = (): string => {
    let curl = `curl -X ${requestConfig.method} \\\n  "${requestConfig.url}"`
    
    Object.entries(requestConfig.headers).forEach(([key, value]) => {
      curl += ` \\\n  -H "${key}: ${value}"`
    })
    
    if (requestConfig.body && ['POST', 'PUT', 'PATCH'].includes(requestConfig.method)) {
      curl += ` \\\n  -d '${requestConfig.body}'`
    }
    
    return curl
  }

  const generatePythonCode = (): string => {
    const hasBody = requestConfig.body && ['POST', 'PUT', 'PATCH'].includes(requestConfig.method)
    
    let code = `import requests\nimport json\n\n`
    
    // Headers
    code += `headers = {\n`
    Object.entries(requestConfig.headers).forEach(([key, value]) => {
      code += `    "${key}": "${value}",\n`
    })
    code += `}\n\n`
    
    // Request body
    if (hasBody) {
      code += `data = ${requestConfig.body}\n\n`
    }
    
    // Request
    code += `response = requests.${requestConfig.method.toLowerCase()}(\n`
    code += `    "${requestConfig.url}",\n`
    code += `    headers=headers`
    
    if (hasBody) {
      code += `,\n    json=data`
    }
    
    code += `\n)\n\n`
    code += `# Check response\n`
    code += `if response.status_code == 200:\n`
    code += `    result = response.json()\n`
    code += `    print(json.dumps(result, indent=2))\n`
    code += `else:\n`
    code += `    print(f"Error: {response.status_code} - {response.text}")`
    
    return code
  }

  const generateJavaScriptCode = (): string => {
    const hasBody = requestConfig.body && ['POST', 'PUT', 'PATCH'].includes(requestConfig.method)
    
    let code = `// Using fetch API\n`
    code += `const headers = {\n`
    Object.entries(requestConfig.headers).forEach(([key, value]) => {
      code += `  "${key}": "${value}",\n`
    })
    code += `};\n\n`
    
    if (hasBody) {
      code += `const data = ${requestConfig.body};\n\n`
    }
    
    code += `fetch("${requestConfig.url}", {\n`
    code += `  method: "${requestConfig.method}",\n`
    code += `  headers: headers`
    
    if (hasBody) {
      code += `,\n  body: JSON.stringify(data)`
    }
    
    code += `\n})\n`
    code += `.then(response => {\n`
    code += `  if (!response.ok) {\n`
    code += `    throw new Error(\`HTTP error! status: \${response.status}\`);\n`
    code += `  }\n`
    code += `  return response.json();\n`
    code += `})\n`
    code += `.then(data => {\n`
    code += `  console.log('Success:', data);\n`
    code += `})\n`
    code += `.catch(error => {\n`
    code += `  console.error('Error:', error);\n`
    code += `});`
    
    return code
  }

  const generateGoCode = (): string => {
    const hasBody = requestConfig.body && ['POST', 'PUT', 'PATCH'].includes(requestConfig.method)
    
    let code = `package main\n\n`
    code += `import (\n`
    code += `\t"bytes"\n`
    code += `\t"encoding/json"\n`
    code += `\t"fmt"\n`
    code += `\t"io/ioutil"\n`
    code += `\t"net/http"\n`
    code += `\t"log"\n`
    code += `)\n\n`
    
    code += `func main() {\n`
    
    if (hasBody) {
      code += `\t// Request body\n`
      code += `\tdata := \`${requestConfig.body}\`\n\n`
    }
    
    if (hasBody) {
      code += `\treq, err := http.NewRequest("${requestConfig.method}", "${requestConfig.url}", bytes.NewBuffer([]byte(data)))\n`
    } else {
      code += `\treq, err := http.NewRequest("${requestConfig.method}", "${requestConfig.url}", nil)\n`
    }
    
    code += `\tif err != nil {\n`
    code += `\t\tlog.Fatal(err)\n`
    code += `\t}\n\n`
    
    code += `\t// Set headers\n`
    Object.entries(requestConfig.headers).forEach(([key, value]) => {
      code += `\treq.Header.Set("${key}", "${value}")\n`
    })
    
    code += `\n\t// Send request\n`
    code += `\tclient := &http.Client{}\n`
    code += `\tresp, err := client.Do(req)\n`
    code += `\tif err != nil {\n`
    code += `\t\tlog.Fatal(err)\n`
    code += `\t}\n`
    code += `\tdefer resp.Body.Close()\n\n`
    
    code += `\t// Read response\n`
    code += `\tbody, err := ioutil.ReadAll(resp.Body)\n`
    code += `\tif err != nil {\n`
    code += `\t\tlog.Fatal(err)\n`
    code += `\t}\n\n`
    
    code += `\t// Print response\n`
    code += `\tfmt.Printf("Status: %s\\n", resp.Status)\n`
    code += `\tfmt.Printf("Body: %s\\n", body)\n`
    code += `}`
    
    return code
  }

  const getCodeSnippet = (language: CodeLanguage): string => {
    switch (language) {
      case 'curl':
        return generateCurlCode()
      case 'python':
        return generatePythonCode()
      case 'javascript':
        return generateJavaScriptCode()
      case 'go':
        return generateGoCode()
      default:
        return ''
    }
  }

  const copyToClipboard = async (text: string, language: CodeLanguage) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedLanguage(language)
      setTimeout(() => setCopiedLanguage(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const languages = [
    { id: 'curl', name: 'cURL', icon: Terminal },
    { id: 'python', name: 'Python', icon: Code2 },
    { id: 'javascript', name: 'JavaScript', icon: Globe },
    { id: 'go', name: 'Go', icon: Zap }
  ] as const

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Code Generator
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Generate code snippets for your API request
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Language Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-6 px-6">
            {languages.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedLanguage(id)}
                className={`flex items-center space-x-2 py-3 px-1 border-b-2 transition-colors ${
                  selectedLanguage === id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {languages.find(l => l.id === selectedLanguage)?.name} Code
                </h3>
                <button
                  onClick={() => copyToClipboard(getCodeSnippet(selectedLanguage), selectedLanguage)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                    copiedLanguage === selectedLanguage
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {copiedLanguage === selectedLanguage ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="text-sm font-medium">Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <pre className="p-4 text-sm font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                  {getCodeSnippet(selectedLanguage)}
                </pre>
              </div>
            </div>

            {/* Request Summary */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                Request Summary
              </h4>
              <div className="space-y-1 text-xs text-blue-800 dark:text-blue-400">
                <div className="flex">
                  <span className="font-medium w-16">Method:</span>
                  <span>{requestConfig.method}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-16">URL:</span>
                  <span className="break-all">{requestConfig.url}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-16">Headers:</span>
                  <span>{Object.keys(requestConfig.headers).length} headers</span>
                </div>
                {requestConfig.body && (
                  <div className="flex">
                    <span className="font-medium w-16">Body:</span>
                    <span>JSON payload included</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tips based on language */}
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                💡 {languages.find(l => l.id === selectedLanguage)?.name} Tips
              </h4>
              <div className="text-xs text-yellow-800 dark:text-yellow-400">
                {selectedLanguage === 'curl' && (
                  <p>Use -v flag for verbose output to see full request/response details. Add -k to ignore SSL certificate errors in development.</p>
                )}
                {selectedLanguage === 'python' && (
                  <p>Install required package: pip install requests. Consider adding timeout and error handling for production code.</p>
                )}
                {selectedLanguage === 'javascript' && (
                  <p>This code uses the modern fetch API. For Node.js, consider using axios or node-fetch. Add proper error handling for production.</p>
                )}
                {selectedLanguage === 'go' && (
                  <p>Remember to handle errors appropriately in production code. Consider adding timeout and retry logic for robust applications.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}