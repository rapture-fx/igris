'use client'

import { Job } from './types'
import { X, Cpu, HardDrive, Network, Timer, TrendingUp, AlertTriangle, Calendar, User } from 'lucide-react'
import { getStatusIcon, getTypeIcon, formatDate, formatDuration, formatNumber } from './helpers.tsx'
import { cn } from '@/lib/utils'

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | React.ReactNode }) => (
  <div className="flex items-start space-x-3 py-3">
    <Icon className="w-5 h-5 text-gray-500 mt-1" />
    <div className="flex-1">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-md font-semibold text-gray-800">{value}</p>
    </div>
  </div>
)

export const JobDetailsPanel = ({ job, onClose }: { job: Job | null, onClose: () => void }) => {
  if (!job) return null

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out",
      job ? 'translate-x-0' : 'translate-x-full'
    )}>
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-3">
                {getTypeIcon(job.type)}
                <h2 className="text-2xl font-bold text-gray-900">{job.name}</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">Job ID: {job.id}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <DetailRow icon={User} label="Initiated By" value={job.user} />
            <DetailRow icon={Calendar} label="Created At" value={formatDate(job.created_at)} />
            {job.started_at && <DetailRow icon={Timer} label="Started At" value={formatDate(job.started_at)} />}
            {job.completed_at && <DetailRow icon={Timer} label="Completed At" value={formatDate(job.completed_at)} />}
            {job.duration && <DetailRow icon={Timer} label="Duration" value={formatDuration(job.duration)} />}
            <DetailRow icon={TrendingUp} label="Records Processed" value={`${formatNumber(job.records_processed)} / ${formatNumber(job.total_records)}`} />
            <DetailRow icon={Cpu} label="CPU Usage" value={`${job.resource_usage?.cpu || 0}%`} />
            <DetailRow icon={HardDrive} label="Memory Usage" value={`${job.resource_usage?.memory || 0}%`} />
          </div>

          {job.status === 'failed' && job.error_message && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error Details</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{job.error_message}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Future additions: Logs, Configuration, etc. */}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-2">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            Re-run Job
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
            Cancel Job
          </button>
        </div>
      </div>
    </div>
  )
} 