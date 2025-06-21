'use client'

import { Play, Pause, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn, getStatusColor } from '@/lib/utils'

const workflows = [
  {
    id: '1',
    name: 'Daily Sales Data Pipeline',
    status: 'running',
    progress: 75,
    lastRun: '2024-01-15T10:30:00Z',
    nextRun: '2024-01-16T10:30:00Z',
    duration: '12m 34s'
  },
  {
    id: '2',
    name: 'Customer Data Cleansing',
    status: 'completed',
    progress: 100,
    lastRun: '2024-01-15T09:15:00Z',
    nextRun: '2024-01-16T09:15:00Z',
    duration: '8m 21s'
  },
  {
    id: '3',
    name: 'Inventory Sync Process',
    status: 'failed',
    progress: 45,
    lastRun: '2024-01-15T08:00:00Z',
    nextRun: '2024-01-16T08:00:00Z',
    duration: '5m 12s'
  },
  {
    id: '4',
    name: 'Analytics Data Aggregation',
    status: 'pending',
    progress: 0,
    lastRun: '2024-01-14T23:45:00Z',
    nextRun: '2024-01-15T23:45:00Z',
    duration: '15m 43s'
  }
]

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running':
      return <Play className="w-4 h-4 text-blue-600" />
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-600" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-600" />
    default:
      return <Pause className="w-4 h-4 text-gray-600" />
  }
}

export function WorkflowStatus() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Workflow Status</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                {getStatusIcon(workflow.status)}
                <h4 className="font-medium text-gray-900">{workflow.name}</h4>
              </div>
              <span className={cn('status-indicator', getStatusColor(workflow.status))}>
                {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{workflow.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    workflow.status === 'completed' ? 'bg-green-500' :
                    workflow.status === 'failed' ? 'bg-red-500' :
                    workflow.status === 'running' ? 'bg-blue-500' :
                    'bg-gray-400'
                  )}
                  style={{ width: `${workflow.progress}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-sm text-gray-500">
              <span>Last run: {new Date(workflow.lastRun).toLocaleString()}</span>
              <span>Duration: {workflow.duration}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-blue-600">1</div>
            <div className="text-xs text-gray-500">Running</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">1</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-red-600">1</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-yellow-600">1</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
        </div>
      </div>
    </div>
  )
} 