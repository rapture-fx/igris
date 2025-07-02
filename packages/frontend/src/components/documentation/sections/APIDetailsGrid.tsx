import React from 'react';
import { Key, Clock, Shield, Info } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface APIDetail {
  name: string;
  description: string;
  example?: string;
  limits?: Array<{
    plan: string;
    limit: string;
  }>;
  icon: string;
}

interface APIDetailsGridProps {
  section: ContentSectionItem;
}

export function APIDetailsGrid({ section }: APIDetailsGridProps) {
  const { details } = section;

  const getIcon = (iconName: string) => {
    const iconProps = { className: "w-5 h-5 text-gray-600" };
    switch (iconName) {
      case 'key':
        return <Key {...iconProps} />;
      case 'clock':
        return <Clock {...iconProps} />;
      case 'shield':
        return <Shield {...iconProps} />;
      default:
        return <Info {...iconProps} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {details?.map((detail: APIDetail, index: number) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center space-x-3 mb-3">
              {getIcon(detail.icon)}
              <h4 className="text-sm font-semibold text-gray-900">{detail.name}</h4>
            </div>
            <div className="text-sm space-y-2">
              <p className="text-gray-600">{detail.description}</p>
              
              {detail.example && (
                <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                  {detail.example}
                </pre>
              )}
              
              {detail.limits && (
                <div className="space-y-1">
                  {detail.limits.map((limit, limitIndex) => (
                    <div key={limitIndex} className="flex justify-between">
                      <span>{limit.plan}:</span>
                      <span className="font-medium">{limit.limit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
