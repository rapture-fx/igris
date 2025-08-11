import React from 'react';
import { ContentSectionItem } from '../../../types/documentation';

interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  parameters?: APIParameter[];
}

interface ApiEndpointsProps {
  section: ContentSectionItem;
}

export function ApiEndpoints({ section }: ApiEndpointsProps) {
  const { endpoints } = section;

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'POST':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DELETE':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{section.title}</h2>
      <div className="space-y-4">
        {endpoints?.map((endpoint: APIEndpoint, index: number) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <span className={`px-2 py-1 text-xs font-medium rounded border ${getMethodColor(endpoint.method)}`}>
                {endpoint.method}
              </span>
              <code className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                {endpoint.path}
              </code>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">{endpoint.description}</p>
            
            {endpoint.parameters && endpoint.parameters.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Parameters</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-gray-700 font-medium">Name</th>
                        <th className="text-left py-2 text-gray-700 font-medium">Type</th>
                        <th className="text-left py-2 text-gray-700 font-medium">Required</th>
                        <th className="text-left py-2 text-gray-700 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.parameters.map((param, paramIndex) => (
                        <tr key={paramIndex} className="border-b border-gray-100">
                          <td className="py-2 font-mono text-xs text-gray-800">{param.name}</td>
                          <td className="py-2 text-xs text-gray-600">{param.type}</td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              param.required 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {param.required ? 'Required' : 'Optional'}
                            </span>
                          </td>
                          <td className="py-2 text-xs text-gray-600">{param.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
