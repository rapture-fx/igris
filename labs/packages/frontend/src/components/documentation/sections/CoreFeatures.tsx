'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'
import { getIcon, getColorClasses, getGradientClasses } from '../../../lib/documentation-utils'

export function CoreFeatures({ section }: Pick<SectionComponentProps, 'section'>) {
  return (
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
} 