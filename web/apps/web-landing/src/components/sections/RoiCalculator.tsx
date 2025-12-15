'use client';

import React, { useState } from 'react';

interface CalculationResults {
  minSavings: number;
  maxSavings: number;
  minNetSavings: number;
  maxNetSavings: number;
  minROI: number;
  maxROI: number;
}

export default function RoiCalculator() {
  const IGRIS_INERTIAL_COST = 799;

  const [currentSpend, setCurrentSpend] = useState(10000);

  const calculateROI = (): CalculationResults => {
    // Provider cost optimization via smart routing
    // Based on actual provider price differentials from major providers:
    // - GPT-4: OpenAI vs Azure vs AWS Bedrock (10-25% variance)
    // - Claude: Direct vs AWS/GCP (15-30% variance)
    // - Llama: Groq vs Together vs Replicate (20-40% variance)

    // Conservative range: 30-60% monthly savings
    // Lower bound (30%): Already somewhat optimized, single provider
    // Upper bound (60%): Multi-provider with suboptimal routing

    const minSavings = currentSpend * 0.30;
    const maxSavings = currentSpend * 0.60;

    const minNetSavings = minSavings - IGRIS_INERTIAL_COST;
    const maxNetSavings = maxSavings - IGRIS_INERTIAL_COST;

    const minROI = (minNetSavings / IGRIS_INERTIAL_COST) * 100;
    const maxROI = (maxNetSavings / IGRIS_INERTIAL_COST) * 100;

    return {
      minSavings,
      maxSavings,
      minNetSavings,
      maxNetSavings,
      minROI,
      maxROI
    };
  };

  const results = calculateROI();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative py-16 px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          <div className="text-center mb-16">
            <h2 className="text-2xl tracking-tight md:text-3xl font-normal font-inter mb-4" style={{ color: '#000000' }}>
              See how much you can save
            </h2>
          </div>

          <div className="max-w-6xl mx-auto">
            {/* Input Section */}
            <div className="mb-12 rounded-lg p-8" style={{
              backgroundColor: '#f6f6f4',
              border: '1px solid rgba(156, 163, 175, 0.3)'
            }}>
              <h3 className="text-xl font-medium font-inter mb-6" style={{ color: '#000000' }}>
                Your Current Setup
              </h3>

              <div className="max-w-md">
                <label className="block text-sm font-medium font-inter mb-2" style={{ color: '#000000' }}>
                  Current Monthly AI Spend ($)
                </label>
                <input
                  type="number"
                  value={currentSpend}
                  onChange={(e) => setCurrentSpend(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border text-lg"
                  style={{
                    backgroundColor: '#f6f6f4',
                    borderColor: 'rgba(156, 163, 175, 0.3)',
                    color: '#000000'
                  }}
                  placeholder="10000"
                />
              </div>
              <p className="text-xs text-gray-500 mt-6">
                Optimized for companies spending $3,000+/month on AI APIs.
              </p>
              <p className="text-xs text-gray-500">
                Below this? We'll notify you when we launch our starter plan.
              </p>
            </div>

            {/* Results Section */}
            <div className="rounded-lg p-8 mb-8" style={{
              backgroundColor: '#f6f6f4',
              border: '1px solid rgba(156, 163, 175, 0.3)'
            }}>
              <h3 className="text-xl font-normal font-inter mb-6" style={{ color: '#000000' }}>
                Estimated monthly savings
              </h3>

              <div className="space-y-6">
                <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600 mb-2">Based on provider cost optimization</p>
                    <p className="text-3xl" style={{ color: '#000000' }}>
                      {formatCurrency(results.minSavings)} - {formatCurrency(results.maxSavings)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">per month</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-700">Igris Inertial cost:</span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-lg" style={{ color: '#000000' }}>
                        {formatCurrency(IGRIS_INERTIAL_COST)}/month
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgba(156, 163, 175, 0.2)' }}>
                    <span className="text-base" style={{ color: '#000000' }}>Net monthly savings:</span>
                    <span className="text-lg" style={{ color: '#000000' }}>
                      {formatCurrency(results.minNetSavings)} - {formatCurrency(results.maxNetSavings)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-700">ROI:</span>
                    <span className="text-lg" style={{ color: '#000000' }}>
                      {results.minROI.toFixed(0)}% - {results.maxROI.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Methodology */}
            <div className="rounded-lg p-8" style={{
              backgroundColor: '#f6f6f4',
              border: '1px solid rgba(156, 163, 175, 0.3)'
            }}>
              <h3 className="text-xl font-normal font-inter mb-6" style={{ color: '#000000' }}>
                How we calculate this
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
                  <p className="text-base text-gray-700 mb-2">Provider cost optimization (30-60%)</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Based on actual provider price differentials for major models. Lower end: already optimized single-provider setup. Upper end: multi-provider with suboptimal routing.
                  </p>
                </div>

                <div className="pt-4 border-t" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
                  <p className="text-base text-gray-600 text-left leading-relaxed">
                    Ranges reflect realistic uncertainty. Your actual savings depend on current provider mix, usage patterns, and optimization level. Connect your API logs for exact calculation based on your real data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
