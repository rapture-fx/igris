'use client'

import { useState, useEffect } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Activity, TrendingUp, Database, Brain } from 'lucide-react'

interface Investigation {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress_percentage: number
  quality_score?: number
  created_at: string
  updated_at: string
}

interface QuickInsights {
  status: string
  progress: number
  quality_score?: number
  total_records: number
  issues_found: number
  patterns_found: number
  last_updated?: string
}

export function DataProcessingOverview() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvestigation, setSelectedInvestigation] = useState<string | null>(null)
  const [insights, setInsights] = useState<QuickInsights | null>(null)

  useEffect(() => {
    fetchInvestigations()
  }, [])

  useEffect(() => {
    if (selectedInvestigation) {
      fetchInsights(selectedInvestigation)
    }
  }, [selectedInvestigation])

  const fetchInvestigations = async () => {
    try {
      const response = await fetch('/api/proxy/data/investigations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setInvestigations(data)
        if (data.length > 0 && !selectedInvestigation) {
          setSelectedInvestigation(data[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch investigations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchInsights = async (investigationId: string) => {
    try {
      const response = await fetch(`/api/proxy/data/quick-insights/${investigationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setInsights(data)
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'running':
        return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <FileText className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Data Processing Overview</h2>
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-600">
              {investigations.length} investigations
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <Database className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-600">Total Records</p>
                <p className="text-2xl font-bold text-blue-900">
                  {insights?.total_records?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-600">Quality Score</p>
                <p className="text-2xl font-bold text-green-900">
                  {insights?.quality_score ? `${Math.round(insights.quality_score * 100)}%` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-8 h-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-orange-600">Issues Found</p>
                <p className="text-2xl font-bold text-orange-900">
                  {insights?.issues_found || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <Brain className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-purple-600">Patterns</p>
                <p className="text-2xl font-bold text-purple-900">
                  {insights?.patterns_found || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Investigations List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Investigations</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {investigations.length === 0 ? (
            <div className="p-6 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No investigations yet</h3>
              <p className="text-gray-600 mb-4">Upload your first data file to get started with AI-powered analysis</p>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Upload Data File
              </button>
            </div>
          ) : (
            investigations.map((investigation) => (
              <div 
                key={investigation.id}
                className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedInvestigation === investigation.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => setSelectedInvestigation(investigation.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(investigation.status)}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{investigation.name}</h4>
                      <p className="text-sm text-gray-600">
                        Created {new Date(investigation.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(investigation.status)}`}>
                      {investigation.status}
                    </span>
                    
                    {investigation.progress_percentage > 0 && (
                      <div className="w-20">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${investigation.progress_percentage}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 text-center">
                          {Math.round(investigation.progress_percentage)}%
                        </p>
                      </div>
                    )}

                    {investigation.quality_score && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          Quality: {Math.round(investigation.quality_score * 100)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Processing Pipeline Status */}
      {selectedInvestigation && insights && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Pipeline</h3>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <span className="ml-2 text-sm font-medium text-gray-900">Upload</span>
              </div>
              
              <div className="flex-1 h-px bg-gray-300"></div>
              
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  insights.status === 'running' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {insights.status === 'running' ? (
                    <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-900">Processing</span>
              </div>
              
              <div className="flex-1 h-px bg-gray-300"></div>
              
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  insights.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {insights.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Brain className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-900">Insights</span>
              </div>
            </div>
          </div>

          {insights.progress < 100 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Processing Progress</span>
                <span>{Math.round(insights.progress)}%</span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${insights.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {insights.last_updated && (
            <p className="text-xs text-gray-500">
              Last updated: {new Date(insights.last_updated).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
} 