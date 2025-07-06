'use client'

import { useState, useEffect } from 'react'
import { 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw, 
  Shield, 
  Eye, 
  Filter, 
  Search, 
  Calendar, 
  BarChart3, 
  Activity, 
  Bell, 
  Settings, 
  Download, 
  Upload, 
  Database, 
  Zap, 
  Target, 
  Clock, 
  Users, 
  FileText, 
  ArrowUpRight, 
  ChevronRight, 
  TrendingDown, 
  Minus, 
  Info, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface Anomaly {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: 'statistical' | 'pattern' | 'data_quality' | 'business_rule' | 'temporal'
  status: 'active' | 'investigating' | 'resolved' | 'false_positive'
  confidence: number
  affected_records: number
  data_source: string
  field_name?: string
  detected_at: string
  resolved_at?: string
  impact_score: number
  suggested_action: string
  details: {
    expected_range?: string
    actual_value?: string
    threshold?: number
    pattern?: string
  }
}

interface AnomalyStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  resolved_today: number
  false_positives: number
  avg_detection_time: number
  data_health_score: number
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [stats, setStats] = useState<AnomalyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('severity')

  // Mock data for demonstration
  const mockAnomalies: Anomaly[] = [
    {
      id: '1',
      title: 'Unusual Purchase Amount Spike',
      description: 'Detected 15 transactions with amounts significantly higher than normal distribution (>3 standard deviations)',
      severity: 'critical',
      type: 'statistical',
      status: 'active',
      confidence: 95,
      affected_records: 15,
      data_source: 'Transaction Database',
      field_name: 'purchase_amount',
      detected_at: '2024-01-15T10:30:00Z',
      impact_score: 8.5,
      suggested_action: 'Review transactions over $10,000 for potential fraud or data entry errors',
      details: {
        expected_range: '$50 - $2,500',
        actual_value: '$15,000 - $45,000',
        threshold: 3.0
      }
    },
    {
      id: '2',
      title: 'Missing Customer Phone Numbers',
      description: 'Sudden increase in null phone number fields, concentrated in specific time period',
      severity: 'high',
      type: 'data_quality',
      status: 'investigating',
      confidence: 88,
      affected_records: 342,
      data_source: 'Customer Database',
      field_name: 'phone_number',
      detected_at: '2024-01-15T09:15:00Z',
      impact_score: 6.2,
      suggested_action: 'Check data collection process during January 10-12 timeframe',
      details: {
        pattern: 'Clustered missing values in 48-hour window'
      }
    },
    {
      id: '3',
      title: 'Irregular Login Pattern',
      description: 'User login frequency shows unusual pattern compared to historical behavior',
      severity: 'medium',
      type: 'pattern',
      status: 'active',
      confidence: 72,
      affected_records: 23,
      data_source: 'User Activity Logs',
      field_name: 'login_timestamp',
      detected_at: '2024-01-15T08:45:00Z',
      impact_score: 4.1,
      suggested_action: 'Monitor user behavior for potential security concerns',
      details: {
        pattern: 'Login frequency 400% above baseline'
      }
    },
    {
      id: '4',
      title: 'Product Category Mismatch',
      description: 'Products assigned to incorrect categories based on naming patterns and descriptions',
      severity: 'medium',
      type: 'business_rule',
      status: 'resolved',
      confidence: 91,
      affected_records: 67,
      data_source: 'Product Catalog',
      field_name: 'category',
      detected_at: '2024-01-14T16:20:00Z',
      resolved_at: '2024-01-15T09:30:00Z',
      impact_score: 5.3,
      suggested_action: 'Update category assignment rules and validate existing data',
      details: {
        pattern: 'Electronics items in Clothing category'
      }
    },
    {
      id: '5',
      title: 'Seasonal Sales Deviation',
      description: 'Sales figures significantly lower than expected for this time period based on historical trends',
      severity: 'high',
      type: 'temporal',
      status: 'active',
      confidence: 84,
      affected_records: 1250,
      data_source: 'Sales Database',
      field_name: 'daily_sales',
      detected_at: '2024-01-15T07:00:00Z',
      impact_score: 7.8,
      suggested_action: 'Investigate potential data collection issues or actual business impact',
      details: {
        expected_range: '$45,000 - $65,000',
        actual_value: '$22,000',
        threshold: 2.5
      }
    }
  ]

  const mockStats: AnomalyStats = {
    total: 23,
    critical: 3,
    high: 5,
    medium: 8,
    low: 7,
    resolved_today: 4,
    false_positives: 2,
    avg_detection_time: 12,
    data_health_score: 87
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Mock API delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        setAnomalies(mockAnomalies)
        setStats(mockStats)
      } catch (error) {
        console.error('Error fetching anomalies:', error)
      } finally {
    setLoading(false)
      }
    }

    fetchData()
  }, [])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'medium': return <Info className="w-4 h-4 text-yellow-500" />
      case 'low': return <CheckCircle className="w-4 h-4 text-blue-500" />
      default: return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'investigating': return <Eye className="w-4 h-4 text-yellow-500" />
      case 'resolved': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'false_positive': return <XCircle className="w-4 h-4 text-gray-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-800'
      case 'investigating': return 'bg-yellow-100 text-yellow-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'false_positive': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'statistical': return <BarChart3 className="w-5 h-5 text-blue-600" />
      case 'pattern': return <TrendingUp className="w-5 h-5 text-purple-600" />
      case 'data_quality': return <Shield className="w-5 h-5 text-green-600" />
      case 'business_rule': return <Target className="w-5 h-5 text-orange-600" />
      case 'temporal': return <Clock className="w-5 h-5 text-indigo-600" />
      default: return <AlertTriangle className="w-5 h-5 text-gray-600" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  const getTimeSince = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return 'Just now'
  }

  const filteredAnomalies = anomalies.filter(anomaly => {
    const matchesSearch = anomaly.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         anomaly.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || anomaly.severity === severityFilter
    const matchesType = typeFilter === 'all' || anomaly.type === typeFilter
    const matchesStatus = statusFilter === 'all' || anomaly.status === statusFilter
    return matchesSearch && matchesSeverity && matchesType && matchesStatus
  })

  const sortedAnomalies = [...filteredAnomalies].sort((a, b) => {
    switch (sortBy) {
      case 'severity':
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return severityOrder[b.severity] - severityOrder[a.severity]
      case 'confidence': return b.confidence - a.confidence
      case 'impact': return b.impact_score - a.impact_score
      case 'recent':
      default: return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading anomaly detection...</span>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load anomaly data</h3>
          <p className="text-gray-600">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Anomaly Detection</h1>
          <p className="text-gray-600 mt-1">Automatically identify data quality issues and unusual patterns</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all transform hover:scale-105">
            <Settings className="w-4 h-4 mr-2" />
            Configure Rules
          </button>
        </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Issues Found</p>
              <p className="text-3xl font-bold text-red-600">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.critical} critical</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Data Health Score</p>
              <p className="text-3xl font-bold text-green-600">{stats.data_health_score}%</p>
              <p className="text-xs text-emerald-600 mt-1 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +3% this week
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Resolved Today</p>
              <p className="text-3xl font-bold text-blue-600">{stats.resolved_today}</p>
              <p className="text-xs text-gray-500 mt-1">avg {stats.avg_detection_time}min to detect</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">False Positives</p>
              <p className="text-3xl font-bold text-gray-600">{stats.false_positives}</p>
              <p className="text-xs text-gray-500 mt-1">this week</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Severity Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
            <p className="text-sm text-red-700 font-medium">Critical</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
            <p className="text-sm text-orange-700 font-medium">High</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-100">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Info className="w-4 h-4 text-yellow-600" />
              </div>
            <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
            <p className="text-sm text-yellow-700 font-medium">Medium</p>
              </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.low}</p>
            <p className="text-sm text-blue-700 font-medium">Low</p>
          </div>
              </div>
              </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search anomalies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="statistical">Statistical</option>
              <option value="pattern">Pattern</option>
              <option value="data_quality">Data Quality</option>
              <option value="business_rule">Business Rule</option>
              <option value="temporal">Temporal</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False Positive</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="severity">Severity</option>
              <option value="recent">Most Recent</option>
              <option value="confidence">Confidence</option>
              <option value="impact">Impact Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-4">
        {sortedAnomalies.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No anomalies found</h3>
            <p className="text-gray-600">
              {searchTerm || severityFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Your data looks healthy! No anomalies detected at this time.'
              }
            </p>
          </div>
        ) : (
          sortedAnomalies.map((anomaly) => (
            <div key={anomaly.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    {getTypeIcon(anomaly.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{anomaly.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(anomaly.status)}`}>
                        {anomaly.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3">{anomaly.description}</p>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-600 mb-3">
                      <span className="flex items-center">
                        <Database className="w-4 h-4 mr-1" />
                        {anomaly.data_source}
                      </span>
                      {anomaly.field_name && (
                        <span className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          {anomaly.field_name}
                        </span>
                      )}
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(anomaly.detected_at)}
                      </span>
                      <span>{formatNumber(anomaly.affected_records)} records affected</span>
                    </div>

                    <div className="flex items-center space-x-6 text-sm mb-4">
                      <div className="flex items-center">
                        <span className="text-gray-600 mr-2">Confidence:</span>
                        <div className="flex items-center">
                          <div className="w-16 h-2 bg-gray-200 rounded-full mr-2">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${anomaly.confidence}%` }}
                            />
                          </div>
                          <span className="font-medium text-gray-900">{anomaly.confidence}%</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-gray-600 mr-2">Impact:</span>
                        <span className="font-medium text-gray-900">{anomaly.impact_score}/10</span>
                      </div>
                      <span className="text-gray-500">{getTimeSince(anomaly.detected_at)}</span>
                    </div>

                    {/* Details */}
                    {Object.keys(anomaly.details).length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {anomaly.details.expected_range && (
                            <div>
                              <span className="text-gray-600">Expected: </span>
                              <span className="font-medium">{anomaly.details.expected_range}</span>
                            </div>
                          )}
                          {anomaly.details.actual_value && (
                            <div>
                              <span className="text-gray-600">Actual: </span>
                              <span className="font-medium">{anomaly.details.actual_value}</span>
                            </div>
                          )}
                          {anomaly.details.threshold && (
                            <div>
                              <span className="text-gray-600">Threshold: </span>
                              <span className="font-medium">{anomaly.details.threshold}σ</span>
                            </div>
                          )}
                          {anomaly.details.pattern && (
                            <div>
                              <span className="text-gray-600">Pattern: </span>
                              <span className="font-medium">{anomaly.details.pattern}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Suggested Action */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-medium text-blue-900 mb-1">Suggested Action</h4>
                          <p className="text-sm text-blue-800">{anomaly.suggested_action}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {getStatusIcon(anomaly.status)}
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Eye className="w-4 h-4 text-gray-600" />
                  </button>
                  {anomaly.status === 'active' && (
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Settings className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
