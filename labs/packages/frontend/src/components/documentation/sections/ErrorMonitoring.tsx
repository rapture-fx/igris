import React from 'react';
import { 
  Target, 
  TrendingUp, 
  Search, 
  Activity,
  AlertCircle,
  BarChart3
} from 'lucide-react';

interface ErrorMonitoringFeature {
  category: string;
  color: string;
  icon: string;
  features: string[];
}

interface ErrorMonitoringProps {
  errorMonitoring: ErrorMonitoringFeature[];
}

const iconMap = {
  'Target': Target,
  'TrendingUp': TrendingUp,
  'Search': Search,
  'Activity': Activity,
  'AlertCircle': AlertCircle,
  'BarChart3': BarChart3,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
  red: 'bg-red-50 border-red-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  purple: 'text-purple-900',
  orange: 'text-orange-900',
  red: 'text-red-900',
};

const badgeColorMap = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-800',
};

export const ErrorMonitoring: React.FC<ErrorMonitoringProps> = ({ errorMonitoring }) => {
  if (!errorMonitoring || errorMonitoring.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📊 Error Monitoring & Analysis
        </h3>
        <p className="text-sm text-gray-600">
          Comprehensive error tracking and performance impact analysis
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {errorMonitoring.map((monitoring, index) => {
          const IconComponent = iconMap[monitoring.icon as keyof typeof iconMap];
          const colorClass = colorMap[monitoring.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[monitoring.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[monitoring.color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[monitoring.color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  )}
                  <h4 className={`text-base font-semibold ${textColorClass}`}>
                    {monitoring.category}
                  </h4>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                  Monitor
                </span>
              </div>
              
              <div className="space-y-3">
                {monitoring.features.map((feature, idx) => (
                  <div key={idx} className="bg-white bg-opacity-60 rounded-lg p-3">
                    <div className="flex items-start">
                      <div className={`w-2 h-2 rounded-full ${iconColorClass.replace('text-', 'bg-')} mt-2 mr-3 flex-shrink-0`}></div>
                      <span className={`text-sm ${textColorClass} opacity-90`}>
                        {feature}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textColorClass} opacity-70`}>
                    {monitoring.features.length} features
                  </span>
                  <div className="flex items-center">
                    <Activity className={`w-3 h-3 mr-1 ${iconColorClass}`} />
                    <span className={`text-xs ${textColorClass} opacity-70`}>
                      Real-time
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6 mt-6">
        <div className="flex items-start">
          <AlertCircle className="w-6 h-6 text-blue-600 mr-3 mt-1" />
          <div>
            <h5 className="text-base font-semibold text-gray-900 mb-2">
              Monitoring Best Practices
            </h5>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <h6 className="font-medium mb-2">Alert Configuration:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Set appropriate thresholds to avoid alert fatigue</li>
                  <li>• Use escalation policies for critical errors</li>
                  <li>• Group related errors to reduce noise</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2">Analysis & Response:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Correlate errors with system metrics</li>
                  <li>• Track error resolution time</li>
                  <li>• Maintain error runbooks for common issues</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorMonitoring; 