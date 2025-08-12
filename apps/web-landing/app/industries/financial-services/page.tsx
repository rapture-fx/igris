'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle, TrendingUp, Shield, Zap, AlertTriangle, DollarSign, Eye, Target } from 'lucide-react'

export default function FinancialServicesPage() {
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
            <div className="inline-flex items-center px-4 py-2 bg-[#1A5799]/20 border border-[#1A5799]/30 rounded-full text-sm text-[#1A5799] mb-6">
              <DollarSign className="w-4 h-4 mr-2" />
              Financial Data Intelligence
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Stop Fraud in Real-Time with
              <span className="text-[#F2E8CE]"> 99.2% Accuracy</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Purpose-built for financial fraud detection. Process transactions in under 200ms, catch sophisticated attacks others miss, and reduce false positives by 85%. Trusted by regional banks to prevent $12.8M+ in annual fraud losses.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="bg-[#1A5799] text-white px-8 py-3 rounded-lg hover:bg-[#154A85] transition-colors font-semibold">
                Start Free Trial
              </Link>
              <Link href="#demo" className="border border-gray-600 text-white px-8 py-3 rounded-lg hover:border-gray-500 transition-colors font-semibold">
                See Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Financial Rare Event Challenges</h2>
            <p className="text-gray-300 text-lg">Traditional ML models fail on imbalanced financial datasets</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-6">
              <AlertTriangle className="w-8 h-8 text-red-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-red-300">Imbalanced Data</h3>
              <p className="text-gray-300">Fraudulent transactions represent only 0.1-0.2% of all transactions. Traditional models trained on such imbalanced data achieve poor recall and generate excessive false alarms.</p>
            </div>
            <div className="bg-orange-900/20 border border-orange-900/30 rounded-lg p-6">
              <Eye className="w-8 h-8 text-orange-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-orange-300">False Positive Storm</h3>
              <p className="text-gray-300">Legacy systems generate 95% false positives, requiring manual review of thousands of legitimate transactions daily, costing $13B annually in operational overhead.</p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-900/30 rounded-lg p-6">
              <Target className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-yellow-300">Missed Threats</h3>
              <p className="text-gray-300">Sophisticated financial crimes evolve rapidly. Traditional rule-based systems miss 60% of new fraud patterns, resulting in billions in losses and regulatory penalties.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Rare Event Detection Pipeline</h2>
            <p className="text-gray-300 text-lg">Advanced ML specialized for imbalanced financial data</p>
          </div>
          
          {/* Pipeline Visual */}
          <div className="bg-gray-900/50 rounded-xl p-8 mb-12">
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">1</span>
                </div>
                <h4 className="font-semibold mb-2">Data Preprocessing</h4>
                <p className="text-sm text-gray-400">Advanced sampling and feature engineering for imbalanced financial datasets</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">Ensemble Modeling</h4>
                <p className="text-sm text-gray-400">Combine multiple algorithms optimized for rare event detection</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Anomaly Scoring</h4>
                <p className="text-sm text-gray-400">Multi-dimensional risk assessment with confidence intervals</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">4</span>
                </div>
                <h4 className="font-semibold mb-2">Real-time Alerts</h4>
                <p className="text-sm text-gray-400">Immediate fraud alerts with explainable AI insights</p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-6">Advanced Rare Event Detection</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Imbalanced Data Optimization</h4>
                    <p className="text-gray-300">Specialized sampling techniques and cost-sensitive learning to handle datasets with 0.1% positive cases while maintaining 99.2% accuracy</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Adaptive Fraud Detection</h4>
                    <p className="text-gray-300">Machine learning models that evolve with new fraud patterns, detecting previously unseen attack vectors within hours</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">False Positive Reduction</h4>
                    <p className="text-gray-300">Advanced ensemble methods reduce false positives by 85% while maintaining 99%+ recall on true fraud cases</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Regulatory Compliance</h4>
                    <p className="text-gray-300">Built-in explainability features meet regulatory requirements for model transparency and audit trails</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-4">API Integration Example</h4>
              <pre className="bg-black rounded p-4 text-sm text-green-400 overflow-x-auto">
{`curl -X POST https://api.schlep-engine.com/v1/financial/detect \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction_data": {
      "amount": 5000.00,
      "merchant": "unknown_vendor",
      "location": "foreign_country",
      "timestamp": "2025-01-15T14:30:00Z",
      "user_behavior": {
        "velocity": "high",
        "pattern_deviation": 0.85
      }
    },
    "model_options": {
      "sensitivity": "high",
      "explain_prediction": true,
      "confidence_threshold": 0.95
    }
  }'`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-16 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Proven Financial Results</h2>
            <p className="text-gray-300 text-lg">Real impact on fraud detection and operational efficiency</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">99.2%</div>
              <div className="text-gray-300">Fraud Detection Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">85%</div>
              <div className="text-gray-300">Reduction in False Positives</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">60%</div>
              <div className="text-gray-300">Faster Threat Detection</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">$2.8M</div>
              <div className="text-gray-300">Average Annual Savings</div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Financial Services Use Cases</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Fraud Detection</h3>
              <p className="text-gray-300 mb-4">Real-time identification of fraudulent transactions across credit cards, wire transfers, and digital payments with minimal false positives.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Card-not-present fraud</li>
                <li>• Account takeover detection</li>
                <li>• Synthetic identity fraud</li>
                <li>• Wire transfer anomalies</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Risk Assessment</h3>
              <p className="text-gray-300 mb-4">Advanced credit risk modeling and loan default prediction using alternative data sources and behavioral patterns.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Credit default prediction</li>
                <li>• Portfolio risk analysis</li>
                <li>• Behavioral scoring</li>
                <li>• Early warning systems</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Compliance Monitoring</h3>
              <p className="text-gray-300 mb-4">Automated detection of suspicious activities for AML/KYC compliance with regulatory-grade audit trails and explainability.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Anti-money laundering</li>
                <li>• Suspicious activity reports</li>
                <li>• Regulatory compliance</li>
                <li>• Customer due diligence</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#1A5799]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">Ready to Transform Your Financial Risk Detection?</h2>
          <p className="text-xl mb-8 text-blue-100">Join leading financial institutions using Schlep Engine to protect against fraud</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white text-[#1A5799] px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
              Start Free Trial
            </Link>
            <Link href="/contact" className="border border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-[#1A5799] transition-colors font-semibold">
              Contact Sales
            </Link>
          </div>
          <p className="text-sm text-blue-200 mt-4">No credit card required • 14-day free trial • Enterprise security</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-[#1A5799] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SE</span>
              </div>
              <span className="text-xl font-semibold text-white">Schlep Engine</span>
            </div>
            <div className="flex space-x-6 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/support" className="hover:text-white transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}