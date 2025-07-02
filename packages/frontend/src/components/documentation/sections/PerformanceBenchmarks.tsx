import React from 'react';
import { ContentSectionItem } from '../../../types/documentation';

interface BenchmarkCategory {
  category: string;
  metrics: string[];
}

interface PerformanceBenchmarksProps {
  section: ContentSectionItem;
}

export function PerformanceBenchmarks({ section }: PerformanceBenchmarksProps) {
  const { benchmarks } = section;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{section.title}</h2>
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="grid md:grid-cols-3 gap-6">
          {benchmarks?.map((benchmark: BenchmarkCategory, index: number) => (
            <div key={index} className="text-center">
              <h3 className="font-semibold text-gray-900 mb-2">{benchmark.category}</h3>
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
} 