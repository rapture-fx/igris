'use client'

import React from 'react'
import { CheckCircle } from 'lucide-react'
import { SectionComponentProps } from '../../../types/documentation'
import { getGradientClasses } from '../../../lib/documentation-utils'

export function NextSteps({ section, onSectionChange }: Pick<SectionComponentProps, 'section' | 'onSectionChange'>) {
  return (
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
} 