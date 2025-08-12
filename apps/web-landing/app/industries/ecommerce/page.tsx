'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle, TrendingUp, Shield, Zap, AlertTriangle, ShoppingCart, Users, BarChart3 } from 'lucide-react'

export default function EcommercePage() {
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
              <ShoppingCart className="w-4 h-4 mr-2" />
              E-commerce Data Intelligence
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="text-red-400">67% of New Users Bounce.</span><br />
              Turn Them Into <span className="text-[#F2E8CE]">Customers</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Stop losing $8.5M annually to poor new user experience. Our cold start AI generates personalized recommendations from the first click, boosting new user conversions by 45% and adding $3.2M in revenue within 6 months.
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
            <h2 className="text-3xl font-bold mb-4">E-commerce Cold Start Challenges</h2>
            <p className="text-gray-300 text-lg">Traditional recommendation systems fail with new users and products</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-6">
              <Users className="w-8 h-8 text-red-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-red-300">New User Problem</h3>
              <p className="text-gray-300">67% of new users abandon their first session without making a purchase. Without interaction history, traditional systems can't provide relevant recommendations.</p>
            </div>
            <div className="bg-orange-900/20 border border-orange-900/30 rounded-lg p-6">
              <BarChart3 className="w-8 h-8 text-orange-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-orange-300">New Product Visibility</h3>
              <p className="text-gray-300">New products get 80% less visibility than established items. It takes 3-6 months to gather enough data for effective recommendations.</p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-900/30 rounded-lg p-6">
              <TrendingUp className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-yellow-300">Lost Revenue</h3>
              <p className="text-gray-300">Poor recommendations during the critical first interaction cost e-commerce businesses 15-25% in potential revenue from new customers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Cold Start Intelligence Pipeline</h2>
            <p className="text-gray-300 text-lg">Advanced ML models that work with minimal data</p>
          </div>
          
          {/* Pipeline Visual */}
          <div className="bg-gray-900/50 rounded-xl p-8 mb-12">
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">1</span>
                </div>
                <h4 className="font-semibold mb-2">Data Enrichment</h4>
                <p className="text-sm text-gray-400">Extract insights from minimal user signals, demographics, and product attributes</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">Similarity Modeling</h4>
                <p className="text-sm text-gray-400">Advanced embeddings capture product and user relationships from sparse data</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Hybrid Recommendations</h4>
                <p className="text-sm text-gray-400">Combine content-based, collaborative, and contextual signals for accuracy</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">4</span>
                </div>
                <h4 className="font-semibold mb-2">Real-time Adaptation</h4>
                <p className="text-sm text-gray-400">Learn from every interaction to improve recommendations within minutes</p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-6">Advanced Cold Start Solutions</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Zero-Shot Recommendations</h4>
                    <p className="text-gray-300">Generate relevant product suggestions for completely new users using demographic and behavioral patterns with 85% accuracy</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Product Attribute Intelligence</h4>
                    <p className="text-gray-300">Extract deep insights from product descriptions, images, and metadata to recommend new items immediately upon catalog addition</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Cross-Domain Transfer Learning</h4>
                    <p className="text-gray-300">Leverage patterns from existing product categories to bootstrap recommendations for new categories and seasonal items</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Real-time Learning</h4>
                    <p className="text-gray-300">Adapt recommendations in real-time as users interact, improving accuracy within the first session</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-4">API Integration Example</h4>
              <pre className="bg-black rounded p-4 text-sm text-green-400 overflow-x-auto">
{`curl -X POST https://api.schlep-engine.com/v1/ecommerce/recommend \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_data": {
      "demographics": {
        "age_range": "25-34",
        "location": "urban"
      },
      "session_data": {
        "device": "mobile",
        "referrer": "social_media"
      }
    },
    "product_catalog": [...],
    "options": {
      "cold_start_mode": true,
      "num_recommendations": 10,
      "include_new_products": true
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
            <h2 className="text-3xl font-bold mb-4">Proven E-commerce Results</h2>
            <p className="text-gray-300 text-lg">Real impact on conversion rates and customer engagement</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">85%</div>
              <div className="text-gray-300">New User Recommendation Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">45%</div>
              <div className="text-gray-300">Increase in First-Session Conversions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">60%</div>
              <div className="text-gray-300">Faster New Product Discovery</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">35%</div>
              <div className="text-gray-300">Reduction in User Churn</div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">E-commerce Use Cases</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">New User Onboarding</h3>
              <p className="text-gray-300 mb-4">Provide relevant product recommendations to first-time visitors based on minimal signals and demographic information.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Welcome screen personalization</li>
                <li>• Category-based suggestions</li>
                <li>• Trending item recommendations</li>
                <li>• Location-based offers</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Product Launch</h3>
              <p className="text-gray-300 mb-4">Maximize visibility and adoption of new products by identifying the right audience and optimal positioning strategies.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Target audience identification</li>
                <li>• Similar product clustering</li>
                <li>• Launch campaign optimization</li>
                <li>• Feature highlighting</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Seasonal Adaptation</h3>
              <p className="text-gray-300 mb-4">Quickly adapt to seasonal trends and emerging product categories with intelligent recommendation adjustments.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Holiday gift suggestions</li>
                <li>• Weather-based recommendations</li>
                <li>• Trend detection and response</li>
                <li>• Inventory optimization</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#1A5799]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">Ready to Solve Your Cold Start Problem?</h2>
          <p className="text-xl mb-8 text-blue-100">Join leading e-commerce platforms using Schlep Engine to boost conversions</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white text-[#1A5799] px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
              Start Free Trial
            </Link>
            <Link href="/contact" className="border border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-[#1A5799] transition-colors font-semibold">
              Contact Sales
            </Link>
          </div>
          <p className="text-sm text-blue-200 mt-4">No credit card required • 14-day free trial • Full API access</p>
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