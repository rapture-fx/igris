import React from 'react';
import { ContentSectionItem } from '@/types/documentation';
import { DynamicIcon } from '../DynamicIcon';

interface TransformationTypesGridProps {
  section: ContentSectionItem;
}

export function TransformationTypesGrid({ section }: TransformationTypesGridProps) {
  if (!section.transformationTypes) return null;

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          text: 'text-blue-700'
        };
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: 'text-green-600',
          title: 'text-green-900',
          text: 'text-green-700'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          icon: 'text-purple-600',
          title: 'text-purple-900',
          text: 'text-purple-700'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: 'text-gray-600',
          title: 'text-gray-900',
          text: 'text-gray-700'
        };
    }
  };

  return (
    <div className="space-y-8">
      {section.transformationTypes.map((category, categoryIndex) => {
        const colors = getColorClasses(category.color);
        
        return (
          <div key={categoryIndex} className={`rounded-lg border ${colors.border} ${colors.bg} p-6`}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2 rounded-lg bg-white border ${colors.border}`}>
                <DynamicIcon name={category.icon} className={`w-6 h-6 ${colors.icon}`} />
              </div>
              <h3 className={`text-lg font-semibold ${colors.title}`}>
                {category.category}
              </h3>
            </div>
            
            <div className="grid gap-4">
              {category.types.map((type, typeIndex) => (
                <div key={typeIndex} className="bg-white rounded-lg border border-white/50 p-4">
                  <h4 className={`font-medium ${colors.title} mb-2`}>
                    {type.name}
                  </h4>
                  <p className={`text-sm ${colors.text} mb-3`}>
                    {type.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {type.methods.map((method, methodIndex) => (
                      <span
                        key={methodIndex}
                        className={`px-2 py-1 text-xs font-medium rounded-md ${colors.bg} ${colors.text} border ${colors.border}`}
                      >
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
} 