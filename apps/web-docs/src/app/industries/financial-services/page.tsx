'use client'

import { useState } from 'react'
import { ShieldCheckIcon, ChartBarIcon, CheckCircleIcon, ClipboardIcon } from '@heroicons/react/24/outline'
import CodeBlock from '../../../components/ui/CodeBlock'

export default function FinancialServicesPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(id)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Financial Services ML</h1>
        <p className="text-xl text-gray-600">
          Machine learning APIs for fraud detection, credit risk assessment, and AML compliance. 
          Deploy ML models for financial data processing workflows.
        </p>
      </div>

      {/* Real-time API Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Fraud Detection ML API</h2>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Transaction Risk Scoring</h3>
              <p className="text-gray-600 mb-4">
                Score transaction risk using trained ML models. Process financial data through standardized endpoints.
              </p>
              <div className="bg-white rounded-md p-4 border">
                <CodeBlock
                  code={`curl -X POST https://api.schlep-engine.com/v1/industry/financial/fraud-detection \\
  -H "Authorization: Bearer your_api_key" \\
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
                  title="Fraud Detection Request"
                  showCopyButton={true}
                />
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm font-semibold text-green-800 mb-2">Response (JSON):</p>
                  <CodeBlock
                    code={`{
  "status": "success",
  "data": {
    "transaction_id": "txn_12345",
    "risk_score": 0.23,
    "risk_level": "low",
    "is_fraudulent": false,
    "confidence": 0.94,
    "risk_factors": [
      "unusual_location",
      "high_amount_for_merchant"
    ],
    "recommended_action": "approve",
    "processing_time_ms": 45
  }
}`}
                    language="json"
                    showCopyButton={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">AI-Powered Solutions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-6">
            <h3 className="font-semibold mb-3">Traditional Challenges</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Manual fraud review teams</li>
              <li>• Weeks to deploy ML models</li>
              <li>• Complex compliance reporting</li>
              <li>• High false positive rates</li>
            </ul>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Schlep Engine APIs</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Real-time fraud detection (45ms)</li>
              <li>• Instant credit risk scoring</li>
              <li>• Automated AML compliance</li>
              <li>• 94%+ accuracy out-of-the-box</li>
            </ul>
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Production-Ready APIs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheckIcon className="h-6 w-6 text-red-600" />
              <h3 className="font-semibold">Fraud Detection</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Real-time transaction analysis with 94% accuracy</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/financial/fraud-detection</code></p>
              <p><strong>Response Time:</strong> ~45ms average</p>
              <p><strong>Rate Limit:</strong> 1,000 req/hour</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold">Credit Risk</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Automated credit scoring and risk assessment</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/financial/credit-risk</code></p>
              <p><strong>Score Range:</strong> 300-850 (FICO compatible)</p>
              <p><strong>Rate Limit:</strong> 500 req/hour</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold">AML Compliance</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Anti-money laundering screening and reporting</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/financial/aml-check</code></p>
              <p><strong>Coverage:</strong> Global watchlists, PEP, sanctions</p>
              <p><strong>Rate Limit:</strong> 200 req/hour</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
        </div>
      </section>

      {/* Quick Integration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">5-Minute Integration</h2>
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Python SDK Example</h3>
          <CodeBlock
            code={`pip install schlep-engine

# Initialize client
from schlep_engine import SchlepClient
client = SchlepClient(api_key="your_api_key")

# Detect fraud in real-time
result = client.financial.detect_fraud(
    transaction_id="txn_12345",
    user_id="user_67890",
    amount=2500.00,
    merchant_category="gas_station",
    location={"lat": 40.7128, "lon": -74.0060},
    device_info={"device_id": "device_abc123"}
)

if result.is_fraudulent:
    # Block transaction
    block_transaction(result.transaction_id)
else:
    # Approve transaction  
    approve_transaction(result.transaction_id)

print(f"Risk Score: {result.risk_score}")
print(f"Processing Time: {result.processing_time_ms}ms")`}
            language="python"
            title="Real-time Fraud Detection"
            showCopyButton={true}
          />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Compliance & Security</h2>
        <div className="bg-amber-50 border-l-4 border-amber-400 p-6">
          <h3 className="font-semibold mb-3">Financial Regulations</h3>
          <p className="text-gray-700 mb-4">
            Schlep Engine automatically handles financial industry compliance requirements including data governance, 
            audit trails, and regulatory reporting.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">PCI DSS</p>
              <p className="text-xs text-gray-600">Payment security</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">SOX</p>
              <p className="text-xs text-gray-600">Financial reporting</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">GDPR</p>
              <p className="text-xs text-gray-600">Data privacy</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Basel III</p>
              <p className="text-xs text-gray-600">Risk management</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}