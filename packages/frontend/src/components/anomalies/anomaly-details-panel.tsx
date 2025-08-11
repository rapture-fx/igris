'use client'

import { Anomaly } from './types'
import { X, TrendingUp, AlertTriangle, Calendar, User, Info, CheckCircle2, Eye, XCircle, Clock } from 'lucide-react'
import { getStatusIcon, formatDate, formatNumber, getSeverityColor, getSeverityIcon } from './helpers'
import { cn } from '@/lib/utils'

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) => (
  <div className="flex items-start space-x-4 py-3 border-b border-gray-100">
    <Icon className="w-5 h-5 text-gray-500 mt-1 flex-shrink-0" />
    <div className="flex-1">
      <p className="text-sm text-gray-600">{label}</p>
      <div className="text-md font-semibold text-gray-800">{value}</div>
    </div>
  </div>
)

export const AnomalyDetailsPanel = ({ anomaly, onClose }: { anomaly: Anomaly | null, onClose: () => void }) => {
  if (!anomaly) return null

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out",
      anomaly ? 'translate-x-0' : 'translate-x-full'
    )}>
      <div className="flex flex-col h-full">
        <div className={cn("p-6 border-b", getSeverityColor(anomaly.severity))}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-3">
                <span className="p-2 rounded-full bg-white">
                    {getSeverityIcon(anomaly.severity)}
                </span>
                <h2 className="text-2xl font-bold text-gray-900">{anomaly.title}</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1 ml-12">Anomaly ID: {anomaly.id}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/10">
              <X className="w-6 h-6 text-gray-800" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-gray-700 mb-6">{anomaly.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <DetailRow icon={Info} label="Type" value={<span className="capitalize">{anomaly.type.replace(/_/g, ' ')}</span>} />
            <DetailRow icon={AlertTriangle} label="Severity" value={<span className="capitalize">{anomaly.severity}</span>} />
            <DetailRow icon={Eye} label="Status" value={<span className="capitalize">{anomaly.status.replace(/_/g, ' ')}</span>} />
            <DetailRow icon={CheckCircle2} label="Confidence" value={`${anomaly.confidence}%`} />
            <DetailRow icon={TrendingUp} label="Impact Score" value={anomaly.impact_score} />
            <DetailRow icon={User} label="Affected Records" value={formatNumber(anomaly.affected_records)} />
            <DetailRow icon={Calendar} label="Detected At" value={formatDate(anomaly.detected_at)} />
            {anomaly.resolved_at && <DetailRow icon={Clock} label="Resolved At" value={formatDate(anomaly.resolved_at)} />}
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Anomaly Details</h3>
            <div className="bg-gray-50 p-4 rounded-lg border">
                {Object.entries(anomaly.details).map(([key, value]) => (
                    <div key={key} className="flex text-sm">
                        <span className="w-1/3 text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-mono text-gray-800">{String(value)}</span>
                    </div>
                ))}
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Suggested Action</h3>
            <p className="p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">{anomaly.suggested_action}</p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-2">
           <select className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <option>Update Status</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="false_positive">False Positive</option>
          </select>
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Take Action
          </button>
        </div>
      </div>
    </div>
  )
} 