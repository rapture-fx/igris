import React from 'react';
import { CheckCircle } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface BestPracticeSection {
  title: string;
  items: string[];
}

interface BestPracticesCalloutProps {
  section: ContentSectionItem;
}

export function BestPracticesCallout({ section }: BestPracticesCalloutProps) {
  const { title, style, sections } = section;

  const getStyleClasses = (style: string) => {
    switch (style) {
      case 'gradient-green':
        return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200';
      default:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200';
    }
  };

  return (
    <div className={`${getStyleClasses(style || '')} border rounded-lg p-6`}>
      <div className="flex items-start space-x-4">
        <CheckCircle className="w-6 h-6 text-green-600 mt-1" />
        <div>
          <h3 className="text-lg font-bold text-green-900 mb-3">{title}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {sections?.map((section: BestPracticeSection, index: number) => (
              <div key={index}>
                <h4 className="font-semibold text-green-800 mb-2 text-sm">{section.title}</h4>
                <ul className="text-green-700 space-y-1 text-xs">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 