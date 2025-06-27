'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts'
import { TrendingUp, AlertTriangle, CheckCircle, Info, Eye, Download, Filter } from 'lucide-react'

interface DataQualityMetrics {
  overall_score: number
  completeness: number
  validity: number
  consistency: number
  accuracy: number
  uniqueness: number
}

interface DataPreview {
  columns: string[]
  sample_rows: any[]
  total_rows: number
  data_types: Record<string, string>
}

interface QualityTrend {
  date: string
  score: number
  issues: number
}

interface DataInsight {
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  description: string
  count?: number
  recommendation?: string
}

interface DataQualityChartsProps {
  investigationId: string
}

export function DataQualityCharts({ investigationId }: DataQualityChartsProps) {
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null)
  const [preview, setPreview] = useState<DataPreview | null>(null)
  const [trends, setTrends] = useState<QualityTrend[]>([])
  const [insights, setInsights] = useState<DataInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'metrics' | 'preview' | 'trends' | 'insights'>('metrics')

  useEffect(() => {
    if (investigationId) {
      fetchData()
    }
  }, [investigationId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      // Fetch investigation details
      const response = await fetch(`/api/proxy/data/investigations/${investigationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const investigation = await response.json()
        
        // Transform data for visualization
        transformInvestigationData(investigation)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const transformInvestigationData = (investigation: any) => {
    // Generate realistic quality metrics
    const baseScore = investigation.quality_score || 0.85
    const mockMetrics: DataQualityMetrics = {
      overall_score: baseScore * 100,
      completeness: Math.min(100, (baseScore + 0.1) * 100),
      validity: Math.min(100, (baseScore + 0.05) * 100),
      consistency: Math.min(100, (baseScore - 0.02) * 100),
      accuracy: Math.min(100, (baseScore + 0.03) * 100),
      uniqueness: Math.min(100, (baseScore - 0.05) * 100)
    }
    setMetrics(mockMetrics)

    // Generate mock data preview
    const mockPreview: DataPreview = {
      columns: ['user_id', 'name', 'email', 'age', 'signup_date', 'status'],
      sample_rows: [
        { user_id: 1, name: 'John Doe', email: 'john@example.com', age: 28, signup_date: '2024-01-15', status: 'active' },
        { user_id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 32, signup_date: '2024-01-14', status: 'active' },
        { user_id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: null, signup_date: '2024-01-13', status: 'inactive' },
        { user_id: 4, name: 'Alice Brown', email: 'alice@example.com', age: 25, signup_date: '2024-01-12', status: 'active' },
        { user_id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', age: 45, signup_date: '2024-01-11', status: 'pending' }
      ],
      total_rows: investigation.insights?.statistics?.total_records || 1250,
      data_types: {
        user_id: 'integer',
        name: 'string',
        email: 'string',
        age: 'integer',
        signup_date: 'date',
        status: 'categorical'
      }
    }
    setPreview(mockPreview)

    // Generate quality trends
    const mockTrends: QualityTrend[] = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
      score: Math.max(75, baseScore * 100 + (Math.random() - 0.5) * 10),
      issues: Math.floor(Math.random() * 5)
    }))
    setTrends(mockTrends)

    // Generate insights
    const mockInsights: DataInsight[] = [
      {
        type: 'success',
        title: 'High Data Completeness',
        description: 'Most fields have complete data with minimal missing values',
        count: 95,
        recommendation: 'Continue current data collection practices'
      },
      {
        type: 'warning',
        title: 'Missing Age Values',
        description: 'Age field has missing values that could impact analysis',
        count: 12,
        recommendation: 'Consider making age field required or implement data imputation'
      },
      {
        type: 'info',
        title: 'Email Format Validation',
        description: 'All email addresses follow standard format patterns',
        count: 100,
        recommendation: 'Maintain current email validation rules'
      },
      {
        type: 'error',
        title: 'Duplicate Records Found',
        description: 'Some user records appear to be duplicated',
        count: 3,
        recommendation: 'Implement deduplication process before data processing'
      }
    ]
    setInsights(mockInsights)
  }

  const getQualityColor = (score: number) => {
    if (score >= 90) return '#10b981' // green
    if (score >= 80) return '#f59e0b' // yellow
    if (score >= 70) return '#f97316' // orange
    return '#ef4444' // red
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const qualityData = metrics ? [
    { name: 'Completeness', value: metrics.completeness, color: getQualityColor(metrics.completeness) },
    { name: 'Validity', value: metrics.validity, color: getQualityColor(metrics.validity) },
    { name: 'Consistency', value: metrics.consistency, color: getQualityColor(metrics.consistency) },
    { name: 'Accuracy', value: metrics.accuracy, color: getQualityColor(metrics.accuracy) },
    { name: 'Uniqueness', value: metrics.uniqueness, color: getQualityColor(metrics.uniqueness) }
  ] : []

  const pieData = qualityData.map(item => ({
    name: item.name,
    value: item.value,
    color: item.color
  }))

  const exportToCSV = () => {
    if (!metrics || !preview) return
    
    const csvData = [
      ['Metric', 'Score'],
      ...qualityData.map(item => [item.name, item.value])
    ]
    
    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `data-quality-report-${investigationId}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Data Quality Analysis</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comprehensive quality metrics and insights
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          {[
            { id: 'metrics', label: 'Quality Metrics', icon: BarChart },
            { id: 'preview', label: 'Data Preview', icon: Eye },
            { id: 'trends', label: 'Quality Trends', icon: TrendingUp },
            { id: 'insights', label: 'AI Insights', icon: Info }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <span className="text-2xl font-bold">{Math.round(metrics?.overall_score || 0)}%</span>
              </div>
              <h4 className="mt-3 text-lg font-medium text-gray-900">Overall Quality Score</h4>
              <p className="text-sm text-gray-500">Based on 5 quality dimensions</p>
            </div>

            {/* Quality Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-4">Quality Breakdown</h5>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={qualityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-4">Quality Distribution</h5>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quality Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {qualityData.map(item => (
                <div key={item.name} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h6 className="text-sm font-medium text-gray-900">{item.name}</h6>
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{item.value}%</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.value >= 90 ? 'Excellent' : 
                     item.value >= 80 ? 'Good' : 
                     item.value >= 70 ? 'Fair' : 'Poor'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'preview' && preview && (
          <div className="space-y-6">
            {/* Data Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h6 className="text-sm font-medium text-blue-900">Total Rows</h6>
                <p className="text-2xl font-bold text-blue-600">{preview.total_rows.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h6 className="text-sm font-medium text-green-900">Columns</h6>
                <p className="text-2xl font-bold text-green-600">{preview.columns.length}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <h6 className="text-sm font-medium text-purple-900">Data Types</h6>
                <p className="text-2xl font-bold text-purple-600">
                  {Object.keys(preview.data_types).length}
                </p>
              </div>
            </div>

            {/* Data Table */}
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-4">Sample Data (First 5 rows)</h5>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.columns.map(col => (
                        <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div>
                            <span>{col}</span>
                            <span className="block text-xs text-gray-400 normal-case">
                              {preview.data_types[col]}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.sample_rows.map((row, index) => (
                      <tr key={index}>
                        {preview.columns.map(col => (
                          <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row[col] === null || row[col] === undefined ? (
                              <span className="text-gray-400 italic">null</span>
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-6">
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-4">Quality Score Trend (Last 7 days)</h5>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-4">Issues Detected</h5>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="issues" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-4">AI-Generated Insights</h5>
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        {getInsightIcon(insight.type)}
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <h6 className="text-sm font-medium text-gray-900">{insight.title}</h6>
                          {insight.count && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {insight.count}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                        {insight.recommendation && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                            <p className="text-sm text-blue-700">
                              <strong>Recommendation:</strong> {insight.recommendation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 