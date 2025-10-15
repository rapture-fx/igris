import React from 'react';
import { Terminal, Package, Globe } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface InstallationMethod {
  name: string;
  command: string;
}

interface InstallationGuideProps {
  section: ContentSectionItem;
}

export function InstallationGuide({ section }: InstallationGuideProps) {
  const { title, methods } = section;

  const getIcon = (methodName: string) => {
    const iconProps = { className: "w-5 h-5" };
    switch (methodName.toLowerCase()) {
      case 'npm':
      case 'yarn':
        return <Package {...iconProps} />;
      case 'cdn':
        return <Globe {...iconProps} />;
      default:
        return <Terminal {...iconProps} />;
    }
  };

  const getLanguage = (methodName: string) => {
    switch (methodName.toLowerCase()) {
      case 'cdn':
        return 'html';
      default:
        return 'bash';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
        <div className="space-y-4">
          {methods?.map((method: InstallationMethod, index: number) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-blue-600">
                  {getIcon(method.name)}
                </span>
                <h3 className="font-semibold text-gray-900">Using {method.name}</h3>
              </div>
              <div className="bg-gray-900 rounded-md p-3">
                <code className="text-sm text-green-400 font-mono">
                  {method.command}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 