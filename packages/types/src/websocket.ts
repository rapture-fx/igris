// WebSocket types for real-time ML/RL operations

export interface WebSocketMessage<T = any> {
  id: string
  type: WebSocketEventType
  timestamp: string
  userId: string
  data: T
}

export type WebSocketEventType = 
  | 'training_progress'
  | 'rl_progress'
  | 'prediction_progress'
  | 'data_upload_progress'
  | 'quality_assessment_complete'
  | 'document_processing_progress'
  | 'pipeline_status'
  | 'system_status'
  | 'notification'
  | 'error'
  | 'connection_status'

export interface WebSocketConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'
  lastConnectedAt?: string
  lastDisconnectedAt?: string
  reconnectAttempts: number
  latency?: number
}

// Training Progress Types
export interface TrainingProgress {
  modelId: string
  modelName: string
  epoch: number
  totalEpochs: number
  progress: number
  metrics: {
    loss: number
    accuracy?: number
    valLoss?: number
    valAccuracy?: number
    learningRate: number
  }
  estimatedTimeRemaining?: number
  status: 'training' | 'validating' | 'completed' | 'failed' | 'paused'
}

// RL Progress Types
export interface RLProgress {
  sessionId: string
  algorithmName: string
  episode: number
  totalEpisodes: number
  progress: number
  metrics: {
    episodeReward: number
    cumulativeReward: number
    averageReward: number
    epsilon?: number
    qValue?: number
    loss?: number
  }
  rewardCurve: Array<{
    episode: number
    reward: number
    averageReward: number
  }>
  hyperparameters: Record<string, any>
  status: 'training' | 'evaluating' | 'completed' | 'failed' | 'paused'
}

// Prediction Progress Types
export interface PredictionProgress {
  batchId: string
  modelId: string
  processed: number
  total: number
  progress: number
  predictions: Array<{
    id: string
    input: any
    output: any
    confidence?: number
  }>
  status: 'processing' | 'completed' | 'failed'
  processingRate: number // items per second
}

// Data Upload Progress Types
export interface DataUploadProgress {
  uploadId: string
  fileName: string
  uploadedBytes: number
  totalBytes: number
  progress: number
  uploadSpeed: number // bytes per second
  estimatedTimeRemaining?: number
  status: 'uploading' | 'processing' | 'completed' | 'failed'
}

// Quality Assessment Types
export interface QualityAssessmentResult {
  datasetId: string
  overallScore: number
  dimensions: {
    completeness: number
    accuracy: number
    consistency: number
    timeliness: number
    validity: number
  }
  issues: Array<{
    type: 'missing_values' | 'outliers' | 'duplicates' | 'inconsistent_format' | 'invalid_data'
    severity: 'low' | 'medium' | 'high' | 'critical'
    count: number
    description: string
    affectedColumns?: string[]
  }>
  recommendations: Array<{
    action: string
    priority: 'low' | 'medium' | 'high'
    description: string
    estimatedImpact: number
  }>
  status: 'completed'
}

// Document Processing Progress Types
export interface DocumentProcessingProgress {
  jobId: string
  documentName: string
  totalPages: number
  processedPages: number
  progress: number
  currentStage: 'ocr' | 'extraction' | 'validation' | 'completed'
  extractedData: {
    text?: string
    tables?: Array<any>
    images?: Array<string>
    metadata?: Record<string, any>
  }
  status: 'processing' | 'completed' | 'failed'
}

// Pipeline Status Types
export interface PipelineStatus {
  pipelineId: string
  pipelineName: string
  currentStep: number
  totalSteps: number
  progress: number
  steps: Array<{
    id: string
    name: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
    startTime?: string
    endTime?: string
    duration?: number
    error?: string
  }>
  status: 'running' | 'completed' | 'failed' | 'paused'
}

// System Status Types
export interface SystemStatus {
  timestamp: string
  resources: {
    cpu: {
      usage: number
      cores: number
      temperature?: number
    }
    memory: {
      used: number
      total: number
      usage: number
    }
    gpu?: {
      usage: number
      memory: {
        used: number
        total: number
        usage: number
      }
      temperature?: number
    }
    disk: {
      used: number
      total: number
      usage: number
    }
  }
  services: Array<{
    name: string
    status: 'healthy' | 'unhealthy' | 'degraded'
    responseTime?: number
    lastCheck: string
  }>
  activeJobs: {
    training: number
    inference: number
    dataProcessing: number
    total: number
  }
  queueStatus: {
    pending: number
    processing: number
    failed: number
  }
}

// Notification Types
export interface NotificationData {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  category: 'system' | 'training' | 'data' | 'billing' | 'security'
  actionUrl?: string
  actionText?: string
  persistent?: boolean
  expiresAt?: string
  metadata?: Record<string, any>
}

// WebSocket Error Types
export interface WebSocketError {
  code: string
  message: string
  details?: Record<string, any>
  retryable: boolean
  timestamp: string
}

// Message Queue Types
export interface QueuedMessage {
  id: string
  message: WebSocketMessage
  attempts: number
  maxAttempts: number
  createdAt: string
  lastAttemptAt?: string
}

// WebSocket Hook Options
export interface WebSocketOptions {
  url: string
  protocols?: string[]
  reconnectAttempts?: number
  reconnectInterval?: number
  heartbeatInterval?: number
  messageQueueSize?: number
  autoConnect?: boolean
  authentication?: {
    token: string
    refreshToken?: string
    tokenType?: string
  }
}

// Progress Tracking Types
export interface ProgressTrackingConfig {
  operationId: string
  operationType: 'training' | 'rl' | 'prediction' | 'upload' | 'processing'
  autoComplete?: boolean
  updateInterval?: number
  persistProgress?: boolean
}

// Real-time Chart Data Types
export interface ChartDataPoint {
  timestamp: string
  value: number
  label?: string
  metadata?: Record<string, any>
}

export interface RealtimeChartConfig {
  maxDataPoints?: number
  updateInterval?: number
  smoothing?: boolean
  aggregation?: 'none' | 'average' | 'sum' | 'max' | 'min'
  timeWindow?: number // in seconds
}

// User Presence Types
export interface UserPresence {
  userId: string
  username: string
  status: 'online' | 'away' | 'offline'
  currentPage?: string
  lastSeen: string
  activeOperations: string[]
}

// WebSocket Event Handlers
export interface WebSocketEventHandlers {
  onConnect?: () => void
  onDisconnect?: (reason: string) => void
  onError?: (error: WebSocketError) => void
  onMessage?: (message: WebSocketMessage) => void
  onTrainingProgress?: (progress: TrainingProgress) => void
  onRLProgress?: (progress: RLProgress) => void
  onPredictionProgress?: (progress: PredictionProgress) => void
  onDataUploadProgress?: (progress: DataUploadProgress) => void
  onQualityAssessment?: (result: QualityAssessmentResult) => void
  onDocumentProcessing?: (progress: DocumentProcessingProgress) => void
  onPipelineStatus?: (status: PipelineStatus) => void
  onSystemStatus?: (status: SystemStatus) => void
  onNotification?: (notification: NotificationData) => void
}

// WebSocket Context Types
export interface WebSocketContextValue {
  connection: WebSocketConnectionState
  subscribe: (eventType: WebSocketEventType, handler: (data: any) => void) => () => void
  unsubscribe: (eventType: WebSocketEventType, handler: (data: any) => void) => void
  send: (message: Omit<WebSocketMessage, 'id' | 'timestamp' | 'userId'>) => Promise<void>
  connect: () => Promise<void>
  disconnect: () => void
  isConnected: boolean
  latency: number | undefined
}