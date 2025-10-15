import React from 'react';
import { ContentSectionItem } from '@/types/documentation';
import { DynamicIcon } from '../DynamicIcon';

interface JobMonitoringFeaturesProps {
  section: ContentSectionItem;
}

export function JobMonitoringFeatures({ section }: JobMonitoringFeaturesProps) {
  if (!section.features) return null;

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
      case 'red':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
          title: 'text-red-900',
          text: 'text-red-700'
        };
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: 'text-green-600',
          title: 'text-green-900',
          text: 'text-green-700'
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
    <div className="grid md:grid-cols-3 gap-6">
      {section.features.map((feature, index) => {
        const colors = getColorClasses(feature.color);
        
        return (
          <div
            key={index}
            className={`rounded-lg border ${colors.border} ${colors.bg} p-6`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg bg-white border ${colors.border}`}>
                <DynamicIcon name={feature.icon} className={`w-5 h-5 ${colors.icon}`} />
              </div>
              <h3 className={`font-semibold ${colors.title}`}>
                {feature.category}
              </h3>
            </div>
            
            <ul className="space-y-2">
              {feature.items.map((item, itemIndex) => (
                <li key={itemIndex} className={`text-sm ${colors.text} flex items-start gap-2`}>
                  <DynamicIcon name="check" className={`w-4 h-4 ${colors.icon} mt-0.5 flex-shrink-0`} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
} 