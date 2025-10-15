import React from 'react';
import { TrendingUp, List, AlertCircle, Package, CheckCircle, ArrowRight } from 'lucide-react';

interface RateLimitHandlingProps {
  handlingStrategies: Array<{
    strategy: string;
    description: string;
    color: string;
    icon: string;
    benefits: string[];
    implementation: string[];
    useCase: string;
  }>;
}

const iconMap = {
  TrendingUp,
  List,
  AlertCircle,
  Package,
};

export default function RateLimitHandling({ handlingStrategies }: RateLimitHandlingProps) {
  const getColorClasses = (color: string) => {
    const colorMap = {
      green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-900',
        badge: 'bg-green-100 text-green-800',
        icon: 'text-green-600',
        accent: 'bg-green-500'
      },
      blue: {
        bg: 'bg-blue-50', 
        border: 'border-blue-200',
        text: 'text-blue-900',
        badge: 'bg-blue-100 text-blue-800',
        icon: 'text-blue-600',
        accent: 'bg-blue-500'
      },
      red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-900',
        badge: 'bg-red-100 text-red-800',
        icon: 'text-red-600',
        accent: 'bg-red-500'
      },
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-900',
        badge: 'bg-purple-100 text-purple-800',
        icon: 'text-purple-600',
        accent: 'bg-purple-500'
      }
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Rate Limit Handling Strategies</h2>
        <p className="text-gray-600">
          Implement these proven patterns to handle rate limits gracefully and maintain reliability
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {handlingStrategies.map((strategy, index) => {
          const colors = getColorClasses(strategy.color);
          const IconComponent = iconMap[strategy.icon as keyof typeof iconMap];

          return (
            <div
              key={index}
              className={`${colors.bg} ${colors.border} border rounded-xl p-6 hover:shadow-lg transition-all duration-300`}
            >
              {/* Strategy Header */}
              <div className="flex items-start space-x-4 mb-6">
                <div className={`${colors.badge} p-3 rounded-lg`}>
                  <IconComponent className={`w-6 h-6 ${colors.icon}`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
                    {strategy.strategy}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {strategy.description}
                  </p>
                </div>
              </div>

              {/* Benefits Section */}
              <div className="mb-6">
                <h4 className={`text-sm font-semibold ${colors.text} mb-3 flex items-center`}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Key Benefits
                </h4>
                <ul className="space-y-2">
                  {strategy.benefits.map((benefit, benefitIndex) => (
                    <li
                      key={benefitIndex}
                      className="flex items-start space-x-2 text-sm text-gray-600"
                    >
                      <div className={`w-1.5 h-1.5 ${colors.accent} rounded-full mt-2 flex-shrink-0`} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Implementation Steps */}
              <div className="mb-6">
                <h4 className={`text-sm font-semibold ${colors.text} mb-3 flex items-center`}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Implementation Steps
                </h4>
                <ol className="space-y-2">
                  {strategy.implementation.map((step, stepIndex) => (
                    <li
                      key={stepIndex}
                      className="flex items-start space-x-3 text-sm text-gray-600"
                    >
                      <span className={`${colors.badge} w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0`}>
                        {stepIndex + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Use Case */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Best For
                </h4>
                <p className="text-sm text-gray-600">
                  {strategy.useCase}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Implementation Guide */}
      <div className="mt-8 p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Combining Strategies for Maximum Resilience
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Recommended Stack</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-gray-700">
                  <strong>Primary:</strong> Exponential Backoff for individual requests
                </span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-sm text-gray-700">
                  <strong>Secondary:</strong> Request Queuing for bulk operations
                </span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-sm text-gray-700">
                  <strong>Fallback:</strong> Circuit Breaker for system protection
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Implementation Priority</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>1. Basic exponential backoff</span>
                <span className="text-green-600 font-medium">Essential</span>
              </div>
              <div className="flex justify-between">
                <span>2. Rate limit header monitoring</span>
                <span className="text-blue-600 font-medium">High</span>
              </div>
              <div className="flex justify-between">
                <span>3. Request queuing system</span>
                <span className="text-orange-600 font-medium">Medium</span>
              </div>
              <div className="flex justify-between">
                <span>4. Circuit breaker pattern</span>
                <span className="text-purple-600 font-medium">Advanced</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 