'use client'

import React from 'react'
import Link from 'next/link'
import { Users, ShoppingCart, TrendingUp, AlertTriangle, CheckCircle, Clock, DollarSign, Zap } from 'lucide-react'

export default function ColdStartPage() {
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
              <AlertTriangle className="w-4 h-4 mr-2" />
              CRITICAL: New User Revenue Loss
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="text-red-400">67% Bounce Rate</span> is Killing Your
              <br />
              <span className="text-[#F2E8CE]">E-commerce Growth</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Every new user that bounces costs you $127 in lifetime value. With 40% of your traffic being new users, you're hemorrhaging millions in potential revenue. Our cold start AI fixes this in real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                Fix Your Bounce Rate Now
              </Link>
              <Link href="/case-studies/ecommerce-cold-start" className="border border-gray-600 text-white px-8 py-3 rounded-lg hover:border-gray-500 transition-colors font-semibold">
                See $3.2M Revenue Case Study
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Urgency */}
      <section className="py-16 bg-red-900/10 border-y border-red-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Users className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4 text-red-300">Your Recommendation System is Broken</h2>
            <p className="text-xl text-gray-300">Generic "trending" and "best sellers" don't convert. Here's what you're losing every day:</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <div className="text-4xl font-bold text-red-400 mb-2">67%</div>
              <div className="text-gray-300">New User Bounce Rate</div>
              <div className="text-sm text-gray-400 mt-2">Leave within 45 seconds</div>
            </div>
            <div className="text-center bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <div className="text-4xl font-bold text-red-400 mb-2">1.2%</div>
              <div className="text-gray-300">First Session Conversion</div>
              <div className="text-sm text-gray-400 mt-2">Abysmal first impression</div>
            </div>
            <div className="text-center bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <div className="text-4xl font-bold text-red-400 mb-2">3-4</div>
              <div className="text-gray-300">Weeks to Product Discovery</div>
              <div className="text-sm text-gray-400 mt-2">New products get buried</div>
            </div>
            <div className="text-center bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <div className="text-4xl font-bold text-red-400 mb-2">$8.5M</div>
              <div className="text-gray-300">Annual Lost Revenue</div>
              <div className="text-sm text-gray-400 mt-2">From poor new user experience</div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">The Only AI Built for Cold Start Problems</h2>
            <p className="text-gray-300 text-lg">While others require weeks of data, we personalize from the first click</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-2xl font-bold mb-6">Zero-Shot Recommendations</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Zap className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Instant Personalization</h4>
                    <p className="text-gray-300">Generate personalized recommendations from demographics, device, referrer, and first 10 seconds of behavior</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <TrendingUp className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">85% Accuracy Without History</h4>
                    <p className="text-gray-300">Our models predict preferences using product attributes, seasonality, and behavioral patterns from similar users</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Clock className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Real-time Learning</h4>
                    <p className="text-gray-300">Every click, hover, and scroll improves recommendations within the same session</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-4">Cold Start API Call</h4>
              <pre className="bg-black rounded p-4 text-sm text-green-400 overflow-x-auto">
{`POST /v1/ecommerce/cold-start-recommend
{
  "user_signals": {
    "device": "mobile",
    "referrer": "instagram", 
    "location": "urban_west_coast",
    "age_range": "25-34"
  },
  "session_behavior": {
    "landing_category": "dresses",
    "time_spent": 12,
    "scroll_depth": 0.6
  },
  "recommendations": [
    {
      "product": "fall_midi_dress",
      "confidence": 0.89,
      "reason": "trending_in_location"
    }
  ]
}`}
              </pre>
            </div>
          </div>

          {/* Competitive Advantage */}
          <div className="bg-gray-900/50 rounded-xl p-8">
            <h3 className="text-2xl font-bold mb-8 text-center">Cold Start Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-4 px-6">Scenario</th>
                    <th className="text-center py-4 px-6 text-green-400">Schlep Engine</th>
                    <th className="text-center py-4 px-6 text-gray-400">Traditional Collaborative Filtering</th>
                    <th className="text-center py-4 px-6 text-gray-400">Content-Based Only</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr>
                    <td className="py-4 px-6 font-medium">Brand New User (0 history)</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ 85% accuracy</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ Generic trending only</td>
                    <td className="py-4 px-6 text-center text-yellow-400">△ 45% accuracy</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium">New Product Launch</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Immediate visibility</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ 3-4 weeks to appear</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Based on attributes</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium">Seasonal Adaptation</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Context-aware</td>
                    <td className="py-4 px-6 text-center text-yellow-400">△ Slow to adapt</td>
                    <td className="py-4 px-6 text-center text-yellow-400">△ Manual tagging</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium">Mobile Optimization</td>
                    <td className="py-4 px-6 text-center text-green-400">✓ Device-specific models</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ Same for all devices</td>
                    <td className="py-4 px-6 text-center text-red-400">✗ No device awareness</td>
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
            <h2 className="text-3xl font-bold mb-4">StyleForward Results: $3.8M Revenue Impact</h2>
            <p className="text-gray-300 text-lg">Fashion retailer case study - 6 months after implementation</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">45%</div>
              <div className="text-gray-300">New User Conversion Increase</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">35%</div>
              <div className="text-gray-300">Bounce Rate Reduction</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">285%</div>
              <div className="text-gray-300">Recommendation CTR Improvement</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">12x</div>
              <div className="text-gray-300">ROI in 6 Months</div>
            </div>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Perfect for High-Growth E-commerce</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Fashion & Apparel</h3>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Seasonal trend adaptation</li>
                <li>• Style preference prediction</li>
                <li>• Size and fit recommendations</li>
                <li>• Social media referrer optimization</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Electronics & Tech</h3>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Product specification matching</li>
                <li>• Compatibility recommendations</li>
                <li>• Price sensitivity modeling</li>
                <li>• Technical feature preferences</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Home & Lifestyle</h3>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Aesthetic style matching</li>
                <li>• Room and space optimization</li>
                <li>• Lifestyle-based bundling</li>
                <li>• Seasonal décor trends</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-900/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ShoppingCart className="w-16 h-16 text-blue-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4 text-white">Every Bounced User Costs You $127</h2>
          <p className="text-xl mb-8 text-gray-300">
            Stop the revenue bleeding. Transform new users into customers from their very first click.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
              Fix Your Cold Start Problem Now
            </Link>
            <Link href="/contact" className="border border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-blue-600 transition-colors font-semibold">
              Schedule Revenue Assessment
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-4">Setup in 1-2 weeks • Mobile-optimized • Real-time API</p>
        </div>
      </section>
    </div>
  )
}