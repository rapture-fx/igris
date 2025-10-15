"use client"

import React, { useState, useMemo } from 'react'
import { FileText, Database, BarChart3, TrendingUp, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { useInvestigations, useInvestigationInsights } from '@/hooks/useAPIData'

// ==================== TYPES ====================

interface Investigation {
  id: string
  name: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress_percentage: number
  quality_score?: number
  total_records?: number
  file_size_bytes?: number
  created_at: string
  data_source_config?: {
    filename?: string
    file_type?: string
  }
}

interface QuickInsights {
  total_rows: number
  total_columns: number
  data_quality_score: number
  issues_found: number
  processing_time_seconds: number
  recommendations: string[]
}

// ==================== COMPONENT ====================

export function DataProcessingOverview() {
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null)

  // Use custom hooks instead of manual state management
  const {
    data: investigations,
    loading: investigationsLoading,
    error: investigationsError,
    refetch: refetchInvestigations
  } = useInvestigations({
    onSuccess: (data) => {
      // Auto-select first investigation if none selected
      if (data.length > 0 && !selectedInvestigationId) {
        setSelectedInvestigationId(data[0].id)
      }
    }
  })

  const {
    data: insights,
    loading: insightsLoading,
    error: insightsError,
    refetch: refetchInsights
  } = useInvestigationInsights(selectedInvestigationId || '', {
    enabled: !!selectedInvestigationId
  })

  // Computed values using useMemo for performance
  const selectedInvestigation = useMemo(() => {
    return investigations?.find(inv => inv.id === selectedInvestigationId) || null
  }, [investigations, selectedInvestigationId])

  const processingStats = useMemo(() => {
    if (!investigations) return { total: 0, completed: 0, processing: 0, failed: 0 }
    
    return investigations.reduce((acc, inv) => {
      acc.total++
      if (inv.status === 'completed') acc.completed++
      else if (inv.status === 'processing') acc.processing++
      else if (inv.status === 'failed') acc.failed++
      return acc
    }, { total: 0, completed: 0, processing: 0, failed: 0 })
  }, [investigations])

  // Event handlers
  const handleInvestigationSelect = (investigationId: string) => {
    setSelectedInvestigationId(investigationId)
  }

  const handleRefresh = async () => {
    await Promise.all([
      refetchInvestigations(),
      selectedInvestigationId ? refetchInsights() : Promise.resolve()
    ])
  }

  // Loading state
  if (investigationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading investigations...</span>
      </div>
    )
  }

  // Error state
  if (investigationsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">Failed to load investigations</span>
        </div>
        <button
          onClick={handleRefresh}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Empty state
  if (!investigations || investigations.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Processed Yet</h3>
        <p className="text-gray-500 mb-6">Upload your first dataset to see processing insights here.</p>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Upload Data
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Processing Overview</h2>
          <p className="text-gray-600 mt-1">
            {processingStats.total} investigations • {processingStats.completed} completed
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Investigations"
          value={processingStats.total}
          icon={<FileText className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Completed"
          value={processingStats.completed}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Processing"
          value={processingStats.processing}
          icon={<RefreshCw className="w-5 h-5 animate-spin" />}
          color="yellow"
        />
        <StatCard
          title="Failed"
          value={processingStats.failed}
          icon={<AlertCircle className="w-5 h-5" />}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Investigation list */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Investigations</h3>
          <div className="space-y-3">
            {investigations.slice(0, 5).map((investigation) => (
              <InvestigationItem
                key={investigation.id}
                investigation={investigation}
                isSelected={investigation.id === selectedInvestigationId}
                onClick={() => handleInvestigationSelect(investigation.id)}
              />
            ))}
          </div>
        </div>

        {/* Selected investigation insights */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h3>
          {insightsLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : insightsError ? (
            <div className="text-red-600 text-sm">Failed to load insights</div>
          ) : insights && selectedInvestigation ? (
            <InsightsDisplay insights={insights} investigation={selectedInvestigation} />
          ) : (
            <div className="text-gray-500 text-center py-8">
              Select an investigation to view insights
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

interface StatCardProps {
  title: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'yellow' | 'red'
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    red: 'text-red-600 bg-red-50'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

interface InvestigationItemProps {
  investigation: Investigation
  isSelected: boolean
  onClick: () => void
}

function InvestigationItem({ investigation, isSelected, onClick }: InvestigationItemProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'processing': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
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

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            {getStatusIcon(investigation.status)}
            <span className="ml-2 font-medium text-gray-900 truncate">
              {investigation.name}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {formatDate(investigation.created_at)}
          </div>
        </div>
        {investigation.quality_score && (
          <div className="ml-3 text-right">
            <div className="text-sm font-medium text-gray-900">
              {investigation.quality_score}%
            </div>
            <div className="text-xs text-gray-500">Quality</div>
          </div>
        )}
      </div>
    </div>
  )
}

interface InsightsDisplayProps {
  insights: QuickInsights
  investigation: Investigation
}

function InsightsDisplay({ insights, investigation }: InsightsDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{insights.total_rows.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Rows</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{insights.total_columns}</div>
          <div className="text-sm text-gray-600">Columns</div>
        </div>
      </div>

      <div className="p-3 bg-green-50 rounded-lg">
        <div className="flex items-center">
          <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
          <span className="font-medium text-green-900">
            Quality Score: {insights.data_quality_score}%
          </span>
        </div>
      </div>

      {insights.issues_found > 0 && (
        <div className="p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="font-medium text-yellow-900">
              {insights.issues_found} issues found
            </span>
          </div>
        </div>
      )}

      {insights.recommendations.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {insights.recommendations.slice(0, 3).map((rec, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start">
                <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default DataProcessingOverview 