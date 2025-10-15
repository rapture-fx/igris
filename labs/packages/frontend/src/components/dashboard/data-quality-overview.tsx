'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

interface DataQualityMetrics {
  overall_score: number
  investigations_count: number
  issues_count: number
  excellent_count: number
  good_count: number
  fair_count: number
  poor_count: number
  trend_direction: string
}

export function DataQualityOverview() {
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQualityMetrics()
  }, [])

  const fetchQualityMetrics = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/proxy/dashboard/data-quality', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
      } else {
        // Fallback to empty data
        setMetrics({
          overall_score: 0,
          investigations_count: 0,
          issues_count: 0,
          excellent_count: 0,
          good_count: 0,
          fair_count: 0,
          poor_count: 0,
          trend_direction: 'stable'
        })
      }
    } catch (error) {
      console.error('Failed to fetch quality metrics:', error)
      setMetrics({
        overall_score: 0,
        investigations_count: 0,
        issues_count: 0,
        excellent_count: 0,
        good_count: 0,
        fair_count: 0,
        poor_count: 0,
        trend_direction: 'stable'
      })
    } finally {
      setLoading(false)
    }
  }

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <TrendingUp className="w-5 h-5 text-green-500" />
      case 'down': return <TrendingDown className="w-5 h-5 text-red-500" />
      default: return <Minus className="w-5 h-5 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!metrics || metrics.investigations_count === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Data Quality Overview</h3>
          <Link
            href="/dashboard/data-sources"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Upload Data
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Data Quality Analysis Yet</h4>
          <p className="text-gray-600 mb-6">Upload your first dataset to see quality insights</p>
          <Link
            href="/dashboard/data-sources"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Dataset
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Data Quality Overview</h3>
            <p className="text-sm text-gray-600 mt-1">
              {metrics.investigations_count} dataset{metrics.investigations_count !== 1 ? 's' : ''} analyzed
            </p>
          </div>
          <Link
            href="/dashboard/data-sources"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View Details
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>

      <div className="p-6">
        {/* Overall Score */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full text-white text-xl font-bold mb-3 ${
            metrics.overall_score >= 90 ? 'bg-green-500' :
            metrics.overall_score >= 80 ? 'bg-yellow-500' :
            metrics.overall_score >= 70 ? 'bg-orange-500' : 'bg-red-500'
          }`}>
            {Math.round(metrics.overall_score)}%
          </div>
          <div className="flex items-center justify-center space-x-2">
            <h4 className="text-lg font-medium text-gray-900">Overall Quality Score</h4>
            {getTrendIcon(metrics.trend_direction)}
          </div>
          {metrics.issues_count > 0 && (
            <p className="text-sm text-orange-600 mt-1">
              {metrics.issues_count} issue{metrics.issues_count !== 1 ? 's' : ''} need attention
            </p>
          )}
        </div>

        {/* Quality Distribution */}
        <div>
          <h5 className="text-sm font-medium text-gray-900 mb-3">Quality Distribution</h5>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-700">Excellent (90-100%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{metrics.excellent_count}</span>
                <div className="w-16 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-green-500 rounded-full"
                    style={{ width: `${metrics.investigations_count > 0 ? (metrics.excellent_count / metrics.investigations_count) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-gray-700">Good (80-89%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{metrics.good_count}</span>
                <div className="w-16 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-yellow-500 rounded-full"
                    style={{ width: `${metrics.investigations_count > 0 ? (metrics.good_count / metrics.investigations_count) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-700">Fair (70-79%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{metrics.fair_count}</span>
                <div className="w-16 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-orange-500 rounded-full"
                    style={{ width: `${metrics.investigations_count > 0 ? (metrics.fair_count / metrics.investigations_count) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-700">Poor (&lt;70%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{metrics.poor_count}</span>
                <div className="w-16 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-red-500 rounded-full"
                    style={{ width: `${metrics.investigations_count > 0 ? (metrics.poor_count / metrics.investigations_count) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 