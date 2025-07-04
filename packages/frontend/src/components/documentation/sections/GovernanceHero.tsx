'use client'

import React from 'react'
import { Shield, CheckCircle } from 'lucide-react'
import { SectionComponentProps } from '../../../types/documentation'
import { getGradientClasses, getIcon } from '../../../lib/documentation-utils'

export function GovernanceHero({ section }: Pick<SectionComponentProps, 'section'>) {
  return (
    <div className={`rounded-xl p-8 ${getGradientClasses(section.style || '')}`}>
      <div className="flex items-start space-x-4 mb-6">
        <Shield className="w-8 h-8 text-blue-600 mt-1" />
        <div>
          <h2 className="text-xl font-bold text-blue-900 mb-3">{section.title}</h2>
          <p className="text-blue-800 mb-4">
            {section.description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {section.features?.map((feature, index) => {
          const icon = getIcon(feature.icon);
          return (
            <div key={index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center">
                {icon && React.cloneElement(icon, { className: "w-4 h-4 text-blue-600 mr-2" })}
                {feature.name}
              </h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
} 