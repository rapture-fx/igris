// Example implementations for WebSocket components
import React from 'react'
import {
  WebSocketProvider,
  ModelTrainingDashboard,
  RLOptimizationMonitor,
  LiveJobMonitor,
  SystemStatusIndicator,
  NotificationCenter,
  ProgressTracker,
  useMLTraining,
  useSystemStatus,
  useNotifications
} from './index'

// Example: Basic WebSocket setup
export function BasicWebSocketExample() {
  const wsConfig = {
    url: 'ws://localhost:8000/ml/progress/ws/authenticated',
    reconnectAttempts: 5,
    heartbeatInterval: 30000,
    authentication: {
      token: 'your-jwt-token'
    }
  }

  return (
    <WebSocketProvider options={wsConfig}>
      <div className="p-6">
        <h1>Real-time ML Dashboard</h1>
        <ModelTrainingDashboard modelId="model_123" />
      </div>
    </WebSocketProvider>
  )
}

// Example: Custom training monitor using hooks
export function CustomTrainingMonitor({ modelId }: { modelId: string }) {
  const { trainingData, metricsHistory, isTraining, isCompleted } = useMLTraining(modelId)
  
  if (!trainingData) {
    return <div>Waiting for training data...</div>
  }

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h2 className="text-xl font-bold mb-4">{trainingData.modelName}</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {trainingData.epoch}
          </div>
          <div className="text-sm text-gray-600">Current Epoch</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {trainingData.progress.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Progress</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {trainingData.metrics.loss.toFixed(4)}
          </div>
          <div className="text-sm text-gray-600">Loss</div>
        </div>
        
        {trainingData.metrics.accuracy && (
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {(trainingData.metrics.accuracy * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>
        )}
      </div>

      <ProgressTracker
        config={{
          operationId: modelId,
          operationType: 'training',
          autoComplete: true
        }}
        showDetails={true}
        showETA={true}
        size="lg"
      />

      <div className="mt-4 text-sm text-gray-600">
        Status: <span className="font-medium">{trainingData.status}</span>
        {trainingData.estimatedTimeRemaining && (
          <span> • ETA: {Math.floor(trainingData.estimatedTimeRemaining / 60)}m</span>
        )}
      </div>
    </div>
  )
}

// Example: System monitoring dashboard
export function SystemMonitoringExample() {
  const { systemStatus, resources, services, isConnected } = useSystemStatus()
  const { notifications, unreadCount } = useNotifications()

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">System Monitor</h1>
        
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          
          <NotificationCenter />
        </div>
      </div>

      {/* Resource usage cards */}
      {resources && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-2">CPU</h3>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {resources.cpu.usage.toFixed(1)}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 bg-blue-500 rounded-full transition-all"
                style={{ width: `${resources.cpu.usage}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-2">Memory</h3>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {resources.memory.usage.toFixed(1)}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 bg-green-500 rounded-full transition-all"
                style={{ width: `${resources.memory.usage}%` }}
              />
            </div>
          </div>

          {resources.gpu && (
            <div className="bg-white p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-2">GPU</h3>
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {resources.gpu.usage.toFixed(1)}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 bg-purple-500 rounded-full transition-all"
                  style={{ width: `${resources.gpu.usage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full system status */}
      <SystemStatusIndicator
        showDetails={true}
        showHistory={true}
      />

      {/* Live jobs monitor */}
      <LiveJobMonitor
        activeJobs={{
          training: ['model_123'],
          rl: ['rl_session_789']
        }}
        showControls={true}
      />
    </div>
  )
}

// Example: Multi-operation dashboard
export function MultiOperationDashboard() {
  const activeOperations = {
    training: ['model_123', 'model_456'],
    rl: ['rl_session_789'],
    prediction: ['batch_001', 'batch_002'],
    upload: ['upload_abc'],
    processing: ['doc_xyz']
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Operations Dashboard</h1>
      
      {/* Live job overview */}
      <LiveJobMonitor
        activeJobs={activeOperations}
        showControls={true}
        autoRefresh={true}
      />

      {/* Individual operation monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ML Training */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">ML Training</h2>
          {activeOperations.training.map(modelId => (
            <ModelTrainingDashboard key={modelId} modelId={modelId} />
          ))}
        </div>

        {/* RL Sessions */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">RL Training</h2>
          {activeOperations.rl.map(sessionId => (
            <RLOptimizationMonitor key={sessionId} sessionId={sessionId} />
          ))}
        </div>
      </div>

      {/* Data processing operations */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Data Operations</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activeOperations.upload.map(uploadId => (
            <ProgressTracker
              key={uploadId}
              config={{
                operationId: uploadId,
                operationType: 'upload'
              }}
              showDetails={true}
              showETA={true}
            />
          ))}
          
          {activeOperations.processing.map(jobId => (
            <ProgressTracker
              key={jobId}
              config={{
                operationId: jobId,
                operationType: 'processing'
              }}
              showDetails={true}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Example: Notification handling
export function NotificationExample() {
  const { notifications, dismissNotification, markAsRead } = useNotifications()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <NotificationCenter />
      </div>

      <div className="space-y-4">
        {notifications.map(notification => (
          <div 
            key={notification.id}
            className="bg-white p-4 rounded-lg border"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{notification.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    notification.type === 'success' ? 'bg-green-100 text-green-800' :
                    notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    notification.type === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {notification.type}
                  </span>
                  
                  <span className="text-xs text-gray-500">
                    {notification.category}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                {!notification.metadata?.read && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Mark Read
                  </button>
                )}
                
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="text-xs text-gray-600 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}