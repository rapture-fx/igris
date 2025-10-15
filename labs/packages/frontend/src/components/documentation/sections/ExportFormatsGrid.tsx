import React from 'react';
import { ContentSectionItem } from '@/types/documentation';
import { DynamicIcon } from '../DynamicIcon';

interface ExportFormatsGridProps {
  section: ContentSectionItem;
}

export function ExportFormatsGrid({ section }: ExportFormatsGridProps) {
  if (!section.exportFormats) return null;

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          text: 'text-blue-700',
          accent: 'bg-blue-100'
        };
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: 'text-green-600',
          title: 'text-green-900',
          text: 'text-green-700',
          accent: 'bg-green-100'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: 'text-gray-600',
          title: 'text-gray-900',
          text: 'text-gray-700',
          accent: 'bg-gray-100'
        };
    }
  };

  return (
    <div className="space-y-8">
      {section.exportFormats.map((category, categoryIndex) => {
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
              {category.formats.map((format, formatIndex) => (
                <div key={formatIndex} className="bg-white rounded-lg border border-white/50 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className={`font-semibold text-lg ${colors.title}`}>
                      {format.name}
                    </h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-md ${colors.accent} ${colors.text}`}>
                      {format.useCase}
                    </span>
                  </div>
                  
                  <p className={`text-sm ${colors.text} mb-4`}>
                    {format.description}
                  </p>
                  
                  <div>
                    <h5 className={`text-sm font-medium ${colors.title} mb-2`}>
                      Key Features:
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {format.features.map((feature, featureIndex) => (
                        <span
                          key={featureIndex}
                          className={`px-2 py-1 text-xs font-medium rounded-md ${colors.bg} ${colors.text} border ${colors.border}`}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
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