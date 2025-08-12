'use client'

import React from 'react'
import Link from 'next/link'
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, DollarSign, Eye, Zap } from 'lucide-react'

export default function FraudDetectionPage() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Header */}
      <header className="bg-[#111111] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[#1A5799] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SE</span>
              </div>
              <span className="text-xl font-semibold text-white">Schlep Engine</span>
            </Link>
            <div className="flex space-x-4">
              <Link href="/signup" className="bg-[#1A5799] text-white px-4 py-2 rounded-lg hover:bg-[#154A85] transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-red-900/20 border border-red-600/30 rounded-full text-sm text-red-400 mb-6">
              <Shield className="w-4 h-4 mr-2" />
              CRITICAL: Financial Fraud Prevention
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="text-[#F2E8CE]">$13 Billion</span> Lost to Financial Fraud
              <br />
              <span className="text-red-400">Every Year</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              While traditional systems generate 95% false positives and miss 60% of new attack patterns, Schlep Engine's rare event detection achieves 99.2% accuracy with 85% fewer false alarms.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold">
                Stop Fraud Now - Free Trial
              </Link>
              <Link href="/case-studies/financial-rare-events" className="border border-gray-600 text-white px-8 py-3 rounded-lg hover:border-gray-500 transition-colors font-semibold">
                See $12.8M Fraud Prevention Case Study
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Urgency Section */}
      <section className="py-16 bg-red-900/10 border-y border-red-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4 text-red-300">Your Current System is Failing You</h2>
            <p className="text-xl text-gray-300">Every day you delay, sophisticated fraudsters adapt faster than your rules-based system</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <div className="text-4xl font-bold text-red-400 mb-2">95%</div>
              <div className="text-gray-300">False Positive Rate</div>
              <div className="text-sm text-gray-400 mt-2">15,000+ legitimate transactions flagged daily</div>
            </div>
            <div className="text-center bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <div className="text-4xl font-bold text-red-400 mb-2">60%</div>
              <div className="text-gray-300">Missed New Attacks</div>
              <div className="text-sm text-gray-400 mt-2">Sophisticated patterns go undetected for months</div>
            </div>
            <div className="text-center bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <div className="text-4xl font-bold text-red-400 mb-2">0.08%</div>
              <div className="text-gray-300">Actual Fraud Rate</div>
              <div className="text-sm text-gray-400 mt-2">Extreme imbalance breaks traditional ML</div>
            </div>
            <div className="text-center bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <div className="text-4xl font-bold text-red-400 mb-2">$2.8M</div>
              <div className="text-gray-300">Annual Investigation Cost</div>
              <div className="text-sm text-gray-400 mt-2">Manual review of false positives</div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Schlep Engine: Built for Financial Fraud Detection</h2>
            <p className="text-gray-300 text-lg">The only ML platform specifically designed for rare event detection in financial data</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-2xl font-bold mb-6">Real-Time Transaction Processing</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Zap className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Sub-200ms Response Time</h4>
                    <p className="text-gray-300">Process transactions faster than customer can notice, enabling real-time blocking without UX degradation</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Shield className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">99.2% Detection Accuracy</h4>
                    <p className="text-gray-300">Catch sophisticated fraud patterns that traditional systems miss, including zero-day attacks and social engineering attempts</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Eye className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">85% Fewer False Positives</h4>
                    <p className="text-gray-300">Reduce manual reviews from 15,000 to 1,950 per day, saving $2.4M annually in investigation costs</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-4">Real-Time Fraud API</h4>
              <pre className="bg-black rounded p-4 text-sm text-green-400 overflow-x-auto">
{`POST /v1/financial/fraud-detection
{
  "transaction": {
    "amount": 2500.00,
    "merchant": "unknown_vendor",
    "location": "unusual_location",
    "time": "late_night"
  },
  "response_time": "89ms",
  "fraud_score": 0.94,
  "confidence": 0.91,
  "action": "block_and_verify"
}`}
              </pre>
            </div>
          </div>

          {/* Competitive Advantage */}
          <div className="bg-gray-900/50 rounded-xl p-8">
            <h3 className="text-2xl font-bold mb-8 text-center">Why Schlep Engine Beats Traditional Solutions</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-4 px-6">Capability</th>
                    <th className="text-center py-4 px-6 text-green-400">Schlep Engine</th>
                    <th className="text-center py-4 px-6 text-gray-400">Legacy Rules</th>
                    <th className="text-center py-4 px-6 text-gray-400">Traditional ML</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr>
                    <td className="py-4 px-6 font-medium">Rare Event Detection (0.08% fraud)</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Specialized algorithms</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ High false positives</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ Poor with imbalanced data</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium">Real-time Processing (&lt;200ms)</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Sub-200ms guaranteed</td>
                    <td className="py-4 px-6 text-center text-yellow-400">△ Fast but inaccurate</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ Batch processing only</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium">Adaptive to New Attacks</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Self-learning models</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ Manual rule updates</td>
                    <td className="py-4 px-6 text-center text-yellow-400">△ Requires retraining</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium">Regulatory Compliance</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Built-in explainability</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Transparent rules</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ Black box models</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-16 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Proven Results: $15.6M Annual Savings</h2>
            <p className="text-gray-300 text-lg">FirstTrust Bank case study - real production results</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">$12.8M</div>
              <div className="text-gray-300">Fraud Losses Prevented</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">$2.4M</div>
              <div className="text-gray-300">Investigation Cost Savings</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">26x</div>
              <div className="text-gray-300">Return on Investment</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">1.4</div>
              <div className="text-gray-300">Months to Break-even</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-red-900/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4 text-white">Every Day Costs You $36,000 in Fraud Losses</h2>
          <p className="text-xl mb-8 text-gray-300">
            While you're reading this, fraudsters are adapting. Stop them before they steal more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold">
              Stop Fraud Now - Free Trial
            </Link>
            <Link href="/contact" className="border border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-red-600 transition-colors font-semibold">
              Emergency Fraud Consultation
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-4">Setup in 2 weeks • Enterprise security • 99.99% uptime SLA</p>
        </div>
      </section>
    </div>
  )
}