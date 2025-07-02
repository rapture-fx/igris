import React from 'react';
import { Upload, Activity, Zap, Shield, Code, FileText, Database, Wand, BarChart } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface SDKFeature {
  name: string;
  description: string;
  icon: string;
}

interface SDKFeaturesProps {
  section: ContentSectionItem;
}

export function SDKFeatures({ section }: SDKFeaturesProps) {
  const { title, features } = section;

  const getIcon = (iconName: string) => {
    const iconProps = { className: "w-6 h-6" };
    switch (iconName) {
      case 'upload':
        return <Upload {...iconProps} />;
      case 'activity':
        return <Activity {...iconProps} />;
      case 'zap':
        return <Zap {...iconProps} />;
      case 'shield':
        return <Shield {...iconProps} />;
      case 'code':
        return <Code {...iconProps} />;
      case 'file-text':
        return <FileText {...iconProps} />;
      case 'database':
        return <Database {...iconProps} />;
      case 'wand':
        return <Wand {...iconProps} />;
      case 'chart-bar':
        return <BarChart {...iconProps} />;
      default:
        return <Code {...iconProps} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {features?.map((feature: SDKFeature, index: number) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600">
                      {getIcon(feature.icon)}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{feature.name}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 