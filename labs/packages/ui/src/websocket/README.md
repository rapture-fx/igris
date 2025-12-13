# WebSocket Real-time Components

Comprehensive React WebSocket implementation for real-time ML/RL monitoring and system status tracking.

## Overview

This WebSocket system provides real-time communication between the frontend and backend services, enabling live monitoring of:
- ML model training progress
- RL optimization sessions
- Batch prediction processing
- Data upload and processing
- System health and resource utilization
- Real-time notifications

## Architecture

### Core Components

1. **WebSocketProvider** - Context provider with automatic reconnection and authentication
2. **Hooks** - Type-safe hooks for different operations (`useMLTraining`, `useRLOptimization`, etc.)
3. **Components** - Real-time UI components for progress tracking and monitoring
4. **Types** - Comprehensive TypeScript definitions for all WebSocket messages

## Quick Start

### 1. Setup WebSocket Provider

```tsx
import { WebSocketProvider } from '@igris-inertial/ui'

const wsConfig = {
  url: 'ws://localhost:8000/ml/progress/ws/authenticated',
  reconnectAttempts: 10,
  heartbeatInterval: 30000,
  authentication: {
    token: 'your-jwt-token'
  }
}

function App() {
  return (
    <WebSocketProvider options={wsConfig}>
      <YourApp />
    </WebSocketProvider>
  )
}
```

### 2. Use Real-time Hooks

```tsx
import { useMLTraining, useSystemStatus } from '@igris-inertial/ui'

function TrainingMonitor({ modelId }: { modelId: string }) {
  const { trainingData, metrics, isTraining } = useMLTraining(modelId)
  const { systemStatus, isConnected } = useSystemStatus()

  return (
    <div>
      <h2>Training Progress: {trainingData?.progress}%</h2>
      <p>Loss: {trainingData?.metrics.loss}</p>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

### 3. Add Real-time Components

```tsx
import { 
  ModelTrainingDashboard,
  LiveJobMonitor,
  NotificationCenter 
} from '@igris-inertial/ui'

function Dashboard() {
  return (
    <div>
      {/* Real-time notifications */}
      <NotificationCenter />
      
      {/* ML Training monitoring */}
      <ModelTrainingDashboard modelId="model_123" />
      
      {/* All active jobs */}
      <LiveJobMonitor />
    </div>
  )
}
```

## Available Hooks

### Core WebSocket Hooks

#### `useWebSocket()`
Returns the main WebSocket context with connection management methods.

```tsx
const { connection, subscribe, send, isConnected } = useWebSocket()
```

#### `useProgress(config)`
Generic progress tracking for any operation type.

```tsx
const { progress, status, data, error } = useProgress({
  operationId: 'job_123',
  operationType: 'training',
  autoComplete: true
})
```

### ML/RL Specific Hooks

#### `useMLTraining(modelId)`
Monitor ML model training progress in real-time.

```tsx
const { 
  trainingData, 
  metrics, 
  metricsHistory,
  isTraining, 
  isCompleted 
} = useMLTraining('model_123')
```

#### `useRLOptimization(sessionId)`
Track RL training sessions with reward curves.

```tsx
const { 
  rlData, 
  rewardHistory, 
  currentReward, 
  hyperparameters,
  isTraining 
} = useRLOptimization('session_789')
```

#### `useSystemStatus()`
Monitor system health and resource utilization.

```tsx
const { 
  systemStatus, 
  resources, 
  services, 
  activeJobs,
  statusHistory 
} = useSystemStatus()
```

### Data Processing Hooks

#### `useDataUpload(uploadId)`
Track file upload progress with speed metrics.

```tsx
const { 
  progress, 
  uploadSpeed, 
  fileName,
  estimatedTimeRemaining 
} = useDataUpload('upload_abc')
```

#### `useDocumentProcessing(jobId)`
Monitor OCR and document extraction progress.

```tsx
const { 
  progress, 
  currentStage, 
  extractedData,
  isCompleted 
} = useDocumentProcessing('doc_xyz')
```

#### `useQualityAssessment()`
Receive real-time data quality analysis results.

```tsx
const { assessments, getAssessment } = useQualityAssessment()
```

### Utility Hooks

#### `useNotifications()`
Manage real-time notifications and alerts.

```tsx
const { 
  notifications, 
  unreadCount, 
  dismissNotification,
  clearAll 
} = useNotifications()
```

#### `useConnectionStatus()`
Monitor WebSocket connection health.

```tsx
const { 
  connection, 
  isConnected, 
  latency, 
  reconnect 
} = useConnectionStatus()
```

## Components

### Progress Tracking

#### `<ProgressTracker>`
Universal progress display component for any operation.

```tsx
<ProgressTracker
  config={{
    operationId: 'job_123',
    operationType: 'training'
  }}
  showDetails={true}
  showETA={true}
  size="lg"
/>
```

#### `<TrainingProgressChart>`
Real-time ML training metrics visualization.

```tsx
<TrainingProgressChart
  modelId="model_123"
  height={400}
  showMetrics={true}
  showLegend={true}
/>
```

#### `<RLRewardChart>`
RL reward curves with live updates.

```tsx
<RLRewardChart
  sessionId="session_789"
  height={300}
  showMovingAverage={true}
  showHyperparameters={false}
/>
```

### Dashboard Components

#### `<LiveJobMonitor>`
Monitor all active operations across the system.

```tsx
<LiveJobMonitor
  activeJobs={{
    training: ['model_123'],
    rl: ['session_789']
  }}
  showControls={true}
  autoRefresh={true}
/>
```

#### `<ModelTrainingDashboard>`
Comprehensive ML training monitoring and control.

```tsx
<ModelTrainingDashboard
  modelId="model_123"
  onPause={() => pauseTraining()}
  onResume={() => resumeTraining()}
  onStop={() => stopTraining()}
/>
```

#### `<RLOptimizationMonitor>`
RL session monitoring with hyperparameter tracking.

```tsx
<RLOptimizationMonitor
  sessionId="session_789"
  onPause={() => pauseRL()}
  onExportResults={() => exportResults()}
/>
```

#### `<SystemStatusIndicator>`
Live system health display with resource charts.

```tsx
<SystemStatusIndicator
  showDetails={true}
  showHistory={true}
  compact={false}
/>
```

#### `<NotificationCenter>`
Real-time notification management.

```tsx
<NotificationCenter
  maxVisible={5}
  showBadge={true}
  position="top-right"
/>
```

### Utility Components

#### `<SystemStatusBadge>`
Compact system status for headers/navigation.

```tsx
<SystemStatusBadge />
```

#### `<NotificationToastContainer>`
Auto-positioning toast notifications.

```tsx
<NotificationToastContainer
  position="top-right"
  maxToasts={3}
/>
```

#### `<ResourceUtilizationChart>`
Real-time resource usage chart.

```tsx
<ResourceUtilizationChart height={200} />
```

## WebSocket Events

The system handles these WebSocket event types:

- `training_progress` - ML model training metrics
- `rl_progress` - RL optimization updates
- `prediction_progress` - Batch prediction status
- `data_upload_progress` - File upload progress
- `quality_assessment_complete` - Data quality results
- `document_processing_progress` - OCR/extraction progress
- `pipeline_status` - Pipeline orchestration
- `system_status` - Resource utilization
- `notification` - Real-time alerts
- `error` - Error messages

## Configuration

### Environment-specific Configuration

```typescript
const config = {
  development: {
    url: 'ws://localhost:8000',
    reconnectAttempts: 5,
    heartbeatInterval: 10000
  },
  production: {
    url: 'wss://api.igris-inertial.com',
    reconnectAttempts: 15,
    heartbeatInterval: 60000
  }
}
```

### Authentication

WebSocket authentication is handled automatically when you provide authentication tokens:

```tsx
const wsConfig = {
  url: 'ws://localhost:8000/ml/progress/ws/authenticated',
  authentication: {
    token: authToken,
    tokenType: 'Bearer'
  }
}
```

## Error Handling

The WebSocket system includes comprehensive error handling:

- **Automatic Reconnection**: Exponential backoff with configurable max attempts
- **Message Queuing**: Failed messages are queued and retried when connection resumes
- **Graceful Degradation**: Components show offline states when disconnected
- **Error Boundaries**: React error boundaries prevent crashes

## Performance Optimizations

- **Connection Pooling**: Efficient WebSocket connection management
- **Message Throttling**: Prevents UI overwhelm from high-frequency updates
- **Memory Management**: Automatic cleanup of old data and event listeners
- **Lazy Loading**: Components are loaded only when needed
- **React Optimization**: `React.memo`, `useMemo`, and `useCallback` for efficient re-rendering

## Testing

### Mock WebSocket Server

For development and testing, you can use mock WebSocket data:

```typescript
// Mock training progress
const mockTrainingProgress = {
  modelId: 'test_model',
  modelName: 'Test Model',
  epoch: 5,
  totalEpochs: 100,
  progress: 5,
  metrics: {
    loss: 0.543,
    accuracy: 0.876,
    learningRate: 0.001
  },
  status: 'training'
}
```

### Component Testing

```tsx
import { render, screen } from '@testing-library/react'
import { WebSocketProvider, ModelTrainingDashboard } from '@igris-inertial/ui'

const mockWebSocketConfig = {
  url: 'ws://localhost:8000/test',
  autoConnect: false
}

test('renders training dashboard', () => {
  render(
    <WebSocketProvider options={mockWebSocketConfig}>
      <ModelTrainingDashboard modelId="test_model" />
    </WebSocketProvider>
  )
  
  expect(screen.getByText('Model Training Dashboard')).toBeInTheDocument()
})
```

## Best Practices

1. **Connection Management**: Always wrap your app with `WebSocketProvider` at the root level
2. **Error Handling**: Use error boundaries and handle offline states gracefully
3. **Performance**: Limit chart data points and use efficient rendering
4. **Authentication**: Ensure WebSocket connections use proper authentication tokens
5. **Cleanup**: Components automatically clean up event listeners on unmount
6. **Testing**: Use mock data for development and testing scenarios

## Troubleshooting

### Common Issues

1. **Connection Fails**: Check WebSocket URL and authentication tokens
2. **No Data**: Verify backend WebSocket endpoints are running
3. **High Memory Usage**: Limit chart data points and clear old data periodically
4. **Performance Issues**: Use React.memo and optimize re-rendering

### Debug Mode

Enable debug logging by setting `process.env.NODE_ENV === 'development'` - the WebSocket provider will log connection events and message traffic to the console.

### Backend Integration

Ensure your backend implements these WebSocket endpoints:
- `/ml/progress/ws/{user_id}` - ML/RL progress updates  
- `/api/v1/streaming/*` - General streaming endpoints
- `/notifications/ws` - Real-time notifications
- `/system/status/ws` - System health updates

## Examples

See `/apps/web-admin/src/app/realtime/page.tsx` for a complete real-time monitoring dashboard implementation.