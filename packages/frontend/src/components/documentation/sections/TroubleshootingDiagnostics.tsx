'use client'

import React from 'react'
import { CheckCircle } from 'lucide-react'
import { SectionComponentProps } from '../../../types/documentation'

interface TroubleshootingDiagnosticsProps extends SectionComponentProps {}

export const TroubleshootingDiagnostics: React.FC<TroubleshootingDiagnosticsProps> = ({ section }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Diagnostic Procedures</h3>
      
      <div className="grid md:grid-cols-1 gap-6">
        {section.troubleshootingDiagnostics?.map((diagnostic, index) => (
          <div key={index} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <h4 className="text-base font-semibold text-blue-900 mb-2">{diagnostic.category}</h4>
            <p className="text-sm text-blue-800 mb-4">{diagnostic.description}</p>
            
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-blue-900">Steps:</h5>
              <ol className="text-sm text-blue-700 space-y-1">
                {diagnostic.steps.map((step, stepIndex) => (
                  <li key={stepIndex} className="flex items-start">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium mr-3 mt-0.5 flex-shrink-0">
                      {stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 