import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface UploadLimitsCalloutProps {
  section: ContentSectionItem;
}

export function UploadLimitsCallout({ section }: UploadLimitsCalloutProps) {
  const { limits } = section;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div>
          <h3 className="font-semibold text-yellow-800 mb-2">{section.title}</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-yellow-700">
            <div>
              <h4 className="font-medium mb-1">File Limits</h4>
              <ul className="space-y-1 text-xs">
                {limits?.file_limits?.map((limit: string, index: number) => (
                  <li key={index}>• {limit}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-1">Performance Tips</h4>
              <ul className="space-y-1 text-xs">
                {limits?.performance_tips?.map((tip: string, index: number) => (
                  <li key={index}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
