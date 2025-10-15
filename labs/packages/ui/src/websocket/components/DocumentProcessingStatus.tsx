import React from 'react'
import { FileText, Image, Table, CheckCircle, Clock, AlertCircle, Loader2, Info } from 'lucide-react'
import * as Progress from '@radix-ui/react-progress'
import { DocumentProcessingProgress } from '@schlep-engine/types'
import { useDocumentProcessing } from '../hooks'
import { cn } from '../../styles/utils'

export interface DocumentProcessingStatusProps {
  jobId: string
  showExtractedData?: boolean
  showProgress?: boolean
  className?: string
}

export function DocumentProcessingStatus({ 
  jobId,
  showExtractedData = true,
  showProgress = true,
  className 
}: DocumentProcessingStatusProps) {
  const { processingData, progress, currentStage, processedPages, totalPages, extractedData, isCompleted, isConnected } = useDocumentProcessing(jobId)

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'ocr':
        return <FileText className="h-4 w-4" />
      case 'extraction':
        return <Table className="h-4 w-4" />
      case 'validation':
        return <CheckCircle className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStageStatus = (stage: string, current: string) => {
    const stages = ['ocr', 'extraction', 'validation', 'completed']
    const stageIndex = stages.indexOf(stage)
    const currentIndex = stages.indexOf(current)
    
    if (stageIndex < currentIndex) return 'completed'
    if (stageIndex === currentIndex) return 'active'
    return 'pending'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!processingData && !isConnected) {
    return (
      <div className={cn("p-6 text-center text-gray-500 bg-gray-50 rounded-lg border", className)}>
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Not connected to document processing service</p>
      </div>
    )
  }

  if (!processingData) {
    return (
      <div className={cn("p-6 text-center text-gray-500 bg-gray-50 rounded-lg border", className)}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Waiting for document processing...</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Document Processing</h3>
          <p className="text-sm text-gray-600">{processingData.documentName}</p>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-600">Pages</div>
          <div className="text-lg font-semibold">
            {processedPages} / {totalPages}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-gray-600">{Math.round(progress)}%</span>
          </div>
          <Progress.Root
            className="relative overflow-hidden bg-gray-200 rounded-full h-3"
            value={progress}
            max={100}
          >
            <Progress.Indicator
              className="h-full w-full flex-1 bg-blue-500 transition-all duration-300 ease-in-out rounded-full"
              style={{ transform: `translateX(-${100 - progress}%)` }}
            />
          </Progress.Root>
        </div>
      )}

      {/* Processing Stages */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Processing Stages</h4>
        
        <div className="space-y-3">
          {['ocr', 'extraction', 'validation', 'completed'].map((stage) => {
            const status = getStageStatus(stage, currentStage)
            
            return (
              <div key={stage} className="flex items-center space-x-3">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full",
                  status === 'completed' && "bg-green-100",
                  status === 'active' && "bg-blue-100",
                  status === 'pending' && "bg-gray-100"
                )}>
                  {status === 'active' ? (
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                  ) : (
                    getStageIcon(stage)
                  )}
                </div>
                
                <div className="flex-1">
                  <div className={cn(
                    "text-sm font-medium",
                    status === 'completed' && "text-green-700",
                    status === 'active' && "text-blue-700",
                    status === 'pending' && "text-gray-500"
                  )}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {stage === 'ocr' && 'Optical Character Recognition'}
                    {stage === 'extraction' && 'Data and Structure Extraction'}
                    {stage === 'validation' && 'Quality Validation'}
                    {stage === 'completed' && 'Processing Complete'}
                  </div>
                </div>

                <div className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  status === 'completed' && "bg-green-100 text-green-800",
                  status === 'active' && "bg-blue-100 text-blue-800",
                  status === 'pending' && "bg-gray-100 text-gray-600"
                )}>
                  {status}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Extracted Data Preview */}
      {showExtractedData && extractedData && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Extracted Data</h4>
          
          <div className="space-y-4">
            {/* Text Content */}
            {extractedData.text && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Text Content</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {extractedData.text.length > 500 
                      ? `${extractedData.text.substring(0, 500)}...`
                      : extractedData.text
                    }
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  {extractedData.text.length.toLocaleString()} characters
                </div>
              </div>
            )}

            {/* Tables */}
            {extractedData.tables && extractedData.tables.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Table className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Tables</span>
                </div>
                <div className="text-sm text-gray-600">
                  {extractedData.tables.length} table(s) extracted
                </div>
              </div>
            )}

            {/* Images */}
            {extractedData.images && extractedData.images.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Image className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Images</span>
                </div>
                <div className="text-sm text-gray-600">
                  {extractedData.images.length} image(s) extracted
                </div>
              </div>
            )}

            {/* Metadata */}
            {extractedData.metadata && Object.keys(extractedData.metadata).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Metadata</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(extractedData.metadata).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium text-gray-700">{key}:</span>
                        <span className="text-gray-600 ml-1">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing Status */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <span className={cn(
              "text-sm font-semibold",
              isCompleted && "text-green-600",
              processingData.status === 'processing' && "text-blue-600",
              processingData.status === 'failed' && "text-red-600"
            )}>
              {processingData.status.charAt(0).toUpperCase() + processingData.status.slice(1)}
            </span>
          </div>
          
          {!isConnected && (
            <span className="text-xs text-gray-400">Offline</span>
          )}
        </div>
      </div>
    </div>
  )
}