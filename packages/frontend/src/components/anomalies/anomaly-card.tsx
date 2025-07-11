'use client'

import { Anomaly } from './types'
import { getSeverityIcon, getSeverityColor, getTimeSince } from './helpers'
import { Eye, Clock, Database, BarChart3, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export const AnomalyCard = ({ anomaly, onSelect }: { anomaly: Anomaly, onSelect: (anomaly: Anomaly) => void }) => {
  return (
    <div className={cn(
      "bg-white rounded-lg border-l-4 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col",
      getSeverityColor(anomaly.severity)
    )}>
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {getSeverityIcon(anomaly.severity)}
            </div>
            <h3 className="text-lg font-semibold text-gray-800 leading-tight">{anomaly.title}</h3>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-200 text-gray-700 capitalize">
            {anomaly.type.replace('_', ' ')}
          </span>
        </div>

        <p className="mt-2 text-sm text-gray-600 ml-7">{anomaly.description}</p>
        
        <div className="mt-4 ml-7 space-y-2 text-sm">
          <div className="flex items-center space-x-2 text-gray-500">
            <Database className="w-4 h-4" />
            <span>{anomaly.data_source}</span>
            {anomaly.field_name && <span>({anomaly.field_name})</span>}
          </div>
          <div className="flex items-center space-x-2 text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>{anomaly.affected_records} records affected</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-500">
            <BarChart3 className="w-4 h-4" />
            <span>Impact Score: <span className="font-bold">{anomaly.impact_score}</span></span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50/70 border-t border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Detected {getTimeSince(anomaly.detected_at)}</span>
        </div>
        <button
          onClick={() => onSelect(anomaly)}
          className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <Eye className="w-4 h-4 mr-1.5" />
          Investigate
        </button>
      </div>
    </div>
  )
}