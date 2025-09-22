'use client';

import React, { useState, useCallback } from 'react';

export default function PricingSlider() {
  const [apiCalls, setApiCalls] = useState(100000); // Default to 100k

  const plans = [
    {
      name: 'Develop',
      basePrice: 99,
      includedCalls: 100000, // 100k
      additionalCostPer10k: 1.5
    },
    {
      name: 'Growth',
      basePrice: 299,
      includedCalls: 1000000, // 1M
      additionalCostPer10k: 1.0
    },
    {
      name: 'Scale',
      basePrice: 599,
      includedCalls: 5000000, // 5M
      additionalCostPer10k: 0.75
    }
  ];

  const calculateCost = useCallback((plan: typeof plans[0], calls: number) => {
    if (calls <= plan.includedCalls) {
      return plan.basePrice;
    }

    const additionalCalls = calls - plan.includedCalls;
    const additional10kBlocks = Math.ceil(additionalCalls / 10000);
    const additionalCost = additional10kBlocks * plan.additionalCostPer10k;

    return plan.basePrice + additionalCost;
  }, []);

  const getRecommendedPlan = useCallback(() => {
    const costs = plans.map(plan => ({
      ...plan,
      totalCost: calculateCost(plan, apiCalls)
    }));

    return costs.reduce((min, current) =>
      current.totalCost < min.totalCost ? current : min
    );
  }, [apiCalls, calculateCost]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'k';
    }
    return num.toString();
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setApiCalls(value);
  };

  const recommendedPlan = getRecommendedPlan();

  return (
    <div className="max-w-4xl mx-auto mb-12">
      <div className="relative p-8" style={{
        backgroundColor: '#f7f7f3',
        borderTop: '1px solid rgba(74, 123, 214, 0.15)',
        borderBottom: '1px solid rgba(74, 123, 214, 0.15)',
        borderLeft: '1px solid rgba(74, 123, 214, 0.15)',
        borderRight: '1px solid rgba(74, 123, 214, 0.15)'
      }}>
        {/* Top left bleeding cross */}
        <div className="absolute -top-4 -left-4 w-8 h-8">
          <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '1px solid #4a7bd6' }}></div>
          <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '1px solid #4a7bd6' }}></div>
        </div>
        {/* Bottom right bleeding cross */}
        <div className="absolute -bottom-4 -right-4 w-8 h-8">
          <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '1px solid #4a7bd6' }}></div>
          <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '1px solid #4a7bd6' }}></div>
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-medium mb-6" style={{ color: '#1f53d0' }}>
            Find your perfect plan
          </h3>

          {/* Slider */}
          <div className="mb-8">
            <div className="relative">
              <input
                type="range"
                min="10000"
                max="10000000"
                step="10000"
                value={apiCalls}
                onChange={handleSliderChange}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #1f53d0 0%, #1f53d0 ${((apiCalls - 10000) / (10000000 - 10000)) * 100}%, #e5e7eb ${((apiCalls - 10000) / (10000000 - 10000)) * 100}%, #e5e7eb 100%)`
                }}
              />
              <style jsx>{`
                .slider::-webkit-slider-thumb {
                  appearance: none;
                  height: 20px;
                  width: 20px;
                  border-radius: 50%;
                  background: #1f53d0;
                  cursor: pointer;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }

                .slider::-moz-range-thumb {
                  height: 20px;
                  width: 20px;
                  border-radius: 50%;
                  background: #1f53d0;
                  cursor: pointer;
                  border: none;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
              `}</style>

              {/* Range labels */}
              <div className="flex justify-between text-sm text-gray-600 mt-2">
                <span>10k</span>
                <span>10M</span>
              </div>
            </div>
          </div>

          {/* Usage Display */}
          <div className="space-y-4">
            <div className="text-lg">
              <span className="text-gray-700">Your usage: </span>
              <span className="font-semibold text-gray-900">
                {formatNumber(apiCalls)} API calls
              </span>
            </div>

            <div className="text-lg">
              <span className="text-gray-700">Recommended plan: </span>
              <span className="font-semibold" style={{ color: '#1f53d0' }}>
                {recommendedPlan.name} ${recommendedPlan.basePrice}
              </span>
            </div>

            <div className="text-lg">
              <span className="text-gray-700">Estimated monthly cost: </span>
              <span className="font-semibold text-gray-900 text-xl">
                ${recommendedPlan.totalCost}
              </span>
            </div>
          </div>

          {/* Plan breakdown for context */}
          <div className="mt-6 text-sm text-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.name} className={`p-3 rounded-lg border ${plan.name === recommendedPlan.name ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                  <div className="font-medium" style={{ color: plan.name === recommendedPlan.name ? '#1f53d0' : '#374151' }}>
                    {plan.name} - ${plan.basePrice}/mo
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatNumber(plan.includedCalls)} included, ${plan.additionalCostPer10k}/10k after
                  </div>
                  <div className="text-sm font-medium mt-1">
                    ${calculateCost(plan, apiCalls)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}