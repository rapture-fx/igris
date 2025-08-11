'use client'

import { Job } from './types'
import { getStatusIcon, getStatusColor, getTypeIcon, getPriorityColor, formatDuration, formatDate, formatNumber, getTimeRemaining } from './helpers.tsx'
import { MoreVertical, Eye, Play, Pause, Square, BarChart3, Users, Cpu, HardDrive, Network, Timer, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const JobCard = ({ job, onSelect }: { job: Job, onSelect: (job: Job) => void }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              {getTypeIcon(job.type)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{job.name}</h3>
              <p className="text-sm text-gray-500 capitalize">
                {job.type.replace('_', ' ')} • by {job.user}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={cn('px-2 py-1 text-xs font-medium rounded-full', getPriorityColor(job.priority))}>
              {job.priority} priority
            </span>
            <button className="p-2 text-gray-500 rounded-full hover:bg-gray-100">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center space-x-2 text-sm font-medium">
              {getStatusIcon(job.status)}
              <span className={cn('capitalize', getStatusColor(job.status).replace('bg-', 'text-'))}>{job.status}</span>
            </div>
            <span className="text-sm font-semibold text-gray-700">{job.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${job.progress}%` }}
            ></div>
          </div>
        </div>

        {job.status === 'running' && job.estimated_completion && (
          <p className="mt-2 text-xs text-center text-gray-500">{getTimeRemaining(job.estimated_completion)}</p>
        )}
      </div>

      <div className="bg-gray-50/70 p-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <p>
            <span className="font-semibold">{formatNumber(job.records_processed)}</span>
            {job.total_records && <span className="text-gray-500"> / {formatNumber(job.total_records)}</span>}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Timer className="w-4 h-4 text-gray-500" />
          <p>
            <span className="font-semibold">{job.duration ? formatDuration(job.duration) : 'N/A'}</span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-gray-500" />
          <p>
            <span className="font-semibold">{job.resource_usage?.cpu || 0}%</span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <HardDrive className="w-4 h-4 text-gray-500" />
          <p>
            <span className="font-semibold">{job.resource_usage?.memory || 0}%</span>
          </p>
        </div>
      </div>
      
      {job.status === 'failed' && job.error_message && (
        <div className="p-4 bg-red-50 border-t border-red-200 text-red-800 text-sm flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span><strong>Error:</strong> {job.error_message}</span>
        </div>
      )}

      <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
         <button 
            onClick={() => onSelect(job)}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
            <Eye className="w-4 h-4 mr-2" />
            View Details
        </button>
      </div>
    </div>
  )
} 