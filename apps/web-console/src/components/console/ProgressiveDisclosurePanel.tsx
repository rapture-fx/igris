'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Info, Zap, Eye, EyeOff } from 'lucide-react'
import { useConsolePreferences } from '../../contexts/ConsolePreferencesContext'

interface DisclosureSection {
  id: string
  title: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  content: React.ReactNode
  defaultExpanded?: boolean
}

interface ProgressiveDisclosurePanelProps {
  sections: DisclosureSection[]
  className?: string
}

export function ProgressiveDisclosurePanel({ sections, className = "" }: ProgressiveDisclosurePanelProps) {
  const { preferences } = useConsolePreferences()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.defaultExpanded).map(s => s.id))
  )

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
      case 'intermediate': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400'
      case 'advanced': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'beginner': return <Eye className="w-3 h-3" />
      case 'intermediate': return <Zap className="w-3 h-3" />
      case 'advanced': return <EyeOff className="w-3 h-3" />
      default: return <Info className="w-3 h-3" />
    }
  }

  // Filter sections based on interface mode
  const visibleSections = sections.filter(section => {
    if (preferences.interface_mode === 'simple') {
      return section.level === 'beginner' || section.level === 'intermediate'
    }
    return true // Advanced mode shows all sections
  })

  if (visibleSections.length === 0) return null

  return (
    <div className={`space-y-2 ${className}`}>
      {visibleSections.map((section) => {
        const isExpanded = expandedSections.has(section.id)
        
        return (
          <div
            key={section.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-4 py-3 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {section.title}
                      </h3>
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 text-xs font-medium rounded ${getLevelColor(section.level)}`}>
                        {getLevelIcon(section.level)}
                        <span className="capitalize">{section.level}</span>
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {section.description}
                    </p>
                  </div>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                {section.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Helper component for creating disclosure sections
export function DisclosureSection({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode
  className?: string 
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {children}
    </div>
  )
}

// Helper component for tips and hints
export function DisclosureTip({ 
  children, 
  type = 'info' 
}: { 
  children: React.ReactNode
  type?: 'info' | 'warning' | 'success' 
}) {
  const getTypeColor = () => {
    switch (type) {
      case 'warning': return 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:text-amber-300 dark:border-amber-800'
      case 'success': return 'text-green-700 bg-green-50 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800'
      default: return 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:text-blue-300 dark:border-blue-800'
    }
  }

  return (
    <div className={`p-3 rounded-lg border text-sm ${getTypeColor()}`}>
      {children}
    </div>
  )
}