import React from 'react';
import { 
  RotateCcw, 
  Shield, 
  Clock, 
  TrendingDown 
} from 'lucide-react';

interface RecoveryStrategy {
  strategy: string;
  description: string;
  useCase: string;
  implementation: string[];
  benefits: string[];
}

interface RecoveryStrategiesProps {
  recoveryStrategies: RecoveryStrategy[];
}

const getStrategyIcon = (strategy: string) => {
  if (strategy.toLowerCase().includes('backoff')) return RotateCcw;
  if (strategy.toLowerCase().includes('circuit')) return Shield;
  if (strategy.toLowerCase().includes('timeout')) return Clock;
  if (strategy.toLowerCase().includes('degradation')) return TrendingDown;
  return RotateCcw;
};

const getStrategyColor = (index: number) => {
  const colors = ['blue', 'green', 'purple', 'orange'];
  return colors[index % colors.length];
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

export const RecoveryStrategies: React.FC<RecoveryStrategiesProps> = ({ recoveryStrategies }) => {
  if (!recoveryStrategies || recoveryStrategies.length === 0) return null;

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🔄 Recovery Strategies
        </h3>
        <p className="text-sm text-gray-600">
          Proven patterns for handling errors and maintaining system stability
        </p>
      </div>

      <div className="grid gap-6">
        {recoveryStrategies.map((strategy, index) => {
          const IconComponent = getStrategyIcon(strategy.strategy);
          const color = getStrategyColor(index);
          const colorClass = colorMap[color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start">
                  <IconComponent className={`w-6 h-6 mr-3 mt-1 ${iconColorClass}`} />
                  <div>
                    <h4 className={`text-lg font-semibold ${textColorClass} mb-2`}>
                      {strategy.strategy}
                    </h4>
                    <p className={`text-sm ${textColorClass} opacity-80 mb-3`}>
                      {strategy.description}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                  Strategy
                </span>
              </div>
              
              <div className="mb-4">
                <span className={`text-sm font-medium ${textColorClass}`}>
                  Use Case: 
                </span>
                <span className={`text-sm ${textColorClass} opacity-90 ml-1`}>
                  {strategy.useCase}
                </span>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h5 className={`text-sm font-medium ${textColorClass} mb-3`}>
                    Implementation Steps:
                  </h5>
                  <ul className="space-y-2">
                    {strategy.implementation.map((step, idx) => (
                      <li key={idx} className={`text-xs ${textColorClass} opacity-90 flex items-start`}>
                        <span className={`inline-block w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center mr-2 mt-0.5 ${iconColorClass.replace('text-', 'bg-')}`}>
                          {idx + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h5 className={`text-sm font-medium ${textColorClass} mb-3`}>
                    Key Benefits:
                  </h5>
                  <ul className="space-y-2">
                    {strategy.benefits.map((benefit, idx) => (
                      <li key={idx} className={`text-xs ${textColorClass} opacity-90`}>
                        ✓ {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecoveryStrategies; 