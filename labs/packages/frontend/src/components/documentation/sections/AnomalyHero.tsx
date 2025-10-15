import React from 'react';
import { Filter } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface AnomalyMethod {
  name: string;
  description: string;
}

interface AnomalyHeroProps {
  section: ContentSectionItem;
}

export function AnomalyHero({ section }: AnomalyHeroProps) {
  const { title, description, style, methods } = section;

  const getStyleClasses = (style: string) => {
    switch (style) {
      case 'gradient-purple':
        return 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200';
      default:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200';
    }
  };

  return (
    <div className={`${getStyleClasses(style || '')} border rounded-lg p-6 mb-8`}>
      <div className="flex items-start space-x-4">
        <Filter className="w-8 h-8 text-purple-600 mt-1" />
        <div>
          <h3 className="text-lg font-bold text-purple-900 mb-3">{title}</h3>
          <p className="text-purple-800 leading-relaxed mb-4">{description}</p>
          <div className="grid md:grid-cols-3 gap-4">
            {methods?.map((method: AnomalyMethod, index: number) => (
              <div key={index} className="bg-white/70 rounded-md p-3">
                <h4 className="font-semibold text-purple-900 text-sm mb-1">{method.name}</h4>
                <p className="text-xs text-purple-700">{method.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 