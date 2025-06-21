'use client'

import { UploadResponse, JobStatus } from '@/lib/api'
import { CheckCircle, AlertTriangle, Clock, FileText, Brain } from 'lucide-react'

interface UploadProgressProps {
  isUploading: boolean
  progress: number
  uploadResponse: UploadResponse | null
  jobStatus: JobStatus | null
  onStartCleaning: () => void
}

export function UploadProgress({ 
  isUploading, 
  progress, 
  uploadResponse, 
  jobStatus,
  onStartCleaning 
}: UploadProgressProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:
        return <FileText className="w-5 h-5 text-gray-400" />
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 bg-green-100'
    if (score >= 0.7) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Progress</h2>
      
      {/* Upload Status */}
      <div className="space-y-4">
        {/* File Upload Step */}
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            uploadResponse ? 'bg-green-100' : isUploading ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {uploadResponse ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : isUploading ? (
              <Clock className="w-5 h-5 text-blue-600 animate-spin" />
            ) : (
              <FileText className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                File Upload
              </span>
              {isUploading && (
                <span className="text-sm text-gray-500">{progress}%</span>
              )}
            </div>
            {isUploading && (
              <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {uploadResponse && (
              <div className="text-sm text-gray-500 mt-1">
                {uploadResponse.upload_info.filename} ({uploadResponse.upload_info.size_mb.toFixed(1)} MB)
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis Step */}
        {uploadResponse && (
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              jobStatus?.status === 'completed' ? 'bg-green-100' : 
              jobStatus?.status === 'processing' ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              {getStatusIcon(jobStatus?.status || 'created')}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  AI Analysis
                </span>
                {jobStatus?.status === 'processing' && (
                  <span className="text-sm text-gray-500">{jobStatus.progress}%</span>
                )}
              </div>
              {jobStatus?.status === 'processing' && (
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${jobStatus.progress}%` }}
                  />
                </div>
              )}
              {jobStatus?.status === 'completed' && jobStatus.result?.ai_analysis && (
                <div className="text-sm text-gray-500 mt-1">
                  Analysis complete - Quality score: {Math.round(jobStatus.result.ai_analysis.quality_score.overall_score * 100)}%
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {jobStatus?.status === 'completed' && jobStatus.result && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-md font-medium text-gray-900 mb-4 flex items-center">
            <Brain className="w-5 h-5 mr-2 text-purple-600" />
            Analysis Results
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Dataset Size</div>
              <div className="text-lg font-semibold text-gray-900">
                {jobStatus.result.file_info.shape.rows.toLocaleString()} rows
              </div>
              <div className="text-sm text-gray-500">
                {jobStatus.result.file_info.shape.columns} columns
              </div>
            </div>

            {jobStatus.result.ai_analysis && (
              <>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500">Overall Quality</div>
                  <div className={`text-lg font-semibold inline-flex items-center px-2 py-1 rounded-md ${
                    getQualityColor(jobStatus.result.ai_analysis.quality_score.overall_score)
                  }`}>
                    {Math.round(jobStatus.result.ai_analysis.quality_score.overall_score * 100)}%
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500">Completeness</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {Math.round(jobStatus.result.ai_analysis.quality_score.completeness_score * 100)}%
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500">Anomalies</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {jobStatus.result.ai_analysis.anomalies_summary.total_statistical_outliers}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Data Quality Issues */}
          {jobStatus.result.ai_analysis?.suggestions && jobStatus.result.ai_analysis.suggestions.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Data Quality Issues Found</h4>
              <div className="space-y-2">
                {jobStatus.result.ai_analysis.suggestions.slice(0, 3).map((suggestion, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-orange-800">
                        {suggestion.message}
                      </div>
                      <div className="text-sm text-orange-600 mt-1">
                        {suggestion.action}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      suggestion.severity === 'high' ? 'bg-red-100 text-red-800' :
                      suggestion.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {suggestion.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Data Preview */}
          {jobStatus.result.sample_data && jobStatus.result.sample_data.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Data Preview</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(jobStatus.result.sample_data[0]).map((key) => (
                        <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {jobStatus.result.sample_data.slice(0, 3).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value, colIndex) => (
                          <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              onClick={onStartCleaning}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Brain className="w-4 h-4 mr-2" />
              Start Data Cleaning
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 