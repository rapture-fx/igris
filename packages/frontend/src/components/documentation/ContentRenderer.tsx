'use client'

import React from 'react'
import { 
  Sparkles, 
  Zap, 
  Brain, 
  CheckCircle, 
  TrendingUp,
  ArrowRight,
  Key
} from 'lucide-react'

interface ContentSection {
  id: string
  title: string
  subtitle?: string
  lastUpdated?: string
  sections: ContentSectionItem[]
}

interface ContentSectionItem {
  type: string
  title?: string
  description?: string
  style?: string
  items?: any[]
  action?: {
    label: string
    target?: string
    url?: string
  }
  languages?: string[]
  codeExamplesRef?: string
}

interface ContentRendererProps {
  content: ContentSection
  onSectionChange: (sectionId: string) => void
  onLanguageChange?: (language: string) => void
  selectedLanguage?: string
  codeExamples?: any[]
}

const iconMap: Record<string, React.ComponentType<any>> = {
  Sparkles,
  Zap,
  Brain,
  CheckCircle,
  TrendingUp,
  Key
}

export function ContentRenderer({ 
  content, 
  onSectionChange, 
  onLanguageChange,
  selectedLanguage = 'curl',
  codeExamples = []
}: ContentRendererProps) {
  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName]
    return IconComponent ? <IconComponent className="w-5 h-5" /> : null
  }

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      green: 'text-green-600',
      blue: 'text-blue-600',
      purple: 'text-purple-600',
      yellow: 'text-yellow-600'
    }
    return colorMap[color] || 'text-gray-600'
  }

  const getGradientClasses = (style: string) => {
    const styleMap: Record<string, string> = {
      'gradient-blue': 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200',
      'gradient-yellow': 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200',
      'gradient-green': 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200',
      'gray-background': 'bg-gray-50'
    }
    return styleMap[style] || ''
  }

  const renderHeroSection = (section: ContentSectionItem) => (
    <div className={`rounded-lg p-4 mb-4 ${getGradientClasses(section.style || '')}`}>
      <div className="flex items-start space-x-4">
        <Sparkles className="w-5 h-5 text-blue-600 mt-1" />
        <div>
          <h3 className="text-base font-bold text-blue-900 mb-2">{section.title}</h3>
          <p className="text-blue-800 leading-relaxed text-sm">
            {section.description}
          </p>
        </div>
      </div>
    </div>
  )

  const renderFeaturesGrid = (section: ContentSectionItem) => (
    <div className="grid md:grid-cols-2 gap-6 mb-12">
      {section.items?.map((item, index) => (
        <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-4">
            {getIcon(item.icon)}
            <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
          </div>
          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
            {item.description}
          </p>
          {item.action && (
            <button
              onClick={() => onSectionChange(item.action.target)}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center text-sm"
            >
              {item.action.label} <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      ))}
    </div>
  )

  const renderCoreFeatures = (section: ContentSectionItem) => (
    <div className={`rounded-xl p-10 ${getGradientClasses(section.style || '')}`}>
      <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">{section.title}</h3>
      <div className="grid md:grid-cols-3 gap-8">
        {section.items?.map((item, index) => (
          <div key={index} className="text-center">
            <div className={`w-8 h-8 mx-auto mb-4 ${getColorClasses(item.color)}`}>
              {getIcon(item.icon)}
            </div>
            <h4 className="font-bold text-gray-900 text-lg mb-3">{item.title}</h4>
            <p className="text-gray-600">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  )

  const renderApiKeyCallout = (section: ContentSectionItem) => (
    <div className={`rounded-lg p-4 mb-4 ${getGradientClasses(section.style || '')}`}>
      <div className="flex items-start space-x-3">
        <Key className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div>
          <h3 className="text-base font-bold text-yellow-900 mb-2">{section.title}</h3>
          <p className="text-yellow-800 mb-3 text-sm">
            {section.description}
          </p>
          {section.action && (
            <a 
              href={section.action.url} 
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-semibold"
            >
              {section.action.label} <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          )}
        </div>
      </div>
    </div>
  )

  const renderLanguageSelector = (section: ContentSectionItem) => (
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
            {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Render code examples for selected language */}
      {codeExamples
        ?.filter(example => example.language === selectedLanguage)
        .map((example, index) => (
          <div key={index} className="mb-6">
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
        ))}
    </div>
  )

  const renderNextSteps = (section: ContentSectionItem) => (
    <div className={`rounded-lg p-4 ${getGradientClasses(section.style || '')}`}>
      <div className="flex items-start space-x-3">
        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
        <div>
          <h3 className="text-base font-bold text-green-900 mb-3">{section.title}</h3>
          <ul className="text-green-800 space-y-1 text-sm">
            {section.items?.map((item, index) => (
              <li key={index}>
                • <button 
                    onClick={() => onSectionChange(item.target)} 
                    className="font-semibold underline hover:text-green-900"
                  >
                    {item.text}
                  </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )

  const renderSection = (section: ContentSectionItem) => {
    switch (section.type) {
      case 'hero':
        return renderHeroSection(section)
      case 'features-grid':
        return renderFeaturesGrid(section)
      case 'core-features':
        return renderCoreFeatures(section)
      case 'api-key-callout':
        return renderApiKeyCallout(section)
      case 'language-selector':
        return renderLanguageSelector(section)
      case 'next-steps':
        return renderNextSteps(section)
      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
          {content.title}
        </h1>
        {content.subtitle && (
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {content.subtitle}
          </p>
        )}
      </div>

      <div className="space-y-6">
        {content.sections.map((section, index) => (
          <div key={index}>
            {renderSection(section)}
          </div>
        ))}
      </div>
    </div>
  )
}