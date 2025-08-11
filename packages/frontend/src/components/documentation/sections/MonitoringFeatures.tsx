import React from 'react';
import { 
  ChartBarIcon, 
  CommandLineIcon, 
  BoltIcon, 
  BellIcon 
} from '@heroicons/react/24/outline';
import { ContentSectionItem } from '../../../types/documentation';

interface MonitoringFeaturesProps {
  section: ContentSectionItem;
}

const iconMap = {
  'chart-bar': ChartBarIcon,
  'terminal': CommandLineIcon,
  'lightning-bolt': BoltIcon,
  'bell': BellIcon,
};

const colorMap = {
  green: 'bg-green-50 border-green-200',
  blue: 'bg-blue-50 border-blue-200',
  purple: 'bg-purple-50 border-purple-200',
  red: 'bg-red-50 border-red-200',
};

const iconColorMap = {
  green: 'text-green-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  red: 'text-red-600',
};

const textColorMap = {
  green: 'text-green-900',
  blue: 'text-blue-900',
  purple: 'text-purple-900',
  red: 'text-red-900',
};

export const MonitoringFeatures: React.FC<MonitoringFeaturesProps> = ({ section }) => {
  if (!section.monitoringFeatures) return null;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {section.monitoringFeatures.map((feature, index) => {
        const IconComponent = iconMap[feature.icon as keyof typeof iconMap];
        const colorClass = colorMap[feature.color as keyof typeof colorMap];
        const iconColorClass = iconColorMap[feature.color as keyof typeof iconColorMap];
        const textColorClass = textColorMap[feature.color as keyof typeof textColorMap];
        
        return (
          <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
            <div className="flex items-center mb-4">
              {IconComponent && (
                <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
              )}
              <div>
                <h3 className={`text-lg font-semibold ${textColorClass}`}>
                  {feature.name}
                </h3>
                <p className={`text-sm ${textColorClass} opacity-80 mt-1`}>
                  {feature.description}
                </p>
              </div>
            </div>
            
            <ul className="space-y-2">
              {feature.metrics.map((metric, idx) => (
                <li key={idx} className={`text-sm ${textColorClass} opacity-90`}>
                  • {metric}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}; 