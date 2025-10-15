import React from 'react';
import { AlertCircle, TrendingUp, Layers, Brain } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface AnomalyType {
  name: string;
  icon: string;
  color: string;
  items: string[];
}

interface AnomalyTypesGridProps {
  section: ContentSectionItem;
}

export function AnomalyTypesGrid({ section }: AnomalyTypesGridProps) {
  const { title, types } = section;

  const getIcon = (iconName: string) => {
    const iconProps = { className: "w-5 h-5" };
    switch (iconName) {
      case 'alert-circle':
        return <AlertCircle {...iconProps} />;
      case 'trending-up':
        return <TrendingUp {...iconProps} />;
      case 'layers':
        return <Layers {...iconProps} />;
      case 'brain':
        return <Brain {...iconProps} />;
      default:
        return <AlertCircle {...iconProps} />;
    }
  };

  const getIconColor = (color: string) => {
    switch (color) {
      case 'red':
        return 'text-red-500';
      case 'orange':
        return 'text-orange-500';
      case 'blue':
        return 'text-blue-500';
      case 'purple':
        return 'text-purple-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {types?.map((type: AnomalyType, index: number) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center space-x-3 mb-3">
                <span className={getIconColor(type.color)}>
                  {getIcon(type.icon)}
                </span>
                <h3 className="font-semibold text-gray-900">{type.name}</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                {type.items.map((item, itemIndex) => (
                  <li key={itemIndex}>• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 