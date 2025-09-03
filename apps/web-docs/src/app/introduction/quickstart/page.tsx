'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircleIcon, ArrowRightIcon, ShieldCheckIcon, CpuChipIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import CodeBlock from '../../../components/ui/CodeBlock'

export default function QuickStart() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Quick Start Guide</h1>
        <p className="text-base text-gray-600 mb-4">
          Get started with industry-focused data processing APIs. Set up transaction analysis, 
          product matching, and equipment monitoring workflows.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left Column */}
        <div className="space-y-8">
          {/* Prerequisites */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Prerequisites</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1 text-sm">Get Your API Key</h3>
                  <p className="text-blue-800 text-xs mb-2">
                    You'll need an API key to authenticate your requests to our industry AI endpoints.
                  </p>
                  <Link 
                    href="/introduction/api-keys"
                    className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 text-xs font-medium"
                  >
                    Get API Key
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <span className="text-gray-600 text-sm">Python 3.7+ or Node.js 14+ (for SDK usage)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <span className="text-gray-600 text-sm">Business data to analyze (transactions, products, sensor data)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <span className="text-gray-600 text-sm">Internet connection for API requests</span>
              </div>
            </div>
          </section>

          {/* Installation */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Installation</h2>
            
            <div className="space-y-4">
              {/* Python SDK */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Python SDK</h3>
                <CodeBlock
                  code="pip install schlep-engine"
                  language="bash"
                  title="Install Python SDK"
                  showCopyButton={true}
                />
              </div>

              {/* JavaScript SDK */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">JavaScript SDK</h3>
                <CodeBlock
                  code="npm install @schlep-engine/js-sdk"
                  language="bash"
                  title="Install JavaScript SDK"
                  showCopyButton={true}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - Empty for now */}
        <div className="space-y-8">
          {/* Content to be added later */}
        </div>
      </div>

      {/* Continue with existing content below the 2-column layout */}

      {/* Industry AI Examples */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Choose Your Industry</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Select the industry that matches your use case to see tailored examples.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <ShieldCheckIcon className="h-6 w-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Financial Services</h3>
            <p className="text-xs text-gray-600 mb-3">Transaction analysis, risk scoring, compliance processing</p>
            <div className="text-xs text-gray-500">
              • Transaction data validation<br/>
              • Risk score calculations<br/>
              • Compliance report generation
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <CpuChipIcon className="h-6 w-6 text-green-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">E-commerce</h3>
            <p className="text-xs text-gray-600 mb-3">Product matching, pricing, demand analysis</p>
            <div className="text-xs text-gray-500">
              • Product similarity matching<br/>
              • Dynamic pricing calculations<br/>
              • Demand forecast processing
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-4">
            <ChartBarIcon className="h-6 w-6 text-purple-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Manufacturing</h3>
            <p className="text-xs text-gray-600 mb-3">Equipment monitoring, quality analysis</p>
            <div className="text-xs text-gray-500">
              • Equipment status tracking<br/>
              • Quality metrics analysis<br/>
              • Supply chain data processing
            </div>
          </div>
        </div>
      </section>

      {/* Financial Services Example */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">🏦 Financial Services: Transaction Analysis</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Analyze transaction data and calculate risk scores using configurable business rules.
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Python Example</h3>
            <CodeBlock
              code={`from schlep_engine import SchlepClient

# Initialize client with your API key
client = SchlepClient(api_key="your_api_key_here")

# Analyze transaction data
result = client.financial.analyze_transaction(
    transaction_id="txn_12345",
    user_id="user_67890",
    transaction_amount=2500.00,
    merchant_category="gas_station",
    location={
        "lat": 40.7128,
        "lon": -74.0060,
        "country": "US"
    },
    device_info={
        "device_id": "device_abc123",
        "ip_address": "192.168.1.1"
    }
)

print(f"Risk Score: {result.risk_score}")
print(f"Analysis: {result.analysis_summary}")
print(f"Flags: {result.risk_flags}")

# Take action based on results
if result.risk_score > 0.7:
    print("⚠️ HIGH RISK - Review required")
else:
    print("✅ LOW RISK - Transaction approved")`}
              language="python"
              title="Transaction Analysis with Python SDK"
              showCopyButton={true}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Direct API Call</h3>
            <CodeBlock
              code={`curl -X POST https://api.schlep-engine.com/v1/financial/analyze-transaction \\
  -H "Authorization: Bearer your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction_id": "txn_12345",
    "user_id": "user_67890",
    "transaction_amount": 2500.00,
    "merchant_category": "gas_station",
    "location": {
      "lat": 40.7128,
      "lon": -74.0060,
      "country": "US"
    },
    "device_info": {
      "device_id": "device_abc123",
      "ip_address": "192.168.1.1"
    }
  }'`}
              language="curl"
              title="Transaction Analysis API Request"
              showCopyButton={true}
            />
          </div>
        </div>
      </section>

      {/* E-commerce Example */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">🛒 E-commerce: Product Matching</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Find similar products and calculate pricing using similarity algorithms and business logic.
        </p>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">JavaScript Example</h3>
          <CodeBlock
            code={`import { SchlepClient } from '@schlep-engine/js-sdk';

// Initialize client
const client = new SchlepClient({
  apiKey: 'your_api_key_here'
});

// Find matching products
async function findMatches() {
  const matches = await client.ecommerce.findMatches({
    userId: 'user_12345',
    currentSession: {
      category: 'electronics',
      viewedProducts: ['laptop_abc', 'phone_xyz']
    },
    filters: {
      priceRange: { min: 100, max: 1000 },
      category: 'electronics'
    },
    maxResults: 10
  });

  console.log('Matching products:', matches.products);
  console.log('Match Score:', matches.total_matches);
  console.log('Processing Time:', matches.processing_time_ms);

  // Display matches in your UI
  matches.products.forEach(product => {
    console.log(\`\${product.name}: $\${product.price} (Similarity: \${product.similarity_score})\`);
  });
}

findMatches().catch(console.error);`}
            language="javascript"
            title="Product Matching with JavaScript SDK"
            showCopyButton={true}
          />
        </div>
      </section>

      {/* Manufacturing Example */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">🏭 Manufacturing: Equipment Monitoring</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Monitor equipment status and analyze quality metrics from sensor data and operational logs.
        </p>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Python Example</h3>
          <CodeBlock
            code={`from schlep_engine import SchlepClient

# Initialize client
client = SchlepClient(api_key="your_api_key_here")

# Monitor equipment status from sensor data
status_check = client.manufacturing.monitor_equipment(
    equipment_id="motor_pump_A01",
    sensor_data={
        "temperature": 85.2,
        "vibration": 0.15,
        "pressure": 145.8,
        "flow_rate": 23.4,
        "power_consumption": 1250
    },
    operational_context={
        "hours_since_maintenance": 720,
        "load_factor": 0.85,
        "environmental_conditions": "normal"
    }
)

print(f"Status: {status_check.status}")
print(f"Health Score: {status_check.health_score}")
print(f"Anomalies: {status_check.anomalies}")
print(f"Maintenance Due: {status_check.maintenance_due}")

# Handle maintenance scheduling
if status_check.health_score < 0.3:
    print("🚨 CRITICAL: Schedule maintenance soon")
    for issue in status_check.issues:
        print(f"• {issue}")
elif status_check.health_score < 0.7:
    print("⚠️ WARNING: Monitor closely")
else:
    print("✅ NORMAL: Equipment operating within parameters")`}
            language="python"
            title="Equipment Monitoring with Python SDK"
            showCopyButton={true}
          />
        </div>
      </section>

      {/* Expected Response */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Expected Response Format</h2>
        <p className="text-gray-600 mb-3 text-sm">
          All industry AI APIs return structured JSON responses with consistent formatting:
        </p>
        
        <CodeBlock
          code={`{
  "status": "success",
  "data": {
    "request_id": "req_abc123",
    "processing_time_ms": 45,
    "model_version": "v2.1.0",
    // Industry-specific results
    "risk_score": 0.23,
    "confidence": 0.94,
    "recommendations": [
      "Monitor for unusual patterns",
      "Review user behavior history"
    ]
  },
  "metadata": {
    "api_version": "v1",
    "timestamp": "2024-01-15T10:30:00Z",
    "rate_limit_remaining": 4950
  }
}`}
          language="json"
          title="Standard API Response Format"
          showCopyButton={true}
        />
      </section>

      {/* Next Steps */}
      <section className="bg-gray-50 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">🎉 What's Next?</h2>
        <p className="text-gray-600 mb-3 text-sm">
          You've learned the basics! Here's how to take your implementation further:
        </p>
        
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <Link 
            href="/industries"
            className="block p-3 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">🏢 Industry Deep Dives</h3>
            <p className="text-gray-600 text-xs">
              Explore comprehensive guides for Financial, E-commerce, and Manufacturing AI.
            </p>
          </Link>
          
          <Link 
            href="/concepts/reinforcement-learning"
            className="block p-3 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">🤖 Advanced RL Features</h3>
            <p className="text-gray-600 text-xs">
              Learn about our reinforcement learning optimization capabilities.
            </p>
          </Link>
          
          <Link 
            href="/api-reference"
            className="block p-3 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">📚 Complete API Reference</h3>
            <p className="text-gray-600 text-xs">
              Detailed documentation for all endpoints, parameters, and responses.
            </p>
          </Link>
          
          <Link 
            href="/sdks"
            className="block p-3 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">🛠 SDK Documentation</h3>
            <p className="text-gray-600 text-xs">
              In-depth guides for Python, JavaScript, and other SDK implementations.
            </p>
          </Link>
        </div>

        <div className="flex gap-3">
          <Link
            href="/introduction/first-call"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Make Your First API Call
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link
            href="/introduction/api-keys"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Get Your API Key
          </Link>
        </div>
      </section>
    </div>
  )
}