export interface Job {
  id: string
  name: string
  type: 'data_processing' | 'analysis' | 'export' | 'import' | 'transformation'
  status: 'running' | 'completed' | 'failed' | 'queued' | 'paused'
  progress: number
  created_at: string
  started_at?: string
  completed_at?: string
  estimated_completion?: string
  duration?: number
  records_processed?: number
  total_records?: number
  error_message?: string
  priority: 'low' | 'medium' | 'high'
  user: string
  resource_usage?: {
    cpu: number
    memory: number
    storage: number
  }
} 