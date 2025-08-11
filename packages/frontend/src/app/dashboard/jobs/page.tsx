'use client'

import { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { JobsToolbar } from '@/components/jobs/jobs-toolbar'
import { JobsList } from '@/components/jobs/jobs-list'
import { JobDetailsPanel } from '@/components/jobs/job-details-panel'
import { Job } from '@/components/jobs/types'
import { RefreshCw, Activity } from 'lucide-react'

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  useEffect(() => {
    const mockJobs: Job[] = [
      { id: '1', name: 'Customer Data Analysis', type: 'analysis', status: 'running', progress: 65, created_at: '2024-01-15T10:30:00Z', started_at: '2024-01-15T10:32:00Z', estimated_completion: '2024-01-15T11:15:00Z', records_processed: 65000, total_records: 100000, priority: 'high', user: 'John Doe', resource_usage: { cpu: 45, memory: 32, storage: 15 }},
      { id: '2', name: 'Sales Data Export', type: 'export', status: 'completed', progress: 100, created_at: '2024-01-15T09:00:00Z', started_at: '2024-01-15T09:02:00Z', completed_at: '2024-01-15T09:45:00Z', duration: 2580, records_processed: 50000, total_records: 50000, priority: 'medium', user: 'Jane Smith' },
      { id: '3', name: 'Data Quality Check', type: 'data_processing', status: 'queued', progress: 0, created_at: '2024-01-15T11:00:00Z', priority: 'low', user: 'Mike Johnson' },
      { id: '4', name: 'Product Catalog Import', type: 'import', status: 'failed', progress: 23, created_at: '2024-01-15T08:30:00Z', started_at: '2024-01-15T08:32:00Z', error_message: 'Invalid file format detected. Expected CSV, got XLSX.', records_processed: 2300, total_records: 10000, priority: 'high', user: 'Sarah Wilson' },
      { id: '5', name: 'Weekly Report Generation', type: 'transformation', status: 'paused', progress: 40, created_at: '2024-01-15T07:00:00Z', started_at: '2024-01-15T07:05:00Z', records_processed: 20000, total_records: 50000, priority: 'medium', user: 'Tom Brown' }
    ];
    
    setTimeout(() => {
      setJobs(mockJobs)
    setLoading(false)
    }, 1000)
  }, [])

  const filteredAndSortedJobs = useMemo(() => {
    return jobs
      .filter(job => {
        const matchesSearch = job.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === 'all' || job.status === statusFilter
        const matchesType = typeFilter === 'all' || job.type === typeFilter
        return matchesSearch && matchesStatus && matchesType
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name': return a.name.localeCompare(b.name)
          case 'status': return a.status.localeCompare(b.status)
          case 'priority': return a.priority.localeCompare(b.priority)
          default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
      })
  }, [jobs, searchTerm, statusFilter, typeFilter, sortBy])

  const EmptyState = () => (
    <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
        <Activity className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs found</h3>
        <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search term.</p>
    </div>
  )

  if (loading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-gray-600 ml-2">Loading jobs...</span>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50">
      <PageHeader
        title="Job Monitor"
        description="Track and manage all data processing, analysis, and transformation jobs."
      />
      
      <main className="p-4 lg:p-8">
        <JobsToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
        
        {filteredAndSortedJobs.length > 0 ? (
          <JobsList jobs={filteredAndSortedJobs} onSelectJob={setSelectedJob} />
        ) : (
          <EmptyState />
        )}
      </main>

      <JobDetailsPanel job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  )
}
