import React from 'react';
import { 
  Zap, 
  CheckCircle, 
  TrendingUp, 
  AlertTriangle,
  Activity,
  BarChart3
} from 'lucide-react';

interface MetricCategory {
  category: string;
  color: string;
  icon: string;
  metrics: string[];
}

interface ObservabilityMetricsProps {
  observabilityMetrics: MetricCategory[];
}

const iconMap = {
  'Zap': Zap,
  'CheckCircle': CheckCircle,
  'TrendingUp': TrendingUp,
  'AlertTriangle': AlertTriangle,
  'Activity': Activity,
  'BarChart3': BarChart3,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  red: 'bg-red-50 border-red-200',
  orange: 'bg-orange-50 border-orange-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  red: 'text-red-600',
  orange: 'text-orange-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  purple: 'text-purple-900',
  red: 'text-red-900',
  orange: 'text-orange-900',
};

const badgeColorMap = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  purple: 'bg-purple-100 text-purple-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
};

export const ObservabilityMetrics: React.FC<ObservabilityMetricsProps> = ({ observabilityMetrics }) => {
  if (!observabilityMetrics || observabilityMetrics.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📈 Key Observability Metrics
        </h3>
        <p className="text-sm text-gray-600">
          Essential metrics for monitoring data pipeline health and performance
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {observabilityMetrics.map((metricCategory, index) => {
          const IconComponent = iconMap[metricCategory.icon as keyof typeof iconMap];
          const colorClass = colorMap[metricCategory.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[metricCategory.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[metricCategory.color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[metricCategory.color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  )}
                  <h4 className={`text-base font-semibold ${textColorClass}`}>
                    {metricCategory.category}
                  </h4>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                  Metrics
                </span>
              </div>
              
              <div className="space-y-3">
                {metricCategory.metrics.map((metric, metricIndex) => (
                  <div key={metricIndex} className="bg-white bg-opacity-60 rounded-lg p-3">
                    <div className="flex items-start">
                      <div className={`w-2 h-2 rounded-full ${iconColorClass.replace('text-', 'bg-')} mt-2 mr-3 flex-shrink-0`}></div>
                      <div className="flex-1">
                        <span className={`text-sm ${textColorClass} opacity-90`}>
                          {metric}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textColorClass} opacity-70`}>
                    {metricCategory.metrics.length} tracked metrics
                  </span>
                  <div className="flex items-center">
                    <BarChart3 className={`w-3 h-3 mr-1 ${iconColorClass}`} />
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
      
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-6 mt-6">
        <div className="flex items-start">
          <Activity className="w-6 h-6 text-indigo-600 mr-3 mt-1" />
          <div>
            <h5 className="text-base font-semibold text-gray-900 mb-2">
              Metrics Collection Strategy
            </h5>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-700">
              <div>
                <h6 className="font-medium mb-2 text-indigo-900">Collection:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Real-time metric collection</li>
                  <li>• Configurable sampling rates</li>
                  <li>• Automatic aggregation</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-indigo-900">Storage:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Time-series database storage</li>
                  <li>• Configurable retention policies</li>
                  <li>• Compression and optimization</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-indigo-900">Analysis:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Trend analysis and forecasting</li>
                  <li>• Anomaly detection algorithms</li>
                  <li>• Custom business intelligence</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ObservabilityMetrics; 