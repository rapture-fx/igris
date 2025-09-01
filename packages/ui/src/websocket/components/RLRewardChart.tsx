import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, Activity, Settings, Award, Clock } from 'lucide-react'
import { RLProgress } from '@schlep-engine/types'
import { useRLOptimization } from '../hooks'
import { cn } from '../../styles/utils'

export interface RLRewardChartProps {
  sessionId: string
  height?: number
  showMetrics?: boolean
  showHyperparameters?: boolean
  showMovingAverage?: boolean
  className?: string
}

export function RLRewardChart({ 
  sessionId, 
  height = 300,
  showMetrics = true,
  showHyperparameters = false,
  showMovingAverage = true,
  className 
}: RLRewardChartProps) {
  const { rlData, rewardHistory, currentReward, averageReward, isTraining, isCompleted, hyperparameters, isConnected } = useRLOptimization(sessionId)

  const chartData = useMemo(() => {
    if (!rewardHistory.length) return []
    
    return rewardHistory.map((point, index) => {
      // Calculate moving average over last 10 episodes
      const start = Math.max(0, index - 9)
      const window = rewardHistory.slice(start, index + 1)
      const movingAverage = window.reduce((sum, p) => sum + p.reward, 0) / window.length
      
      return {
        episode: point.episode,
        reward: point.reward,
        averageReward: point.averageReward,
        movingAverage: movingAverage
      }
    })
  }, [rewardHistory])

  const rewardStats = useMemo(() => {
    if (!rewardHistory.length) return null
    
    const rewards = rewardHistory.map(h => h.reward)
    const maxReward = Math.max(...rewards)
    const minReward = Math.min(...rewards)
    const lastEpisodes = rewards.slice(-100) // Last 100 episodes
    const recentAverage = lastEpisodes.reduce((sum, r) => sum + r, 0) / lastEpisodes.length
    
    const improvement = rewards.length > 1 
      ? rewards[rewards.length - 1] - rewards[0]
      : 0
    
    return {
      maxReward,
      minReward,
      recentAverage,
      improvement,
      totalEpisodes: rewards.length
    }
  }, [rewardHistory])

  const MetricCard = ({ 
    title, 
    value, 
    format = (v) => v?.toFixed(2) || 'N/A',
    color = 'text-gray-900',
    icon: Icon 
  }: {
    title: string
    value?: number
    format?: (value?: number) => string
    color?: string
    icon: React.ComponentType<any>
  }) => (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{title}</span>
      </div>
      <div className={cn("text-2xl font-bold", color)}>
        {format(value)}
      </div>
    </div>
  )

  if (!rlData && !isConnected) {
    return (
      <div className={cn("p-8 text-center text-gray-500", className)}>
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Not connected to RL service</p>
      </div>
    )
  }

  if (!rlData && rewardHistory.length === 0) {
    return (
      <div className={cn("p-8 text-center text-gray-500", className)}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Waiting for RL training data...</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            RL Training - {rlData?.algorithmName || 'Unknown Algorithm'}
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>
              Episode {rlData?.episode || 0} / {rlData?.totalEpisodes || 0}
            </span>
            <span className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              isTraining && "bg-blue-100 text-blue-800",
              isCompleted && "bg-green-100 text-green-800",
              rlData?.status === 'failed' && "bg-red-100 text-red-800"
            )}>
              {rlData?.status || 'Unknown'}
            </span>
            {!isConnected && (
              <span className="text-xs text-gray-400">(Offline)</span>
            )}
          </div>
        </div>
        
        {currentReward !== undefined && (
          <div className="text-right">
            <div className="text-sm text-gray-600">Current Reward</div>
            <div className="text-2xl font-bold text-blue-600">
              {currentReward.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      {showMetrics && rewardStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Max Reward"
            value={rewardStats.maxReward}
            color="text-green-600"
            icon={Award}
          />
          <MetricCard
            title="Recent Average"
            value={rewardStats.recentAverage}
            color="text-blue-600"
            icon={TrendingUp}
          />
          <MetricCard
            title="Total Episodes"
            value={rewardStats.totalEpisodes}
            format={(v) => v?.toLocaleString() || 'N/A'}
            icon={Activity}
          />
          <MetricCard
            title="Improvement"
            value={rewardStats.improvement}
            color={rewardStats.improvement > 0 ? "text-green-600" : "text-red-600"}
            format={(v) => v ? (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) : 'N/A'}
            icon={TrendingUp}
          />
        </div>
      )}

      {/* Reward Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="mb-4">
            <h4 className="text-md font-semibold text-gray-900 mb-2">Reward Progress</h4>
            <div className="text-sm text-gray-600">
              Episode rewards and running averages over time
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="episode" 
                label={{ value: 'Episode', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Reward', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value, name) => [Number(value).toFixed(3), name]}
                labelFormatter={(episode) => `Episode ${episode}`}
              />
              <Legend />
              
              {/* Zero reward reference line */}
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="2 2" />
              
              {/* Episode rewards as scatter points/line */}
              <Line
                type="monotone"
                dataKey="reward"
                stroke="#3b82f6"
                strokeWidth={1}
                dot={{ fill: '#3b82f6', strokeWidth: 0, r: 2 }}
                name="Episode Reward"
                opacity={0.7}
              />
              
              {/* Average reward line */}
              <Line
                type="monotone"
                dataKey="averageReward"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                name="Running Average"
              />
              
              {/* Moving average line (if enabled) */}
              {showMovingAverage && (
                <Line
                  type="monotone"
                  dataKey="movingAverage"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                  name="Moving Average (10)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hyperparameters */}
      {showHyperparameters && hyperparameters && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Settings className="h-4 w-4 text-gray-500" />
            <h4 className="text-md font-semibold text-gray-900">Hyperparameters</h4>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(hyperparameters).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </div>
                <div className="font-mono text-sm">
                  {typeof value === 'number' 
                    ? value < 0.001 ? value.toExponential(2) : value.toFixed(4)
                    : String(value)
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional RL Metrics */}
      {rlData?.metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {rlData.metrics.epsilon !== undefined && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Epsilon (Exploration)</div>
              <div className="text-lg font-mono">
                {rlData.metrics.epsilon.toFixed(4)}
              </div>
            </div>
          )}
          
          {rlData.metrics.qValue !== undefined && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Q-Value</div>
              <div className="text-lg font-mono">
                {rlData.metrics.qValue.toFixed(4)}
              </div>
            </div>
          )}
          
          {rlData.metrics.loss !== undefined && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Loss</div>
              <div className="text-lg font-mono">
                {rlData.metrics.loss.toFixed(6)}
              </div>
            </div>
          )}
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Cumulative Reward</div>
            <div className="text-lg font-mono">
              {rlData.metrics.cumulativeReward.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}