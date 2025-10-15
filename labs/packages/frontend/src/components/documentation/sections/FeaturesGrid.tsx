'use client'

import React from 'react'
import { ArrowRight } from 'lucide-react'
import { SectionComponentProps } from '../../../types/documentation'
import { getIcon } from '../../../lib/documentation-utils'

export function FeaturesGrid({ section, onSectionChange }: Pick<SectionComponentProps, 'section' | 'onSectionChange'>) {
  return (
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
} 