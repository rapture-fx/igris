'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'

export const PerformanceTips: React.FC<SectionComponentProps> = ({ section }) => {
  if (!section.performanceTips) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Tips</h3>
      
      <div className="grid md:grid-cols-1 gap-6">
        {section.performanceTips.map((tipCategory, index) => (
          <div key={index} className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-6">
            <h4 className="text-base font-semibold text-gray-900 mb-2">{tipCategory.category}</h4>
            <p className="text-sm text-gray-700 mb-4">{tipCategory.description}</p>
            
            <div className="space-y-2">
              <ul className="text-sm text-gray-600 space-y-2">
                {tipCategory.tips.map((tip, tipIndex) => (
                  <li key={tipIndex} className="flex items-start">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium mr-3 mt-0.5 flex-shrink-0">
                      {tipIndex + 1}
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 