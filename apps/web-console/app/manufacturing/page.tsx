'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Factory, 
  Play, 
  Copy, 
  Settings,
  Activity,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  Zap,
  AlertTriangle,
  Gauge,
  Wrench,
  TrendingUp,
  Cpu
} from 'lucide-react'
import { apiClient } from '../../src/lib/api/client'

interface ManufacturingTest {
  id: string
  name: string
  description: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  category: string
  sampleRequest?: any
  sampleResponse?: any
}

const ManufacturingHeader = () => {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Console
            </Link>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Factory className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Manufacturing Console
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  IoT monitoring, predictive maintenance & supply chain optimization
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>12 APIs Active</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

const ResponseDisplay: React.FC<{
  response: any
  isLoading: boolean
  error?: string
}> = ({ response, isLoading, error }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 text-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-300">Processing manufacturing data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <XCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400 font-medium">API Error</span>
        </div>
        <pre className="text-red-300 text-sm overflow-x-auto">{error}</pre>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center border-2 border-dashed border-gray-600">
        <Terminal className="w-8 h-8 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Click "Test API" to see manufacturing data</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-medium">Success</span>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-1 px-2 py-1 text-gray-300 hover:text-white transition-colors"
        >
          {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="text-sm">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-gray-100 text-sm overflow-x-auto">
        {JSON.stringify(response, null, 2)}
      </pre>
    </div>
  )
}

const APITestCard: React.FC<{
  test: ManufacturingTest
  onTest: (test: ManufacturingTest) => void
  isLoading?: boolean
}> = ({ test, onTest, isLoading }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              test.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
              test.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
              'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
            }`}>
              {test.method}
            </span>
            <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {test.endpoint}
            </code>
          </div>
        </div>
        <button
          onClick={() => onTest(test)}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-1" />
          )}
          Test API
        </button>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {test.name}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
        {test.description}
      </p>
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded inline-block">
        {test.category}
      </div>
    </div>
  )
}

export default function ManufacturingConsolePage() {
  const [activeTest, setActiveTest] = useState<ManufacturingTest | null>(null)
  const [response, setResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const manufacturingTests: ManufacturingTest[] = [
    {
      id: 'predictive-maintenance',
      name: 'Predictive Maintenance Analysis',
      description: 'Analyze equipment sensor data to predict failures and maintenance needs',
      endpoint: '/api/v1/industry/manufacturing/predictive-maintenance',
      method: 'POST',
      category: 'Predictive Maintenance',
      sampleRequest: {
        equipment_id: "CNC_001",
        sensor_data: {
          vibration: 2.3,
          temperature: 65.2,
          pressure: 150.8,
          rpm: 1800
        },
        timestamp: "2024-01-15T14:30:00Z"
      },
      sampleResponse: {
        equipment_id: "CNC_001",
        health_score: 0.85,
        failure_probability: 0.12,
        maintenance_recommendation: "Schedule maintenance in 5-7 days",
        critical_sensors: ["vibration", "temperature"],
        next_inspection: "2024-01-22T09:00:00Z"
      }
    },
    {
      id: 'quality-control',
      name: 'Quality Control Inspection',
      description: 'AI-powered quality inspection with defect detection and classification',
      endpoint: '/api/v1/industry/manufacturing/quality-control',
      method: 'POST',
      category: 'Quality Control',
      sampleRequest: {
        product_id: "PROD_12345",
        inspection_data: {
          dimensions: { length: 100.2, width: 50.1, height: 25.0 },
          surface_quality: "good",
          color_variance: 0.02
        },
        batch_id: "BATCH_789"
      },
      sampleResponse: {
        product_id: "PROD_12345",
        quality_score: 0.94,
        pass_fail: "pass",
        defects_detected: [],
        recommendations: ["Monitor color variance"],
        batch_statistics: {
          total_inspected: 150,
          pass_rate: 0.96,
          average_score: 0.92
        }
      }
    },
    {
      id: 'iot-dashboard',
      name: 'Real-time IoT Dashboard Data',
      description: 'Get live IoT sensor data and equipment status across the factory floor',
      endpoint: '/api/v1/industry/manufacturing/iot-dashboard',
      method: 'GET',
      category: 'IoT Monitoring',
      sampleResponse: {
        factory_overview: {
          total_equipment: 24,
          active_equipment: 22,
          alerts: 3,
          overall_efficiency: 0.89
        },
        equipment_status: [
          {
            id: "CNC_001",
            name: "CNC Machine #1",
            status: "running",
            efficiency: 0.92,
            temperature: 65.2,
            vibration: 2.1
          },
          {
            id: "ROBOT_002", 
            name: "Assembly Robot #2",
            status: "maintenance",
            efficiency: 0.00,
            last_maintenance: "2024-01-14T10:00:00Z"
          }
        ],
        production_metrics: {
          current_shift_output: 1250,
          target_output: 1400,
          efficiency_rate: 0.89,
          downtime_hours: 0.5
        }
      }
    },
    {
      id: 'supply-chain',
      name: 'Supply Chain Optimization',
      description: 'Optimize inventory levels and supplier selection using AI algorithms',
      endpoint: '/api/v1/industry/manufacturing/supply-chain',
      method: 'POST',
      category: 'Supply Chain',
      sampleRequest: {
        optimization_type: "inventory",
        parameters: {
          current_inventory: 5000,
          demand_forecast: 8000,
          lead_time_days: 7,
          safety_stock: 1000
        },
        constraints: {
          max_order_quantity: 10000,
          budget_limit: 50000
        }
      },
      sampleResponse: {
        optimization_result: {
          recommended_order: 6500,
          order_timing: "2024-01-18T00:00:00Z",
          cost_savings: 2500.00,
          risk_level: "low"
        },
        supplier_recommendations: [
          {
            supplier_id: "SUP_001",
            name: "TechParts Inc",
            score: 0.94,
            lead_time: 5,
            cost_per_unit: 12.50
          }
        ],
        inventory_projection: {
          weeks_of_supply: 4.2,
          stockout_probability: 0.03
        }
      }
    },
    {
      id: 'energy-optimization',
      name: 'Energy Consumption Optimization',
      description: 'Analyze and optimize energy usage patterns across manufacturing processes',
      endpoint: '/api/v1/industry/manufacturing/energy-optimization',
      method: 'POST',
      category: 'Energy Management',
      sampleRequest: {
        facility_id: "FAC_001",
        time_period: {
          start: "2024-01-01T00:00:00Z",
          end: "2024-01-31T23:59:59Z"
        },
        equipment_types: ["cnc", "conveyor", "hvac", "lighting"]
      },
      sampleResponse: {
        current_consumption: {
          total_kwh: 45000,
          cost_usd: 9000,
          peak_demand: 180
        },
        optimization_recommendations: [
          {
            equipment_type: "hvac",
            potential_savings_kwh: 3200,
            potential_savings_usd: 640,
            recommendation: "Implement smart scheduling"
          }
        ],
        projected_savings: {
          annual_kwh_reduction: 12000,
          annual_cost_reduction: 2400,
          payback_period_months: 8
        }
      }
    },
    {
      id: 'production-analytics',
      name: 'Production Line Analytics',
      description: 'Advanced analytics on production efficiency, bottlenecks, and OEE calculations',
      endpoint: '/api/v1/industry/manufacturing/production-analytics',
      method: 'POST',
      category: 'Production Analytics',
      sampleRequest: {
        production_line: "LINE_A",
        date_range: {
          start: "2024-01-15T00:00:00Z",
          end: "2024-01-15T23:59:59Z"
        },
        metrics: ["oee", "throughput", "quality", "downtime"]
      },
      sampleResponse: {
        oee_metrics: {
          availability: 0.92,
          performance: 0.88,
          quality: 0.95,
          overall_oee: 0.77
        },
        bottleneck_analysis: {
          primary_bottleneck: "Station_3",
          impact_minutes: 45,
          suggested_actions: ["Increase buffer", "Add operator"]
        },
        production_summary: {
          units_produced: 1250,
          target_units: 1400,
          efficiency_rate: 0.89,
          quality_rate: 0.95
        }
      }
    }
  ]

  const handleTest = async (test: ManufacturingTest) => {
    setActiveTest(test)
    setIsLoading(true)
    setError(undefined)
    setResponse(null)

    try {
      let result
      
      // Simulate manufacturing API calls with sample data
      switch (test.id) {
        case 'predictive-maintenance':
          result = await apiClient.getPredictiveMaintenance(test.sampleRequest)
          break
        case 'quality-control':
          // Simulate quality control API
          result = {
            success: true,
            data: test.sampleResponse,
            status: 200
          }
          break
        case 'iot-dashboard':
          // Simulate IoT dashboard API
          result = {
            success: true,
            data: test.sampleResponse,
            status: 200
          }
          break
        case 'supply-chain':
        case 'energy-optimization':
        case 'production-analytics':
          // Simulate other manufacturing APIs
          result = {
            success: true,
            data: test.sampleResponse,
            status: 200
          }
          break
        default:
          result = {
            success: true,
            data: test.sampleResponse || { 
              message: 'Manufacturing API test successful', 
              timestamp: new Date().toISOString(),
              facility_id: 'FAC_001'
            },
            status: 200
          }
      }

      if (result.success) {
        setResponse(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const statsCards = [
    { 
      icon: <Gauge className="w-5 h-5" />, 
      label: "Equipment Monitored", 
      value: "24", 
      color: "text-yellow-600" 
    },
    { 
      icon: <AlertTriangle className="w-5 h-5" />, 
      label: "Active Alerts", 
      value: "3", 
      color: "text-red-600" 
    },
    { 
      icon: <TrendingUp className="w-5 h-5" />, 
      label: "Overall OEE", 
      value: "89%", 
      color: "text-green-600" 
    },
    { 
      icon: <Activity className="w-5 h-5" />, 
      label: "Uptime", 
      value: "96.2%", 
      color: "text-blue-600" 
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ManufacturingHeader />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className={stat.color}>{stat.icon}</div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* API Tests */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Manufacturing APIs
            </h2>
            <div className="space-y-4">
              {manufacturingTests.map((test) => (
                <APITestCard
                  key={test.id}
                  test={test}
                  onTest={handleTest}
                  isLoading={isLoading && activeTest?.id === test.id}
                />
              ))}
            </div>
          </div>

          {/* Response Display */}
          <div className="lg:sticky lg:top-24">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Manufacturing Data
            </h2>
            <ResponseDisplay 
              response={response} 
              isLoading={isLoading} 
              error={error}
            />
            
            {activeTest && (
              <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                  Testing: {activeTest.name}
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {activeTest.description}
                </p>
                {activeTest.sampleRequest && (
                  <div className="mt-3">
                    <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Sample Request:</p>
                    <pre className="text-xs bg-orange-100 dark:bg-orange-900/40 p-2 rounded overflow-x-auto">
                      {JSON.stringify(activeTest.sampleRequest, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}