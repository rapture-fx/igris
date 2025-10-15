import React from 'react';
import { ArrowRightIcon, DocumentDuplicateIcon, ClockIcon } from '@heroicons/react/24/outline';
import { ContentSectionItem } from '../../../types/documentation';

interface PaginationStrategiesProps {
  section: ContentSectionItem;
}

const iconMap = {
  'arrow-right': ArrowRightIcon,
  'document-duplicate': DocumentDuplicateIcon,
  'clock': ClockIcon,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
};

export const PaginationStrategies: React.FC<PaginationStrategiesProps> = ({ section }) => {
  if (!section.paginationStrategies) return null;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {section.paginationStrategies.map((strategy, index) => {
        const IconComponent = iconMap[strategy.icon as keyof typeof iconMap];
        const colorClass = colorMap[strategy.color as keyof typeof colorMap];
        
        return (
          <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
            <div className="flex items-center mb-4">
              {IconComponent && <IconComponent className="w-6 h-6 mr-3" />}
              <h3 className="text-lg font-semibold">{strategy.name}</h3>
            </div>
            
            <p className="text-sm mb-4 opacity-90">{strategy.description}</p>
            
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Benefits:</h4>
              <ul className="text-xs space-y-1">
                {strategy.benefits.map((benefit, idx) => (
                  <li key={idx}>• {benefit}</li>
                ))}
              </ul>
            </div>
            
            <div className="pt-2 border-t border-current border-opacity-20">
              <span className="text-xs font-medium">Best for: </span>
              <span className="text-xs">{strategy.useCase}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}; 