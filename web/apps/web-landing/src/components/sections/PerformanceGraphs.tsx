'use client'

import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Zap, DollarSign, Activity, BarChart3 } from 'lucide-react'

const performanceData = [
  { month: 'Jan', latency: 245, cost: 0.085, throughput: 450 },
  { month: 'Feb', latency: 220, cost: 0.072, throughput: 520 },
  { month: 'Mar', latency: 185, cost: 0.061, throughput: 610 },
  { month: 'Apr', latency: 165, cost: 0.058, throughput: 725 },
  { month: 'May', latency: 142, cost: 0.052, throughput: 890 },
  { month: 'Jun', latency: 125, cost: 0.045, throughput: 1050 },
]

const providerData = [
  { provider: 'OpenAI GPT-4', percentage: 45, avgLatency: 125, cost: 0.045 },
  { provider: 'Claude 3.5', percentage: 35, avgLatency: 142, cost: 0.038 },
  { provider: 'Custom Provider', percentage: 20, avgLatency: 98, cost: 0.028 },
]

const metrics = [
  {
    title: 'Latency Reduction',
    value: '49%',
    subtitle: '125ms → 64ms average',
    icon: Zap,
    trend: 'down',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    title: 'Cost Optimization',
    value: '47%',
    subtitle: '$0.085 → $0.045 per request',
    icon: DollarSign,
    trend: 'down',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    title: 'Throughput Increase',
    value: '133%',
    subtitle: '450 → 1050 requests/min',
    icon: Activity,
    trend: 'up',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    title: 'Success Rate',
    value: '99.7%',
    subtitle: '99.2% → 99.7% reliability',
    icon: BarChart3,
    trend: 'up',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  }
]

export default function PerformanceGraphs() {
  const [selectedMetric, setSelectedMetric] = useState('latency')

  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
              {/* Left Column - Title and Metrics */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Performance Analytics</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Real optimization<br/>measurable results.
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-8">
                  Track latency improvements, cost savings, and throughput gains. Our intelligent routing delivers quantifiable performance benefits.
                </p>

                {/* Key Metrics Cards */}
                <div className="space-y-3">
                  {metrics.map((metric, index) => (
                    <div key={index} className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${metric.bgColor}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
                          <metric.icon className={`h-5 w-5 ${metric.color}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                            {metric.title}
                          </h4>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">
                              {metric.value}
                            </span>
                            {metric.trend === 'up' ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {metric.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - Graphs */}
              <div className="rounded-lg p-6 lg:col-span-3 min-h-[600px] flex flex-col gap-6 relative overflow-hidden" style={{ backgroundColor: '#f2f1ed' }}>
                <div className="relative z-10">
                  {/* Main Performance Graph */}
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Performance Trends</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedMetric('latency')}
                          className={`px-3 py-1 text-xs rounded ${
                            selectedMetric === 'latency' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Latency
                        </button>
                        <button
                          onClick={() => setSelectedMetric('cost')}
                          className={`px-3 py-1 text-xs rounded ${
                            selectedMetric === 'cost' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Cost
                        </button>
                        <button
                          onClick={() => setSelectedMetric('throughput')}
                          className={`px-3 py-1 text-xs rounded ${
                            selectedMetric === 'throughput' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Throughput
                        </button>
                      </div>
                    </div>
                    
                    {/* Simple Bar Graph Visualization */}
                    <div className="h-40 flex items-end justify-between gap-2 px-2">
                      {performanceData.map((data, index) => {
                        let height = 0
                        let color = 'bg-blue-500'
                        
                        if (selectedMetric === 'latency') {
                          height = (data.latency / 245) * 100
                          color = 'bg-red-500'
                        } else if (selectedMetric === 'cost') {
                          height = (data.cost / 0.085) * 100
                          color = 'bg-yellow-500'
                        } else {
                          height = (data.throughput / 1050) * 100
                          color = 'bg-green-500'
                        }
                        
                        return (
                          <div key={index} className="flex flex-col items-center flex-1">
                            <div className="w-full relative">
                              <div
                                className={`${color} rounded-t transition-all duration-300`}
                                style={{ height: `${height}%` }}
                              />
                              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 dark:text-gray-400 opacity-0 hover:opacity-100 transition-opacity">
                                {selectedMetric === 'latency' && `${data.latency}ms`}
                                {selectedMetric === 'cost' && `$${data.cost}`}
                                {selectedMetric === 'throughput' && `${data.throughput}`}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{data.month[0]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Provider Distribution */}
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Provider Distribution</h4>
                    <div className="space-y-3">
                      {providerData.map((provider, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-32 text-xs text-gray-600 dark:text-gray-400 truncate">
                              {provider.provider}
                            </div>
                            <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${provider.percentage}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 w-12 text-right">
                              {provider.percentage}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Provider Stats */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Avg Latency</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">125ms</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Cost Per 1K</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">$0.037</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">99.7%</div>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Stats */}
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Real-time Metrics</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Current Latency</div>
                        <div className="text-lg font-bold text-blue-600">87ms</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Active Requests</div>
                        <div className="text-lg font-bold text-green-600">342</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Min Savings/hr</div>
                        <div className="text-lg font-bold text-yellow-600">$12.40</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Uptime</div>
                        <div className="text-lg font-bold text-purple-600">99.9%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
