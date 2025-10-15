import React, { useState } from 'react'
import { Brain, Play, Pause, Square, RefreshCw, Settings, Download, Eye } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Dialog from '@radix-ui/react-dialog'
import { TrainingProgress } from '@schlep-engine/types'
import { useMLTraining, useConnectionStatus } from '../hooks'
import { TrainingProgressChart } from './TrainingProgressChart'
import { ProgressTracker } from './ProgressTracker'
import { cn } from '../../styles/utils'

export interface ModelTrainingDashboardProps {
  modelId: string
  onPause?: () => void
  onResume?: () => void
  onStop?: () => void
  onDownloadModel?: () => void
  className?: string
}

export function ModelTrainingDashboard({ 
  modelId,
  onPause,
  onResume,
  onStop,
  onDownloadModel,
  className 
}: ModelTrainingDashboardProps) {
  const { trainingData, metricsHistory, isTraining, isCompleted, resetMetrics, isConnected } = useMLTraining(modelId)
  const { connection } = useConnectionStatus()
  const [showSettings, setShowSettings] = useState(false)

  const MetricsTable = () => {
    if (!trainingData) return null

    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h4 className="text-md font-semibold text-gray-900">Current Metrics</h4>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(trainingData.metrics).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="text-sm font-medium text-gray-700">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </div>
                <div className="text-lg font-mono">
                  {typeof value === 'number' 
                    ? value < 0.001 ? value.toExponential(4) : value.toFixed(6)
                    : String(value)
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const TrainingControls = () => (
    <div className="flex items-center space-x-2">
      {isTraining && onPause && (
        <button
          onClick={onPause}
          className="flex items-center space-x-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
        >
          <Pause className="h-4 w-4" />
          <span>Pause</span>
        </button>
      )}
      
      {!isTraining && trainingData?.status === 'paused' && onResume && (
        <button
          onClick={onResume}
          className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Play className="h-4 w-4" />
          <span>Resume</span>
        </button>
      )}
      
      {(isTraining || trainingData?.status === 'paused') && onStop && (
        <button
          onClick={onStop}
          className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          <Square className="h-4 w-4" />
          <span>Stop</span>
        </button>
      )}
      
      {isCompleted && onDownloadModel && (
        <button
          onClick={onDownloadModel}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Download Model</span>
        </button>
      )}

      <button
        onClick={() => setShowSettings(true)}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
      >
        <Settings className="h-4 w-4" />
        <span>Settings</span>
      </button>

      <button
        onClick={resetMetrics}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Reset</span>
      </button>
    </div>
  )

  const ConnectionStatus = () => (
    <div className={cn(
      "flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium",
      isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full",
        isConnected ? "bg-green-500" : "bg-red-500"
      )} />
      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      {connection.latency && (
        <span className="text-gray-500">({connection.latency}ms)</span>
      )}
    </div>
  )

  return (
    <div className={cn("space-y-6", className)}>
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Brain className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Model Training Dashboard</h2>
            <p className="text-sm text-gray-600">Real-time monitoring and control</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <ConnectionStatus />
          <TrainingControls />
        </div>
      </div>

      {/* Main Content */}
      <Tabs.Root defaultValue="overview" className="space-y-4">
        <Tabs.List className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <Tabs.Trigger
            value="overview"
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Overview
          </Tabs.Trigger>
          <Tabs.Trigger
            value="metrics"
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Metrics
          </Tabs.Trigger>
          <Tabs.Trigger
            value="charts"
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Charts
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
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
              
              {trainingData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border p-4">
                    <div className="text-sm text-gray-600">Current Epoch</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {trainingData.epoch}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border p-4">
                    <div className="text-sm text-gray-600">Progress</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {trainingData.progress.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border p-4">
                    <div className="text-sm text-gray-600">Current Loss</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {trainingData.metrics.loss.toFixed(4)}
                    </div>
                  </div>
                  {trainingData.metrics.accuracy !== undefined && (
                    <div className="bg-white rounded-lg border p-4">
                      <div className="text-sm text-gray-600">Accuracy</div>
                      <div className="text-2xl font-bold text-green-600">
                        {(trainingData.metrics.accuracy * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <MetricsTable />
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="metrics" className="space-y-4">
          <MetricsTable />
          
          {metricsHistory.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Metrics History</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Epoch</th>
                      <th className="text-right p-2">Loss</th>
                      <th className="text-right p-2">Accuracy</th>
                      <th className="text-right p-2">Val Loss</th>
                      <th className="text-right p-2">Val Accuracy</th>
                      <th className="text-right p-2">LR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricsHistory.slice(-10).map((metrics, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2">{metricsHistory.length - 10 + index + 1}</td>
                        <td className="p-2 text-right font-mono">{metrics.loss.toFixed(6)}</td>
                        <td className="p-2 text-right font-mono">
                          {metrics.accuracy ? (metrics.accuracy * 100).toFixed(2) + '%' : 'N/A'}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {metrics.valLoss?.toFixed(6) || 'N/A'}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {metrics.valAccuracy ? (metrics.valAccuracy * 100).toFixed(2) + '%' : 'N/A'}
                        </td>
                        <td className="p-2 text-right font-mono text-xs">
                          {metrics.learningRate.toExponential(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="charts" className="space-y-4">
          <TrainingProgressChart
            modelId={modelId}
            height={400}
            showMetrics={false}
            showLegend={true}
          />
        </Tabs.Content>
      </Tabs.Root>

      {/* Settings Dialog */}
      <Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
              Training Settings
            </Dialog.Title>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model ID
                </label>
                <input
                  type="text"
                  value={modelId}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connection Status
                </label>
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    isConnected ? "bg-green-500" : "bg-red-500"
                  )} />
                  <span className="text-sm">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                  {connection.latency && (
                    <span className="text-xs text-gray-500">
                      ({connection.latency}ms latency)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metrics History
                </label>
                <div className="text-sm text-gray-600">
                  {metricsHistory.length} data points collected
                </div>
                <button
                  onClick={resetMetrics}
                  className="mt-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition-colors"
                >
                  Clear History
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  Close
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

// Additional component for multiple model monitoring
export interface MultiModelTrainingDashboardProps {
  modelIds: string[]
  className?: string
}

export function MultiModelTrainingDashboard({ modelIds, className }: MultiModelTrainingDashboardProps) {
  const [selectedModel, setSelectedModel] = useState(modelIds[0])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Model Selector */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Models</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modelIds.map((modelId) => (
            <ModelCard
              key={modelId}
              modelId={modelId}
              isSelected={selectedModel === modelId}
              onClick={() => setSelectedModel(modelId)}
            />
          ))}
        </div>
      </div>

      {/* Selected Model Dashboard */}
      {selectedModel && (
        <ModelTrainingDashboard modelId={selectedModel} />
      )}
    </div>
  )
}

// Model Card for selection
interface ModelCardProps {
  modelId: string
  isSelected: boolean
  onClick: () => void
}

function ModelCard({ modelId, isSelected, onClick }: ModelCardProps) {
  const { trainingData, isTraining, isCompleted } = useMLTraining(modelId)

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all",
        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
      )}
    >
      <div className="flex items-center space-x-3">
        <div className={cn(
          "p-2 rounded-lg",
          isTraining ? "bg-blue-100" : isCompleted ? "bg-green-100" : "bg-gray-100"
        )}>
          <Brain className={cn(
            "h-4 w-4",
            isTraining ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-500"
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {trainingData?.modelName || modelId}
          </div>
          <div className="text-sm text-gray-600">
            {trainingData ? `${trainingData.progress.toFixed(1)}% complete` : 'No data'}
          </div>
        </div>
        
        <div className={cn(
          "w-3 h-3 rounded-full",
          isTraining ? "bg-blue-500 animate-pulse" : 
          isCompleted ? "bg-green-500" : "bg-gray-300"
        )} />
      </div>
    </button>
  )
}