'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  Share2,
  Filter,
  Calendar,
  RefreshCw,
  PieChart,
  LineChart,
  Activity,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  Eye
} from 'lucide-react'
import { industryApi, analyticsApi } from '@/lib/api'

interface ModelPerformance {
  model_name: string
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  auc_roc: number
  training_time: number
  last_updated: string
  status: 'active' | 'training' | 'deprecated'
}

interface ProcessingResults {
  dataset_name: string
  total_records: number
  processed_records: number
  quality_score: number
  anomalies_detected: number
  processing_time: number
  timestamp: string
  insights: string[]
}

interface IndustryInsights {
  financial: {
    fraud_rate: number
    avg_transaction_amount: number
    risk_distribution: { [key: string]: number }
    daily_detections: { date: string; count: number }[]
  }
  ecommerce: {
    conversion_rate: number
    avg_order_value: number
    recommendation_accuracy: number
    user_segments: { segment: string; users: number; revenue: number }[]
  }
  manufacturing: {
    equipment_uptime: number
    maintenance_alerts: number
    predictive_accuracy: number
    sensor_readings: { sensor: string; value: number; status: string }[]
  }
}

export default function ResultsVisualizationSection() {
  const [modelPerformance, setModelPerformance] = useState<ModelPerformance[]>([])
  const [processingResults, setProcessingResults] = useState<ProcessingResults[]>([])
  const [industryInsights, setIndustryInsights] = useState<IndustryInsights | null>(null)
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadVisualizationData()
  }, [selectedTimeRange])

  const loadVisualizationData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load industry metrics for insights
      const metrics = await industryApi.getIndustryMetrics()
      
      // Transform metrics into visualization data
      const insights: IndustryInsights = {
        financial: {
          fraud_rate: (metrics.financial.fraud_detections_24h / metrics.financial.transactions_processed) * 100,
          avg_transaction_amount: metrics.financial.transactions_processed > 0 ? 1250 + Math.random() * 500 : 0,
          risk_distribution: {
            'Low Risk': 75 + Math.random() * 10,
            'Medium Risk': 15 + Math.random() * 5,
            'High Risk': 8 + Math.random() * 3,
            'Critical': 2 + Math.random() * 1
          },
          daily_detections: generateDailyData('fraud_detections')
        },
        ecommerce: {
          conversion_rate: metrics.ecommerce.conversion_rate,
          avg_order_value: 85 + Math.random() * 30,
          recommendation_accuracy: metrics.ecommerce.personalization_accuracy,
          user_segments: [
            { segment: 'Premium', users: 1250, revenue: 125000 },
            { segment: 'Regular', users: 5890, revenue: 235600 },
            { segment: 'New', users: 2340, revenue: 45800 }
          ]
        },
        manufacturing: {
          equipment_uptime: 100 - (metrics.manufacturing.maintenance_alerts / metrics.manufacturing.equipment_monitored * 100),
          maintenance_alerts: metrics.manufacturing.maintenance_alerts,
          predictive_accuracy: metrics.manufacturing.predictive_accuracy,
          sensor_readings: [
            { sensor: 'Temperature', value: 72.5, status: 'normal' },
            { sensor: 'Pressure', value: 15.8, status: 'warning' },
            { sensor: 'Vibration', value: 0.2, status: 'normal' },
            { sensor: 'Flow Rate', value: 234.7, status: 'normal' }
          ]
        }
      }
      setIndustryInsights(insights)

      // Mock model performance data (in real app, this would come from ML tracking)
      setModelPerformance([
        {
          model_name: 'FraudDetectionV2',
          accuracy: 0.962,
          precision: 0.945,
          recall: 0.938,
          f1_score: 0.941,
          auc_roc: 0.978,
          training_time: 45.2,
          last_updated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        },
        {
          model_name: 'RecommendationEngine',
          accuracy: 0.887,
          precision: 0.891,
          recall: 0.883,
          f1_score: 0.887,
          auc_roc: 0.923,
          training_time: 67.8,
          last_updated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        },
        {
          model_name: 'PredictiveMaintenance',
          accuracy: 0.934,
          precision: 0.928,
          recall: 0.940,
          f1_score: 0.934,
          auc_roc: 0.967,
          training_time: 32.1,
          last_updated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          status: 'training'
        }
      ])

      // Mock processing results
      setProcessingResults([
        {
          dataset_name: 'customer_transactions_nov.csv',
          total_records: 156789,
          processed_records: 156789,
          quality_score: 94.5,
          anomalies_detected: 1247,
          processing_time: 4.2,
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          insights: [
            'High correlation between transaction amount and time of day',
            'Detected 12 potential fraud patterns',
            '94.5% data quality score - excellent',
            'Recommended: Apply feature scaling for ML training'
          ]
        }
      ])

    } catch (error: any) {
      console.error('Failed to load visualization data:', error)
      setError(`Failed to load data: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const generateDailyData = (type: string) => {
    const data = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      data.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50) + 10
      })
    }
    return data
  }

  const formatTimeAgo = (isoString: string): string => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100 border-green-300'
      case 'training':
        return 'text-blue-600 bg-blue-100 border-blue-300'
      case 'deprecated':
        return 'text-gray-600 bg-gray-100 border-gray-300'
      default:
        return 'text-gray-600 bg-gray-100 border-gray-300'
    }
  }

  const downloadReport = (format: 'pdf' | 'csv' | 'json') => {
    // In real implementation, this would generate and download actual reports
    alert(`Downloading ${format.toUpperCase()} report...`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Results & Analytics</h1>
          <p className="text-gray-400 mt-1">Comprehensive insights and performance metrics</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => downloadReport('pdf')}
              className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              PDF
            </button>
            <button
              onClick={() => downloadReport('csv')}
              className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </button>
            <button
              onClick={() => downloadReport('json')}
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-700 font-medium">Error</p>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {['overview', 'models', 'processing', 'industry'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-600">Avg Accuracy</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {modelPerformance.length > 0 
                  ? `${(modelPerformance.reduce((acc, m) => acc + m.accuracy, 0) / modelPerformance.length * 100).toFixed(1)}%`
                  : '0%'
                }
              </p>
              <div className="flex items-center space-x-1 mt-2 text-sm text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span>+2.3% vs last week</span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Active Models</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {modelPerformance.filter(m => m.status === 'active').length}
              </p>
              <div className="flex items-center space-x-1 mt-2 text-sm text-blue-600">
                <CheckCircle className="w-4 h-4" />
                <span>All operational</span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-600">Data Quality</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {processingResults.length > 0 
                  ? `${processingResults[0].quality_score}%`
                  : '0%'
                }
              </p>
              <div className="flex items-center space-x-1 mt-2 text-sm text-purple-600">
                <TrendingUp className="w-4 h-4" />
                <span>Excellent rating</span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-gray-600">Processing Speed</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {processingResults.length > 0 
                  ? `${processingResults[0].processing_time}m`
                  : '0m'
                }
              </p>
              <div className="flex items-center space-x-1 mt-2 text-sm text-orange-600">
                <TrendingDown className="w-4 h-4" />
                <span>15% faster</span>
              </div>
            </div>
          </div>

          {/* Performance Trends Chart Placeholder */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Performance Trends</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <LineChart className="w-4 h-4" />
                <span>Last 7 days</span>
              </div>
            </div>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Performance chart would be rendered here</p>
                <p className="text-sm text-gray-400">Integration with charting library needed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Model Performance</h2>
          {modelPerformance.map((model) => (
            <div key={model.model_name} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">{model.model_name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(model.status)}`}>
                      {model.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Last updated: {formatTimeAgo(model.last_updated)}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    <Eye className="w-4 h-4 text-blue-600" />
                  </button>
                  <button className="p-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                    <Download className="w-4 h-4 text-green-600" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {Object.entries({
                  'Accuracy': model.accuracy,
                  'Precision': model.precision,
                  'Recall': model.recall,
                  'F1 Score': model.f1_score,
                  'AUC-ROC': model.auc_roc,
                  'Training Time': `${model.training_time}m`
                }).map(([metric, value]) => (
                  <div key={metric} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{metric}</p>
                    <p className="font-semibold text-gray-800">
                      {typeof value === 'number' ? (value < 1 ? (value * 100).toFixed(1) + '%' : value.toFixed(2)) : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'processing' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Processing Results</h2>
          {processingResults.map((result, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{result.dataset_name}</h3>
                  <p className="text-sm text-gray-600">Processed: {formatTimeAgo(result.timestamp)}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                    {result.quality_score}% Quality
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">Total Records</p>
                  <p className="text-lg font-semibold text-blue-800">{result.total_records.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">Processed</p>
                  <p className="text-lg font-semibold text-green-800">{result.processed_records.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-yellow-600 mb-1">Anomalies</p>
                  <p className="text-lg font-semibold text-yellow-800">{result.anomalies_detected}</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-1">Processing Time</p>
                  <p className="text-lg font-semibold text-purple-800">{result.processing_time}m</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">Key Insights</h4>
                <ul className="space-y-2">
                  {result.insights.map((insight, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'industry' && industryInsights && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Industry-Specific Insights</h2>
          
          {/* Financial Services */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Financial Services</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600 mb-1">Fraud Rate</p>
                <p className="text-2xl font-bold text-red-800">{industryInsights.financial.fraud_rate.toFixed(2)}%</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 mb-1">Avg Transaction</p>
                <p className="text-2xl font-bold text-blue-800">${industryInsights.financial.avg_transaction_amount.toFixed(0)}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 mb-1">Low Risk %</p>
                <p className="text-2xl font-bold text-green-800">{industryInsights.financial.risk_distribution['Low Risk'].toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* E-commerce */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">E-commerce</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600 mb-1">Conversion Rate</p>
                <p className="text-2xl font-bold text-purple-800">{industryInsights.ecommerce.conversion_rate.toFixed(1)}%</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-600 mb-1">Avg Order Value</p>
                <p className="text-2xl font-bold text-orange-800">${industryInsights.ecommerce.avg_order_value.toFixed(0)}</p>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-600 mb-1">Recommendation Accuracy</p>
                <p className="text-2xl font-bold text-indigo-800">{industryInsights.ecommerce.recommendation_accuracy.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Manufacturing */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Manufacturing & IoT</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-teal-50 rounded-lg">
                <p className="text-sm text-teal-600 mb-1">Equipment Uptime</p>
                <p className="text-2xl font-bold text-teal-800">{industryInsights.manufacturing.equipment_uptime.toFixed(1)}%</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-600 mb-1">Maintenance Alerts</p>
                <p className="text-2xl font-bold text-yellow-800">{industryInsights.manufacturing.maintenance_alerts}</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-sm text-emerald-600 mb-1">Predictive Accuracy</p>
                <p className="text-2xl font-bold text-emerald-800">{industryInsights.manufacturing.predictive_accuracy.toFixed(1)}%</p>
              </div>
            </div>
            
            {/* Sensor Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {industryInsights.manufacturing.sensor_readings.map((sensor) => (
                <div key={sensor.sensor} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">{sensor.sensor}</span>
                    <span className={`w-2 h-2 rounded-full ${
                      sensor.status === 'normal' ? 'bg-green-400' :
                      sensor.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
                    }`}></span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{sensor.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mr-3" />
          <span className="text-gray-600">Loading visualization data...</span>
        </div>
      )}
    </div>
  )
}