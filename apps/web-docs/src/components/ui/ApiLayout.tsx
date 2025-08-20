'use client'

import React, { useState } from 'react'
import { ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline'
import CodeBlock from './CodeBlock'

interface CodeExample {
  language: string
  label: string
  code: string
}

interface ApiLayoutProps {
  title: string
  description?: string
  method?: string
  endpoint?: string
  codeExamples?: CodeExample[]
  children: React.ReactNode
}

export function ApiLayout({ 
  title, 
  description, 
  method, 
  endpoint, 
  codeExamples = [], 
  children 
}: ApiLayoutProps) {
  const [activeLanguage, setActiveLanguage] = useState(codeExamples[0]?.language || 'curl')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = async (code: string, language: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(language)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const getMethodColor = (method?: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-green-100 text-green-800 border-green-200'
      case 'POST': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'PUT': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'PATCH': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="flex gap-8 min-h-screen">
      {/* Left Column - Content */}
      <div className="flex-1 min-w-0 pr-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            {method && (
              <span className={`px-2 py-1 text-xs font-semibold rounded border ${getMethodColor(method)}`}>
                {method.toUpperCase()}
              </span>
            )}
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          </div>
          
          {endpoint && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <code className="text-sm font-mono text-gray-900">{endpoint}</code>
            </div>
          )}
          
          {description && (
            <p className="text-sm text-gray-600">{description}</p>
          )}
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          {children}
        </div>
      </div>

      {/* Right Column - Code Examples */}
      {codeExamples.length > 0 && (
        <div className="w-1/2 flex-shrink-0 min-w-0 pr-8">
          <div className="sticky top-24 space-y-6">
            {/* Base URL */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Base URL</h3>
              <div className="rounded-lg p-4" style={{backgroundColor: '#f9fafb', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'}}>
                <code className="base-url-code">
                  https://api.schlep-engine.com
                </code>
              </div>
            </div>
            
            {/* Code Examples */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Get Started with SDKs</h3>
              <div className="api-code-block rounded-lg overflow-hidden" style={{backgroundColor: '#f9fafb', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'}}>
                {/* Language Tabs with Copy Button */}
                {codeExamples.length > 1 && (
                  <div className="flex justify-between items-center border-b" style={{borderColor: '#e5e7eb'}}>
                    <div className="flex overflow-x-auto">
                      {codeExamples.map((example) => (
                        <button
                          key={example.language}
                          onClick={() => setActiveLanguage(example.language)}
                          className={`flex-shrink-0 px-3 py-2 text-sm font-medium transition-all duration-200 relative ${
                            activeLanguage === example.language
                              ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                          style={{
                            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
                            fontSize: '13px',
                            fontWeight: activeLanguage === example.language ? '600' : '500',
                            lineHeight: '1.5',
                            letterSpacing: '-0.01em'
                          }}
                        >
                          {example.label}
                        </button>
                      ))}
                    </div>
                    <div className="pr-3">
                      <button
                        onClick={() => copyToClipboard(
                          codeExamples.find(ex => ex.language === activeLanguage)?.code || '', 
                          activeLanguage
                        )}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                          copiedCode === activeLanguage 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 border border-gray-200'
                        }`}
                      >
                        {copiedCode === activeLanguage ? (
                          <>
                            <CheckIcon className="h-3.5 w-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <ClipboardIcon className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Code Block */}
                {codeExamples.map((example) => (
                  <div
                    key={example.language}
                    className={`relative ${activeLanguage === example.language ? 'block' : 'hidden'}`}
                    style={{
                      margin: 0,
                      background: '#f9fafb',
                    }}
                  >
                    <div style={{ padding: '1rem' }}>
                      <CodeBlock 
                        code={example.code}
                        language={example.language === 'cli' ? 'bash' : example.language}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}