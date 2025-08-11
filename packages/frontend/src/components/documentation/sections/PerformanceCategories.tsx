'use client'

import React from 'react'
import { TrendingUp, Zap, Settings } from 'lucide-react'
import { SectionComponentProps } from '../../../types/documentation'

const iconMap = {
  'TrendingUp': TrendingUp,
  'Zap': Zap,
  'Settings': Settings,
};

const colorMap = {
  blue: 'bg-white border-gray-200',
  green: 'bg-white border-gray-200',
  purple: 'bg-white border-gray-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
};

const textColorMap = {
  blue: 'text-gray-900',
  green: 'text-gray-900',
  purple: 'text-gray-900',
};

const subtextColorMap = {
  blue: 'text-gray-600',
  green: 'text-gray-600',
  purple: 'text-gray-600',
};

export const PerformanceCategories: React.FC<SectionComponentProps> = ({ section }) => {
  if (!section.performanceCategories) {
    return null;
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {section.performanceCategories.map((category, index) => {
        const IconComponent = iconMap[category.icon as keyof typeof iconMap];
        const bgColor = colorMap[category.color as keyof typeof colorMap];
        const iconColor = iconColorMap[category.color as keyof typeof iconColorMap];
        const textColor = textColorMap[category.color as keyof typeof textColorMap];
        const subtextColor = subtextColorMap[category.color as keyof typeof subtextColorMap];

        return (
          <div key={index} className={`rounded-lg p-4 ${bgColor}`}>
            {IconComponent && <IconComponent className={`w-5 h-5 mb-2 ${iconColor}`} />}
            <h4 className={`text-sm font-semibold mb-2 ${textColor}`}>
              {category.name}
            </h4>
            <ul className={`text-xs space-y-1 ${subtextColor}`}>
              {category.techniques.map((technique, techniqueIndex) => (
                <li key={techniqueIndex}>• {technique}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}; 