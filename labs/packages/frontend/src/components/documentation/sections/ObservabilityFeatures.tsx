import React from 'react';
import { 
  BarChart3, 
  Bell, 
  Monitor, 
  Activity,
  Zap,
  Settings
} from 'lucide-react';

interface ObservabilityFeature {
  name: string;
  description: string;
  color: string;
  icon: string;
  capabilities: string[];
}

interface ObservabilityFeaturesProps {
  observabilityFeatures: ObservabilityFeature[];
}

const iconMap = {
  'BarChart3': BarChart3,
  'Bell': Bell,
  'Monitor': Monitor,
  'Activity': Activity,
  'Zap': Zap,
  'Settings': Settings,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  orange: 'bg-orange-50 border-orange-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  red: 'bg-red-50 border-red-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  orange: 'text-orange-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  red: 'text-red-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  orange: 'text-orange-900',
  green: 'text-green-900',
  purple: 'text-purple-900',
  red: 'text-red-900',
};

const badgeColorMap = {
  blue: 'bg-blue-100 text-blue-800',
  orange: 'bg-orange-100 text-orange-800',
  green: 'bg-green-100 text-green-800',
  purple: 'bg-purple-100 text-purple-800',
  red: 'bg-red-100 text-red-800',
};

export const ObservabilityFeatures: React.FC<ObservabilityFeaturesProps> = ({ observabilityFeatures }) => {
  if (!observabilityFeatures || observabilityFeatures.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📊 Observability Features
        </h3>
        <p className="text-sm text-gray-600">
          Comprehensive monitoring and alerting capabilities for production data pipelines
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {observabilityFeatures.map((feature, index) => {
          const IconComponent = iconMap[feature.icon as keyof typeof iconMap];
          const colorClass = colorMap[feature.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[feature.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[feature.color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[feature.color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  )}
                  <h4 className={`text-base font-semibold ${textColorClass}`}>
                    {feature.name}
                  </h4>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                  Feature
                </span>
              </div>
              
              <p className={`text-sm ${textColorClass} opacity-80 mb-4`}>
                {feature.description}
              </p>
              
              <div className="space-y-3">
                <h5 className={`text-sm font-medium ${textColorClass} mb-2`}>
                  Key Capabilities:
                </h5>
                <ul className="space-y-2">
                  {feature.capabilities.map((capability, idx) => (
                    <li key={idx} className="bg-white bg-opacity-60 rounded-lg p-3">
                      <div className="flex items-start">
                        <div className={`w-2 h-2 rounded-full ${iconColorClass.replace('text-', 'bg-')} mt-2 mr-3 flex-shrink-0`}></div>
                        <span className={`text-sm ${textColorClass} opacity-90`}>
                          {capability}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textColorClass} opacity-70`}>
                    {feature.capabilities.length} capabilities
                  </span>
                  <div className="flex items-center">
                    <Activity className={`w-3 h-3 mr-1 ${iconColorClass}`} />
                    <span className={`text-xs ${textColorClass} opacity-70`}>
                      Production ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ObservabilityFeatures; 