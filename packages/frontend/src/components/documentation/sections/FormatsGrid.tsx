import React from 'react';
import { Database, Code, Settings } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface FormatCategory {
  category: string;
  icon: string;
  color: string;
  items: string[];
}

interface FormatsGridProps {
  section: ContentSectionItem;
}

export function FormatsGrid({ section }: FormatsGridProps) {
  const { formats } = section;

  const getIcon = (iconName: string) => {
    const iconProps = { className: "w-5 h-5 mb-2" };
    switch (iconName) {
      case 'database':
        return <Database {...iconProps} />;
      case 'code':
        return <Code {...iconProps} />;
      case 'settings':
        return <Settings {...iconProps} />;
      default:
        return <Database {...iconProps} />;
    }
  };

  const getIconColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'text-blue-600';
      case 'green':
        return 'text-green-600';
      case 'purple':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        {formats?.map((format: FormatCategory, index: number) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className={getIconColor(format.color)}>
              {getIcon(format.icon)}
            </div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{format.category}</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              {format.items.map((item, itemIndex) => (
                <li key={itemIndex}>• {item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
} 