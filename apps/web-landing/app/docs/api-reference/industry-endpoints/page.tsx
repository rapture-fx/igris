'use client'

import React from 'react'
import Link from 'next/link'
import { Code, BookOpen, Shield, ShoppingCart, Factory, CreditCard, ArrowRight } from 'lucide-react'

export default function IndustryEndpointsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/docs/api-reference" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to API Reference
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Industry-Specific Endpoints</h1>
          <p className="text-xl text-gray-600">
            Specialized API endpoints optimized for specific industry use cases and data patterns.
          </p>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
          <p className="text-gray-600 mb-6">
            Schlep Engine provides industry-specific endpoints that are pre-configured with domain knowledge, 
            specialized algorithms, and optimized parameters for common industry challenges. These endpoints 
            reduce implementation time and improve performance for specific use cases.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Key Benefits</h3>
            <ul className="list-disc list-inside text-blue-800 space-y-2">
              <li>Pre-configured algorithms optimized for industry-specific data patterns</li>
              <li>Domain-specific feature engineering and validation rules</li>
              <li>Industry compliance and security standards built-in</li>
              <li>Faster time-to-production with minimal configuration</li>
            </ul>
          </div>
        </section>

        {/* Industry Endpoints */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Available Industry Endpoints</h2>
          
          <div className="grid gap-8">
            {/* E-commerce */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <ShoppingCart className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">E-commerce Endpoints</h3>
                  <p className="text-gray-600 mb-4">
                    Specialized endpoints for recommendation systems, customer segmentation, and cold start problems.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/ecommerce/cold-start-recommend
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Generate recommendations for new users with minimal interaction data</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/ecommerce/customer-segment
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Segment customers based on behavior and purchase patterns</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/ecommerce/product-similarity
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Find similar products for cross-sell and upsell opportunities</p>
                    </div>
                  </div>
                  
                  <Link href="#ecommerce-details" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium mt-4">
                    View detailed documentation <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Financial Services */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <CreditCard className="h-8 w-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Financial Services Endpoints</h3>
                  <p className="text-gray-600 mb-4">
                    Advanced fraud detection, risk assessment, and regulatory compliance endpoints.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/financial/fraud-detection
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Real-time fraud scoring with rare event detection</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/financial/risk-assessment
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Credit risk scoring and default probability estimation</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/financial/aml-screening
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Anti-money laundering transaction analysis</p>
                    </div>
                  </div>
                  
                  <Link href="#financial-details" className="inline-flex items-center text-green-600 hover:text-green-700 font-medium mt-4">
                    View detailed documentation <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Manufacturing */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Factory className="h-8 w-8 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Manufacturing Endpoints</h3>
                  <p className="text-gray-600 mb-4">
                    Sensor data processing, predictive maintenance, and quality control endpoints.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/manufacturing/sensor-process
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Clean and process industrial sensor data streams</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/manufacturing/predictive-maintenance
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Predict equipment failures and maintenance needs</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm font-mono text-gray-800">
                        POST /v1/manufacturing/quality-control
                      </code>
                      <p className="text-sm text-gray-600 mt-1">Real-time quality monitoring and anomaly detection</p>
                    </div>
                  </div>
                  
                  <Link href="#manufacturing-details" className="inline-flex items-center text-orange-600 hover:text-orange-700 font-medium mt-4">
                    View detailed documentation <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* E-commerce Detailed Documentation */}
        <section id="ecommerce-details" className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">E-commerce Endpoints</h2>
          
          {/* Cold Start Recommendations */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Cold Start Recommendations</h3>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                  POST
                </span>
                <code className="text-lg font-mono text-gray-800">/v1/ecommerce/cold-start-recommend</code>
              </div>
              
              <p className="text-gray-600 mb-4">
                Generate personalized product recommendations for new users with minimal interaction data using 
                behavioral signals, demographics, and content-based filtering.
              </p>
              
              <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
              <div className="bg-gray-900 rounded p-4 mb-4">
                <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "user_context": {
    "session_id": "sess_new_user_001",
    "device_type": "mobile",
    "location": "US-CA",
    "referrer_source": "instagram",
    "timestamp": "2024-01-15T14:30:00Z"
  },
  "implicit_signals": {
    "landing_page": "/category/womens-dresses",
    "time_on_page": 12,
    "scroll_depth": 0.6,
    "hover_products": ["dress_001", "dress_045"]
  },
  "demographics": {
    "age_range": "25-34",
    "gender": "female",
    "location_type": "urban"
  },
  "preferences": {
    "max_recommendations": 8,
    "category_focus": "womens-fashion",
    "include_trending": true,
    "personalization_level": "high"
  }
}`}</code></pre>
              </div>
              
              <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
              <div className="bg-gray-900 rounded p-4">
                <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "status": "success",
  "recommendations": [
    {
      "product_id": "dress_127",
      "title": "Floral Midi Dress",
      "confidence_score": 0.89,
      "reasons": ["style_match", "trending_in_location", "size_available"],
      "price": 89.99,
      "category": "womens-dresses"
    }
  ],
  "personalization_insights": {
    "user_segment": "fashion_conscious_millennial",
    "predicted_preferences": ["casual_chic", "midi_length", "floral_patterns"],
    "next_best_categories": ["accessories", "shoes"]
  },
  "metadata": {
    "processing_time_ms": 47,
    "model_version": "v2.1.3",
    "cache_hit": false
  }
}`}</code></pre>
              </div>
            </div>
          </div>
        </section>

        {/* Financial Services Detailed Documentation */}
        <section id="financial-details" className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Services Endpoints</h2>
          
          {/* Fraud Detection */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Fraud Detection</h3>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                  POST
                </span>
                <code className="text-lg font-mono text-gray-800">/v1/financial/fraud-detection</code>
              </div>
              
              <p className="text-gray-600 mb-4">
                Real-time fraud scoring using advanced rare event detection techniques, ensemble methods, 
                and behavioral analysis optimized for financial transaction data.
              </p>
              
              <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
              <div className="bg-gray-900 rounded p-4 mb-4">
                <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "transaction": {
    "amount": 1847.50,
    "merchant_type": "online_retail",
    "location": "US-CA-San Francisco",
    "timestamp": "2024-01-15T23:47:12Z",
    "card_present": false,
    "channel": "ecommerce"
  },
  "customer_context": {
    "account_id": "acct_789456",
    "customer_age": 34,
    "account_tenure_months": 28,
    "avg_monthly_spend": 2340.00,
    "recent_transaction_pattern": "normal"
  },
  "behavioral_features": {
    "time_since_last_transaction": 14400,
    "location_variance": 2847.3,
    "spending_velocity": "elevated",
    "merchant_familiarity": "new"
  },
  "processing_options": {
    "model_type": "ensemble_rare_event",
    "return_explanation": true,
    "confidence_threshold": 0.7
  }
}`}</code></pre>
              </div>
              
              <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
              <div className="bg-gray-900 rounded p-4">
                <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "fraud_score": 0.87,
  "risk_level": "high",
  "recommendation": "block_and_verify",
  "confidence": 0.91,
  "explanation": {
    "primary_factors": [
      "unusual_location_variance",
      "elevated_amount_vs_profile",
      "late_night_transaction_pattern"
    ],
    "risk_contributors": {
      "location_factor": 0.34,
      "amount_factor": 0.28,
      "time_factor": 0.25
    }
  },
  "next_actions": {
    "immediate": "contact_customer_via_phone",
    "if_confirmed_fraud": "block_card_issue_replacement",
    "if_legitimate": "update_customer_profile"
  },
  "metadata": {
    "processing_time_ms": 89,
    "model_version": "v3.2.1",
    "compliance_flags": ["pci_dss", "sox_compliant"]
  }
}`}</code></pre>
              </div>
            </div>
          </div>
        </section>

        {/* Manufacturing Detailed Documentation */}
        <section id="manufacturing-details" className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Manufacturing Endpoints</h2>
          
          {/* Sensor Data Processing */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Sensor Data Processing</h3>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mr-2">
                  POST
                </span>
                <code className="text-lg font-mono text-gray-800">/v1/manufacturing/sensor-process</code>
              </div>
              
              <p className="text-gray-600 mb-4">
                Process industrial sensor data streams with advanced noise filtering, calibration drift correction, 
                and multi-sensor correlation analysis for predictive maintenance insights.
              </p>
              
              <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
              <div className="bg-gray-900 rounded p-4 mb-4">
                <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "facility_id": "facility_001",
  "equipment_id": "pump_industrial_003",
  "sensor_data": {
    "vibration_sensors": [
      {
        "sensor_id": "VIB_001",
        "readings": [2.34, 2.41, 2.38, 2.45],
        "timestamps": ["2024-01-15T10:30:00Z", "2024-01-15T10:30:01Z"],
        "sampling_rate": "1Hz"
      }
    ],
    "temperature_sensors": [
      {
        "sensor_id": "TEMP_001",
        "readings": [85.2, 85.4, 85.1],
        "timestamps": ["2024-01-15T10:30:00Z"],
        "unit": "celsius"
      }
    ],
    "pressure_sensors": [
      {
        "sensor_id": "PRES_001",
        "readings": [150.3, 150.7, 149.8],
        "timestamps": ["2024-01-15T10:30:00Z"],
        "unit": "psi"
      }
    ]
  },
  "equipment_metadata": {
    "equipment_type": "centrifugal_pump",
    "model": "industrial_pump_v3",
    "installation_date": "2023-06-15",
    "maintenance_schedule": "quarterly"
  },
  "processing_options": {
    "enable_noise_filtering": true,
    "anomaly_detection": true,
    "predictive_maintenance": true,
    "real_time_alerts": true
  }
}`}</code></pre>
              </div>
              
              <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
              <div className="bg-gray-900 rounded p-4">
                <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "status": "success",
  "processed_data": {
    "cleaned_sensors": {
      "vibration": {
        "filtered_readings": [2.35, 2.40, 2.37, 2.44],
        "noise_removed": 0.12,
        "trend_analysis": "stable"
      },
      "temperature": {
        "filtered_readings": [85.2, 85.3, 85.1],
        "calibration_offset": 0.1,
        "trend_analysis": "normal"
      }
    },
    "anomaly_scores": {
      "vibration_anomaly": 0.23,
      "temperature_anomaly": 0.08,
      "overall_health": 0.91
    },
    "maintenance_predictions": {
      "equipment_health_score": 0.87,
      "days_to_maintenance": 14,
      "confidence": 0.94,
      "maintenance_type": "preventive",
      "priority": "medium"
    }
  },
  "alerts": [
    {
      "type": "info",
      "message": "Vibration levels slightly elevated but within normal range",
      "severity": "low",
      "recommendation": "monitor_trend"
    }
  ],
  "metadata": {
    "processing_time_ms": 156,
    "model_version": "v1.8.2",
    "sensors_processed": 6
  }
}`}</code></pre>
              </div>
            </div>
          </div>
        </section>

        {/* Authentication & Rate Limits */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Authentication & Rate Limits</h2>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-3">Authentication</h3>
            <p className="text-yellow-700 mb-3">
              All industry endpoints require API key authentication. Include your API key in the Authorization header:
            </p>
            <code className="bg-yellow-100 px-2 py-1 rounded text-sm text-yellow-800">
              Authorization: Bearer your-api-key
            </code>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">Rate Limits</h3>
            <div className="text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>E-commerce endpoints:</strong> 1000 requests/minute</li>
                <li><strong>Financial endpoints:</strong> 500 requests/minute (higher security processing)</li>
                <li><strong>Manufacturing endpoints:</strong> 2000 requests/minute (real-time sensor data)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Next Steps</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/docs/api-reference/authentication" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <Shield className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Authentication Guide</h3>
              <p className="text-gray-600">Learn how to authenticate with our API and manage your API keys.</p>
            </Link>
            
            <Link href="/docs/sdks" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <Code className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">SDKs & Libraries</h3>
              <p className="text-gray-600">Use our official SDKs for Python, JavaScript, and other languages.</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}