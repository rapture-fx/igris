'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, TrendingUp, ShoppingCart, Clock, DollarSign, AlertTriangle, BarChart, Zap, Users } from 'lucide-react'
import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'

export default function SeasonalScalingCaseStudyPage() {
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
                <Zap className="h-4 w-4 mr-2" />
                Seasonal Scaling Case Study
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                MegaMart Handles 15x Black Friday Traffic with Zero Downtime Using Auto-Scaling ML Recommendations
              </h1>
              
              <p className="text-xl text-gray-600 mb-8">
                How America's 3rd largest online retailer processed 47 million recommendation requests during peak shopping without a single system failure, generating $89M in Black Friday sales with 42% higher conversion rates.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <Zap className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">15x</div>
                  <div className="text-gray-600">Traffic Scaling Without Failure</div>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <DollarSign className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">$89M</div>
                  <div className="text-gray-600">Black Friday Sales Revenue</div>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <TrendingUp className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">42%</div>
                  <div className="text-gray-600">Higher Peak Conversion Rate</div>
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
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">MegaMart E-commerce</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• America's 3rd largest online general merchandise retailer</li>
                    <li>• 2.8M SKUs across electronics, home, fashion, and grocery</li>
                    <li>• $4.2B annual revenue, 18M active customers</li>
                    <li>• 75% of annual revenue generated during Q4 shopping season</li>
                    <li>• Black Friday: 15x normal traffic, 600% revenue spike</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">The Challenge</h3>
                  <p className="text-gray-600">
                    MegaMart's recommendation system collapsed during previous Black Friday, losing $34M in sales due to 3-hour downtime. Their infrastructure couldn't handle the 15x traffic spike, and manual scaling took too long to prevent customer abandonment during peak shopping hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Crisis Section */}
        <section className="py-16 bg-red-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">The $34M Black Friday Disaster</h2>
              <p className="text-xl text-gray-600">November 2023: When peak traffic brought down their entire recommendation engine</p>
            </div>
            
            <div className="space-y-8">
              <div className="bg-white rounded-lg p-8 shadow-sm border-l-4 border-red-500">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Timeline of Failure</h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 text-sm font-medium text-red-600">6:00 AM</div>
                    <div>
                      <div className="font-medium text-gray-900">Traffic begins spiking (3x normal)</div>
                      <div className="text-gray-600">Recommendation response times increase to 2.4 seconds</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-16 text-sm font-medium text-red-600">8:15 AM</div>
                    <div>
                      <div className="font-medium text-gray-900">System overload (8x normal traffic)</div>
                      <div className="text-gray-600">Database connections maxed out, recommendation engine failing</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-16 text-sm font-medium text-red-600">9:30 AM</div>
                    <div>
                      <div className="font-medium text-gray-900">Complete system failure (15x traffic)</div>
                      <div className="text-gray-600">Recommendation API returning 503 errors, customers seeing blank product grids</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-16 text-sm font-medium text-red-600">12:30 PM</div>
                    <div>
                      <div className="font-medium text-gray-900">Emergency manual scaling attempt</div>
                      <div className="text-gray-600">DevOps team manually spinning up servers, but damage already done</div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 bg-red-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-red-800 mb-4">Business Impact</h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <ul className="space-y-2 text-red-700">
                        <li>• $34M in lost sales during 3-hour outage</li>
                        <li>• 67% customer bounce rate during peak hours</li>
                        <li>• 847,000 abandoned shopping carts</li>
                        <li>• 23% drop in customer satisfaction scores</li>
                      </ul>
                    </div>
                    <div>
                      <ul className="space-y-2 text-red-700">
                        <li>• Emergency infrastructure costs: $2.8M</li>
                        <li>• Customer service overflow: $450K</li>
                        <li>• Brand reputation damage</li>
                        <li>• Competitive advantage lost to Amazon</li>
                      </ul>
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
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Schlep Engine Auto-Scaling Solution</h2>
            
            <div className="space-y-8">
              <div className="bg-blue-50 rounded-xl p-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Intelligent Auto-Scaling Architecture</h3>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase 1: Predictive Scaling (July-August)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Analyzed 3 years of seasonal traffic patterns</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Implemented predictive scaling algorithms</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Set up multi-region failover infrastructure</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase 2: Real-Time Adaptation (September)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Real-time traffic monitoring and auto-scaling</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Elastic recommendation model deployment</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Intelligent caching and edge distribution</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Auto-Scaling API Architecture</h3>
                <div className="bg-gray-900 rounded-lg p-6 text-green-400 font-mono text-sm overflow-x-auto">
                  <pre>{`# Predictive scaling configuration
curl -X POST https://api.schlep-engine.com/v1/scaling/configure \\
  -H "Authorization: Bearer megamart_api_key" \\
  -d '{
    "scaling_policy": {
      "predictive_enabled": true,
      "traffic_forecast_days": 7,
      "scale_up_threshold": "75%",
      "scale_down_threshold": "25%",
      "min_instances": 5,
      "max_instances": 500,
      "target_response_time": "150ms"
    },
    "seasonal_patterns": {
      "black_friday_multiplier": 15,
      "cyber_monday_multiplier": 12,
      "christmas_week_multiplier": 8
    }
  }'

# Real-time scaling metrics
{
  "current_load": "847%",
  "instances_active": 347,
  "avg_response_time": "127ms",
  "recommendations_per_second": 24567,
  "scaling_action": "up",
  "next_scale_prediction": "2024-11-29T10:15:00Z"
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Black Friday Success */}
        <section className="py-16 bg-green-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Black Friday 2024: Complete Success</h2>
              <p className="text-xl text-gray-600">47 million recommendation requests processed flawlessly</p>
            </div>
            
            <div className="bg-white rounded-lg p-8 shadow-sm border-l-4 border-green-500 mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Perfect Performance Timeline</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-16 text-sm font-medium text-green-600">5:45 AM</div>
                  <div>
                    <div className="font-medium text-gray-900">Predictive scaling activated</div>
                    <div className="text-gray-600">System pre-scaled to 45 instances before traffic spike</div>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-16 text-sm font-medium text-green-600">8:30 AM</div>
                  <div>
                    <div className="font-medium text-gray-900">Peak traffic handled seamlessly</div>
                    <div className="text-gray-600">15x traffic processed with 127ms avg response time</div>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-16 text-sm font-medium text-green-600">12:00 PM</div>
                  <div>
                    <div className="font-medium text-gray-900">Record recommendation accuracy</div>
                    <div className="text-gray-600">89% click-through rate on personalized recommendations</div>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-16 text-sm font-medium text-green-600">11:59 PM</div>
                  <div>
                    <div className="font-medium text-gray-900">Perfect 24-hour uptime</div>
                    <div className="text-gray-600">Zero downtime, zero errors, $89M in sales</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Technical Performance</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Peak Concurrent Requests</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">47M</div>
                      <div className="text-sm text-gray-500">Per hour at peak</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Average Response Time</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">127ms</div>
                      <div className="text-sm text-gray-500">Under 150ms target</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">System Uptime</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">100%</div>
                      <div className="text-sm text-gray-500">Zero downtime</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Auto-Scale Events</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">147</div>
                      <div className="text-sm text-gray-500">Seamless adjustments</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Business Results</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Black Friday Revenue</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">$89M</div>
                      <div className="text-sm text-gray-500">+34% vs 2023</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Conversion Rate</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">8.9%</div>
                      <div className="text-sm text-gray-500">+42% vs previous year</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Customer Satisfaction</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">94%</div>
                      <div className="text-sm text-gray-500">Record high score</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Infrastructure Cost</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-67%</div>
                      <div className="text-sm text-gray-500">vs manual scaling</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROI Analysis */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">ROI Analysis</h2>
            
            <div className="bg-blue-50 rounded-xl p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Investment vs. Returns</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">$850K</div>
                  <div className="text-gray-600">Schlep Engine Implementation</div>
                  <div className="text-sm text-gray-500 mt-2">Setup + first year subscription</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">$156M</div>
                  <div className="text-gray-600">Holiday Season Revenue</div>
                  <div className="text-sm text-gray-500 mt-2">Black Friday + Cyber Monday + Christmas</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">183x</div>
                  <div className="text-gray-600">Return on Investment</div>
                  <div className="text-sm text-gray-500 mt-2">In first holiday season alone</div>
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-blue-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Cost Avoidance</h4>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <ul className="space-y-2 text-gray-700">
                      <li>• Prevented $34M+ in lost sales</li>
                      <li>• Avoided $2.8M emergency infrastructure costs</li>
                      <li>• Eliminated $450K customer service overflow</li>
                    </ul>
                  </div>
                  <div>
                    <ul className="space-y-2 text-gray-700">
                      <li>• Reduced infrastructure costs by 67%</li>
                      <li>• Eliminated need for 24/7 manual monitoring</li>
                      <li>• Prevented brand reputation damage</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Learnings */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Implementation Best Practices</h2>
            
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-800 mb-3">Critical Success Factors</h3>
                <ul className="list-disc list-inside text-green-700 space-y-2">
                  <li>Start seasonal scaling preparation 4+ months before peak season</li>
                  <li>Use historical data to train predictive scaling algorithms</li>
                  <li>Set conservative response time targets (under 150ms for recommendations)</li>
                  <li>Implement multi-region failover for true high availability</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Technical Recommendations</h3>
                <ul className="list-disc list-inside text-blue-700 space-y-2">
                  <li>Configure auto-scaling to pre-scale 30 minutes before predicted traffic spikes</li>
                  <li>Use intelligent caching to reduce recommendation computation load by 60%</li>
                  <li>Implement graceful degradation for extreme traffic scenarios</li>
                  <li>Monitor recommendation accuracy during scaling events</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gray-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Don't Let Peak Season Break Your Business</h2>
            <p className="text-xl text-gray-300 mb-8">
              Holiday shopping season generates 40-60% of annual e-commerce revenue. One outage can cost millions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/signup" 
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Prepare for Next Season
              </Link>
              <Link 
                href="/contact" 
                className="border border-gray-600 text-white px-8 py-3 rounded-lg hover:border-gray-500 transition-colors font-semibold"
              >
                Emergency Scaling Consultation
              </Link>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Implementation takes 8-12 weeks. Start planning now for next holiday season.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}