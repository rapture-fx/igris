'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'

export function ScoreRanges({ section }: Pick<SectionComponentProps, 'section'>) {
  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500'
    }
    return colorMap[color] || 'bg-gray-500'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">{section.title}</h4>
      <div className="space-y-2 text-sm">
        {section.items?.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getColorClasses(item.color)}`}></div>
              <span>{item.range}</span>
            </span>
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
} 