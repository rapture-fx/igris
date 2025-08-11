import React from 'react';
import { 
  Zap, 
  BarChart3, 
  DollarSign, 
  Clock,
  TrendingUp,
  CheckCircle
} from 'lucide-react';

interface CostStrategy {
  name: string;
  description: string;
  color: string;
  icon: string;
  costMultiplier: string;
  timeReduction: string;
  features: string[];
  useCase: string;
}

interface CostStrategiesProps {
  costStrategies: CostStrategy[];
}

const iconMap = {
  'Zap': Zap,
  'BarChart3': BarChart3,
  'DollarSign': DollarSign,
  'Clock': Clock,
  'TrendingUp': TrendingUp,
  'CheckCircle': CheckCircle,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  orange: 'bg-orange-50 border-orange-200',
  purple: 'bg-purple-50 border-purple-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  orange: 'text-orange-600',
  purple: 'text-purple-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  orange: 'text-orange-900',
  purple: 'text-purple-900',
};

const badgeColorMap = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
  purple: 'bg-purple-100 text-purple-800',
};

const getMultiplierColor = (multiplier: string) => {
  if (multiplier.includes('1.5')) return 'text-blue-600';
  if (multiplier.includes('1.0')) return 'text-green-600';
  if (multiplier.includes('0.6')) return 'text-orange-600';
  return 'text-gray-600';
};

const getTimeColor = (timeReduction: string) => {
  if (timeReduction.includes('70%')) return 'text-blue-600';
  if (timeReduction.includes('0%')) return 'text-green-600';
  if (timeReduction.includes('-80%')) return 'text-orange-600';
  return 'text-gray-600';
};

export const CostStrategies: React.FC<CostStrategiesProps> = ({ costStrategies }) => {
  if (!costStrategies || costStrategies.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          💰 Processing Strategies
        </h3>
        <p className="text-sm text-gray-600">
          Choose the optimal processing strategy based on your requirements and budget
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {costStrategies.map((strategy, index) => {
          const IconComponent = iconMap[strategy.icon as keyof typeof iconMap];
          const colorClass = colorMap[strategy.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[strategy.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[strategy.color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[strategy.color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass} transition-all duration-200 hover:shadow-lg`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  )}
                  <h4 className={`text-base font-semibold ${textColorClass}`}>
                    {strategy.name}
                  </h4>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                  Strategy
                </span>
              </div>
              
              {/* Description */}
              <p className={`text-sm ${textColorClass} opacity-80 mb-4`}>
                {strategy.description}
              </p>
              
              {/* Cost & Time Metrics */}
              <div className="bg-white bg-opacity-70 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className={`text-lg font-bold ${getMultiplierColor(strategy.costMultiplier)}`}>
                      {strategy.costMultiplier}
                    </div>
                    <div className="text-xs text-gray-600">Cost Multiplier</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-bold ${getTimeColor(strategy.timeReduction)}`}>
                      {strategy.timeReduction}
                    </div>
                    <div className="text-xs text-gray-600">Time Change</div>
                  </div>
                </div>
              </div>
              
              {/* Features */}
              <div className="space-y-3 mb-4">
                <h5 className={`text-sm font-medium ${textColorClass} mb-2`}>
                  Key Features:
                </h5>
                <ul className="space-y-2">
                  {strategy.features.map((feature, idx) => (
                    <li key={idx} className="bg-white bg-opacity-60 rounded-lg p-2">
                      <div className="flex items-start">
                        <CheckCircle className={`w-3 h-3 ${iconColorClass} mt-0.5 mr-2 flex-shrink-0`} />
                        <span className={`text-xs ${textColorClass} opacity-90`}>
                          {feature}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Use Case */}
              <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-gray-200 border-opacity-50">
                <h6 className={`text-xs font-medium ${textColorClass} mb-1`}>
                  Best For:
                </h6>
                <p className={`text-xs ${textColorClass} opacity-80`}>
                  {strategy.useCase}
                </p>
              </div>
              
              {/* Footer Stats */}
              <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textColorClass} opacity-70`}>
                    {strategy.features.length} features
                  </span>
                  <div className="flex items-center">
                    <TrendingUp className={`w-3 h-3 mr-1 ${iconColorClass}`} />
                    <span className={`text-xs ${textColorClass} opacity-70`}>
                      Optimized
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Strategy Comparison Summary */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6 mt-6">
        <div className="flex items-start">
          <BarChart3 className="w-6 h-6 text-blue-600 mr-3 mt-1" />
          <div>
            <h5 className="text-base font-semibold text-gray-900 mb-2">
              Strategy Selection Guide
            </h5>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-700">
              <div>
                <h6 className="font-medium mb-2 text-blue-900">Fast Processing:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Time-critical deadlines</li>
                  <li>• Real-time analytics needs</li>
                  <li>• Urgent business decisions</li>
                  <li>• High-priority workloads</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-green-900">Standard Processing:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Regular business operations</li>
                  <li>• Balanced cost-performance needs</li>
                  <li>• Scheduled data processing</li>
                  <li>• General-purpose workloads</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-orange-900">Economical Processing:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Large batch processing</li>
                  <li>• Budget-conscious projects</li>
                  <li>• Non-urgent analysis</li>
                  <li>• Cost optimization focus</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostStrategies; 