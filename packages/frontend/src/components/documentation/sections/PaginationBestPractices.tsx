import React from 'react';
import { BoltIcon, ExclamationTriangleIcon, UserIcon } from '@heroicons/react/24/outline';
import { ContentSectionItem } from '../../../types/documentation';

interface PaginationBestPracticesProps {
  section: ContentSectionItem;
}

const iconMap = {
  'lightning-bolt': BoltIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  'user': UserIcon,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  red: 'bg-red-50 border-red-200',
  green: 'bg-green-50 border-green-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  red: 'text-red-600',
  green: 'text-green-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  red: 'text-red-900',
  green: 'text-green-900',
};

export const PaginationBestPractices: React.FC<PaginationBestPracticesProps> = ({ section }) => {
  if (!section.paginationPractices) return null;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {section.paginationPractices.map((practice, index) => {
        const IconComponent = iconMap[practice.icon as keyof typeof iconMap];
        const colorClass = colorMap[practice.color as keyof typeof colorMap];
        const iconColorClass = iconColorMap[practice.color as keyof typeof iconColorMap];
        const textColorClass = textColorMap[practice.color as keyof typeof textColorMap];
        
        return (
          <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
            <div className="flex items-center mb-4">
              {IconComponent && (
                <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
              )}
              <h3 className={`text-lg font-semibold ${textColorClass}`}>
                {practice.category}
              </h3>
            </div>
            
            <ul className="space-y-2">
              {practice.tips.map((tip, idx) => (
                <li key={idx} className={`text-sm ${textColorClass} opacity-90`}>
                  • {tip}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}; 