import React from 'react';
import { ContentSectionItem } from '../../../types/documentation';

interface SecurityConfigurationProps {
  section: ContentSectionItem;
}

export const SecurityConfiguration: React.FC<SecurityConfigurationProps> = ({ section }) => {
  if (!section.securityConfigurations) return null;

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          ⚙️ Security Configuration
        </h3>
        <p className="text-sm text-gray-600">
          Configure security settings to meet your organization's requirements
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {section.securityConfigurations.map((config, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h4 className="text-base font-semibold text-gray-900">
                {config.category}
              </h4>
            </div>
            
            <div className="p-6 space-y-6">
              {config.settings.map((setting, settingIndex) => (
                <div key={settingIndex} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-gray-900 mb-1">
                        {setting.name}
                      </h5>
                      <p className="text-xs text-gray-600">
                        {setting.description}
                      </p>
                    </div>
                    <span className="ml-4 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      {setting.recommended}
                    </span>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {setting.options.map((option, optionIndex) => {
                        const isRecommended = option === setting.recommended;
                        return (
                          <span
                            key={optionIndex}
                            className={`px-3 py-1 text-xs font-medium rounded-full border ${
                              isRecommended
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            {option}
                            {isRecommended && (
                              <span className="ml-1 text-green-500">✓</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-base font-semibold text-blue-900 mb-4">
          🔧 Configuration Best Practices
        </h4>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h5 className="text-sm font-medium text-blue-800 mb-2">Development Environment</h5>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Use sandbox API keys with limited permissions</li>
              <li>• Enable verbose logging for debugging</li>
              <li>• Test security configurations thoroughly</li>
              <li>• Implement automated security testing</li>
            </ul>
          </div>
          <div>
            <h5 className="text-sm font-medium text-blue-800 mb-2">Production Environment</h5>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Use production keys with minimal required permissions</li>
              <li>• Enable all security features and monitoring</li>
              <li>• Implement regular security audits</li>
              <li>• Maintain security incident response procedures</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}; 