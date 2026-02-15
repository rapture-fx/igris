import React from 'react';
import { Settings } from 'lucide-react';
import { ContentSectionItem } from '../../../types/documentation';

interface WebhookConfigurationProps {
  section: ContentSectionItem;
}

export function WebhookConfiguration({ section }: WebhookConfigurationProps) {
  const { title, description } = section;

  const codeString = `{
  "event": "data.investigation.completed",
  "data": {
    "investigation_id": "inv_12345",
    "status": "completed",
    "quality_score": 95.7
  }
}`;

  const curlString = `curl -X POST "https://api.igris-inertial.com/v1/webhooks" \\
-H "Authorization: Bearer YOUR_API_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "url": "https://your-app.com/webhooks/igris-inertial",
  "events": ["data.investigation.completed", "data.investigation.failed"]
}'`;

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <div className="flex items-center space-x-3 mb-3">
          <Settings className="w-5 h-5 text-gray-600" />
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        </div>
        <div className="text-sm">
          <p className="text-gray-600 mb-3">{description}</p>
          <pre className="bg-white p-3 rounded border overflow-x-auto text-xs">
{curlString}
          </pre>
        </div>
      </div>
    </div>
  );
}
