import React, { useState, useMemo } from 'react'
import { Activity, Brain, Target, TrendingUp, Settings, Play, Pause, Square, BarChart3 } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Dialog from '@radix-ui/react-dialog'
import { RLProgress } from '@schlep-engine/types'
import { useRLOptimization, useConnectionStatus } from '../hooks'
import { RLRewardChart } from './RLRewardChart'
import { ProgressTracker } from './ProgressTracker'
import { cn } from '../../styles/utils'

export interface RLOptimizationMonitorProps {
  sessionId: string
  onPause?: () => void
  onResume?: () => void
  onStop?: () => void
  onExportResults?: () => void
  className?: string
}

export function RLOptimizationMonitor({ 
  sessionId,
  onPause,
  onResume,
  onStop,
  onExportResults,
  className 
}: RLOptimizationMonitorProps) {
  const { rlData, rewardHistory, currentReward, averageReward, isTraining, isCompleted, hyperparameters, isConnected } = useRLOptimization(sessionId)
  const { connection } = useConnectionStatus()
  const [showHyperparameters, setShowHyperparameters] = useState(false)

  const performanceStats = useMemo(() => {
    if (!rewardHistory.length) return null

    const rewards = rewardHistory.map(h => h.reward)
    const recent50 = rewards.slice(-50)
    const recent100 = rewards.slice(-100)
    
    const recentPerformance = recent50.reduce((sum, r) => sum + r, 0) / recent50.length
    const longerTermPerformance = recent100.reduce((sum, r) => sum + r, 0) / recent100.length
    
    const convergenceRate = rewards.length > 10 
      ? Math.abs(rewards[rewards.length - 1] - rewards[rewards.length - 10]) / 10
      : 0

    const explorationRate = rlData?.metrics.epsilon || 0
    const stability = recent50.length > 1 
      ? 1 - (Math.max(...recent50) - Math.min(...recent50)) / (Math.abs(Math.max(...recent50)) || 1)
      : 0

    return {
      recentPerformance,
      longerTermPerformance,
      convergenceRate,
      explorationRate,
      stability: Math.max(0, Math.min(1, stability)),
      episodesCompleted: rewards.length,
      bestReward: Math.max(...rewards),
      worstReward: Math.min(...rewards)
    }
  }, [rewardHistory, rlData])

  const StatCard = ({ 
    title, 
    value, 
    format = (v) => v?.toFixed(3) || 'N/A',
    description,
    icon: Icon,
    color = 'text-gray-900'
  }: {
    title: string
    value?: number
    format?: (value?: number) => string
    description?: string
    icon: React.ComponentType<any>
    color?: string
  }) => (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{title}</span>
      </div>
      <div className={cn("text-2xl font-bold", color)}>
        {format(value)}
      </div>
      {description && (
        <div className="text-xs text-gray-500">{description}</div>
      )}
    </div>
  )

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
      
      {!isTraining && rlData?.status === 'paused' && onResume && (
        <button
          onClick={onResume}
          className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Play className="h-4 w-4" />
          <span>Resume</span>
        </button>
      )}
      
      {(isTraining || rlData?.status === 'paused') && onStop && (
        <button
          onClick={onStop}
          className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          <Square className="h-4 w-4" />
          <span>Stop</span>
        </button>
      )}
      
      {isCompleted && onExportResults && (
        <button
          onClick={onExportResults}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
          <span>Export Results</span>
        </button>
      )}

      <button
        onClick={() => setShowHyperparameters(true)}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
      >
        <Settings className="h-4 w-4" />
        <span>Parameters</span>
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
          <div className="p-2 bg-purple-100 rounded-lg">
            <Target className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">RL Optimization Monitor</h2>
            <p className="text-sm text-gray-600">
              {rlData?.algorithmName || 'Reinforcement Learning'} - Real-time tracking
            </p>
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
            value="rewards"
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Rewards
          </Tabs.Trigger>
          <Tabs.Trigger
            value="analysis"
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Analysis
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <ProgressTracker
                config={{
                  operationId: sessionId,
                  operationType: 'rl',
                  autoComplete: true
                }}
                showDetails={true}
                size="lg"
              />
              
              {performanceStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    title="Current Reward"
                    value={currentReward}
                    color="text-blue-600"
                    icon={Target}
                  />
                  <StatCard
                    title="Average Reward"
                    value={averageReward}
                    color="text-green-600"
                    icon={TrendingUp}
                  />
                  <StatCard
                    title="Best Reward"
                    value={performanceStats.bestReward}
                    color="text-purple-600"
                    icon={TrendingUp}
                  />
                  <StatCard
                    title="Episodes"
                    value={performanceStats.episodesCompleted}
                    format={(v) => v?.toLocaleString() || 'N/A'}
                    icon={Activity}
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {rlData && (
                <div className="bg-white rounded-lg border p-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Session Info</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-500">Algorithm</div>
                      <div className="font-medium">{rlData.algorithmName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Progress</div>
                      <div className="font-medium">{rlData.progress.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Status</div>
                      <div className={cn(
                        "inline-block px-2 py-1 rounded text-xs font-medium",
                        isTraining && "bg-blue-100 text-blue-800",
                        isCompleted && "bg-green-100 text-green-800",
                        rlData.status === 'failed' && "bg-red-100 text-red-800"
                      )}>
                        {rlData.status}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {performanceStats && (
                <div className="bg-white rounded-lg border p-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Performance</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-500">Exploration Rate</div>
                      <div className="font-mono text-sm">{(performanceStats.explorationRate * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Stability</div>
                      <div className="font-mono text-sm">{(performanceStats.stability * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Convergence Rate</div>
                      <div className="font-mono text-sm">{performanceStats.convergenceRate.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="rewards" className="space-y-4">
          <RLRewardChart
            sessionId={sessionId}
            height={500}
            showMetrics={true}
            showHyperparameters={false}
            showMovingAverage={true}
          />
        </Tabs.Content>

        <Tabs.Content value="analysis" className="space-y-4">
          {performanceStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Performance Metrics */}
              <div className="bg-white rounded-lg border p-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Performance Analysis</h4>
                
                <div className="space-y-4">
                  <StatCard
                    title="Recent Performance"
                    value={performanceStats.recentPerformance}
                    description="Average reward over last 50 episodes"
                    icon={TrendingUp}
                    color="text-blue-600"
                  />
                  <StatCard
                    title="Long-term Performance"
                    value={performanceStats.longerTermPerformance}
                    description="Average reward over last 100 episodes"
                    icon={BarChart3}
                    color="text-green-600"
                  />
                  <StatCard
                    title="Performance Range"
                    value={performanceStats.bestReward - performanceStats.worstReward}
                    description="Difference between best and worst rewards"
                    icon={Activity}
                    color="text-purple-600"
                  />
                </div>
              </div>

              {/* Learning Progress */}
              <div className="bg-white rounded-lg border p-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Learning Progress</h4>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Exploration Rate</span>
                      <span className="text-sm text-gray-600">
                        {(performanceStats.explorationRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${performanceStats.explorationRate * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Stability</span>
                      <span className="text-sm text-gray-600">
                        {(performanceStats.stability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 bg-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${performanceStats.stability * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Convergence Rate</div>
                    <div className="text-lg font-mono text-gray-900">
                      {performanceStats.convergenceRate.toFixed(6)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Rate of reward change per episode
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Episode Performance Distribution */}
          {rewardHistory.length > 10 && (
            <div className="bg-white rounded-lg border p-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Episode Distribution</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {performanceStats?.episodesCompleted || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Episodes</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {performanceStats?.bestReward.toFixed(2) || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Best Reward</div>
                </div>
                
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {performanceStats?.worstReward.toFixed(2) || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Worst Reward</div>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {performanceStats ? ((performanceStats.bestReward + performanceStats.worstReward) / 2).toFixed(2) : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Median Reward</div>
                </div>
              </div>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {/* Hyperparameters Dialog */}
      <Dialog.Root open={showHyperparameters} onOpenChange={setShowHyperparameters}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto z-50">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
              Hyperparameters - {rlData?.algorithmName}
            </Dialog.Title>
            
            {hyperparameters ? (
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(hyperparameters).map(([key, value]) => (
                  <div key={key} className="space-y-1 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </div>
                    <div className="font-mono text-sm text-gray-900">
                      {typeof value === 'number' 
                        ? value < 0.001 ? value.toExponential(3) : value.toFixed(6)
                        : String(value)
                      }
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No hyperparameters available
              </div>
            )}

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