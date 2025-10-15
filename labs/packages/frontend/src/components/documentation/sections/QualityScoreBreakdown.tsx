'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'
import { getGradientClasses } from '../../../lib/documentation-utils'

export function QualityScoreBreakdown({ section }: Pick<SectionComponentProps, 'section'>) {
  return (
    <div className={`rounded-lg p-5 ${getGradientClasses(section.style || '')}`}>
      <h3 className="text-base font-semibold text-green-900 mb-3">{section.title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {section.items?.map((item, index) => (
          <div key={index} className="text-center">
            <div className="text-lg font-bold text-green-700">{item.percentage}</div>
            <div className="text-sm font-medium text-green-900">{item.title}</div>
            <div className="text-xs text-green-700">{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
} 