'use client'

import { useTransformationPipelineStatus } from "@/hooks/useAPIData"
import { CheckCircle, AlertTriangle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export const PipelineExecutionStatus = ({ 
  pipelineId 
}: { 
  pipelineId: string | null 
}) => {
  const { data: statusData } = useTransformationPipelineStatus(pipelineId, {
    refreshInterval: pipelineId ? 2000 : 0
  })

  if (!pipelineId || !statusData) return null

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-50'
      case 'failed':
        return 'text-red-600 bg-red-50'
      case 'running':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'failed':
        return <AlertTriangle className="w-4 h-4" />
      case 'running':
        return <RefreshCw className="w-4 h-4 animate-spin" />
      default:
        return null
    }
  }

  return (
    <div className={cn("p-4 rounded-lg border", getStatusColor(statusData.status))}>
      <div className="flex items-center space-x-3">
        {getStatusIcon(statusData.status)}
        <div>
          <p className="text-sm font-medium">
            Pipeline Status: <span className="font-bold">{statusData.status}</span>
          </p>
          <p className="text-xs">{statusData.message}</p>
        </div>
      </div>
    </div>
  )
} 