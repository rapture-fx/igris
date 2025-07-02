'use client'

import React from 'react'
import { AlertCircle, Clock, Key, CheckCircle } from 'lucide-react'
import { SectionComponentProps } from '../../../types/documentation'

interface TroubleshootingCategoriesProps extends SectionComponentProps {
  section: {
    troubleshootingCategories: Array<{
      name: string;
      color: string;
      icon: string;
      issues: Array<{
        problem: string;
        solution: string;
      }>;
    }>;
  };
}

const iconMap = {
  'AlertCircle': AlertCircle,
  'Clock': Clock,
  'Key': Key,
  'CheckCircle': CheckCircle,
};

const colorMap = {
  red: 'bg-red-50 border-red-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  blue: 'bg-blue-50 border-blue-200',
  purple: 'bg-purple-50 border-purple-200',
};

const iconColorMap = {
  red: 'text-red-500',
  yellow: 'text-yellow-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
};

const textColorMap = {
  red: 'text-red-900',
  yellow: 'text-yellow-900',
  blue: 'text-blue-900',
  purple: 'text-purple-900',
};

const subtextColorMap = {
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
};

export const TroubleshootingCategories: React.FC<TroubleshootingCategoriesProps> = ({ section }) => {
  return (
    <div className="grid gap-4">
      {section.troubleshootingCategories.map((category, index) => {
        const IconComponent = iconMap[category.icon as keyof typeof iconMap];
        const bgColor = colorMap[category.color as keyof typeof colorMap];
        const iconColor = iconColorMap[category.color as keyof typeof iconColorMap];
        const textColor = textColorMap[category.color as keyof typeof textColorMap];
        const subtextColor = subtextColorMap[category.color as keyof typeof subtextColorMap];

        return (
          <div key={index} className={`bg-white border border-gray-200 rounded-lg p-4 ${bgColor}`}>
            <h4 className={`text-sm font-semibold mb-2 flex items-center ${textColor}`}>
              {IconComponent && <IconComponent className={`w-4 h-4 mr-2 ${iconColor}`} />}
              {category.name}
            </h4>
            <div className="text-xs space-y-1">
              {category.issues.map((issue, issueIndex) => (
                <div key={issueIndex} className={subtextColor}>
                  <div><strong>{issue.problem}:</strong> {issue.solution}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}; 