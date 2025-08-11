'use client'

import React from 'react'
import { Sparkles } from 'lucide-react'
import { SectionComponentProps } from '../../../types/documentation'
import { getGradientClasses } from '../../../lib/documentation-utils'

export function HeroSection({ section }: Pick<SectionComponentProps, 'section'>) {
  return (
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
} 