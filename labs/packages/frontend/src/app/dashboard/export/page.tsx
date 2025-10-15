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
import { ExportJobsTable } from '@/components/export/export-jobs-table'
import { NewExportModal } from '@/components/export/new-export-modal'
import { ExportJob } from '@/components/export/export-job-row'

export default function ExportPage() {
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const mockJobs: ExportJob[] = [
      { id: 'exp_1', sourceName: 'Cleaned Customer Data', sourceType: 'pipeline', format: 'csv', status: 'completed', createdAt: '2024-06-28T10:30:00Z', fileSize: '15.2 MB', destination: 'download' },
      { id: 'exp_2', sourceName: 'Q1 Sales Transactions', sourceType: 'dataset', format: 'parquet', status: 'completed', createdAt: '2024-06-28T09:15:00Z', fileSize: '128.7 MB', destination: 's3' },
      { id: 'exp_3', sourceName: 'Product Analysis Results', sourceType: 'pipeline', format: 'json', status: 'processing', createdAt: '2024-06-28T11:45:00Z', fileSize: '... MB', destination: 'gcs' },
      { id: 'exp_4', sourceName: 'User Activity Logs', sourceType: 'dataset', format: 'json', status: 'failed', createdAt: '2024-06-27T16:20:00Z', fileSize: 'N/A', destination: 'download' },
      { id: 'exp_5', sourceName: 'Marketing Campaign Data', sourceType: 'dataset', format: 'csv', status: 'queued', createdAt: '2024-06-28T12:00:00Z', fileSize: '... MB', destination: 's3' },
    ]
    setTimeout(() => {
        setExportJobs(mockJobs)
        setLoading(false)
    }, 1000);
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

  const EmptyState = () => (
    <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
        <Download className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No exports found</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new export.</p>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Export
        </button>
    </div>
  )

  if (loading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-gray-600 ml-2">Loading export history...</span>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50">
      <PageHeader
        title="Export Center"
        description="Create and manage exports for your datasets and transformation pipelines."
        actions={
          <button 
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Export
          </button>
        }
      />
      
      <main className="p-4 lg:p-8">
        {exportJobs.length > 0 ? (
            <ExportJobsTable jobs={exportJobs} />
        ) : (
            <EmptyState />
        )}
      </main>

      <NewExportModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
