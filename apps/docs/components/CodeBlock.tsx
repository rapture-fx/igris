'use client'

import { useState } from 'react'
import { ClipboardDocumentIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

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
      <div className="relative">
        <button
          onClick={copyToClipboard}
          className="absolute top-4 right-4 p-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors opacity-75 hover:opacity-100"
        >
          {copied ? (
            <CheckCircleIcon className="h-4 w-4" />
          ) : (
            <ClipboardDocumentIcon className="h-4 w-4" />
          )}
        </button>
        <pre className="p-8 overflow-x-auto font-mono leading-relaxed" style={{fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace', fontSize: '18px', lineHeight: '1.7', background: 'transparent'}}>
          <code 
            className={`language-${language}`}
            style={{fontSize: '18px', lineHeight: '1.7'}}
            dangerouslySetInnerHTML={{__html: formatCode(code, language)}}
          />
        </pre>
      </div>
    </div>
  )
}

export default CodeBlock;