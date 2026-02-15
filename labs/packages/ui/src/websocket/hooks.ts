import { useCallback, useEffect, useRef, useState } from 'react'
import { 
  WebSocketEventType,
  TrainingProgress,
  RLProgress,
  PredictionProgress,
  DataUploadProgress,
  QualityAssessmentResult,
  DocumentProcessingProgress,
  PipelineStatus,
  SystemStatus,
  NotificationData,
  ProgressTrackingConfig,
  WebSocketConnectionState
} from '@igris-inertial/types'
import { useWebSocketContext } from './WebSocketProvider'

// Core WebSocket hook
export function useWebSocket() {
  return useWebSocketContext()
}

// Generic progress tracking hook
export function useProgress(config: ProgressTrackingConfig) {
  const { subscribe, isConnected } = useWebSocketContext()
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('pending')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let eventType: WebSocketEventType
    
    switch (config.operationType) {
      case 'training':
        eventType = 'training_progress'
        break
      case 'rl':
        eventType = 'rl_progress'
        break
      case 'prediction':
        eventType = 'prediction_progress'
        break
      case 'upload':
        eventType = 'data_upload_progress'
        break
      case 'processing':
        eventType = 'document_processing_progress'
        break
      default:
        eventType = 'pipeline_status'
    }

    const unsubscribe = subscribe(eventType, (progressData) => {
      if (progressData.id === config.operationId || 
          progressData.modelId === config.operationId ||
          progressData.sessionId === config.operationId ||
          progressData.batchId === config.operationId ||
          progressData.uploadId === config.operationId ||
          progressData.jobId === config.operationId) {
        
        setProgress(progressData.progress || 0)
        setStatus(progressData.status || 'pending')
        setData(progressData)
        setError(null)

        // Auto-complete if configured
        if (config.autoComplete && progressData.status === 'completed') {
          setProgress(100)
        }
      }
    })

    // Subscribe to errors
    const unsubscribeError = subscribe('error', (errorData) => {
      if (errorData.operationId === config.operationId) {
        setError(errorData.message)
        setStatus('failed')
      }
    })

    return () => {
      unsubscribe()
      unsubscribeError()
    }
  }, [config, subscribe])

  return {
    progress,
    status,
    data,
    error,
    isConnected
  }
}

// ML Training progress hook
export function useMLTraining(modelId: string) {
  const { subscribe, isConnected } = useWebSocketContext()
  const [trainingData, setTrainingData] = useState<TrainingProgress | null>(null)
  const [metrics, setMetrics] = useState<TrainingProgress['metrics'][]>([])
  const metricsHistoryRef = useRef<TrainingProgress['metrics'][]>([])

  useEffect(() => {
    const unsubscribe = subscribe('training_progress', (data: TrainingProgress) => {
      if (data.modelId === modelId) {
        setTrainingData(data)
        
        // Update metrics history
        metricsHistoryRef.current.push(data.metrics)
        setMetrics([...metricsHistoryRef.current])
      }
    })

    return unsubscribe
  }, [modelId, subscribe])

  const resetMetrics = useCallback(() => {
    metricsHistoryRef.current = []
    setMetrics([])
  }, [])

  return {
    trainingData,
    metrics,
    metricsHistory: metrics,
    isTraining: trainingData?.status === 'training',
    isCompleted: trainingData?.status === 'completed',
    isFailed: trainingData?.status === 'failed',
    resetMetrics,
    isConnected
  }
}

// RL Optimization hook
export function useRLOptimization(sessionId: string) {
  const { subscribe, isConnected } = useWebSocketContext()
  const [rlData, setRLData] = useState<RLProgress | null>(null)
  const [rewardHistory, setRewardHistory] = useState<Array<{ episode: number; reward: number; averageReward: number }>>([])

  useEffect(() => {
    const unsubscribe = subscribe('rl_progress', (data: RLProgress) => {
      if (data.sessionId === sessionId) {
        setRLData(data)
        
        // Update reward history
        if (data.rewardCurve) {
          setRewardHistory(data.rewardCurve)
        }
      }
    })

    return unsubscribe
  }, [sessionId, subscribe])

  return {
    rlData,
    rewardHistory,
    currentReward: rlData?.metrics.episodeReward,
    averageReward: rlData?.metrics.averageReward,
    isTraining: rlData?.status === 'training',
    isCompleted: rlData?.status === 'completed',
    hyperparameters: rlData?.hyperparameters,
    isConnected
  }
}

// Batch Prediction tracking hook
export function useBatchPrediction(batchId: string) {
  const { subscribe, isConnected } = useWebSocketContext()
  const [predictionData, setPredictionData] = useState<PredictionProgress | null>(null)

  useEffect(() => {
    const unsubscribe = subscribe('prediction_progress', (data: PredictionProgress) => {
      if (data.batchId === batchId) {
        setPredictionData(data)
      }
    })

    return unsubscribe
  }, [batchId, subscribe])

  return {
    predictionData,
    progress: predictionData?.progress || 0,
    processed: predictionData?.processed || 0,
    total: predictionData?.total || 0,
    predictions: predictionData?.predictions || [],
    processingRate: predictionData?.processingRate || 0,
    isCompleted: predictionData?.status === 'completed',
    isConnected
  }
}

// Data Upload progress hook
export function useDataUpload(uploadId: string) {
  const { subscribe, isConnected } = useWebSocketContext()
  const [uploadData, setUploadData] = useState<DataUploadProgress | null>(null)

  useEffect(() => {
    const unsubscribe = subscribe('data_upload_progress', (data: DataUploadProgress) => {
      if (data.uploadId === uploadId) {
        setUploadData(data)
      }
    })

    return unsubscribe
  }, [uploadId, subscribe])

  return {
    uploadData,
    progress: uploadData?.progress || 0,
    uploadedBytes: uploadData?.uploadedBytes || 0,
    totalBytes: uploadData?.totalBytes || 0,
    uploadSpeed: uploadData?.uploadSpeed || 0,
    estimatedTimeRemaining: uploadData?.estimatedTimeRemaining,
    fileName: uploadData?.fileName,
    isCompleted: uploadData?.status === 'completed',
    isConnected
  }
}

// Document Processing hook
export function useDocumentProcessing(jobId: string) {
  const { subscribe, isConnected } = useWebSocketContext()
  const [processingData, setProcessingData] = useState<DocumentProcessingProgress | null>(null)

  useEffect(() => {
    const unsubscribe = subscribe('document_processing_progress', (data: DocumentProcessingProgress) => {
      if (data.jobId === jobId) {
        setProcessingData(data)
      }
    })

    return unsubscribe
  }, [jobId, subscribe])

  return {
    processingData,
    progress: processingData?.progress || 0,
    currentStage: processingData?.currentStage || 'ocr',
    processedPages: processingData?.processedPages || 0,
    totalPages: processingData?.totalPages || 0,
    extractedData: processingData?.extractedData,
    isCompleted: processingData?.status === 'completed',
    isConnected
  }
}

// Quality Assessment hook
export function useQualityAssessment() {
  const { subscribe, isConnected } = useWebSocketContext()
  const [assessments, setAssessments] = useState<Map<string, QualityAssessmentResult>>(new Map())

  useEffect(() => {
    const unsubscribe = subscribe('quality_assessment_complete', (data: QualityAssessmentResult) => {
      setAssessments(prev => new Map(prev.set(data.datasetId, data)))
    })

    return unsubscribe
  }, [subscribe])

  const getAssessment = useCallback((datasetId: string) => {
    return assessments.get(datasetId)
  }, [assessments])

  return {
    assessments: Array.from(assessments.values()),
    getAssessment,
    isConnected
  }
}

// Pipeline Status hook
export function usePipelineStatus(pipelineId: string) {
  const { subscribe, isConnected } = useWebSocketContext()
  const [pipelineData, setPipelineData] = useState<PipelineStatus | null>(null)

  useEffect(() => {
    const unsubscribe = subscribe('pipeline_status', (data: PipelineStatus) => {
      if (data.pipelineId === pipelineId) {
        setPipelineData(data)
      }
    })

    return unsubscribe
  }, [pipelineId, subscribe])

  return {
    pipelineData,
    progress: pipelineData?.progress || 0,
    currentStep: pipelineData?.currentStep || 0,
    totalSteps: pipelineData?.totalSteps || 0,
    steps: pipelineData?.steps || [],
    isRunning: pipelineData?.status === 'running',
    isCompleted: pipelineData?.status === 'completed',
    isFailed: pipelineData?.status === 'failed',
    isConnected
  }
}

// System Status hook
export function useSystemStatus() {
  const { subscribe, isConnected } = useWebSocketContext()
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [statusHistory, setStatusHistory] = useState<SystemStatus[]>([])
  const historyRef = useRef<SystemStatus[]>([])

  useEffect(() => {
    const unsubscribe = subscribe('system_status', (data: SystemStatus) => {
      setSystemStatus(data)
      
      // Keep last 100 status updates
      historyRef.current.push(data)
      if (historyRef.current.length > 100) {
        historyRef.current.shift()
      }
      setStatusHistory([...historyRef.current])
    })

    return unsubscribe
  }, [subscribe])

  return {
    systemStatus,
    statusHistory,
    resources: systemStatus?.resources,
    services: systemStatus?.services || [],
    activeJobs: systemStatus?.activeJobs,
    queueStatus: systemStatus?.queueStatus,
    isConnected
  }
}

// Notifications hook
export function useNotifications() {
  const { subscribe, isConnected } = useWebSocketContext()
  const [notifications, setNotifications] = useState<NotificationData[]>([])

  useEffect(() => {
    const unsubscribe = subscribe('notification', (data: NotificationData) => {
      setNotifications(prev => {
        const updated = [data, ...prev]
        
        // Remove expired notifications
        const now = new Date()
        return updated.filter(notification => 
          !notification.expiresAt || new Date(notification.expiresAt) > now
        )
      })
    })

    return unsubscribe
  }, [subscribe])

  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId 
          ? { ...n, metadata: { ...n.metadata, read: true } }
          : n
      )
    )
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.metadata?.read).length,
    dismissNotification,
    markAsRead,
    clearAll,
    isConnected
  }
}

// Connection Status hook
export function useConnectionStatus() {
  const { connection, connect, disconnect } = useWebSocketContext()

  const reconnect = useCallback(async () => {
    disconnect()
    await new Promise(resolve => setTimeout(resolve, 1000))
    return connect()
  }, [connect, disconnect])

  return {
    connection,
    isConnected: connection.status === 'connected',
    isConnecting: connection.status === 'connecting',
    isReconnecting: connection.status === 'reconnecting',
    hasError: connection.status === 'error',
    reconnectAttempts: connection.reconnectAttempts,
    latency: connection.latency,
    lastConnectedAt: connection.lastConnectedAt,
    lastDisconnectedAt: connection.lastDisconnectedAt,
    reconnect
  }
}