'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CodeBlockProps {
  code: string
  language: string
  title?: string
  showLineNumbers?: boolean
}

export function CodeBlock({ code, language, title, showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
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
    } else if (language === 'json') {
      return code
        .replace(/(".*?")\s*:/g, '<span style="color: #7c3aed; font-weight: 600;">$1</span>:')
        .replace(/:\s*(".*?")/g, ': <span style="color: #059669;">$1</span>')
        .replace(/:\s*(true|false|null)/g, ': <span style="color: #dc2626; font-weight: 600;">$1</span>')
        .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color: #dc2626;">$1</span>')
    }
    return code
  }

  return (
    <div className="relative text-left my-6">
      {title && (
        <div className="mb-2 text-gray-600 text-sm font-medium">
          {title}
        </div>
      )}
      <div className="relative bg-gray-50 rounded-lg border border-gray-200">
        <button
          onClick={copyToClipboard}
          className="absolute top-4 right-4 p-2 rounded-md bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors opacity-75 hover:opacity-100 shadow-sm border border-gray-200"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
        <pre className="p-6 overflow-x-auto font-mono text-sm leading-relaxed">
          <code 
            className={`language-${language}`}
            dangerouslySetInnerHTML={{__html: formatCode(code, language)}}
          />
        </pre>
      </div>
    </div>
  )
}

export default CodeBlock