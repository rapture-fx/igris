'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'

export const PerformanceBenchmarks: React.FC<SectionComponentProps> = ({ section }) => {
  if (!section.performanceBenchmarks) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Benchmarks</h3>
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="grid md:grid-cols-3 gap-6">
          {section.performanceBenchmarks.map((benchmark, index) => (
            <div key={index} className="text-center">
              <h4 className="font-semibold text-gray-900 mb-2">{benchmark.category}</h4>
              <div className="text-sm text-gray-600 space-y-1">
                {benchmark.metrics.map((metric, metricIndex) => (
                  <div key={metricIndex}>{metric}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 