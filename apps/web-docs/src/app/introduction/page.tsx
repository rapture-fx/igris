'use client'

import { useState } from 'react'
import { 
  ArrowRightIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  RocketLaunchIcon,
  CpuChipIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import CodeBlock from '../../components/ui/CodeBlock'

export default function Introduction() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="max-w-7xl mx-auto px-6">
      {/* Hero Section */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
          Industry-Focused Data Processing APIs
        </h1>
        <p className="text-xs text-[#999999] mb-4 max-w-3xl">
          REST APIs for data processing and analysis workflows in financial services, e-commerce, and manufacturing. 
          Handle common business logic and data transformations through HTTP endpoints.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">

          {/* Key Benefits */}
          <section>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-3">
              Why Use Schlep Engine?
            </h2>
            <p className="text-xs text-[#999999] mb-4">
              Save development time with pre-built data processing workflows for common business use cases.
            </p>
            <div className="space-y-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-x-3 text-xs font-semibold leading-7 text-[#999999] mb-2">
                  <RocketLaunchIcon className="h-4 w-4 flex-none text-blue-600" />
                  Ready-to-Use
                </div>
                <p className="text-xs leading-7 text-[#999999]">
                  Pre-configured processing workflows for transaction analysis, product matching, and equipment monitoring
                </p>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-x-3 text-xs font-semibold leading-7 text-[#999999] mb-2">
                  <CpuChipIcon className="h-4 w-4 flex-none text-blue-600" />
                  Industry-Specific
                </div>
                <p className="text-xs leading-7 text-[#999999]">
                  Endpoints tailored for financial, e-commerce, and manufacturing data structures and requirements
                </p>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-x-3 text-xs font-semibold leading-7 text-[#999999] mb-2">
                  <ChartBarIcon className="h-4 w-4 flex-none text-blue-600" />
                  Scalable Processing
                </div>
                <p className="text-xs leading-7 text-[#999999]">
                  Handle high-volume data processing with configurable rate limits and batch operations
                </p>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-x-3 text-xs font-semibold leading-7 text-[#999999] mb-2">
                  <ShieldCheckIcon className="h-4 w-4 flex-none text-blue-600" />
                  Security Focused
                </div>
                <p className="text-xs leading-7 text-[#999999]">
                  API authentication, data encryption, and compliance-ready audit logs
                </p>
              </div>
            </div>
          </section>
        </div>
        
        {/* Right Column - Empty for now */}
        <div className="space-y-6">
          {/* Content to be added later */}
        </div>
      </div>
      
      {/* Continue with existing content below the 2-column layout */}

      {/* Quick Start Preview */}
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-3">
          Getting Started
        </h2>
        <p className="text-xs text-[#999999] mb-4">
          Install our SDK and start processing data with industry-specific endpoints
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <CodeBlock
              code={`# Install the SDK
pip install schlep-engine

# Import and authenticate
from schlep_engine import SchlepClient

client = SchlepClient(api_key="your_api_key")

# Analyze transaction data
result = client.financial.analyze_transaction(
    transaction_id="txn_12345",
    user_id="user_67890", 
    amount=2500.00,
    merchant_category="gas_station",
    location={"lat": 40.7128, "lon": -74.0060}
)

print(f"Risk Score: {result.risk_score}")
print(f"Analysis: {result.analysis}")`}
              language="python"
              title="Python SDK - Transaction Analysis"
              showCopyButton={true}
            />
          </div>

          <div>
            <CodeBlock
              code={`// Install the SDK
npm install @schlep-engine/js-sdk

// Import and authenticate
import { SchlepClient } from '@schlep-engine/js-sdk';

const client = new SchlepClient({
  apiKey: 'your_api_key'
});

// Process product matching
const matches = await client.ecommerce.findMatches({
  userId: 'user_12345',
  maxResults: 10,
  currentSession: { category: 'electronics' }
});

console.log('Matching products:', matches.products);`}
              language="javascript"
              title="JavaScript SDK - Product Matching"
              showCopyButton={true}
            />
          </div>
        </div>
      </div>

      {/* Core Features */}
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-3">
          Core Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">🛡️ Financial Services</h3>
            <p className="text-xs text-[#999999] dark:text-[#999999] mb-2">
              Transaction analysis, risk scoring, and compliance data processing workflows.
            </p>
            <ul className="text-xs text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Transaction data validation</li>
              <li>• Risk score calculations</li>
              <li>• Compliance report generation</li>
            </ul>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">🛍️ E-commerce</h3>
            <p className="text-xs text-[#999999] dark:text-[#999999] mb-2">
              Product matching, inventory analysis, and pricing calculation endpoints.
            </p>
            <ul className="text-xs text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Product similarity matching</li>
              <li>• Demand forecast calculations</li>
              <li>• Dynamic pricing algorithms</li>
            </ul>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">🏭 Manufacturing</h3>
            <p className="text-xs text-[#999999] dark:text-[#999999] mb-2">
              Equipment monitoring, quality analysis, and supply chain data processing.
            </p>
            <ul className="text-xs text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Equipment status monitoring</li>
              <li>• Quality metrics analysis</li>
              <li>• Supply chain data tracking</li>
            </ul>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">🤖 Data Processing</h3>
            <p className="text-xs text-[#999999] dark:text-[#999999] mb-2">
              Configurable data processing workflows and parameter optimization.
            </p>
            <ul className="text-xs text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Parameter tuning workflows</li>
              <li>• Batch processing optimization</li>
              <li>• Pipeline configuration tools</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Overview */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-4">
          API Overview
        </h2>
        <p className="text-sm text-[#999999] mb-6">
          Our REST API provides industry-specific AI endpoints for financial, e-commerce, and manufacturing use cases.
        </p>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-[#999999] dark:text-[#999999]">
                <strong>Base URL:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-xs">https://api.schlep-engine.com</code>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🛡️ Fraud Detection</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /industry/financial/fraud-detection</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Real-time transaction fraud analysis</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🛍️ Product Recommendations</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /industry/ecommerce/recommendations</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">AI-powered product recommendations</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🔧 Predictive Maintenance</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /industry/manufacturing/predictive-maintenance</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">IoT-powered equipment monitoring</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🤖 RL Optimization</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /rl/hyperparameter-optimization</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Automated ML hyperparameter tuning</p>
          </div>
        </div>
      </div>

      {/* What's Next */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What's Next?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a 
            href="/introduction/quickstart"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <RocketLaunchIcon className="h-5 w-5" />
              <span className="font-medium">Quick Start</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Set up your development environment</p>
          </a>
          <a 
            href="/introduction/api-keys"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <ShieldCheckIcon className="h-5 w-5" />
              <span className="font-medium">Authentication</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Learn about API keys and security</p>
          </a>
          <a 
            href="/introduction/first-call"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <PlayIcon className="h-5 w-5" />
              <span className="font-medium">First API Call</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Make your first request to the API</p>
          </a>
        </div>
      </div>
    </div>
  )
}

