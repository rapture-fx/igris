import React from 'react';
import { Clock, Zap, Settings } from 'lucide-react';

interface RateLimitOverviewProps {
  rateLimits: Array<{
    tier: string;
    description: string;
    color: string;
    icon: string;
    limits: Array<{
      metric: string;
      value: string;
      description: string;
    }>;
  }>;
}

const iconMap = {
  Clock,
  Zap,
  Settings,
};

export default function RateLimitOverview({ rateLimits }: RateLimitOverviewProps) {
  const getColorClasses = (color: string) => {
    const colorMap = {
      orange: {
        bg: 'bg-gradient-to-r from-orange-50 to-red-50',
        border: 'border-orange-200',
        text: 'text-orange-900',
        badge: 'bg-orange-100 text-orange-800',
        value: 'text-orange-800',
        metric: 'text-orange-700',
        desc: 'text-orange-600'
      },
      blue: {
        bg: 'bg-gradient-to-r from-blue-50 to-indigo-50',
        border: 'border-blue-200',
        text: 'text-blue-900',
        badge: 'bg-blue-100 text-blue-800',
        value: 'text-blue-800',
        metric: 'text-blue-700',
        desc: 'text-blue-600'
      },
      purple: {
        bg: 'bg-gradient-to-r from-purple-50 to-pink-50',
        border: 'border-purple-200',
        text: 'text-purple-900',
        badge: 'bg-purple-100 text-purple-800',
        value: 'text-purple-800',
        metric: 'text-purple-700',
        desc: 'text-purple-600'
      }
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Rate Limit Tiers</h2>
        <p className="text-gray-600">
          Choose the tier that matches your usage requirements and scale as needed
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {rateLimits.map((tier, index) => {
          const colors = getColorClasses(tier.color);
          const IconComponent = iconMap[tier.icon as keyof typeof iconMap];

          return (
            <div
              key={index}
              className={`${colors.bg} ${colors.border} border rounded-xl p-6 relative overflow-hidden`}
            >
              {/* Tier Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`${colors.badge} p-2 rounded-lg`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${colors.text}`}>
                      {tier.tier}
                    </h3>
                    <p className={`text-sm ${colors.desc} mt-1`}>
                      {tier.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Limits Grid */}
              <div className="space-y-4">
                {tier.limits.map((limit, limitIndex) => (
                  <div
                    key={limitIndex}
                    className="bg-white/50 rounded-lg p-4 border border-white/30"
                  >
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${colors.value} mb-1`}>
                        {limit.value}
                      </div>
                      <div className={`text-sm font-medium ${colors.metric} mb-1`}>
                        {limit.metric}
                      </div>
                      <div className={`text-xs ${colors.desc}`}>
                        {limit.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tier Indicator */}
              {tier.tier === 'Enterprise' && (
                <div className="absolute top-4 right-4">
                  <span className="bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                    Popular
                  </span>
                </div>
              )}
              
              {tier.tier === 'Custom' && (
                <div className="absolute top-4 right-4">
                  <span className="bg-purple-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                    Premium
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upgrade Notice */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <Settings className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">
              Need Higher Limits?
            </h4>
            <p className="text-sm text-gray-600 mb-2">
              Contact our sales team for custom enterprise solutions with dedicated resources,
              higher rate limits, and priority support.
            </p>
            <div className="flex space-x-3 text-xs">
              <span className="text-gray-500">• Dedicated infrastructure</span>
              <span className="text-gray-500">• 99.9% SLA guarantee</span>
              <span className="text-gray-500">• Priority support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 