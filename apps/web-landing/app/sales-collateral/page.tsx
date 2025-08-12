'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Download, Calculator, BarChart3, FileText, TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react'

export default function SalesCollateralPage() {
  const [roiInputs, setRoiInputs] = useState({
    industry: 'ecommerce',
    monthlyTransactions: '',
    currentAccuracy: '',
    laborCostPerHour: ''
  })

  const [roiResults, setRoiResults] = useState<{
    totalSavings: number;
    costs: number;
    roi: number;
    paybackMonths: number;
    improvements: any; // Allow flexible improvements structure
    savings: any; // Allow flexible savings structure
  } | null>(null)

  const handleRoiCalculation = () => {
    const transactions = parseInt(roiInputs.monthlyTransactions) || 0
    const currentAcc = parseFloat(roiInputs.currentAccuracy) || 0
    const laborCost = parseFloat(roiInputs.laborCostPerHour) || 0

    let improvements, costs, savings
    
    if (roiInputs.industry === 'ecommerce') {
      improvements = {
        accuracyImprovement: 45,
        revenueIncrease: 35,
        timeToValue: 1.8
      }
      const newUserRevenue = transactions * 0.4 * 15 * (improvements.revenueIncrease / 100)
      costs = 320000
      savings = {
        additionalRevenue: newUserRevenue * 12,
        operationalSavings: laborCost * 40 * 52 * 0.6
      }
    } else if (roiInputs.industry === 'financial') {
      improvements = {
        accuracyImprovement: 23.2,
        falsePositiveReduction: 85,
        timeToValue: 1.4
      }
      const fraudPrevention = transactions * 0.0008 * 5000 * (improvements.accuracyImprovement / 100)
      const laborSavings = 15000 * 0.87 * laborCost * 12
      costs = 600000
      savings = {
        fraudPrevention: fraudPrevention * 12,
        operationalSavings: laborSavings
      }
    } else {
      improvements = {
        downtimeReduction: 40,
        efficiencyIncrease: 25,
        timeToValue: 2.1
      }
      const downtimeSavings = 156 * 0.4 * 15000 * 12
      const efficiencySavings = transactions * 0.1 * (improvements.efficiencyIncrease / 100)
      costs = 180000
      savings = {
        downtimeReduction: downtimeSavings,
        efficiencyGains: efficiencySavings * 12
      }
    }

    const totalSavings = Object.values(savings).reduce((a, b) => a + b, 0)
    const roi = ((totalSavings - costs) / costs) * 100
    const paybackMonths = (costs / (totalSavings / 12))

    setRoiResults({
      totalSavings,
      costs,
      roi,
      paybackMonths,
      improvements,
      savings
    })
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Sales Resources & Tools</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive sales collateral, ROI calculators, and competitive analysis tools to help demonstrate Schlep Engine's value proposition.
          </p>
        </div>

        {/* Solution Briefs */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Industry Solution Briefs</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 ml-4">E-commerce Solution Brief</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Comprehensive guide to solving cold start problems and improving recommendation accuracy for e-commerce platforms.
              </p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>45% increase in new user conversions</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>85% recommendation accuracy</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>12x ROI within 6 months</span>
                </div>
              </div>
              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </button>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 ml-4">Financial Services Brief</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Advanced fraud detection and rare event handling capabilities designed for financial institutions.
              </p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>99.2% fraud detection accuracy</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>85% reduction in false positives</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>26x ROI within 12 months</span>
                </div>
              </div>
              <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </button>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 ml-4">Manufacturing Brief</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Industrial sensor data processing and predictive maintenance solutions for manufacturing operations.
              </p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>40% reduction in downtime</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>25% efficiency improvement</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>18x ROI within 12 months</span>
                </div>
              </div>
              <button className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </button>
            </div>
          </div>
        </section>

        {/* ROI Calculator */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">ROI Calculator</h2>
          <div className="bg-gray-50 rounded-xl p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Calculate Your Potential ROI</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={roiInputs.industry}
                      onChange={(e) => setRoiInputs({...roiInputs, industry: e.target.value})}
                    >
                      <option value="ecommerce">E-commerce</option>
                      <option value="financial">Financial Services</option>
                      <option value="manufacturing">Manufacturing</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Transactions/Data Points
                    </label>
                    <input 
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 100000"
                      value={roiInputs.monthlyTransactions}
                      onChange={(e) => setRoiInputs({...roiInputs, monthlyTransactions: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current System Accuracy (%)
                    </label>
                    <input 
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 76"
                      value={roiInputs.currentAccuracy}
                      onChange={(e) => setRoiInputs({...roiInputs, currentAccuracy: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Average Labor Cost per Hour ($)
                    </label>
                    <input 
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 45"
                      value={roiInputs.laborCostPerHour}
                      onChange={(e) => setRoiInputs({...roiInputs, laborCostPerHour: e.target.value})}
                    />
                  </div>
                  
                  <button 
                    onClick={handleRoiCalculation}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <Calculator className="h-5 w-5 mr-2" />
                    Calculate ROI
                  </button>
                </div>
              </div>
              
              <div>
                {roiResults ? (
                  <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Your ROI Projection</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-gray-600">Total Annual Savings</span>
                        <span className="text-2xl font-bold text-green-600">
                          ${roiResults.totalSavings.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-gray-600">Implementation Cost</span>
                        <span className="text-lg font-semibold text-gray-900">
                          ${roiResults.costs.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-gray-600">ROI</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {roiResults.roi.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Payback Period</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {roiResults.paybackMonths.toFixed(1)} months
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-semibold text-gray-900 mb-3">Key Improvements</h4>
                      <div className="space-y-2">
                        {Object.entries(roiResults.improvements).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-600 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className="font-medium">
                              {typeof value === 'number' ? `${value}%` : `${value} months`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-6 shadow-sm flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>Enter your details and click calculate to see your potential ROI</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Competitive Comparison */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Competitive Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-sm border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Feature</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-blue-600">Schlep Engine</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Competitor A</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Competitor B</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Legacy Solutions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Cold Start Problem Solving</td>
                  <td className="px-6 py-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Partial</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Limited</td>
                  <td className="px-6 py-4 text-center text-sm text-red-500">✗</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Rare Event Detection</td>
                  <td className="px-6 py-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Basic</td>
                  <td className="px-6 py-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-red-500">✗</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Real-time Processing</td>
                  <td className="px-6 py-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Batch only</td>
                  <td className="px-6 py-4 text-center text-sm text-red-500">✗</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Industry-Specific Models</td>
                  <td className="px-6 py-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Generic</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Limited</td>
                  <td className="px-6 py-4 text-center text-sm text-red-500">✗</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Explainable AI</td>
                  <td className="px-6 py-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Basic</td>
                  <td className="px-6 py-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-red-500">✗</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Setup Time</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">2-4 weeks</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">3-6 months</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">2-4 months</td>
                  <td className="px-6 py-4 text-center text-sm text-red-500">6+ months</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Cost Structure</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">Usage-based</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Enterprise only</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">Per-seat</td>
                  <td className="px-6 py-4 text-center text-sm text-red-500">High upfront</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Additional Resources */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Additional Sales Resources</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/case-studies/ecommerce-cold-start" className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <FileText className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">E-commerce Case Study</h3>
              <p className="text-sm text-gray-600">45% conversion increase for fashion retailer</p>
            </Link>
            
            <Link href="/case-studies/financial-rare-events" className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <FileText className="h-8 w-8 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Financial Case Study</h3>
              <p className="text-sm text-gray-600">99.2% fraud detection accuracy for regional bank</p>
            </Link>
            
            <Link href="/case-studies/manufacturing-sensor-data" className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <FileText className="h-8 w-8 text-orange-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Manufacturing Case Study</h3>
              <p className="text-sm text-gray-600">40% downtime reduction for pump manufacturer</p>
            </Link>
            
            <Link href="/docs/api-reference" className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <BarChart3 className="h-8 w-8 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Technical Documentation</h3>
              <p className="text-sm text-gray-600">Complete API reference and integration guides</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}