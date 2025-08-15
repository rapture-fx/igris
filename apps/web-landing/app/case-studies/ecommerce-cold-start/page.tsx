'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, TrendingUp, ShoppingCart, Clock, DollarSign, AlertTriangle, BarChart, Users } from 'lucide-react'
import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'

export default function EcommerceCaseStudyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <Link 
                href="/industries/ecommerce" 
                className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to E-commerce
              </Link>
              
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
                <ShoppingCart className="h-4 w-4 mr-2" />
                E-commerce Case Study
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Fashion Retailer Increases New User Conversions by 45% with AI-Powered Cold Start Recommendations
              </h1>
              
              <p className="text-xl text-gray-600 mb-8">
                How StyleForward transformed their new user experience with intelligent recommendations, generating $3.2M in additional revenue from first-time visitors in just 6 months.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <TrendingUp className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">45%</div>
                  <div className="text-gray-600">Increase in New User Conversions</div>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <DollarSign className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">$3.2M</div>
                  <div className="text-gray-600">Additional Revenue (6 months)</div>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <Users className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">35%</div>
                  <div className="text-gray-600">Reduction in Bounce Rate</div>
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
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">StyleForward</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Mid-market fashion e-commerce platform</li>
                    <li>• 50,000+ SKUs across women's, men's, and accessories</li>
                    <li>• $85M annual revenue, 2.3M registered users</li>
                    <li>• Primary audience: fashion-conscious millennials and Gen Z</li>
                    <li>• 60% of traffic from mobile devices</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">The Challenge</h3>
                  <p className="text-gray-600">
                    StyleForward's rapid growth meant 40% of their daily traffic came from new users with no purchase history. Their legacy recommendation system showed generic "trending" items, resulting in a 67% bounce rate for first-time visitors and missed revenue opportunities worth millions annually.
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
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">The Cold Start Problem</h3>
                    <p className="text-gray-600 mb-4">
                      StyleForward's recommendation engine relied heavily on collaborative filtering, which required extensive user interaction history. For new users, this created several critical issues:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 space-y-2">
                      <li>New users saw only generic "best sellers" and "trending" products</li>
                      <li>Recommendations lacked personalization, leading to poor engagement</li>
                      <li>New product launches received minimal visibility to fresh audiences</li>
                      <li>Seasonal and trend-driven items struggled to gain initial traction</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-8 shadow-sm">
                <div className="flex items-start space-x-4">
                  <BarChart className="h-8 w-8 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Business Impact</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Before Schlep Engine:</h4>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                          <li>New user bounce rate: 67%</li>
                          <li>First-session conversion: 1.2%</li>
                          <li>Average session duration: 45 seconds</li>
                          <li>New product discovery: 3-4 weeks</li>
                          <li>Recommendation click-through: 2.1%</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Revenue Impact:</h4>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                          <li>Lost new user revenue: $8.5M annually</li>
                          <li>Poor product launch performance</li>
                          <li>Reduced lifetime customer value</li>
                          <li>High customer acquisition costs</li>
                          <li>Inventory imbalance issues</li>
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
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Schlep Engine Cold Start Pipeline</h3>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase 1: Data Integration (Week 1-2)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Connected product catalog with 50K+ items</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Integrated user behavior tracking and demographics</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Set up real-time recommendation API endpoints</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase 2: ML Model Training (Week 3-4)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Trained content-based recommendation models</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Implemented demographic and behavioral segmentation</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Developed hybrid recommendation algorithms</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Technical Implementation</h3>
                <div className="bg-gray-900 rounded-lg p-6 text-green-400 font-mono text-sm overflow-x-auto">
                  <pre>{`# Real-time cold start recommendation API
curl -X POST https://api.schlep-engine.com/v1/ecommerce/recommend \\
  -H "Authorization: Bearer styleforward_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_data": {
      "is_new_user": true,
      "demographics": {
        "age_range": "25-34",
        "gender": "female",
        "location": "urban_west_coast"
      },
      "session_data": {
        "device": "mobile",
        "referrer": "instagram",
        "time_of_day": "evening",
        "season": "fall"
      },
      "implicit_signals": {
        "browsed_categories": ["dresses", "accessories"],
        "time_spent_on_category": 45
      }
    },
    "catalog_context": {
      "new_arrivals": true,
      "seasonal_items": true,
      "trending_items": true
    },
    "options": {
      "num_recommendations": 12,
      "include_new_products": true,
      "diversity_factor": 0.7,
      "explanation": true
    }
  }'

# Response with personalized recommendations
{
  "status": "success",
  "recommendations": [
    {
      "product_id": "dress_autumn_001",
      "score": 0.92,
      "reason": "Popular fall dress for your age group",
      "category": "dresses",
      "is_new_arrival": true
    },
    {
      "product_id": "necklace_minimal_003", 
      "score": 0.87,
      "reason": "Trending accessory in your area",
      "category": "accessories",
      "social_proof": "loved_by_similar_users"
    }
  ],
  "user_segment": "fashion_forward_millennial",
  "confidence": 0.89
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
                <h3 className="text-xl font-semibold text-gray-900 mb-6">User Experience Improvements</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">New User Bounce Rate</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-35%</div>
                      <div className="text-sm text-gray-500">67% → 43%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">First-Session Conversion</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">+45%</div>
                      <div className="text-sm text-gray-500">1.2% → 1.74%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Session Duration</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">+180%</div>
                      <div className="text-sm text-gray-500">45s → 2m 6s</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Recommendation CTR</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">+285%</div>
                      <div className="text-sm text-gray-500">2.1% → 8.1%</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Business Impact</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">New User Revenue (6 months)</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">+$3.2M</div>
                      <div className="text-sm text-gray-500">$2.1M → $5.3M</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">New Product Discovery Time</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-60%</div>
                      <div className="text-sm text-gray-500">3-4 weeks → 1-2 weeks</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Customer Acquisition Cost</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-25%</div>
                      <div className="text-sm text-gray-500">$47 → $35</div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Total Revenue Impact</span>
                      <div className="text-3xl font-bold text-green-600">$3.8M</div>
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
                  <div className="text-4xl font-bold text-blue-600 mb-2">12x</div>
                  <div className="text-gray-600">Return on Investment</div>
                  <div className="text-sm text-gray-500 mt-2">Within 6 months</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">1.8</div>
                  <div className="text-gray-600">Months to Break-even</div>
                  <div className="text-sm text-gray-500 mt-2">Including setup costs</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">$320K</div>
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
                  <li>A/B testing different recommendation strategies showed clear performance improvements</li>
                  <li>Mobile-first approach was crucial as 60% of new users came from mobile devices</li>
                  <li>Real-time personalization created immediate engagement with new visitors</li>
                  <li>Seasonal and trend-based recommendations resonated strongly with target demographic</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">Implementation Challenges</h3>
                <ul className="list-disc list-inside text-yellow-700 space-y-2">
                  <li>Initial recommendation accuracy required 2-3 weeks of optimization</li>
                  <li>Product catalog enrichment needed additional manual curation</li>
                  <li>Balancing diversity vs. relevance in recommendations required fine-tuning</li>
                  <li>Integration with existing e-commerce platform required custom API development</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="py-16 bg-gray-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Solve Your Cold Start Problem?</h2>
            <p className="text-xl text-gray-300 mb-8">
              See how Schlep Engine can help you convert more new users with intelligent recommendations
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
              Talk to our e-commerce specialists about your specific use case
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}