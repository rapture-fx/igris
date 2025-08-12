'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, TrendingUp, Factory, Clock, DollarSign, AlertTriangle, BarChart } from 'lucide-react'
import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'

export default function ManufacturingCaseStudyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <Link 
                href="/industries/manufacturing" 
                className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Manufacturing
              </Link>
              
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
                <Factory className="h-4 w-4 mr-2" />
                Manufacturing Case Study
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Industrial Pump Manufacturer Reduces Downtime by 40% with AI-Powered Sensor Data Cleaning
              </h1>
              
              <p className="text-xl text-gray-600 mb-8">
                How MegaPump Industries transformed noisy sensor data into actionable predictive maintenance insights, saving $2.3M annually in unplanned downtime costs.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <TrendingUp className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">40%</div>
                  <div className="text-gray-600">Reduction in Unplanned Downtime</div>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <DollarSign className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">$2.3M</div>
                  <div className="text-gray-600">Annual Cost Savings</div>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <Clock className="h-8 w-8 text-green-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-900 mb-1">85%</div>
                  <div className="text-gray-600">Faster Data Processing</div>
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
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">MegaPump Industries</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Global manufacturer of industrial pumps and compressors</li>
                    <li>• 15 manufacturing facilities across North America and Europe</li>
                    <li>• 5,000+ employees, $1.2B annual revenue</li>
                    <li>• Serves oil &amp; gas, chemical processing, and water treatment industries</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">The Challenge</h3>
                  <p className="text-gray-600">
                    MegaPump's manufacturing equipment generated 50TB of sensor data monthly, but 30% was corrupted by electromagnetic interference, calibration drift, and environmental noise. Their data science team spent 80% of their time cleaning data instead of building predictive models.
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
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Quality Crisis</h3>
                    <p className="text-gray-600 mb-4">
                      MegaPump's manufacturing floors were equipped with thousands of vibration, temperature, and pressure sensors monitoring critical equipment. However, the industrial environment created significant data quality issues:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 space-y-2">
                      <li>Electromagnetic interference from heavy machinery corrupted 15% of sensor readings</li>
                      <li>Sensor calibration drift caused gradual signal degradation over 3-6 month periods</li>
                      <li>Environmental factors (temperature fluctuations, humidity) introduced systematic noise</li>
                      <li>Network latency and packet loss created gaps in time-series data</li>
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
                          <li>Manual data cleaning: 120 hours/week</li>
                          <li>False alarm rate: 45%</li>
                          <li>Missed maintenance windows: 23%</li>
                          <li>Unplanned downtime: 156 hours/month</li>
                          <li>Data processing time: 8-12 hours</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Business Costs:</h4>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                          <li>$5.8M annual downtime costs</li>
                          <li>$800K in data science labor</li>
                          <li>$350K in manual inspection costs</li>
                          <li>Customer SLA penalties: $200K</li>
                          <li>Equipment replacement: $1.2M</li>
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
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Schlep Engine Manufacturing Pipeline</h3>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase 1: Data Integration (Week 1-2)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Connected 2,400 sensors across 3 facilities</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Established real-time data streaming pipeline</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Configured equipment metadata and maintenance schedules</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase 2: ML Pipeline Setup (Week 3-4)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Deployed advanced noise filtering algorithms</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Trained equipment-specific anomaly detection models</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Implemented predictive maintenance scoring</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Technical Architecture</h3>
                <div className="bg-gray-900 rounded-lg p-6 text-green-400 font-mono text-sm overflow-x-auto">
                  <pre>{`# Real-time sensor data processing pipeline
curl -X POST https://api.schlep-engine.com/v1/manufacturing/process \\
  -H "Authorization: Bearer megapump_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "facility_id": "facility_001",
    "sensor_data": {
      "vibration_sensors": [
        {"sensor_id": "VIB_001", "value": 2.34, "timestamp": "2024-01-15T10:30:00Z"},
        {"sensor_id": "VIB_002", "value": 1.87, "timestamp": "2024-01-15T10:30:01Z"}
      ],
      "temperature_sensors": [
        {"sensor_id": "TEMP_001", "value": 85.2, "timestamp": "2024-01-15T10:30:00Z"}
      ]
    },
    "processing_options": {
      "enable_noise_filtering": true,
      "anomaly_detection": true,
      "predictive_maintenance": true,
      "real_time_alerts": true
    }
  }'

# Response with cleaned data and predictions
{
  "status": "success",
  "processed_data": {
    "cleaned_sensors": [...],
    "anomaly_scores": {...},
    "maintenance_predictions": {
      "equipment_health": 0.87,
      "days_to_maintenance": 14,
      "confidence": 0.94
    }
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
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Operational Improvements</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Unplanned Downtime</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-40%</div>
                      <div className="text-sm text-gray-500">156h → 94h/month</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">False Alarm Rate</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-78%</div>
                      <div className="text-sm text-gray-500">45% → 10%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Data Processing Time</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-85%</div>
                      <div className="text-sm text-gray-500">8h → 1.2h</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Maintenance Prediction Accuracy</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">+65%</div>
                      <div className="text-sm text-gray-500">55% → 91%</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Financial Impact</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Annual Downtime Costs</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-$2.3M</div>
                      <div className="text-sm text-gray-500">$5.8M → $3.5M</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Data Science Labor</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-$640K</div>
                      <div className="text-sm text-gray-500">$800K → $160K</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Manual Inspection</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">-$273K</div>
                      <div className="text-sm text-gray-500">$350K → $77K</div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Total Annual Savings</span>
                      <div className="text-3xl font-bold text-green-600">$3.2M</div>
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
                  <div className="text-4xl font-bold text-blue-600 mb-2">18x</div>
                  <div className="text-gray-600">Return on Investment</div>
                  <div className="text-sm text-gray-500 mt-2">Within 12 months</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">2.1</div>
                  <div className="text-gray-600">Months to Break-even</div>
                  <div className="text-sm text-gray-500 mt-2">Including implementation</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">$180K</div>
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
                  <li>Executive sponsorship and clear success metrics from day one</li>
                  <li>Gradual rollout across facilities allowed for learning and optimization</li>
                  <li>Integration with existing CMMS and ERP systems reduced change management</li>
                  <li>Training maintenance teams on interpreting AI predictions improved adoption</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">Implementation Challenges</h3>
                <ul className="list-disc list-inside text-yellow-700 space-y-2">
                  <li>Initial resistance from maintenance teams who preferred manual inspections</li>
                  <li>Legacy sensor systems required additional integration work</li>
                  <li>Model training required 3 months of historical data for optimal performance</li>
                  <li>Network infrastructure upgrades needed to support real-time data streaming</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="py-16 bg-gray-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Manufacturing Operations?</h2>
            <p className="text-xl text-gray-300 mb-8">
              See how Schlep Engine can help you achieve similar results with AI-powered sensor data processing
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
              Talk to our manufacturing specialists about your specific use case
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}