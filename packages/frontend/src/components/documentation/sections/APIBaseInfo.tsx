import React from 'react';
import { Globe } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface APIBaseInfoProps {
  section: ContentSectionItem;
}

export function APIBaseInfo({ section }: APIBaseInfoProps) {
  const { title } = section;
  const baseUrl = (section as any).baseUrl || 'https://api.schlep-engine.com';

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <div className="flex items-center space-x-3 mb-3">
          <Globe className="w-5 h-5 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Base URL</h4>
            <code className="text-sm bg-white px-3 py-2 rounded border block">
              {baseUrl}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
