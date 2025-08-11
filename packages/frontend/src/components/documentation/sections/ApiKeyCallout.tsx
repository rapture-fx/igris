'use client'

import React from 'react'
import { Key, ArrowRight } from 'lucide-react'
import { SectionComponentProps } from '../../../types/documentation'
import { getGradientClasses } from '../../../lib/documentation-utils'

export function ApiKeyCallout({ section }: Pick<SectionComponentProps, 'section'>) {
  return (
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
} 