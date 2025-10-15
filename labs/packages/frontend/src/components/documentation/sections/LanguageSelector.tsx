'use client'

import React from 'react'
import { SectionComponentProps, CodeExample } from '../../../types/documentation'
import { getLanguageDisplayName } from '../../../lib/documentation-utils'

export function LanguageSelector({ 
  section, 
  onLanguageChange,
  selectedLanguage = 'curl',
  codeExamples = []
}: Pick<SectionComponentProps, 'section' | 'onLanguageChange' | 'selectedLanguage' | 'codeExamples'>) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">{section.title}</h2>
      <div className="flex space-x-3 mb-6">
        {section.languages?.map((lang) => (
          <button
            key={lang}
            onClick={() => onLanguageChange?.(lang)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              selectedLanguage === lang
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {getLanguageDisplayName(lang)}
          </button>
        ))}
      </div>
      
      {/* Render code examples for selected language */}
      {codeExamples
        ?.filter(example => example.language === selectedLanguage)
        .map((example, index) => (
          <CodeExampleBlock key={index} example={example} />
        ))}
    </div>
  )
}

interface CodeExampleBlockProps {
  example: CodeExample
}

function CodeExampleBlock({ example }: CodeExampleBlockProps) {
  return (
    <div className="mb-6">
      <div className="bg-gray-900 rounded-t-lg px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">{example.title}</h3>
          <button className="text-gray-400 hover:text-white">
            Copy
          </button>
        </div>
        <p className="text-gray-400 text-xs mt-1">{example.description}</p>
      </div>
      <div className="bg-gray-800 rounded-b-lg p-4 overflow-x-auto">
        <pre className="text-gray-100 text-sm">
          <code>{example.code}</code>
        </pre>
      </div>
      {example.response && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-2">
          <h4 className="text-green-800 font-semibold text-sm mb-2">Response:</h4>
          <pre className="text-green-700 text-xs overflow-x-auto">
            <code>{example.response}</code>
          </pre>
        </div>
      )}
    </div>
  )
} 