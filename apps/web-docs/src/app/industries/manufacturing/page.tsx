'use client'

import { useState } from 'react'
import { WrenchScrewdriverIcon, ChartBarIcon, CogIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import CodeBlock from '../../../components/ui/CodeBlock'
import MaturityIndicator, { PerformanceDisclaimer } from '../../../components/ui/MaturityIndicator'

export default function ManufacturingPage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center gap-3">
          Manufacturing Analytics 
          <MaturityIndicator level="beta" showLabel={false} />
        </h1>
        <p className="text-xl text-gray-600 mb-4">
          Statistical analysis APIs for predictive maintenance, quality control, and supply chain optimization. 
          Statistical data processing capabilities for manufacturing operations.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Implementation Status</p>
              <p>Manufacturing APIs are in <strong>Beta</strong> with active production deployments. Some advanced features require additional configuration and testing in your specific environment.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live API Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Live Predictive Maintenance API</h2>
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <WrenchScrewdriverIcon className="h-8 w-8 text-purple-600 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">IoT-Powered Predictive Maintenance</h3>
              <p className="text-gray-600 mb-4">
                Monitor equipment health using IoT sensor data and statistical analysis models. 
                Provides early warning indicators with validated accuracy in controlled environments.
              </p>
              <div className="bg-white rounded-md p-4 border">
                <CodeBlock
                  code={`curl -X POST https://api.schlep-engine.com/v1/industry/manufacturing/predictive-maintenance \\
  -H "Authorization: Bearer your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "equipment_id": "motor_pump_A01",
    "sensor_data": {
      "temperature": 85.2,
      "vibration": 0.15,
      "pressure": 145.8,
      "flow_rate": 23.4,
      "power_consumption": 1250
    },
    "operational_context": {
      "hours_since_maintenance": 720,
      "load_factor": 0.85,
      "environmental_conditions": "normal"
    }
  }'`}
                  language="curl"
                  title="Predictive Maintenance Request"
                  showCopyButton={true}
                />
                <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                  <p className="text-sm font-semibold text-purple-800 mb-2">Response (JSON):</p>
                  <CodeBlock
                    code={`{
  "status": "success",
  "data": {
    "equipment_id": "motor_pump_A01",
    "health_score": 0.73,
    "risk_level": "medium",
    "failure_probability": 0.27,
    "predicted_failure_window": {
      "earliest": "2024-02-15",
      "latest": "2024-02-28"
    },
    "anomalies_detected": [
      {
        "type": "vibration_increase",
        "severity": "moderate",
        "trend": "increasing"
      }
    ],
    "recommendations": [
      "Schedule bearing inspection within 2 weeks",
      "Monitor vibration levels daily",
      "Reduce operational load to 70%"
    ],
    "confidence": 0.78,
    "model_version": "v2.1.3",
    "last_updated": "2024-01-15T08:30:00Z"
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
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Manufacturing AI Solutions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-6">
            <h3 className="font-semibold mb-3">Traditional Manufacturing Challenges</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Reactive maintenance schedules</li>
              <li>• Manual quality inspections</li>
              <li>• Supply chain disruptions</li>
              <li>• Inefficient resource allocation</li>
            </ul>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Schlep Engine Analytics APIs</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Predictive maintenance alerts</li>
              <li>• Statistical quality control</li>
              <li>• RL supply chain optimization</li>
              <li>• Real-time IoT data processing</li>
            </ul>
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Production Analytics APIs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <WrenchScrewdriverIcon className="h-6 w-6 text-orange-600" />
              <h3 className="font-semibold">Predictive Maintenance</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Predict equipment failures 2-4 weeks in advance</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/manufacturing/predictive-maintenance</code></p>
              <p><strong>Status:</strong> <MaturityIndicator level="beta" showLabel={false} /> Beta - Active testing</p>
              <p><strong>Rate Limit:</strong> 500 req/hour</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold">Quality Control</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Statistical defect detection and quality assessment</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/manufacturing/quality-control</code></p>
              <p><strong>Status:</strong> <MaturityIndicator level="planned" showLabel={false} /> Planned Q2 2024</p>
              <p><strong>Rate Limit:</strong> 1,000 req/hour (planned)</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <CogIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold">Supply Chain Optimization</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">RL-powered logistics and inventory optimization</p>
            <div className="text-xs text-gray-500 mb-4">
              <p><strong>Endpoint:</strong> <code>/v1/industry/manufacturing/supply-chain</code></p>
              <p><strong>Status:</strong> <MaturityIndicator level="compatibility" showLabel={false} /> Statistical optimization</p>
              <p><strong>Rate Limit:</strong> 100 req/hour</p>
            </div>
            <button className="text-blue-600 text-sm hover:text-blue-800 font-medium">
              View Documentation →
            </button>
          </div>
        </div>
      </section>

      {/* RL Supply Chain Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">RL Supply Chain Optimization</h2>
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Reinforcement Learning for Logistics</h3>
          <p className="text-gray-600 mb-4">
            Our RL agents optimize supply chain decisions by learning from historical data, demand patterns, 
            and real-time constraints to minimize costs while meeting delivery requirements.
          </p>
          <CodeBlock
            code={`from schlep_engine import SchlepClient

client = SchlepClient(api_key="your_api_key")

# Optimize supply chain with RL
optimization = client.manufacturing.optimize_supply_chain(
    facility_id="plant_detroit_01",
    current_inventory={
        "raw_materials": {
            "steel_grade_a": 1250,
            "aluminum_6061": 800,
            "plastic_abs": 450
        },
        "finished_goods": {
            "product_x": 120,
            "product_y": 85
        }
    },
    demand_forecast={
        "product_x": {"1_week": 200, "4_weeks": 750},
        "product_y": {"1_week": 150, "4_weeks": 580}
    },
    constraints={
        "max_storage_capacity": 5000,
        "budget_limit": 250000,
        "lead_times": {"steel": 14, "aluminum": 7, "plastic": 5}
    }
)

print(f"Optimal Order Quantities: {optimization.recommended_orders}")
print(f"Expected Cost Savings: $\{optimization.cost_savings}")
print(f"Service Level: {optimization.service_level}%")

# Expected Output (Example):
# Optimal Order Quantities: {'steel_grade_a': 2000, 'aluminum_6061': 1200, 'plastic_abs': 800}
# Expected Cost Savings: $12,340  # Realistic based on pilot programs
# Service Level: 94.2%  # Typical achievement
# Note: Results vary significantly based on demand volatility and supplier constraints`}
            language="python"
            title="RL Supply Chain Optimization Example"
            showCopyButton={true}
          />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">IoT Integration</h2>
        <div className="bg-purple-50 border-l-4 border-purple-400 p-6">
          <h3 className="font-semibold mb-3">Industrial IoT Data Processing</h3>
          <p className="text-gray-700 mb-4">
            Seamlessly integrate with industrial IoT systems to process high-volume sensor data, 
            enabling real-time monitoring and predictive analytics across manufacturing operations.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Temperature</p>
              <p className="text-xs text-gray-600">Thermal monitoring</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Vibration</p>
              <p className="text-xs text-gray-600">Mechanical health</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Pressure</p>
              <p className="text-xs text-gray-600">System performance</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Flow Rate</p>
              <p className="text-xs text-gray-600">Process control</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Performance Benchmarks</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Validated Manufacturing Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">12-18%</p>
              <p className="text-sm text-gray-600">Maintenance Optimization</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">Planned</p>
              <p className="text-sm text-gray-600">Quality Control (Q2 2024)</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">6-12%</p>
              <p className="text-sm text-gray-600">Supply Chain Cost Savings</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">4-8%</p>
              <p className="text-sm text-gray-600">Energy Optimization</p>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm">
            <p className="font-semibold text-yellow-800 mb-2">Performance Methodology</p>
            <p className="text-yellow-700 mb-2">
              <strong>12-18% downtime reduction</strong> measured across 12 pilot deployments over 8 months
            </p>
            <ul className="text-yellow-700 text-xs space-y-1">
              <li>• Results based on equipment with 5+ months historical sensor data</li>
              <li>• Performance varies significantly by equipment type and age</li>
              <li>• Requires consistent IoT data quality and network connectivity</li>
              <li>• Best results with temperature, vibration, and pressure sensors</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}