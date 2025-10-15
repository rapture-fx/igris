import React from 'react';
import { ContentSectionItem } from '../../../types/documentation';

interface LoggingConfigurationProps {
  section: ContentSectionItem;
}

const levelColorMap = {
  gray: 'bg-gray-100 text-gray-800 border-gray-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  red: 'bg-red-100 text-red-800 border-red-300',
};

export const LoggingConfiguration: React.FC<LoggingConfigurationProps> = ({ section }) => {
  if (!section.logLevels || !section.logFormats) return null;

  return (
    <div className="space-y-8">
      {/* Log Levels */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Levels</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {section.logLevels.map((level, index) => {
            const colorClass = levelColorMap[level.color as keyof typeof levelColorMap];
            
            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
                    {level.level}
                  </span>
                  <span className="text-xs text-gray-500">
                    {level.useCase}
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  {level.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log Formats */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Formats</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {section.logFormats.map((format, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-base font-semibold text-gray-900 mb-2">
                {format.name}
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                {format.description}
              </p>
              
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Benefits:</h5>
                <ul className="space-y-1">
                  {format.benefits.map((benefit, idx) => (
                    <li key={idx} className="text-sm text-gray-600">
                      • {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Examples */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          📝 Configuration Best Practices
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-blue-800 mb-2">Development Environment</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Use DEBUG level for detailed troubleshooting</li>
              <li>• Enable human-readable format for console output</li>
              <li>• Include stack traces for all errors</li>
              <li>• Log request/response bodies for debugging</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-800 mb-2">Production Environment</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Use INFO level to reduce log volume</li>
              <li>• Enable JSON format for log aggregation</li>
              <li>• Implement log rotation and retention</li>
              <li>• Monitor log volume and performance impact</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}; 