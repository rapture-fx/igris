import React from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, Shield } from 'lucide-react'
import { QualityAssessmentResult } from '@schlep-engine/types'
import { useQualityAssessment } from '../hooks'
import { cn } from '../../styles/utils'

export interface DataQualityIndicatorProps {
  datasetId?: string
  showDetails?: boolean
  showRecommendations?: boolean
  className?: string
}

export function DataQualityIndicator({ 
  datasetId,
  showDetails = true,
  showRecommendations = false,
  className 
}: DataQualityIndicatorProps) {
  const { assessments, getAssessment, isConnected } = useQualityAssessment()

  const assessment = datasetId ? getAssessment(datasetId) : assessments[0]

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-50 border-green-200'
    if (score >= 70) return 'bg-yellow-50 border-yellow-200'
    if (score >= 50) return 'bg-orange-50 border-orange-200'
    return 'bg-red-50 border-red-200'
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  if (!assessment && !isConnected) {
    return (
      <div className={cn("p-6 text-center text-gray-500 bg-gray-50 rounded-lg border", className)}>
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Not connected to quality assessment service</p>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className={cn("p-6 text-center text-gray-500 bg-gray-50 rounded-lg border", className)}>
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No quality assessment available</p>
        {datasetId && (
          <p className="text-sm mt-1">Dataset ID: {datasetId}</p>
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overall Score */}
      <div className={cn(
        "rounded-lg border p-6 text-center",
        getScoreBgColor(assessment.overallScore)
      )}>
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Shield className="h-6 w-6 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Data Quality Score</h3>
        </div>
        <div className={cn("text-4xl font-bold", getScoreColor(assessment.overallScore))}>
          {assessment.overallScore.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {assessment.overallScore >= 90 ? 'Excellent' :
           assessment.overallScore >= 70 ? 'Good' :
           assessment.overallScore >= 50 ? 'Fair' : 'Poor'}
        </div>
      </div>

      {/* Quality Dimensions */}
      {showDetails && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Quality Dimensions</h4>
          
          <div className="space-y-4">
            {Object.entries(assessment.dimensions).map(([dimension, score]) => (
              <div key={dimension} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {dimension}
                  </span>
                  <span className={cn("text-sm font-semibold", getScoreColor(score))}>
                    {score.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      score >= 90 ? 'bg-green-500' :
                      score >= 70 ? 'bg-yellow-500' :
                      score >= 50 ? 'bg-orange-500' : 'bg-red-500'
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues Summary */}
      {assessment.issues.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Data Issues</h4>
          
          <div className="space-y-3">
            {assessment.issues.map((issue, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                {getSeverityIcon(issue.severity)}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {issue.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      {issue.count.toLocaleString()} instances
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{issue.description}</p>
                  {issue.affectedColumns && (
                    <div className="text-xs text-gray-500">
                      Affected columns: {issue.affectedColumns.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {showRecommendations && assessment.recommendations.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Recommendations</h4>
          
          <div className="space-y-3">
            {assessment.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className={cn(
                  "h-2 w-2 rounded-full mt-2",
                  rec.priority === 'high' ? 'bg-red-500' :
                  rec.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                )} />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {rec.action}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded",
                        rec.priority === 'high' && "bg-red-100 text-red-700",
                        rec.priority === 'medium' && "bg-yellow-100 text-yellow-700",
                        rec.priority === 'low' && "bg-green-100 text-green-700"
                      )}>
                        {rec.priority} priority
                      </span>
                      <span className="text-xs text-gray-500">
                        +{rec.estimatedImpact.toFixed(1)}% impact
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}