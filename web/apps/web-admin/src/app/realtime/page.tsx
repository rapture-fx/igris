'use client'

import React, { useState } from 'react'
import { 
  LiveJobMonitor, 
  ModelTrainingDashboard,
  RLOptimizationMonitor,
  SystemStatusIndicator,
  NotificationCenter,
  WebSocketDebugger,
  useSystemStatus,
  useConnectionStatus
} from '@schlep-engine/ui'
import * as Tabs from '@radix-ui/react-tabs'
import { Activity, Brain, Target, Server, Bell } from 'lucide-react'

export default function RealtimePage() {
  const { systemStatus, activeJobs } = useSystemStatus()
  const { connection, isConnected } = useConnectionStatus()

  // Mock active job IDs for demonstration
  const mockActiveJobs = {
    training: ['model_123', 'model_456'],
    rl: ['rl_session_789'],
    prediction: ['batch_001'],
    upload: ['upload_abc'],
    processing: ['doc_xyz']
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to System Status</span>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Real-time Monitoring</h1>
              <p className="text-lg text-gray-600">
                Live tracking of ML/RL operations and system health
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <NotificationCenter />
            <div className="flex items-center space-x-2 px-3 py-2 bg-white border rounded-lg">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {connection.latency && (
                <span className="text-xs text-gray-500">
                  ({connection.latency}ms)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <Tabs.Root defaultValue="overview" className="space-y-6">
          <Tabs.List className="flex space-x-1 bg-white p-1 rounded-lg border">
            <Tabs.Trigger
              value="overview"
              className="flex items-center space-x-2 flex-1 px-4 py-3 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 text-gray-600 hover:text-gray-900"
            >
              <Activity className="h-4 w-4" />
              <span>Overview</span>
            </Tabs.Trigger>
            
            <Tabs.Trigger
              value="training"
              className="flex items-center space-x-2 flex-1 px-4 py-3 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 text-gray-600 hover:text-gray-900"
            >
              <Brain className="h-4 w-4" />
              <span>ML Training</span>
            </Tabs.Trigger>
            
            <Tabs.Trigger
              value="rl"
              className="flex items-center space-x-2 flex-1 px-4 py-3 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 text-gray-600 hover:text-gray-900"
            >
              <Target className="h-4 w-4" />
              <span>RL Training</span>
            </Tabs.Trigger>
            
            <Tabs.Trigger
              value="system"
              className="flex items-center space-x-2 flex-1 px-4 py-3 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 text-gray-600 hover:text-gray-900"
            >
              <Server className="h-4 w-4" />
              <span>System</span>
            </Tabs.Trigger>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Content value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {(activeJobs?.training || 0) + mockActiveJobs.training.length}
                </div>
                <div className="text-sm text-gray-600">Active Training Jobs</div>
              </div>
              
              <div className="bg-white rounded-lg border p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {mockActiveJobs.rl.length}
                </div>
                <div className="text-sm text-gray-600">RL Sessions</div>
              </div>
              
              <div className="bg-white rounded-lg border p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {systemStatus?.resources.cpu.usage.toFixed(0) || 0}%
                </div>
                <div className="text-sm text-gray-600">CPU Usage</div>
              </div>
              
              <div className="bg-white rounded-lg border p-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {systemStatus?.queueStatus.processing || 0}
                </div>
                <div className="text-sm text-gray-600">Jobs in Queue</div>
              </div>
            </div>

            {/* Live Job Monitor */}
            <LiveJobMonitor
              activeJobs={mockActiveJobs}
              showControls={true}
              autoRefresh={true}
            />

            {/* System Status Overview */}
            <SystemStatusIndicator
              showDetails={true}
              showHistory={true}
              compact={false}
            />
          </Tabs.Content>

          {/* ML Training Tab */}
          <Tabs.Content value="training" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {mockActiveJobs.training.map((modelId) => (
                <ModelTrainingDashboard
                  key={modelId}
                  modelId={modelId}
                  onPause={() => console.log(`Pause training ${modelId}`)}
                  onResume={() => console.log(`Resume training ${modelId}`)}
                  onStop={() => console.log(`Stop training ${modelId}`)}
                  onDownloadModel={() => console.log(`Download model ${modelId}`)}
                />
              ))}
            </div>
            
            {mockActiveJobs.training.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Training Jobs</h3>
                <p>Start a new training job to see real-time monitoring here.</p>
              </div>
            )}
          </Tabs.Content>

          {/* RL Training Tab */}
          <Tabs.Content value="rl" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {mockActiveJobs.rl.map((sessionId) => (
                <RLOptimizationMonitor
                  key={sessionId}
                  sessionId={sessionId}
                  onPause={() => console.log(`Pause RL ${sessionId}`)}
                  onResume={() => console.log(`Resume RL ${sessionId}`)}
                  onStop={() => console.log(`Stop RL ${sessionId}`)}
                  onExportResults={() => console.log(`Export RL results ${sessionId}`)}
                />
              ))}
            </div>
            
            {mockActiveJobs.rl.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No RL Sessions</h3>
                <p>Start a new reinforcement learning session to monitor progress here.</p>
              </div>
            )}
          </Tabs.Content>

          {/* System Tab */}
          <Tabs.Content value="system" className="space-y-6">
            <SystemStatusIndicator
              showDetails={true}
              showHistory={true}
              compact={false}
            />
          </Tabs.Content>
        </Tabs.Root>
      </div>
      
      {/* WebSocket Debugger for Development */}
      <WebSocketDebugger maxMessages={50} />
    </div>
  )
}