'use client'

import { useState } from 'react'
import { ClipboardDocumentIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface CodeBlockProps {
  code: string
  language: string
  title?: string
  showLineNumbers?: boolean
  showCopyButton?: boolean
}

export function CodeBlock({ code, language, title, showLineNumbers = false, showCopyButton = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      // Copy the original code without HTML formatting
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const highlightCode = (code: string, language: string) => {
    // Simple regex-based syntax highlighting for common languages
    if (!code) return code

    let highlightedCode = code

    if (language === 'python') {
      highlightedCode = highlightedCode
        // Keywords
        .replace(/\b(def|class|if|else|elif|for|while|import|from|return|try|except|with|as|pass|break|continue|and|or|not|in|is|lambda|global|nonlocal|assert|yield|True|False|None)\b/g, '<span style="color: #a626a4; font-weight: bold;">$1</span>')
        // Strings
        .replace(/(['"`])(.*?)\1/g, '<span style="color: #50a14f;">$1$2$1</span>')
        // Comments
        .replace(/(#.*$)/gm, '<span style="color: #a0a1a7; font-style: italic;">$1</span>')
        // Functions
        .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '<span style="color: #4078f2;">$1</span>(')
        // Numbers
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #e45649;">$1</span>')
    } else if (language === 'javascript') {
      highlightedCode = highlightedCode
        // Keywords
        .replace(/\b(function|const|let|var|if|else|for|while|return|import|export|from|default|class|extends|try|catch|finally|throw|async|await|true|false|null|undefined|typeof|instanceof)\b/g, '<span style="color: #a626a4; font-weight: bold;">$1</span>')
        // Strings
        .replace(/(['"`])(.*?)\1/g, '<span style="color: #50a14f;">$1$2$1</span>')
        // Comments
        .replace(/(\/\/.*$)/gm, '<span style="color: #a0a1a7; font-style: italic;">$1</span>')
        // Functions
        .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '<span style="color: #4078f2;">$1</span>(')
        // Numbers
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #e45649;">$1</span>')
    } else if (language === 'bash' || language === 'curl') {
      highlightedCode = highlightedCode
        // Commands
        .replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)/gm, '$1<span style="color: #4078f2; font-weight: bold;">$2</span>')
        // Flags
        .replace(/\s(-[a-zA-Z-]+)/g, ' <span style="color: #a626a4;">$1</span>')
        // Strings
        .replace(/(['"`])(.*?)\1/g, '<span style="color: #50a14f;">$1$2$1</span>')
        // Comments
        .replace(/(#.*$)/gm, '<span style="color: #a0a1a7; font-style: italic;">$1</span>')
    } else if (language === 'json') {
      highlightedCode = highlightedCode
        // Strings (keys and values)
        .replace(/(".*?")/g, '<span style="color: #50a14f;">$1</span>')
        // Numbers
        .replace(/:\s*(\d+(?:\.\d+)?)/g, ': <span style="color: #e45649;">$1</span>')
        // Booleans and null
        .replace(/:\s*(true|false|null)/g, ': <span style="color: #a626a4;">$1</span>')
        // Brackets and braces
        .replace(/([{}[\],])/g, '<span style="color: #383a42;">$1</span>')
    }

    return highlightedCode
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
            className="absolute top-4 right-4 p-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors opacity-75 hover:opacity-100 z-10"
          >
            {copied ? (
              <CheckCircleIcon className="h-4 w-4" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" />
            )}
          </button>
        )}
        <pre className="bg-white border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code 
            className="text-sm font-mono block leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            }}
          />
        </pre>
      </div>
    </div>
  )
}

export default CodeBlock;