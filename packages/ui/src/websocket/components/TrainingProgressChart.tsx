import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react'
import { TrainingProgress } from '@schlep-engine/types'
import { useMLTraining } from '../hooks'
import { cn } from '../../styles/utils'

export interface TrainingProgressChartProps {
  modelId: string
  height?: number
  showMetrics?: boolean
  showLegend?: boolean
  className?: string
}

export function TrainingProgressChart({ 
  modelId, 
  height = 300,
  showMetrics = true,
  showLegend = true,
  className 
}: TrainingProgressChartProps) {
  const { trainingData, metricsHistory, isTraining, isCompleted, isConnected } = useMLTraining(modelId)

  const chartData = useMemo(() => {
    return metricsHistory.map((metrics, index) => ({
      epoch: index + 1,
      loss: metrics.loss,
      accuracy: metrics.accuracy,
      valLoss: metrics.valLoss,
      valAccuracy: metrics.valAccuracy,
      learningRate: metrics.learningRate
    }))
  }, [metricsHistory])

  const getMetricTrend = (values: number[]) => {
    if (values.length < 2) return 'stable'
    const recent = values.slice(-5) // Last 5 values
    const average = recent.reduce((sum, val) => sum + val, 0) / recent.length
    const previous = values[Math.max(0, values.length - 10)]
    
    if (average < previous * 0.95) return 'improving'
    if (average > previous * 1.05) return 'declining'
    return 'stable'
  }

  const MetricCard = ({ 
    title, 
    value, 
    trend, 
    format = (v) => v?.toFixed(4) || 'N/A',
    icon: Icon 
  }: {
    title: string
    value?: number
    trend?: 'improving' | 'declining' | 'stable'
    format?: (value?: number) => string
    icon: React.ComponentType<any>
  }) => (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        {trend && (
          <div className={cn(
            "flex items-center space-x-1 text-xs",
            trend === 'improving' && "text-green-600",
            trend === 'declining' && "text-red-600",
            trend === 'stable' && "text-gray-500"
          )}>
            {trend === 'improving' && <TrendingDown className="h-3 w-3" />}
            {trend === 'declining' && <TrendingUp className="h-3 w-3" />}
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {format(value)}
      </div>
    </div>
  )

  if (!trainingData && !isConnected) {
    return (
      <div className={cn("p-8 text-center text-gray-500", className)}>
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Not connected to training service</p>
      </div>
    )
  }

  if (!trainingData && chartData.length === 0) {
    return (
      <div className={cn("p-8 text-center text-gray-500", className)}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Waiting for training data...</p>
      </div>
    )
  }

  const lossValues = chartData.map(d => d.loss).filter((val): val is number => val !== undefined)
  const accuracyValues = chartData.map(d => d.accuracy).filter((val): val is number => val !== undefined)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {trainingData?.modelName || 'Model Training'}
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>
              Epoch {trainingData?.epoch || 0} / {trainingData?.totalEpochs || 0}
            </span>
            <span className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              isTraining && "bg-blue-100 text-blue-800",
              isCompleted && "bg-green-100 text-green-800",
              trainingData?.status === 'failed' && "bg-red-100 text-red-800"
            )}>
              {trainingData?.status || 'Unknown'}
            </span>
            {!isConnected && (
              <span className="text-xs text-gray-400">(Offline)</span>
            )}
          </div>
        </div>
        
        {trainingData?.estimatedTimeRemaining && (
          <div className="text-right text-sm text-gray-600">
            <div>Estimated Time Remaining</div>
            <div className="font-semibold">
              {Math.floor(trainingData.estimatedTimeRemaining / 60)}m {Math.floor(trainingData.estimatedTimeRemaining % 60)}s
            </div>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      {showMetrics && trainingData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Loss"
            value={trainingData.metrics.loss}
            trend={getMetricTrend(lossValues)}
            icon={TrendingDown}
          />
          {trainingData.metrics.accuracy !== undefined && (
            <MetricCard
              title="Accuracy"
              value={trainingData.metrics.accuracy}
              trend={getMetricTrend(accuracyValues)}
              format={(v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A'}
              icon={TrendingUp}
            />
          )}
          {trainingData.metrics.valLoss !== undefined && (
            <MetricCard
              title="Val Loss"
              value={trainingData.metrics.valLoss}
              icon={TrendingDown}
            />
          )}
          {trainingData.metrics.valAccuracy !== undefined && (
            <MetricCard
              title="Val Accuracy"
              value={trainingData.metrics.valAccuracy}
              format={(v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A'}
              icon={TrendingUp}
            />
          )}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="epoch" 
                label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'accuracy' || name === 'valAccuracy') {
                    return [`${(Number(value) * 100).toFixed(2)}%`, name]
                  }
                  return [Number(value).toFixed(6), name]
                }}
              />
              {showLegend && <Legend />}
              
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="loss"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Training Loss"
              />
              
              {chartData.some(d => d.valLoss) && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="valLoss"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                  name="Validation Loss"
                />
              )}
              
              {chartData.some(d => d.accuracy) && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Training Accuracy"
                />
              )}
              
              {chartData.some(d => d.valAccuracy) && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="valAccuracy"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                  name="Validation Accuracy"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Learning Rate Display */}
      {trainingData?.metrics.learningRate && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Learning Rate</div>
          <div className="text-lg font-mono">
            {trainingData.metrics.learningRate.toExponential(2)}
          </div>
        </div>
      )}
    </div>
  )
}