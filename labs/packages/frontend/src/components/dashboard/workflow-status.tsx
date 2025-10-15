'use client'

import { useState, useEffect } from 'react'
import { Clock, CheckCircle2, AlertCircle, Play, Pause, RefreshCw, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface WorkflowStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration?: number
  error_message?: string
}

interface WorkflowInstance {
  id: string
  investigation_id: string
  investigation_name: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  progress_percentage: number
  current_step: string
  steps: WorkflowStep[]
  started_at: string
  completed_at?: string
  estimated_completion?: string
}

interface WorkflowStatusProps {
  limit?: number
  className?: string
}

export function WorkflowStatus({ limit = 5, className = '' }: WorkflowStatusProps) {
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkflows()
    
    // Set up polling for active workflows
    const interval = setInterval(() => {
      if (workflows.some(w => w.status === 'running')) {
        fetchWorkflows()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [workflows.length])

  const fetchWorkflows = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/proxy/dashboard/active-jobs?limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        // Transform the data to match WorkflowInstance interface
        const transformedWorkflows = data.map((job: any) => ({
          id: job.job_id,
          investigation_id: job.job_id,
          investigation_name: job.investigation_name,
          status: job.status,
          progress_percentage: job.progress_percentage,
          current_step: getCurrentStep(job.progress_percentage),
          steps: generateSteps(job.status, job.progress_percentage),
          started_at: job.started_at || new Date().toISOString(),
          estimated_completion: job.estimated_completion
        }))
        setWorkflows(transformedWorkflows)
      } else {
        setWorkflows([])
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }

  const getCurrentStep = (progress: number): string => {
    if (progress < 20) return 'Data Ingestion'
    if (progress < 40) return 'Structure Analysis'
    if (progress < 60) return 'Quality Assessment'
    if (progress < 80) return 'Pattern Recognition'
    if (progress < 100) return 'Report Generation'
    return 'Completed'
  }

  const generateSteps = (status: string, progress: number): WorkflowStep[] => {
    const steps: WorkflowStep[] = [
      { id: '1', name: 'Data Ingestion', status: 'pending' },
      { id: '2', name: 'Structure Analysis', status: 'pending' },
      { id: '3', name: 'Quality Assessment', status: 'pending' },
      { id: '4', name: 'Pattern Recognition', status: 'pending' },
      { id: '5', name: 'Report Generation', status: 'pending' }
    ]

    // Update step statuses based on progress
    steps.forEach((step, index) => {
      const stepProgress = (index + 1) * 20
      if (progress >= stepProgress) {
        step.status = 'completed'
      } else if (progress > (index * 20)) {
        step.status = 'running'
      }
    })

    if (status === 'failed') {
      const currentStepIndex = Math.floor(progress / 20)
      if (currentStepIndex < steps.length) {
        steps[currentStepIndex].status = 'failed'
      }
    }

    return steps
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3 h-3 text-green-500" />
      case 'running':
        return <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />
      default:
        return <div className="w-3 h-3 border-2 border-gray-300 rounded-full" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-50 border-blue-200'
      case 'completed':
        return 'bg-green-50 border-green-200'
      case 'failed':
        return 'bg-red-50 border-red-200'
      case 'paused':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const formatTimeRemaining = (estimatedCompletion?: string) => {
    if (!estimatedCompletion) return null
    
    const now = new Date()
    const completion = new Date(estimatedCompletion)
    const diffInMinutes = Math.max(0, Math.floor((completion.getTime() - now.getTime()) / (1000 * 60)))
    
    if (diffInMinutes < 1) return 'Less than 1 minute'
    if (diffInMinutes < 60) return `${diffInMinutes} minutes`
    return `${Math.floor(diffInMinutes / 60)} hours ${diffInMinutes % 60} minutes`
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Processing Status</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Processing Status</h3>
          <Link 
            href="/dashboard/data-sources" 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View All
          </Link>
        </div>
      </div>
      
      <div className="p-6">
        {workflows.length > 0 ? (
          <div className="space-y-6">
            {workflows.map((workflow) => (
              <div key={workflow.id} className={`p-4 border rounded-lg ${getStatusColor(workflow.status)}`}>
                {/* Workflow Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(workflow.status)}
                    <div>
                      <h4 className="font-medium text-gray-900 truncate">
                        {workflow.investigation_name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {workflow.current_step}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {Math.round(workflow.progress_percentage)}%
                    </p>
                    {workflow.estimated_completion && workflow.status === 'running' && (
                      <p className="text-xs text-gray-600">
                        {formatTimeRemaining(workflow.estimated_completion)} left
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      workflow.status === 'failed' ? 'bg-red-500' :
                      workflow.status === 'completed' ? 'bg-green-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${workflow.progress_percentage}%` }}
                  ></div>
                </div>

                {/* Workflow Steps */}
                <div className="flex items-center justify-between">
                  {workflow.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div className="flex flex-col items-center">
                        {getStepIcon(step.status)}
                        <span className="text-xs text-gray-600 mt-1 text-center max-w-16 truncate">
                          {step.name}
                        </span>
                      </div>
                      {index < workflow.steps.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-gray-400 mx-2 mt-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Play className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Active Workflows</h4>
            <p className="text-gray-600 mb-4">Upload a dataset to start processing</p>
            <Link
              href="/dashboard/data-sources"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Processing
            </Link>
          </div>
        )}
      </div>
    </div>
  )
} 