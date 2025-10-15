'use client'

import {
  Download,
  FileText,
  Database,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  FileSpreadsheet,
  FileJson,
  Table,
  Archive,
  Share2,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ExportJob {
  id: string
  sourceName: string
  sourceType: 'dataset' | 'pipeline'
  format: 'csv' | 'json' | 'parquet'
  status: 'completed' | 'processing' | 'failed' | 'queued'
  createdAt: string
  fileSize: string
  destination: 'download' | 's3' | 'gcs'
}

const getStatusPill = (status: ExportJob['status']) => {
  const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
  switch (status) {
    case 'completed': return <span className={cn(baseClasses, "bg-green-100 text-green-800")}><CheckCircle2 className="w-3 h-3 mr-1.5"/>Completed</span>
    case 'processing': return <span className={cn(baseClasses, "bg-blue-100 text-blue-800")}><RefreshCw className="w-3 h-3 mr-1.5 animate-spin"/>Processing</span>
    case 'failed': return <span className={cn(baseClasses, "bg-red-100 text-red-800")}><AlertTriangle className="w-3 h-3 mr-1.5"/>Failed</span>
    case 'queued': return <span className={cn(baseClasses, "bg-yellow-100 text-yellow-800")}><Clock className="w-3 h-3 mr-1.5"/>Queued</span>
  }
}

const getFormatIcon = (format: ExportJob['format']) => {
  const iconProps = { className: "w-5 h-5 text-gray-500" }
  switch(format) {
      case 'csv': return <FileSpreadsheet {...iconProps}/>
      case 'json': return <FileJson {...iconProps}/>
      case 'parquet': return <Table {...iconProps}/>
  }
}

const getDestinationIcon = (destination: ExportJob['destination']) => {
  const iconProps = { className: "w-5 h-5 text-gray-500" }
   switch(destination) {
      case 'download': return <Download {...iconProps}/>
      case 's3': return <Archive {...iconProps}/>
      case 'gcs': return <Share2 {...iconProps}/>
  }
}


export const ExportJobRow = ({ job }: { job: ExportJob }) => {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-100 rounded-md">
            {job.sourceType === 'dataset' ? <Database className="w-5 h-5 text-gray-500"/> : <Zap className="w-5 h-5 text-gray-500"/>}
          </div>
          <div>
              <p className="font-semibold text-gray-800">{job.sourceName}</p>
              <p className="text-sm text-gray-500 capitalize">{job.sourceType}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center space-x-2">
            {getFormatIcon(job.format)}
            <span className="font-medium text-gray-700 uppercase">{job.format}</span>
        </div>
      </td>
      <td className="p-4">{getStatusPill(job.status)}</td>
      <td className="p-4 text-sm text-gray-600">{new Date(job.createdAt).toLocaleString()}</td>
      <td className="p-4 font-medium text-gray-800">{job.fileSize}</td>
      <td className="p-4">
         <div className="flex items-center space-x-2">
            {getDestinationIcon(job.destination)}
            <span className="font-medium text-gray-700 capitalize">{job.destination}</span>
        </div>
      </td>
      <td className="p-4 text-right">
        <button className="p-2 rounded-md hover:bg-gray-200 text-gray-500">
          <MoreVertical className="w-4 h-4"/>
        </button>
      </td>
    </tr>
  )
} 