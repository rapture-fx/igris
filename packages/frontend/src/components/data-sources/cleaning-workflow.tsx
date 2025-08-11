'use client'

import { useState, useEffect } from 'react'
import { apiService, JobStatus, CleaningTask } from '@/lib/api'
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Play, 
  Download, 
  Eye,
  Sparkles,
  Settings,
  BarChart3,
  RefreshCw
} from 'lucide-react'
// import { toast } from 'sonner'

interface CleaningWorkflowProps {
  jobId: string
  jobStatus: JobStatus
}

export function CleaningWorkflow({ jobId, jobStatus }: CleaningWorkflowProps) {
  const [cleaningTasks, setCleaningTasks] = useState<CleaningTask[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleaningProgress, setCleaningProgress] = useState(0)
  const [completedTasks, setCompletedTasks] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    loadCleaningTasks()
  }, [jobId])

  const loadCleaningTasks = async () => {
    setIsLoadingTasks(true)
    try {
      const tasks = await apiService.getCleaningTasks(jobId)
      setCleaningTasks(tasks)
    } catch (error) {
      console.error('Failed to load cleaning tasks:', error)
      console.error('Failed to load cleaning recommendations')
    } finally {
      setIsLoadingTasks(false)
    }
  }

  const toggleTask = (taskId: string) => {
    setCleaningTasks(tasks => 
      tasks.map(task => 
        task.id === taskId 
          ? { ...task, enabled: !task.enabled }
          : task
      )
    )
  }

  const startCleaning = async () => {
    const enabledTasks = cleaningTasks.filter(task => task.enabled)
    if (enabledTasks.length === 0) {
      console.error('Please select at least one cleaning task')
      return
    }

    setIsCleaning(true)
    setCleaningProgress(0)
    setCompletedTasks([])

    try {
      // Simulate cleaning process
      for (let i = 0; i < enabledTasks.length; i++) {
        const task = enabledTasks[i]
        
        // Simulate task execution
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        setCompletedTasks(prev => [...prev, task.id])
        setCleaningProgress(((i + 1) / enabledTasks.length) * 100)
        
        console.log(`${task.name} completed`)
      }

      console.log('Data cleaning completed successfully!')
    } catch (error) {
      console.error('Cleaning failed:', error)
      console.error('Cleaning process failed')
    } finally {
      setIsCleaning(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'duplicates':
        return <RefreshCw className="w-5 h-5" />
      case 'missing_values':
        return <AlertTriangle className="w-5 h-5" />
      case 'outliers':
        return <BarChart3 className="w-5 h-5" />
      case 'formatting':
        return <Settings className="w-5 h-5" />
      default:
        return <Sparkles className="w-5 h-5" />
    }
  }

  const getTaskStatus = (taskId: string) => {
    if (completedTasks.includes(taskId)) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    if (isCleaning && cleaningTasks.findIndex(t => t.id === taskId) < completedTasks.length) {
      return <Clock className="w-5 h-5 text-blue-500 animate-spin" />
    }
    return null
  }

  const totalEstimatedTime = cleaningTasks
    .filter(task => task.enabled)
    .reduce((sum, task) => sum + task.estimatedTime, 0)

  const totalAffectedRows = cleaningTasks
    .filter(task => task.enabled)
    .reduce((sum, task) => sum + task.affectedRows, 0)

  if (isLoadingTasks) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
            Automated Data Cleaning
          </h2>
          <p className="text-gray-600 mt-1">
            Select cleaning tasks to improve your data quality
          </p>
        </div>
        {!isCleaning && (
          <button
            onClick={startCleaning}
            disabled={cleaningTasks.filter(t => t.enabled).length === 0}
            className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Cleaning
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {isCleaning && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              Cleaning in progress...
            </span>
            <span className="text-sm text-blue-700">
              {Math.round(cleaningProgress)}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${cleaningProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Tasks Selected</div>
          <div className="text-2xl font-semibold text-gray-900">
            {cleaningTasks.filter(task => task.enabled).length}
          </div>
          <div className="text-sm text-gray-500">
            of {cleaningTasks.length} available
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Est. Time</div>
          <div className="text-2xl font-semibold text-gray-900">
            {Math.round(totalEstimatedTime / 60)}m
          </div>
          <div className="text-sm text-gray-500">
            {totalEstimatedTime}s total
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Rows Affected</div>
          <div className="text-2xl font-semibold text-gray-900">
            {totalAffectedRows.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">
            estimated impact
          </div>
        </div>
      </div>

      {/* Cleaning Tasks */}
      <div className="space-y-4">
        <h3 className="text-md font-medium text-gray-900">Available Cleaning Tasks</h3>
        
        {cleaningTasks.map((task) => (
          <div
            key={task.id}
            className={`border rounded-lg p-4 transition-all duration-200 ${
              task.enabled 
                ? 'border-blue-200 bg-blue-50' 
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start space-x-4">
              {/* Checkbox */}
              <div className="flex items-center h-6">
                <input
                  type="checkbox"
                  checked={task.enabled}
                  onChange={() => toggleTask(task.id)}
                  disabled={isCleaning}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              {/* Task Icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                task.enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {getTaskIcon(task.type)}
              </div>

              {/* Task Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center">
                    {task.name}
                    {getTaskStatus(task.id)}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(task.severity)}`}>
                      {task.severity}
                    </span>
                    <span className="text-xs text-gray-500">
                      {task.confidence * 100}% confidence
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mt-1">
                  {task.description}
                </p>
                
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>
                    Affects {task.affectedRows.toLocaleString()} rows
                  </span>
                  <span>
                    ~{task.estimatedTime}s
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      {completedTasks.length > 0 && !isCleaning && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-600 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Cleaning completed! {completedTasks.length} tasks processed.
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowPreview(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Results
              </button>
              <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4 mr-2" />
                Download Clean Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 