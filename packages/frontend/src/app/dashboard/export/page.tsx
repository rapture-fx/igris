'use client'

import { useState, useEffect } from 'react'
import {
  Download,
  Plus,
  FileText,
  Database,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  ChevronRight,
  FileSpreadsheet,
  FileJson,
  Table,
  Archive,
  Share2,
  Zap
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'

interface ExportJob {
  id: string
  sourceName: string
  sourceType: 'dataset' | 'pipeline'
  format: 'csv' | 'json' | 'parquet'
  status: 'completed' | 'processing' | 'failed' | 'queued'
  createdAt: string
  fileSize: string
  destination: 'download' | 's3' | 'gcs'
}

export default function ExportPage() {
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mockJobs: ExportJob[] = [
      { id: 'exp_1', sourceName: 'Cleaned Customer Data', sourceType: 'pipeline', format: 'csv', status: 'completed', createdAt: '2024-06-28T10:30:00Z', fileSize: '15.2 MB', destination: 'download' },
      { id: 'exp_2', sourceName: 'Q1 Sales Transactions', sourceType: 'dataset', format: 'parquet', status: 'completed', createdAt: '2024-06-28T09:15:00Z', fileSize: '128.7 MB', destination: 's3' },
      { id: 'exp_3', sourceName: 'Product Analysis Results', sourceType: 'pipeline', format: 'json', status: 'processing', createdAt: '2024-06-28T11:45:00Z', fileSize: '... MB', destination: 'gcs' },
      { id: 'exp_4', sourceName: 'User Activity Logs', sourceType: 'dataset', format: 'json', status: 'failed', createdAt: '2024-06-27T16:20:00Z', fileSize: 'N/A', destination: 'download' },
      { id: 'exp_5', sourceName: 'Marketing Campaign Data', sourceType: 'dataset', format: 'csv', status: 'queued', createdAt: '2024-06-28T12:00:00Z', fileSize: '... MB', destination: 's3' },
    ]
    setExportJobs(mockJobs)
    setLoading(false)
  }, [])
  
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-gray-600 ml-2">Loading export history...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Export Center"
        description="Create and manage exports for your datasets and transformation pipelines."
      >
        <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg shadow-sm hover:shadow-lg transition-all transform hover:scale-105">
          <Plus className="w-4 h-4 mr-2" />
          New Export
        </button>
      </PageHeader>
      
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
           <h2 className="text-xl font-bold text-gray-800">Recent Exports</h2>
           <p className="text-sm text-gray-500 mt-1">View the status and details of your most recent export jobs.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/80">
              <tr className="text-sm font-semibold text-gray-600">
                <th className="p-4">Source</th>
                <th className="p-4">Format</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created</th>
                <th className="p-4">Size</th>
                <th className="p-4">Destination</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {exportJobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
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
              ))}
              </tbody>
            </table>
          </div>
        <div className="p-4 border-t border-gray-200 flex justify-end">
            <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                View all exports <ChevronRight className="w-4 h-4 ml-1"/>
            </button>
        </div>
      </div>
    </div>
  )
}
