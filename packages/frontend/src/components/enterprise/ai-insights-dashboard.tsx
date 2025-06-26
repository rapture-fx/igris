'use client'

import { useState, useEffect } from 'react'
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Eye, Settings, Zap, Target, BarChart3, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

interface InsightData {
  category: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  confidence: number
  details: any
}

interface PredictiveData {
  date: string
  actual?: number
  predicted: number
  lower_bound: number
  upper_bound: number
}

interface MonitoringAlert {
  id: string
  type: 'quality' | 'anomaly' | 'performance'
  severity: 'high' | 'medium' | 'low'
  message: string
  timestamp: string
  resolved: boolean
}

interface AIInsightsDashboardProps {
  investigationId: string
}

export function AIInsightsDashboard({ investigationId }: AIInsightsDashboardProps) {
  const [insights, setInsights] = useState<InsightData[]>([])
  const [predictiveData, setPredictiveData] = useState<PredictiveData[]>([])
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'insights' | 'predictions' | 'monitoring' | 'recommendations'>('insights')
  const [aiAnalysisRunning, setAiAnalysisRunning] = useState(false)

  useEffect(() => {
    if (investigationId) {
      loadDashboardData()
    }
  }, [investigationId])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      // Load AI insights
      await loadIntelligentInsights(token)
      
      // Load predictive analytics
      await loadPredictiveAnalytics(token)
      
      // Load monitoring data
      await loadMonitoringData(token)
      
    } catch (error) {
      console.error('Failed to load AI dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadIntelligentInsights = async (token: string) => {
    try {
      const response = await fetch('/api/proxy/advanced-ai/intelligent-analysis', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          investigation_id: investigationId,
          analysis_type: 'comprehensive',
          include_recommendations: true
        })
      })

      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
      }
    } catch (error) {
      console.error('Failed to load insights:', error)
      // Mock data for demo
      setInsights([
        {
          category: 'Data Quality',
          title: 'High Completeness Score: 94.2%',
          description: 'Data shows excellent completeness across all fields with minimal missing values',
          priority: 'high',
          confidence: 0.92,
          details: { completeness: 94.2, validity: 89.1, consistency: 91.5 }
        },
        {
          category: 'Pattern Recognition',
          title: 'Seasonal Trends Detected',
          description: 'AI identified recurring seasonal patterns in your data with 87% confidence',
          priority: 'medium',
          confidence: 0.87,
          details: { seasonality: 'quarterly', strength: 'moderate' }
        },
        {
          category: 'Anomaly Detection',
          title: '12 Statistical Outliers Found',
          description: 'Machine learning detected unusual patterns that may require investigation',
          priority: 'high',
          confidence: 0.95,
          details: { anomalies: 12, threshold: 0.05 }
        }
      ])
    }
  }

  const loadPredictiveAnalytics = async (token: string) => {
    try {
      // Mock predictive data for demo
      const mockPredictions: PredictiveData[] = Array.from({ length: 30 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() + i)
        const baseValue = 100 + Math.sin(i * 0.2) * 20
        
        return {
          date: date.toISOString().split('T')[0],
          predicted: baseValue + (Math.random() - 0.5) * 10,
          lower_bound: baseValue - 15,
          upper_bound: baseValue + 15,
          ...(i < 10 ? { actual: baseValue + (Math.random() - 0.5) * 5 } : {})
        }
      })
      
      setPredictiveData(mockPredictions)
    } catch (error) {
      console.error('Failed to load predictive data:', error)
    }
  }

  const loadMonitoringData = async (token: string) => {
    try {
      // Mock monitoring data
      setMonitoringAlerts([
        {
          id: '1',
          type: 'quality',
          severity: 'medium',
          message: 'Data completeness dropped below 90% threshold',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          resolved: false
        },
        {
          id: '2',
          type: 'anomaly',
          severity: 'high',
          message: 'Unusual spike in null values detected in customer_age field',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          resolved: true
        },
        {
          id: '3',
          type: 'performance',
          severity: 'low',
          message: 'Processing time increased by 15% compared to baseline',
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          resolved: false
        }
      ])
    } catch (error) {
      console.error('Failed to load monitoring data:', error)
    }
  }

  const runAdvancedAnalysis = async () => {
    setAiAnalysisRunning(true)
    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 3000))
      await loadIntelligentInsights(localStorage.getItem('token') || '')
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setAiAnalysisRunning(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getInsightIcon = (category: string) => {
    switch (category) {
      case 'Data Quality': return <CheckCircle className="w-5 h-5" />
      case 'Pattern Recognition': return <TrendingUp className="w-5 h-5" />
      case 'Anomaly Detection': return <AlertTriangle className="w-5 h-5" />
      default: return <Brain className="w-5 h-5" />
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">AI-Powered Insights</h2>
            <p className="text-purple-100">Advanced analytics and intelligent recommendations for your data</p>
          </div>
          <button
            onClick={runAdvancedAnalysis}
            disabled={aiAnalysisRunning}
            className="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {aiAnalysisRunning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Run Deep Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-1">
            {[
              { key: 'insights', label: 'AI Insights', icon: Brain },
              { key: 'predictions', label: 'Predictions', icon: TrendingUp },
              { key: 'monitoring', label: 'Real-time Monitoring', icon: Activity },
              { key: 'recommendations', label: 'Recommendations', icon: Target }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {/* Insights Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{insights.length}</div>
                  <div className="text-sm text-blue-600">Total Insights</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {insights.filter(i => i.priority === 'high').length}
                  </div>
                  <div className="text-sm text-green-600">High Priority</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {(insights.reduce((acc, i) => acc + i.confidence, 0) / insights.length * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-purple-600">Avg Confidence</div>
                </div>
              </div>

              {/* Insights List */}
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${getPriorityColor(insight.priority)}`}
                  >
                    <div className="flex items-start">
                      <div className={`flex-shrink-0 ${insight.priority === 'high' ? 'text-red-600' : insight.priority === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                        {getInsightIcon(insight.category)}
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                              {insight.category}
                            </span>
                            <h4 className="text-lg font-semibold text-gray-900 mt-1">{insight.title}</h4>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-600">
                              {(insight.confidence * 100).toFixed(0)}% confidence
                            </div>
                            <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${insight.confidence * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-600 mt-2">{insight.description}</p>
                        
                        {insight.details && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Details</h5>
                            <div className="text-xs text-gray-600">
                              {JSON.stringify(insight.details, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">30-Day Forecast</h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={predictiveData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="upper_bound"
                        stackId="1"
                        stroke="none"
                        fill="#e0e7ff"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="lower_bound"
                        stackId="1"
                        stroke="none"
                        fill="#ffffff"
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Prediction Summary</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-600 font-medium">Trend Direction</div>
                      <div className="text-lg font-semibold text-blue-900">Upward</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-600 font-medium">Confidence</div>
                      <div className="text-lg font-semibold text-green-900">87.3%</div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="text-sm text-purple-600 font-medium">Expected Growth</div>
                      <div className="text-lg font-semibold text-purple-900">+12.4%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="space-y-6">
              {/* Monitoring Status */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">98.2%</div>
                  <div className="text-sm text-green-600">System Health</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">24/7</div>
                  <div className="text-sm text-blue-600">Monitoring</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-600">
                    {monitoringAlerts.filter(a => !a.resolved).length}
                  </div>
                  <div className="text-sm text-yellow-600">Active Alerts</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {monitoringAlerts.filter(a => a.resolved).length}
                  </div>
                  <div className="text-sm text-purple-600">Resolved Today</div>
                </div>
              </div>

              {/* Alerts List */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h4>
                <div className="space-y-3">
                  {monitoringAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        alert.resolved ? 'bg-gray-50 border-gray-400' : 
                        alert.severity === 'high' ? 'bg-red-50 border-red-400' :
                        alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                        'bg-blue-50 border-blue-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <AlertTriangle className={`w-5 h-5 ${getSeverityColor(alert.severity)}`} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{alert.message}</div>
                            <div className="text-xs text-gray-500">
                              {alert.type} • {new Date(alert.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {alert.resolved ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              Resolved
                            </span>
                          ) : (
                            <button className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200">
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Recommendations</h3>
                <p className="text-gray-600">
                  Intelligent recommendations will appear here based on your data analysis
                </p>
                <button
                  onClick={runAdvancedAnalysis}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Generate Recommendations
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 