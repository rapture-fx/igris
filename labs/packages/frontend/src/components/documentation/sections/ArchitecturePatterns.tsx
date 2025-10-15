import React from 'react';
import { ContentSectionItem } from '../../../types/documentation';

interface ArchitecturePattern {
  name: string;
  style: string;
  flow: string;
  bestFor: string;
}

interface ArchitecturePatternsProps {
  section: ContentSectionItem;
}

export function ArchitecturePatterns({ section }: ArchitecturePatternsProps) {
  const { patterns } = section;

  const getPatternStyle = (style: string) => {
    switch (style) {
      case 'blue':
        return {
          background: 'bg-blue-50',
          border: 'border-blue-200',
          titleColor: 'text-blue-900',
          textColor: 'text-blue-800'
        };
      case 'green':
        return {
          background: 'bg-green-50',
          border: 'border-green-200',
          titleColor: 'text-green-900',
          textColor: 'text-green-800'
        };
      default:
        return {
          background: 'bg-gray-50',
          border: 'border-gray-200',
          titleColor: 'text-gray-900',
          textColor: 'text-gray-800'
        };
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{section.title}</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {patterns?.map((pattern: ArchitecturePattern, index: number) => {
          const styles = getPatternStyle(pattern.style);
          return (
            <div key={index} className={`${styles.background} border ${styles.border} rounded-lg p-5`}>
              <h3 className={`font-semibold ${styles.titleColor} mb-3`}>{pattern.name}</h3>
              <div className={`text-sm ${styles.textColor} space-y-2`}>
                <div>{pattern.flow}</div>
                <div className="text-xs">Best for: {pattern.bestFor}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 