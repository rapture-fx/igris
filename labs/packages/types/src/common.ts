// Common types used across the application
export type Environment = 'development' | 'staging' | 'production'

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface FileUpload {
  name: string
  size: number
  type: string
  url?: string
}

export interface ProcessingJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  startedAt?: string
  completedAt?: string
  error?: string
}