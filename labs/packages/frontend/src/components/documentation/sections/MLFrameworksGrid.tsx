'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'

export function MLFrameworksGrid({ section }: Pick<SectionComponentProps, 'section'>) {
  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      orange: 'bg-orange-50 border-orange-200',
      red: 'bg-red-50 border-red-200',
      blue: 'bg-blue-50 border-blue-200',
      yellow: 'bg-yellow-50 border-yellow-200',
      green: 'bg-green-50 border-green-200',
      purple: 'bg-purple-50 border-purple-200'
    }
    return colorMap[color] || 'bg-gray-50 border-gray-200'
  }

  return (
    <div className="grid md:grid-cols-4 gap-4">
      {section.frameworks?.map((framework, index) => (
        <div 
          key={index} 
          className={`${getColorClasses(framework.color)} rounded-lg p-4 text-center`}
        >
          <div className="text-sm font-semibold text-gray-900">{framework.name}</div>
          <div className="text-xs text-gray-600 mt-1">{framework.description}</div>
        </div>
      ))}
    </div>
  )
} 