'use client'

import { useState } from 'react'
import { ShoppingBagIcon, ChartBarIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import CodeBlock from '../../../components/ui/CodeBlock'

export default function EcommercePage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-4">E-commerce AI</h1>
        <p className="text-xl text-gray-600">
          Production-ready AI APIs for product recommendations, demand forecasting, and dynamic pricing. 
          Boost conversion rates and optimize revenue with intelligent e-commerce automation.
        </p>
      </div>

      {/* Live API Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Live Product Recommendations API</h2>
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <ShoppingBagIcon className="h-8 w-8 text-green-600 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Personalized Product Recommendations</h3>
              <p className="text-gray-600 mb-4">
                Generate intelligent product recommendations using collaborative filtering and deep learning. 
                Increase conversion rates by 35% with personalized shopping experiences.
              </p>
              <div className="bg-white rounded-md p-4 border">
                <CodeBlock
                  code={`curl -X POST https://api.schlep-engine.com/v1/industry/ecommerce/recommendations \\
  -H "Authorization: Bearer your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "user_12345",
    "current_session": {
      "category": "electronics",
      "viewed_products": ["laptop_abc", "phone_xyz"]
    },
    "browsing_history": ["tech_gadgets", "smartphones"],
    "purchase_history": ["wireless_headphones"],
    "max_recommendations": 10
  }'`}
                  language="curl"
                  title="Product Recommendations Request"
                  showCopyButton={true}
                />
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm font-semibold text-green-800 mb-2">Response (JSON):</p>
                  <CodeBlock
                    code={`{
  "status": "success",
  "data": {
    "user_id": "user_12345",
    "recommendations": [
      {
        "product_id": "tablet_pro_2024",
        "name": "Tablet Pro 2024",
        "price": 599.99,
        "category": "electronics",
        "relevance_score": 0.94
      },
      {
        "product_id": "wireless_charger",
        "name": "Fast Wireless Charger", 
        "price": 39.99,
        "category": "accessories",
        "relevance_score": 0.87
      }
    ],
    "recommendation_scores": [0.94, 0.87, 0.83, 0.79],
    "diversity_score": 0.82,
    "algorithm_used": "hybrid_collaborative_filtering"
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
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">E-commerce AI Solutions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-6">
            <h3 className="font-semibold mb-3">Traditional E-commerce Challenges</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Generic product recommendations</li>
              <li>• Manual pricing strategies</li>
              <li>• Inventory stockouts and overstock</li>
              <li>• Poor personalization at scale</li>
            </ul>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Schlep Engine AI APIs</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Intelligent product recommendations</li>
              <li>• RL-powered dynamic pricing</li>
              <li>• ML-driven demand forecasting</li>
              <li>• Real-time personalization engine</li>
            </ul>
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Production AI APIs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <ShoppingBagIcon className="h-6 w-6 text-purple-600" />
              <h3 className="font-semibold">Product Recommendations</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Personalized recommendations with 35% conversion lift</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/ecommerce/recommendations</code></p>
              <p><strong>Response Time:</strong> ~120ms average</p>
              <p><strong>Rate Limit:</strong> 2,000 req/hour</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold">Demand Forecasting</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">ML-powered inventory optimization and planning</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/ecommerce/demand-forecast</code></p>
              <p><strong>Forecast Horizon:</strong> 1-365 days</p>
              <p><strong>Rate Limit:</strong> 100 req/hour</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold">Price Optimization</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">RL-powered dynamic pricing for maximum profitability</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/ecommerce/price-optimization</code></p>
              <p><strong>Optimization:</strong> Profit/Revenue maximization</p>
              <p><strong>Rate Limit:</strong> 200 req/hour</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
        </div>
      </section>

      {/* RL-Powered Pricing Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">RL-Powered Dynamic Pricing</h2>
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Reinforcement Learning Price Optimization</h3>
          <p className="text-gray-600 mb-4">
            Our RL agents continuously learn optimal pricing strategies by analyzing competitor prices, 
            demand patterns, and customer behavior to maximize revenue while maintaining competitiveness.
          </p>
          <CodeBlock
            code={`from schlep_engine import SchlepClient

client = SchlepClient(api_key="your_api_key")

# Optimize product pricing with RL
optimization = client.ecommerce.optimize_price(
    product_id="wireless_headphones_v2",
    current_price=149.99,
    cost_data={
        "manufacturing_cost": 45.00,
        "shipping_cost": 8.50,
        "marketing_cost": 12.00
    },
    competitor_prices={
        "competitor_a": 139.99,
        "competitor_b": 159.99,
        "competitor_c": 144.99
    },
    business_objective="profit_maximization"
)

print(f"Optimized Price: ${optimization.optimized_price}")
print(f"Expected Revenue Change: +{optimization.expected_revenue_change}%")
print(f"Competitive Position: {optimization.competitive_positioning}")

# Expected Output:
# Optimized Price: $152.99
# Expected Revenue Change: +23.4%
# Competitive Position: premium_but_competitive`}
            language="python"
            title="RL Price Optimization Example"
            showCopyButton={true}
          />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Performance Metrics</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">E-commerce AI Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">35%</p>
              <p className="text-sm text-gray-600">Conversion Rate Increase</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">28%</p>
              <p className="text-sm text-gray-600">Revenue Growth</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">42%</p>
              <p className="text-sm text-gray-600">Inventory Optimization</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">67%</p>
              <p className="text-sm text-gray-600">Personalization Accuracy</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}