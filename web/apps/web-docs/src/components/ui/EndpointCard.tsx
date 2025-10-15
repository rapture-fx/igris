'use client'

import { useState } from 'react'
import { CodeBlock } from './CodeBlock'
import { clsx } from 'clsx'

interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  example?: string
}

interface Response {
  status: number
  description: string
  example: string
}

interface EndpointCardProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  title: string
  description: string
  parameters?: Parameter[]
  responses: Response[]
  examples: {
    curl: string
    python: string
    javascript: string
  }
}

export function EndpointCard({
  method,
  path,
  title,
  description,
  parameters = [],
  responses,
  examples
}: EndpointCardProps) {
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'javascript'>('curl')

  const methodColors = {
    GET: 'bg-green-100 text-green-800',
    POST: 'bg-blue-100 text-blue-800',
    PUT: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800',
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <span className={clsx('endpoint-badge', methodColors[method])}>
            {method}
          </span>
          <code className="text-lg font-mono text-gray-900">{path}</code>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mt-2">{title}</h3>
        <p className="text-gray-600 mt-1">{description}</p>
      </div>

      <div className="px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {parameters.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Parameters</h4>
                <div className="space-y-4">
                  {parameters.map((param) => (
                    <div key={param.name} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <code className="text-sm font-mono text-gray-900">{param.name}</code>
                        <span className="text-xs text-gray-500">{param.type}</span>
                        {param.required && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{param.description}</p>
                      {param.example && (
                        <div className="mt-2">
                          <code className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            {param.example}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Responses</h4>
              <div className="space-y-4">
                {responses.map((response) => (
                  <div key={response.status} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={clsx(
                        'text-sm font-mono px-2 py-1 rounded',
                        response.status >= 200 && response.status < 300 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      )}>
                        {response.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{response.description}</p>
                    <CodeBlock
                      code={response.example}
                      language="json"
                      title="Response"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Examples</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex border-b border-gray-200">
                {(['curl', 'python', 'javascript'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      'px-4 py-2 text-sm font-medium transition-colors',
                      activeTab === tab
                        ? 'bg-gray-50 text-gray-900 border-b-2 border-schlep-blue'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    {tab === 'curl' ? 'cURL' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="p-0">
                <CodeBlock
                  code={examples[activeTab]}
                  language={activeTab === 'curl' ? 'bash' : activeTab}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}