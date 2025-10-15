import React from 'react';
import { ContentSectionItem } from '../../../types/documentation';

interface ScalingStrategy {
  type: string;
  description: string;
  items: string[];
}

interface ScalingStrategiesProps {
  section: ContentSectionItem;
}

export function ScalingStrategies({ section }: ScalingStrategiesProps) {
  const { strategies } = section;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{section.title}</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {strategies?.map((strategy: ScalingStrategy, index: number) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-900 mb-3">{strategy.type}</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              {strategy.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
} 