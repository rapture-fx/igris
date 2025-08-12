'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, TrendingUp, DollarSign, Clock, Shield, AlertTriangle, BarChart, Eye } from 'lucide-react'
import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'

export default function FinancialCaseStudyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <Link 
                href="/industries/financial-services" 
                className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Financial Services
              </Link>
              
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
                <DollarSign className="h-4 w-4 mr-2" />
                Financial Services Case Study
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Regional Bank Achieves 99.2% Fraud Detection Accuracy While Reducing False Positives by 85%
              </h1>
              
              <p className="text-xl text-gray-600 mb-8">
                How FirstTrust Bank transformed their fraud detection system with AI-powered rare event modeling, preventing $12.8M in losses while dramatically improving customer experience.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <Shield className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">99.2%</div>
                  <div className="text-gray-600">Fraud Detection Accuracy</div>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <Eye className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">85%</div>
                  <div className="text-gray-600">Reduction in False Positives</div>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <DollarSign className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">$12.8M</div>
                  <div className="text-gray-600">Fraud Losses Prevented</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Company Overview */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Company Overview</h2>
            
            <div className="bg-gray-50 rounded-xl p-8 mb-12">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">FirstTrust Bank</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Regional community bank serving mid-Atlantic states</li>
                    <li>• $8.5B in assets, 450,000 customers</li>
                    <li>• 85 branches across 4 states</li>
                    <li>• Focus on retail banking and small business lending</li>
                    <li>• 2.8M monthly digital transactions</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">The Challenge</h3>
                  <p className="text-gray-600">
                    FirstTrust's legacy fraud detection system generated 95% false positives, requiring manual review of 15,000+ legitimate transactions daily. With fraud representing only 0.08% of transactions, traditional models struggled with the extreme class imbalance, missing sophisticated attacks while overwhelming staff with false alarms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Statement */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">The Problem</h2>
            
            <div className="space-y-8">
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <div className="flex items-start space-x-4">
                  <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Extreme Data Imbalance</h3>
                    <p className="text-gray-600 mb-4">
                      FirstTrust processed 2.8 million monthly transactions, but only 2,240 were fraudulent (0.08%). This extreme imbalance created several critical issues:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 space-y-2">
                      <li>Traditional ML models favored the majority class, missing rare fraud patterns</li>
                      <li>Rule-based systems generated excessive false positives to catch edge cases</li>
                      <li>New fraud techniques went undetected until patterns emerged months later</li>
                      <li>Customer experience degraded due to legitimate transaction blocks</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-8 shadow-sm">
                <div className="flex items-start space-x-4">
                  <BarChart className="h-8 w-8 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Operational Impact</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Before Schlep Engine:</h4>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                          <li>False positive rate: 95%</li>
                          <li>Manual reviews: 15,000+ daily</li>
                          <li>Fraud detection accuracy: 76%</li>
                          <li>Average investigation time: 45 minutes</li>
                          <li>Customer complaint rate: 12%</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Financial Costs:</h4>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                          <li>Annual fraud losses: $18.5M</li>
                          <li>Investigation labor costs: $2.8M</li>
                          <li>Customer service costs: $450K</li>
                          <li>Regulatory penalties: $380K</li>
                          <li>Lost customer revenue: $1.2M</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solution Implementation */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Solution Implementation</h2>
            
            <div className="space-y-8">
              <div className="bg-blue-50 rounded-xl p-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Schlep Engine Rare Event Detection Pipeline</h3>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase 1: Data Integration (Week 1-3)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Integrated 3 years of historical transaction data</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Connected real-time transaction streams</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Established secure API endpoints for fraud scoring</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase 2: Model Development (Week 4-6)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Implemented advanced sampling techniques for imbalanced data</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Trained ensemble models optimized for rare event detection</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Deployed explainable AI for regulatory compliance</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Technical Architecture</h3>
                <div className="bg-gray-900 rounded-lg p-6 text-green-400 font-mono text-sm overflow-x-auto">
                  <pre>{`# Real-time fraud detection API
curl -X POST https://api.schlep-engine.com/v1/financial/detect \\
  -H "Authorization: Bearer firsttrust_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction_id": "txn_2024_001_445566",
    "transaction_data": {
      "amount": 2500.00,
      "merchant": "electronics_store_unknown",
      "location": {
        "country": "US",
        "state": "CA",
        "distance_from_home": 2800
      },
      "timestamp": "2024-01-15T23:45:00Z",
      "payment_method": "card_not_present"
    },
    "customer_context": {
      "customer_id": "cust_98765",
      "account_age_days": 1250,
      "avg_monthly_spending": 850.00,
      "recent_activity": {
        "transactions_last_24h": 1,
        "velocity_score": 0.95,
        "location_pattern_deviation": 0.87
      }
    },
    "model_options": {
      "sensitivity": "high",
      "explain_prediction": true,
      "confidence_threshold": 0.85,
      "regulatory_mode": true
    }
  }'

# Response with fraud assessment
{
  "status": "success",
  "fraud_assessment": {
    "fraud_probability": 0.94,
    "risk_level": "high",
    "confidence": 0.91,
    "recommended_action": "block_and_review"
  },
  "explanation": {
    "primary_factors": [
      "Unusual location (2800 miles from home)",
      "High velocity score (0.95)",
      "Late night transaction time",
      "Card-not-present for high amount"
    ],
    "risk_breakdown": {
      "location_risk": 0.88,
      "velocity_risk": 0.92,
      "amount_risk": 0.76,
      "merchant_risk": 0.45
    }
  },
  "regulatory_audit": {
    "model_version": "v2.1.3",
    "features_used": [...],
    "decision_path": "ensemble_majority_vote"
  }
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Results & Impact</h2>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Detection Performance</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Fraud Detection Accuracy</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">+23.2%</div>
                      <div className="text-sm text-gray-500">76% → 99.2%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">False Positive Rate</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-85%</div>
                      <div className="text-sm text-gray-500">95% → 14%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Manual Reviews per Day</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-87%</div>
                      <div className="text-sm text-gray-500">15,000 → 1,950</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Detection Speed</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">&lt;200ms</div>
                      <div className="text-sm text-gray-500">Real-time processing</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Financial Impact</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Annual Fraud Losses</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-$12.8M</div>
                      <div className="text-sm text-gray-500">$18.5M → $5.7M</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Investigation Labor Costs</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-$2.4M</div>
                      <div className="text-sm text-gray-500">$2.8M → $400K</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Customer Service Costs</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-$382K</div>
                      <div className="text-sm text-gray-500">$450K → $68K</div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Total Annual Savings</span>
                      <div className="text-3xl font-bold text-green-600">$15.6M</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROI Calculation */}
            <div className="bg-blue-50 rounded-xl p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">ROI Analysis</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">26x</div>
                  <div className="text-gray-600">Return on Investment</div>
                  <div className="text-sm text-gray-500 mt-2">Within 12 months</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">1.4</div>
                  <div className="text-gray-600">Months to Break-even</div>
                  <div className="text-sm text-gray-500 mt-2">Including implementation</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">$600K</div>
                  <div className="text-gray-600">Total Implementation Cost</div>
                  <div className="text-sm text-gray-500 mt-2">Setup + first year subscription</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Learnings */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Key Learnings & Best Practices</h2>
            
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-800 mb-3">Success Factors</h3>
                <ul className="list-disc list-inside text-green-700 space-y-2">
                  <li>Gradual rollout with parallel systems built confidence among fraud analysts</li>
                  <li>Explainable AI features satisfied regulatory requirements and analyst training</li>
                  <li>Real-time processing enabled immediate transaction blocking without delays</li>
                  <li>Continuous model retraining adapted to evolving fraud patterns within weeks</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">Implementation Challenges</h3>
                <ul className="list-disc list-inside text-yellow-700 space-y-2">
                  <li>Initial model calibration required 6 weeks of fine-tuning for optimal precision/recall balance</li>
                  <li>Legacy system integration needed custom middleware for seamless data flow</li>
                  <li>Regulatory approval process took 3 months longer than anticipated</li>
                  <li>Staff training on new investigation workflows required comprehensive change management</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Regulatory Compliance</h3>
                <ul className="list-disc list-inside text-blue-700 space-y-2">
                  <li>Model explainability features provided clear audit trails for regulatory reviews</li>
                  <li>Automated documentation generation streamlined compliance reporting</li>
                  <li>A/B testing framework ensured fair lending and non-discriminatory practices</li>
                  <li>Real-time monitoring dashboards provided transparency into model performance</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="py-16 bg-gray-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Fraud Detection?</h2>
            <p className="text-xl text-gray-300 mb-8">
              See how Schlep Engine can help you achieve similar results with advanced rare event detection
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/signup" 
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Start Free Trial
              </Link>
              <Link 
                href="/contact" 
                className="border border-gray-600 text-white px-8 py-3 rounded-lg hover:border-gray-500 transition-colors font-semibold"
              >
                Schedule Demo
              </Link>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Talk to our financial services specialists about your specific use case
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}