'use client'

import { useState, useEffect } from 'react'
import { ClipboardDocumentIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import curl from 'react-syntax-highlighter/dist/esm/languages/hljs/bash'
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'

interface CodeBlockProps {
  code: string
  language: string
  title?: string
  showLineNumbers?: boolean
  showCopyButton?: boolean
}

// Register languages
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('curl', curl)

export function CodeBlock({ code, language, title, showLineNumbers = false, showCopyButton = true }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  // Custom style for better readability
  const customStyle = {
    ...atomOneLight,
    'hljs': {
      ...atomOneLight['hljs'],
      background: '#f8f9fa',
      padding: '1rem',
      borderRadius: '0.375rem',
      fontSize: '11px',
      lineHeight: '1.4',
    }
  }

  // Handle language mapping
  const getLanguage = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'curl': return 'bash'
      case 'js': return 'javascript'
      case 'py': return 'python'
      default: return lang.toLowerCase()
    }
  }

  if (!mounted) {
    // Show plain text while loading to prevent hydration mismatch
    return (
      <div className={`relative text-left ${title ? 'my-6' : ''}`}>
        {title && (
          <div className="mb-2 text-gray-600 text-sm font-medium">
            {title}
          </div>
        )}
        <div className="relative">
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
            <code className="text-sm font-mono block leading-relaxed">
              {code}
            </code>
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative text-left ${title ? 'my-6' : ''}`}>
      {title && (
        <div className="mb-2 text-gray-600 text-sm font-medium">
          {title}
        </div>
      )}
      <div className="relative">
        {showCopyButton && (
          <button
            onClick={copyToClipboard}
            className="absolute top-4 right-4 p-2 rounded-md bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition-colors shadow-sm border border-gray-200 z-10"
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" />
            )}
          </button>
        )}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <SyntaxHighlighter
            language={getLanguage(language)}
            style={customStyle}
            showLineNumbers={showLineNumbers}
            wrapLines={true}
            customStyle={{
              margin: 0,
              fontSize: '11px',
              lineHeight: '1.4',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  )
}

export default CodeBlock