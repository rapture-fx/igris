'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'

export function ImprovementActions({ section }: Pick<SectionComponentProps, 'section'>) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">{section.title}</h4>
      <div className="space-y-2 text-sm">
        {section.items?.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <span className="text-green-600">{item.improvement}</span>
            <span className="text-gray-600">{item.action}</span>
          </div>
        ))}
      </div>
    </div>
  )
} 