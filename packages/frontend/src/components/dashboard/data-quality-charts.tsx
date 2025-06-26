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
    fill: item.color
  }))

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header with tabs */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Data Quality Analysis</h3>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'metrics', label: 'Quality Metrics' },
            { key: 'preview', label: 'Data Preview' },
            { key: 'trends', label: 'Quality Trends' },
            { key: 'insights', label: 'AI Insights' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* Overall Score */}
            {metrics && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 mb-4">
                  <span className="text-3xl font-bold text-blue-600">
                    {Math.round(metrics.overall_score)}
                  </span>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Overall Quality Score</h4>
                <p className="text-gray-600">Based on 5 key quality dimensions</p>
              </div>
            )}

            {/* Quality Metrics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div>
                <h5 className="text-lg font-medium text-gray-900 mb-4">Quality Dimensions</h5>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={qualityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div>
                <h5 className="text-lg font-medium text-gray-900 mb-4">Quality Distribution</h5>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preview' && preview && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{preview.total_rows.toLocaleString()}</div>
                <div className="text-sm text-blue-600">Total Records</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{preview.columns.length}</div>
                <div className="text-sm text-green-600">Data Columns</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {Object.values(preview.data_types).filter(type => type === 'string').length}
                </div>
                <div className="text-sm text-purple-600">Text Fields</div>
              </div>
            </div>

            {/* Data Types */}
            <div className="mb-6">
              <h5 className="text-lg font-medium text-gray-900 mb-3">Data Types</h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.data_types).map(([column, type]) => (
                  <span
                    key={column}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {column}: {type}
                  </span>
                ))}
              </div>
            </div>

            {/* Sample Data Table */}
            <div>
              <h5 className="text-lg font-medium text-gray-900 mb-3">Sample Data</h5>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.columns.map((column) => (
                        <th
                          key={column}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.sample_rows.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {preview.columns.map((column) => (
                          <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row[column] !== null ? String(row[column]) : (
                              <span className="text-gray-400 italic">null</span>
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
              <h5 className="text-lg font-medium text-gray-900 mb-4">Quality Score Trends</h5>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[70, 100]} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="url(#colorScore)"
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h5 className="text-lg font-medium text-gray-900 mb-4">Issues Detected</h5>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="issues"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  insight.type === 'success'
                    ? 'bg-green-50 border-green-400'
                    : insight.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-400'
                    : insight.type === 'error'
                    ? 'bg-red-50 border-red-400'
                    : 'bg-blue-50 border-blue-400'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h6 className="text-sm font-medium text-gray-900">{insight.title}</h6>
                      {insight.count && (
                        <span className="text-sm font-semibold text-gray-600">
                          {insight.count}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                    {insight.recommendation && (
                      <div className="mt-2 p-2 bg-white rounded border">
                        <p className="text-xs text-gray-700">
                          <strong>Recommendation:</strong> {insight.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
    value: item.value,
    fill: item.color
  }))

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Data Quality Analysis</h3>
          <div className="flex items-center space-x-2">
            <button className="text-gray-600 hover:text-gray-900 p-1">
              <Filter className="w-4 h-4" />
            </button>
            <button className="text-gray-600 hover:text-gray-900 p-1">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mt-4">
          {[
            { id: 'metrics', label: 'Quality Metrics' },
            { id: 'preview', label: 'Data Preview' },
            { id: 'trends', label: 'Quality Trends' },
            { id: 'insights', label: 'Insights' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'metrics' && metrics && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-8 border-gray-200 relative">
                <div 
                  className="absolute inset-0 rounded-full border-8 border-transparent"
                  style={{
                    borderTopColor: getQualityColor(metrics.overall_score),
                    borderRightColor: getQualityColor(metrics.overall_score),
                    borderBottomColor: metrics.overall_score > 50 ? getQualityColor(metrics.overall_score) : 'transparent',
                    borderLeftColor: metrics.overall_score > 75 ? getQualityColor(metrics.overall_score) : 'transparent',
                    transform: `rotate(${(metrics.overall_score / 100) * 360}deg)`
                  }}
                />
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(metrics.overall_score)}%
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">Overall Quality Score</p>
            </div>

            {/* Quality Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4">Quality Dimensions</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={qualityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill={(entry) => entry.color} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4">Quality Distribution</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preview' && preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Data Sample</h4>
                <p className="text-xs text-gray-600">
                  Showing 5 of {preview.total_rows.toLocaleString()} rows
                </p>
              </div>
              <button className="flex items-center text-sm text-blue-600 hover:text-blue-700">
                <Eye className="w-4 h-4 mr-1" />
                View Full Dataset
              </button>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {preview.columns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        <div className="flex flex-col">
                          <span>{column}</span>
                          <span className="normal-case text-gray-400">
                            {preview.data_types[column]}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.sample_rows.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {preview.columns.map((column) => (
                        <td key={column} className="px-4 py-3 text-sm text-gray-900">
                          {row[column] === null || row[column] === undefined ? (
                            <span className="text-gray-400 italic">null</span>
                          ) : (
                            String(row[column])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">Quality Score Over Time</h4>
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
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">Data Quality Insights</h4>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-gray-900">
                          {insight.title}
                        </h5>
                        {insight.count && (
                          <span className="text-sm text-gray-500">
                            {insight.count}{insight.type === 'success' || insight.type === 'info' ? '%' : ' issues'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {insight.description}
                      </p>
                      {insight.recommendation && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                          <strong>Recommendation:</strong> {insight.recommendation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 