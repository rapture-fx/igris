import React from 'react';
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  DollarSign,
  AlertTriangle,
  Activity
} from 'lucide-react';

interface CostMonitoringCategory {
  category: string;
  color: string;
  icon: string;
  features: string[];
}

interface CostMonitoringProps {
  costMonitoring: CostMonitoringCategory[];
}

const iconMap = {
  'BarChart3': BarChart3,
  'Target': Target,
  'TrendingUp': TrendingUp,
  'DollarSign': DollarSign,
  'AlertTriangle': AlertTriangle,
  'Activity': Activity,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  purple: 'text-purple-900',
  orange: 'text-orange-900',
};

const badgeColorMap = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
};

export const CostMonitoring: React.FC<CostMonitoringProps> = ({ costMonitoring }) => {
  if (!costMonitoring || costMonitoring.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📊 Cost Monitoring & Analytics
        </h3>
        <p className="text-sm text-gray-600">
          Monitor and analyze your processing costs to identify optimization opportunities
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {costMonitoring.map((category, index) => {
          const IconComponent = iconMap[category.icon as keyof typeof iconMap];
          const colorClass = colorMap[category.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[category.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[category.color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[category.color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass} transition-all duration-200 hover:shadow-lg`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  )}
                  <h4 className={`text-base font-semibold ${textColorClass}`}>
                    {category.category}
                  </h4>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                  Monitor
                </span>
              </div>
              
              {/* Features */}
              <div className="space-y-3">
                {category.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="bg-white bg-opacity-60 rounded-lg p-3">
                    <div className="flex items-start">
                      <div className={`w-2 h-2 rounded-full ${iconColorClass.replace('text-', 'bg-')} mt-2 mr-3 flex-shrink-0`}></div>
                      <span className={`text-sm ${textColorClass} opacity-90`}>
                        {feature}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textColorClass} opacity-70`}>
                    {category.features.length} capabilities
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
      
      {/* Cost Monitoring Dashboard Preview */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-6 mt-6">
        <div className="flex items-start">
          <BarChart3 className="w-6 h-6 text-indigo-600 mr-3 mt-1" />
          <div>
            <h5 className="text-base font-semibold text-gray-900 mb-2">
              Cost Monitoring Dashboard
            </h5>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-700">
              <div>
                <h6 className="font-medium mb-2 text-indigo-900">Key Metrics:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Real-time spend tracking</li>
                  <li>• Cost per GB processed</li>
                  <li>• Monthly budget utilization</li>
                  <li>• Processing efficiency scores</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-indigo-900">Alert Triggers:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Budget threshold exceeded (75%, 90%, 100%)</li>
                  <li>• Unusual spending spikes detected</li>
                  <li>• Cost efficiency degradation</li>
                  <li>• Projected budget overrun</li>
                </ul>
              </div>
            </div>
            
            {/* Sample Dashboard */}
            <div className="mt-4 bg-white rounded-lg p-4 border border-indigo-200">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="border-r border-gray-200 pr-4">
                  <div className="text-lg font-bold text-blue-600">$247.83</div>
                  <div className="text-xs text-gray-600">This Month</div>
                </div>
                <div className="border-r border-gray-200 pr-4">
                  <div className="text-lg font-bold text-green-600">$0.045</div>
                  <div className="text-xs text-gray-600">Cost per GB</div>
                </div>
                <div className="border-r border-gray-200 pr-4">
                  <div className="text-lg font-bold text-orange-600">73%</div>
                  <div className="text-xs text-gray-600">Budget Used</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-600">92.4%</div>
                  <div className="text-xs text-gray-600">Efficiency</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostMonitoring; 