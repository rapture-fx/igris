// WebSocket Components and Hooks Export
export { WebSocketProvider, useWebSocketContext } from './WebSocketProvider'

// Core Hooks
export { 
  useWebSocket,
  useProgress,
  useMLTraining,
  useRLOptimization,
  useBatchPrediction,
  useDataUpload,
  useDocumentProcessing,
  useQualityAssessment,
  usePipelineStatus,
  useSystemStatus,
  useNotifications,
  useConnectionStatus
} from './hooks'

// Progress Components
export { ProgressTracker } from './components/ProgressTracker'
export { TrainingProgressChart } from './components/TrainingProgressChart'
export { RLRewardChart } from './components/RLRewardChart'
export { DataQualityIndicator } from './components/DataQualityIndicator'
export { DocumentProcessingStatus } from './components/DocumentProcessingStatus'

// Dashboard Components
export { LiveJobMonitor, TrainingJobMonitor, RLSessionMonitor } from './components/LiveJobMonitor'
export { 
  NotificationCenter, 
  NotificationToast, 
  NotificationToastContainer 
} from './components/NotificationCenter'
export { 
  SystemStatusIndicator, 
  SystemStatusBadge, 
  ResourceUtilizationChart 
} from './components/SystemStatusIndicator'

// ML/RL Monitoring Components
export { ModelTrainingDashboard, MultiModelTrainingDashboard } from './components/ModelTrainingDashboard'
export { RLOptimizationMonitor } from './components/RLOptimizationMonitor'

// Development Tools
export { WebSocketDebugger } from './components/WebSocketDebugger'

// Re-export types for convenience
export type {
  WebSocketMessage,
  WebSocketEventType,
  WebSocketConnectionState,
  WebSocketOptions,
  WebSocketContextValue,
  TrainingProgress,
  RLProgress,
  PredictionProgress,
  DataUploadProgress,
  QualityAssessmentResult,
  DocumentProcessingProgress,
  PipelineStatus,
  SystemStatus,
  NotificationData,
  ProgressTrackingConfig
} from '@igris-inertial/types'