'use client';

import React, { useState } from 'react';

interface CalculationResults {
  costSavings: number;
  downtimeSavings: number;
  cacheSavings: number;
  totalMonthlySavings: number;
  netSavings: number;
  roiPercent: number;
  paybackDays: number;
  cacheImprovement: number;
}

export default function RoiCalculator() {
  const SCHLEP_ENGINE_COST = 799;
  const TARGET_CACHE_HIT_RATE = 60; // 60% target cache hit rate

  const [currentSpend, setCurrentSpend] = useState(10000);
  const [currentCacheHitRate, setCurrentCacheHitRate] = useState(20);
  const [downtimeHours, setDowntimeHours] = useState(4);

  const calculateROI = (): CalculationResults => {
    // Hard, measurable savings only - no soft costs

    // 1. API Cost Savings: 30% reduction via smart routing
    // Provable with math - based on actual provider cost differentials
    const costSavings = currentSpend * 0.30;

    // 2. Downtime Savings: 60% reduction in downtime costs
    // Measurable via SLA monitoring and automatic failover
    const downtimeSavings = downtimeHours * 500 * 0.6;

    // 3. Cache Savings: 35% efficiency gain
    // Measurable via cache hit rate improvements
    const cacheImprovementPercent = Math.max(0, TARGET_CACHE_HIT_RATE - currentCacheHitRate);
    const cacheSavings = currentSpend * (cacheImprovementPercent / 100) * 0.35;

    const totalMonthlySavings = costSavings + downtimeSavings + cacheSavings;
    const netSavings = totalMonthlySavings - SCHLEP_ENGINE_COST;
    const roiPercent = (netSavings / SCHLEP_ENGINE_COST) * 100;
    const paybackDays = totalMonthlySavings > 0 ? Math.round((SCHLEP_ENGINE_COST / totalMonthlySavings) * 30) : 0;

    return {
      costSavings,
      downtimeSavings,
      cacheSavings,
      totalMonthlySavings,
      netSavings,
      roiPercent,
      paybackDays,
      cacheImprovement: cacheImprovementPercent
    };
  };

  const results = calculateROI();
  const currentTotalCost = currentSpend + (downtimeHours * 500);
  const newTotalCost = currentTotalCost - results.totalMonthlySavings + SCHLEP_ENGINE_COST;

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
            <p className="text-sm font-mono text-gray-600 max-w-3xl mx-auto mt-4">
              Conservative estimates based on early customer data. Actual savings vary by usage patterns, current optimization level, and infrastructure setup.
            </p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium font-inter mb-2" style={{ color: '#000000' }}>
                  Current Monthly AI Spend ($)
                </label>
                <input
                  type="number"
                  value={currentSpend}
                  onChange={(e) => setCurrentSpend(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border font-mono"
                  style={{
                    backgroundColor: '#f6f6f4',
                    borderColor: 'rgba(156, 163, 175, 0.3)',
                    color: '#000000'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium font-inter mb-2" style={{ color: '#000000' }}>
                  Current Cache Hit Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={currentCacheHitRate}
                  onChange={(e) => setCurrentCacheHitRate(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border font-mono"
                  style={{
                    backgroundColor: '#f6f6f4',
                    borderColor: 'rgba(156, 163, 175, 0.3)',
                    color: '#000000'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium font-inter mb-2" style={{ color: '#000000' }}>
                  Average Monthly Downtime (hours)
                </label>
                <input
                  type="number"
                  value={downtimeHours}
                  onChange={(e) => setDowntimeHours(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border font-mono"
                  style={{
                    backgroundColor: '#f6f6f4',
                    borderColor: 'rgba(156, 163, 175, 0.3)',
                    color: '#000000'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="rounded-lg p-8 mb-8" style={{
            backgroundColor: '#f6f6f4',
            border: '1px solid rgba(156, 163, 175, 0.3)'
          }}>
            <h3 className="text-xl font-normal font-inter mb-6" style={{ color: '#000000' }}>
              With Schlep-engine, you'll save:
            </h3>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgba(156, 163, 175, 0.2)' }}>
                <span className="text-base font-mono text-gray-700">API cost savings (30% via smart routing)</span>
                <span className="text-lg font-mono" style={{ color: '#000000' }}>
                  {formatCurrency(results.costSavings)}/month
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgba(156, 163, 175, 0.2)' }}>
                <span className="text-base font-mono text-gray-700">Reduced downtime costs</span>
                <span className="text-lg font-mono" style={{ color: '#000000' }}>
                  {formatCurrency(results.downtimeSavings)}/month
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgba(156, 163, 175, 0.2)' }}>
                <span className="text-base font-mono text-gray-700">Cache efficiency gains</span>
                <span className="text-lg font-mono" style={{ color: '#000000' }}>
                  {results.cacheImprovement}% improvement ({formatCurrency(results.cacheSavings)}/month)
                </span>
              </div>
            </div>

            {/* Total Savings */}
            <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
              <div className="flex items-center justify-between">
                <span className="text-base font-normal font-mono" style={{ color: '#000000' }}>
                  Total Monthly Savings:
                </span>
                <span className="text-lg font-mono" style={{ color: '#000000' }}>
                  {formatCurrency(results.totalMonthlySavings)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-base font-mono text-gray-700">
                  After Schlep-engine ({formatCurrency(SCHLEP_ENGINE_COST)}):
                </span>
                <span className="text-lg font-mono" style={{ color: '#000000' }}>
                  Net Savings {formatCurrency(results.netSavings)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-base font-mono text-gray-700">ROI in first month:</span>
                <span className="text-lg font-mono" style={{ color: '#000000' }}>
                  {results.roiPercent.toFixed(0)}%
                </span>
              </div>

              <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}>
                <p className="text-center text-base font-mono" style={{ color: '#000000' }}>
                  {results.paybackDays > 0 ? `Estimated payback in ${results.paybackDays} days` : 'Calculate your estimated payback'}
                </p>
                <p className="text-center text-sm font-mono text-gray-600 mt-2">
                  Your {formatCurrency(SCHLEP_ENGINE_COST)} investment could return {formatCurrency(results.totalMonthlySavings)} monthly
                </p>
              </div>

              <div className="mt-4 p-3 rounded-lg" style={{
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                border: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                <p className="text-xs font-mono text-gray-600 text-center leading-relaxed">
                  Methodology: API cost savings (30% via provider optimization), downtime reduction (60% via automatic failover), cache efficiency (35% improvement). All calculations based on hard, measurable metrics. Actual results vary by usage patterns and infrastructure.
                </p>
              </div>
            </div>
          </div>

          {/* Cost Comparison Line Graph */}
          <div className="rounded-lg p-8" style={{
            backgroundColor: '#f6f6f4',
            border: '1px solid rgba(156, 163, 175, 0.3)'
          }}>
            <h3 className="text-xl font-normal font-inter mb-6" style={{ color: '#000000' }}>
              Cost Comparison
            </h3>

            <div className="space-y-8">
              {/* Line graph visualization */}
              <div className="relative pt-8 pb-4">
                <div className="flex items-end justify-between h-48 gap-8">
                  {/* Current Cost */}
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col justify-end h-full relative">
                      <div
                        className="w-full transition-all duration-500 relative"
                        style={{
                          height: '100%',
                          borderTop: '0.5px solid #000000'
                        }}
                      >
                        <div className="absolute -top-8 left-0 right-0 text-center">
                          <span className="text-sm font-mono" style={{ color: '#000000' }}>
                            {formatCurrency(currentTotalCost)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-gray-700 mt-4">Current Total Cost</span>
                  </div>

                  {/* New Cost */}
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col justify-end h-full relative">
                      <div
                        className="w-full transition-all duration-500 relative"
                        style={{
                          height: `${(newTotalCost / currentTotalCost) * 100}%`,
                          borderTop: '0.5px solid #000000'
                        }}
                      >
                        <div className="absolute -top-8 left-0 right-0 text-center">
                          <span className="text-sm font-mono" style={{ color: '#000000' }}>
                            {formatCurrency(newTotalCost)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-gray-700 mt-4">New Total Cost</span>
                  </div>
                </div>

                {/* Connecting line */}
                <svg
                  className="absolute top-8 left-0 w-full h-48 pointer-events-none"
                  style={{ zIndex: 1 }}
                >
                  <line
                    x1="25%"
                    y1="0"
                    x2="75%"
                    y2={`${100 - ((newTotalCost / currentTotalCost) * 100)}%`}
                    stroke="rgba(0, 0, 0, 0.3)"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                </svg>
              </div>

              <div className="pt-4 text-center border-t" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
                <p className="text-lg font-mono" style={{ color: '#000000' }}>
                  Save {formatCurrency(currentTotalCost - newTotalCost)} per month
                </p>
                <p className="text-sm font-mono text-gray-600 mt-1">
                  {((1 - (newTotalCost / currentTotalCost)) * 100).toFixed(0)}% reduction in total AI infrastructure costs
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
