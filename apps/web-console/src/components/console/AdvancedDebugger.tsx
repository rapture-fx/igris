'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Bug,
  Search,
  Filter,
  Download,
  Maximize2,
  Copy,
  Eye,
  EyeOff,
  Clock,
  Zap,
  Network,
  Database,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Play,
  Pause,
  Square,
  RotateCcw,
  FileText,
  Layers,
  Code,
  Terminal,
  Activity,
  TrendingUp,
  Gauge,
  Timer
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface NetworkTrace {
  id: string
  timestamp: string
  method: string
  url: string
  status: number
  duration: number
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  requestBody?: string
  responseBody?: string
  size: {
    request: number
    response: number
  }
  timing: {
    dns: number
    connect: number
    ssl: number
    send: number
    wait: number
    receive: number
    total: number
  }
  error?: {
    type: string
    message: string
    stack?: string
  }
  performance: {
    memory: number
    cpu: number
    renderTime: number
  }
}

interface DebugSession {
  id: string
  name: string
  startTime: string
  endTime?: string
  traces: NetworkTrace[]
  status: 'recording' | 'paused' | 'stopped'
  filters: {
    method?: string[]
    status?: number[]
    minDuration?: number
    maxDuration?: number
  }
}

interface PerformanceProfile {
  id: string
  name: string
  endpoint: string
  samples: Array<{
    timestamp: string
    duration: number
    memory: number
    cpu: number
  }>
  bottlenecks: Array<{
    type: 'slow_query' | 'high_cpu' | 'memory_leak' | 'network_latency'
    severity: 'low' | 'medium' | 'high'
    description: string
    recommendation: string
  }>
}

export function AdvancedDebugger() {
  const [activeTab, setActiveTab] = useState<'traces' | 'performance' | 'errors' | 'profiler'>('traces')
  const [debugSessions, setDebugSessions] = useState<DebugSession[]>([])
  const [activeSession, setActiveSession] = useState<DebugSession | null>(null)
  const [selectedTrace, setSelectedTrace] = useState<NetworkTrace | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [darkMode, setDarkMode] = useState(false)
  const [showRequestDetails, setShowRequestDetails] = useState(true)
  const [showResponseDetails, setShowResponseDetails] = useState(true)
  const [performanceProfiles, setPerformanceProfiles] = useState<PerformanceProfile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<PerformanceProfile | null>(null)
  const recordingInterval = useRef<NodeJS.Timeout>()

  // Mock data generation
  useEffect(() => {
    // Initialize with a sample session
    const sampleSession: DebugSession = {
      id: 'session_1',
      name: 'Digital Twin API Debug',
      startTime: '2024-01-15T10:00:00Z',
      traces: generateMockTraces(25),
      status: 'stopped',
      filters: {}
    }

    const sampleProfile: PerformanceProfile = {
      id: 'profile_1',
      name: 'Create Digital Twin Performance',
      endpoint: '/api/v1/manufacturing/digital-twin/create',
      samples: generateMockProfileSamples(50),
      bottlenecks: [
        {
          type: 'slow_query',
          severity: 'high',
          description: 'Database query taking 800ms on average',
          recommendation: 'Add database index on twin_id column'
        },
        {
          type: 'high_cpu',
          severity: 'medium',
          description: 'ML model validation consuming 75% CPU',
          recommendation: 'Consider caching validation results'
        }
      ]
    }

    setDebugSessions([sampleSession])
    setActiveSession(sampleSession)
    setPerformanceProfiles([sampleProfile])
  }, [])

  // Recording simulation
  useEffect(() => {
    if (isRecording && activeSession) {
      recordingInterval.current = setInterval(() => {
        const newTrace = generateMockTrace()
        setDebugSessions(prev => 
          prev.map(session => 
            session.id === activeSession.id 
              ? { ...session, traces: [...session.traces, newTrace] }
              : session
          )
        )
        setActiveSession(prev => 
          prev ? { ...prev, traces: [...prev.traces, newTrace] } : null
        )
      }, 2000)
    } else {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current)
      }
    }

    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current)
      }
    }
  }, [isRecording, activeSession])

  const generateMockTrace = (): NetworkTrace => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE'] as const
    const paths = [
      '/api/v1/manufacturing/digital-twin/create',
      '/api/v1/datasets/search',
      '/api/v1/experiments/create',
      '/api/v1/streaming/setup'
    ]
    const statuses = [200, 201, 400, 404, 500]
    
    const method = methods[Math.floor(Math.random() * methods.length)]
    const path = paths[Math.floor(Math.random() * paths.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const duration = Math.random() * 1000 + 50
    
    return {
      id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      method,
      url: `https://api.schlep-engine.com${path}`,
      status,
      duration,
      requestHeaders: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ***',
        'User-Agent': 'Schlep-Console/2.1.0'
      },
      responseHeaders: {
        'Content-Type': 'application/json',
        'Server': 'nginx/1.18.0',
        'X-Response-Time': `${duration.toFixed(0)}ms`
      },
      requestBody: method !== 'GET' ? JSON.stringify({
        twin_id: 'ai_model_twin_001',
        configuration: { model_type: 'xgboost' }
      }, null, 2) : undefined,
      responseBody: JSON.stringify({
        success: status < 400,
        data: { id: 'response_123', message: 'Operation completed' },
        timestamp: new Date().toISOString()
      }, null, 2),
      size: {
        request: Math.floor(Math.random() * 1024) + 100,
        response: Math.floor(Math.random() * 2048) + 200
      },
      timing: {
        dns: Math.random() * 10,
        connect: Math.random() * 50,
        ssl: Math.random() * 100,
        send: Math.random() * 20,
        wait: duration * 0.7,
        receive: Math.random() * 30,
        total: duration
      },
      error: status >= 400 ? {
        type: 'HTTP_ERROR',
        message: `HTTP ${status} Error`,
        stack: 'Error: Request failed\n  at requestHandler (/app/api.js:123)\n  at processRequest (/app/server.js:456)'
      } : undefined,
      performance: {
        memory: Math.random() * 100 + 50,
        cpu: Math.random() * 80 + 10,
        renderTime: Math.random() * 16 + 1
      }
    }
  }

  const generateMockTraces = (count: number): NetworkTrace[] => {
    return Array.from({ length: count }, generateMockTrace)
  }

  const generateMockProfileSamples = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
      duration: Math.random() * 500 + 200,
      memory: Math.random() * 100 + 50,
      cpu: Math.random() * 80 + 20
    }))
  }

  const startRecording = () => {
    const newSession: DebugSession = {
      id: `session_${Date.now()}`,
      name: `Debug Session ${debugSessions.length + 1}`,
      startTime: new Date().toISOString(),
      traces: [],
      status: 'recording',
      filters: {}
    }
    setDebugSessions(prev => [...prev, newSession])
    setActiveSession(newSession)
    setIsRecording(true)
  }

  const stopRecording = () => {
    setIsRecording(false)
    if (activeSession) {
      setDebugSessions(prev => 
        prev.map(session => 
          session.id === activeSession.id 
            ? { ...session, status: 'stopped' as const, endTime: new Date().toISOString() }
            : session
        )
      )
      setActiveSession(prev => 
        prev ? { ...prev, status: 'stopped' as const, endTime: new Date().toISOString() } : null
      )
    }
  }

  const filteredTraces = activeSession?.traces.filter(trace => {
    const matchesSearch = searchQuery === '' || 
      trace.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trace.method.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'success' && trace.status >= 200 && trace.status < 400) ||
      (statusFilter === 'error' && trace.status >= 400)
    
    const matchesMethod = methodFilter === 'all' || trace.method === methodFilter
    
    return matchesSearch && matchesStatus && matchesMethod
  }) || []

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
    if (status >= 300 && status < 400) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
    if (status >= 400 && status < 500) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
    return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
  }

  const exportSession = (session: DebugSession) => {
    const exportData = {
      session,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug_session_${session.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bug className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Advanced Debugger
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Network tracing, performance profiling, and error debugging
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Session Selector */}
            <select
              value={activeSession?.id || ''}
              onChange={(e) => {
                const session = debugSessions.find(s => s.id === e.target.value)
                setActiveSession(session || null)
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {debugSessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.traces.length} traces)
                </option>
              ))}
            </select>

            {/* Recording Controls */}
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors animate-pulse"
              >
                <Square className="w-4 h-4" />
                <span>Stop Recording</span>
              </button>
            )}

            {/* Export Session */}
            {activeSession && (
              <button
                onClick={() => exportSession(activeSession)}
                className="flex items-center space-x-2 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            )}
          </div>
        </div>

        {/* Session Status */}
        {activeSession && (
          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                activeSession.status === 'recording' ? 'bg-red-500 animate-pulse' :
                activeSession.status === 'paused' ? 'bg-yellow-500' :
                'bg-gray-500'
              }`} />
              <span className="text-gray-600 dark:text-gray-400">
                Status: {activeSession.status}
              </span>
            </div>
            <span className="text-gray-600 dark:text-gray-400">
              Started: {new Date(activeSession.startTime).toLocaleString()}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Traces: {activeSession.traces.length}
            </span>
            {activeSession.traces.length > 0 && (
              <span className="text-gray-600 dark:text-gray-400">
                Avg Response Time: {(activeSession.traces.reduce((acc, t) => acc + t.duration, 0) / activeSession.traces.length).toFixed(0)}ms
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {[
            { key: 'traces', label: 'Network Traces', icon: Network },
            { key: 'performance', label: 'Performance Profiler', icon: Gauge },
            { key: 'errors', label: 'Error Analysis', icon: AlertTriangle },
            { key: 'profiler', label: 'CPU & Memory', icon: Activity }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === key
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'traces' && (
          <>
            {/* Traces List */}
            <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              {/* Filters */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search traces..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Methods</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Status</option>
                    <option value="success">2xx Success</option>
                    <option value="error">4xx/5xx Errors</option>
                  </select>
                </div>
              </div>

              {/* Traces */}
              <div className="flex-1 overflow-y-auto">
                {filteredTraces.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No traces found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Start recording to capture network requests
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTraces.map((trace) => (
                      <button
                        key={trace.id}
                        onClick={() => setSelectedTrace(trace)}
                        className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          selectedTrace?.id === trace.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              trace.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              trace.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            }`}>
                              {trace.method}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(trace.status)}`}>
                              {trace.status}
                            </span>
                            {trace.error && (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {trace.duration.toFixed(0)}ms
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {new Date(trace.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-900 dark:text-white font-mono truncate">
                          {trace.url}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {trace.size.request}B → {trace.size.response}B
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Trace Details */}
            <div className="flex-1 bg-white dark:bg-gray-800 flex flex-col">
              {selectedTrace ? (
                <>
                  {/* Trace Header */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded ${
                          selectedTrace.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          selectedTrace.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}>
                          {selectedTrace.method}
                        </span>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedTrace.url}
                        </h2>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(selectedTrace.url)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Status and Timing */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Status', value: selectedTrace.status.toString(), color: getStatusColor(selectedTrace.status) },
                        { label: 'Duration', value: `${selectedTrace.duration.toFixed(0)}ms`, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400' },
                        { label: 'Request Size', value: `${selectedTrace.size.request}B`, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
                        { label: 'Response Size', value: `${selectedTrace.size.response}B`, color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' }
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center">
                          <div className={`px-3 py-2 rounded-lg ${color}`}>
                            <div className="font-semibold">{value}</div>
                            <div className="text-xs opacity-75">{label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trace Content */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                      {/* Timing Breakdown */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          Timing Breakdown
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(selectedTrace.timing).map(([phase, duration]) => (
                            <div key={phase} className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                {phase.replace('_', ' ')}:
                              </span>
                              <div className="flex items-center space-x-2">
                                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                  <div 
                                    className="h-full bg-purple-500 rounded-full" 
                                    style={{ width: `${Math.min((duration / selectedTrace.duration) * 100, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white w-16 text-right">
                                  {duration.toFixed(1)}ms
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Error Details */}
                      {selectedTrace.error && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                            <XCircle className="w-5 h-5 text-red-500 mr-2" />
                            Error Details
                          </h3>
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <div className="text-red-800 dark:text-red-300 font-medium mb-2">
                              {selectedTrace.error.type}: {selectedTrace.error.message}
                            </div>
                            {selectedTrace.error.stack && (
                              <SyntaxHighlighter
                                language="javascript"
                                style={darkMode ? oneDark : oneLight}
                                customStyle={{ fontSize: '12px', margin: 0 }}
                              >
                                {selectedTrace.error.stack}
                              </SyntaxHighlighter>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Request Headers */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Request Headers
                          </h3>
                          <button
                            onClick={() => setShowRequestDetails(!showRequestDetails)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                          >
                            {showRequestDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {showRequestDetails && (
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                            <div className="space-y-2">
                              {Object.entries(selectedTrace.requestHeaders).map(([key, value]) => (
                                <div key={key} className="flex justify-between text-sm">
                                  <span className="font-medium text-purple-600 dark:text-purple-400">{key}:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-mono">
                                    {key.toLowerCase().includes('auth') ? '***' : value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Request Body */}
                      {selectedTrace.requestBody && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                            Request Body
                          </h3>
                          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <SyntaxHighlighter
                              language="json"
                              style={darkMode ? oneDark : oneLight}
                              customStyle={{ margin: 0, fontSize: '14px' }}
                            >
                              {selectedTrace.requestBody}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      )}

                      {/* Response Headers */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Response Headers
                          </h3>
                          <button
                            onClick={() => setShowResponseDetails(!showResponseDetails)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                          >
                            {showResponseDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {showResponseDetails && (
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                            <div className="space-y-2">
                              {Object.entries(selectedTrace.responseHeaders).map(([key, value]) => (
                                <div key={key} className="flex justify-between text-sm">
                                  <span className="font-medium text-purple-600 dark:text-purple-400">{key}:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-mono">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Response Body */}
                      {selectedTrace.responseBody && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                            Response Body
                          </h3>
                          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <SyntaxHighlighter
                              language="json"
                              style={darkMode ? oneDark : oneLight}
                              customStyle={{ margin: 0, fontSize: '14px' }}
                            >
                              {selectedTrace.responseBody}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Select a trace to view details
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Click on any network trace to see detailed information
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'performance' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Performance Analysis
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {performanceProfiles.map((profile) => (
                  <div key={profile.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {profile.name}
                    </h3>
                    <div className="space-y-4">
                      {profile.bottlenecks.map((bottleneck, index) => (
                        <div key={index} className={`p-4 rounded-lg ${
                          bottleneck.severity === 'high' ? 'bg-red-50 dark:bg-red-900/20' :
                          bottleneck.severity === 'medium' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                          'bg-blue-50 dark:bg-blue-900/20'
                        }`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <AlertTriangle className={`w-4 h-4 ${
                              bottleneck.severity === 'high' ? 'text-red-600' :
                              bottleneck.severity === 'medium' ? 'text-yellow-600' :
                              'text-blue-600'
                            }`} />
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              bottleneck.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              bottleneck.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {bottleneck.severity} priority
                            </span>
                          </div>
                          <div className="text-sm text-gray-900 dark:text-white mb-2">
                            {bottleneck.description}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            💡 {bottleneck.recommendation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'errors' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Error Analysis
              </h2>
              
              <div className="space-y-4">
                {filteredTraces.filter(trace => trace.error).map((trace) => (
                  <div key={trace.id} className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <XCircle className="w-5 h-5 text-red-500" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {trace.error?.type}: {trace.error?.message}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {trace.method} {trace.url} • {new Date(trace.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(trace.status)}`}>
                        {trace.status}
                      </span>
                    </div>
                    
                    {trace.error?.stack && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Stack Trace</h4>
                        <SyntaxHighlighter
                          language="javascript"
                          style={darkMode ? oneDark : oneLight}
                          customStyle={{ fontSize: '12px', margin: 0 }}
                        >
                          {trace.error.stack}
                        </SyntaxHighlighter>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiler' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                CPU & Memory Profiler
              </h2>
              
              {/* Real-time Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">CPU Usage</h3>
                    <Activity className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    {activeSession?.traces.length > 0 
                      ? Math.round(activeSession.traces[activeSession.traces.length - 1]?.performance.cpu || 0)
                      : 0}%
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${activeSession?.traces.length > 0 
                          ? activeSession.traces[activeSession.traces.length - 1]?.performance.cpu || 0
                          : 0}%` 
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Average: {activeSession?.traces.length > 0 
                      ? Math.round(activeSession.traces.reduce((acc, t) => acc + t.performance.cpu, 0) / activeSession.traces.length)
                      : 0}%
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Memory Usage</h3>
                    <Database className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {activeSession?.traces.length > 0 
                      ? Math.round(activeSession.traces[activeSession.traces.length - 1]?.performance.memory || 0)
                      : 0}MB
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${Math.min((activeSession?.traces.length > 0 
                          ? activeSession.traces[activeSession.traces.length - 1]?.performance.memory || 0
                          : 0) / 100 * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Peak: {activeSession?.traces.length > 0 
                      ? Math.round(Math.max(...activeSession.traces.map(t => t.performance.memory)))
                      : 0}MB
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Render Time</h3>
                    <Timer className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                    {activeSession?.traces.length > 0 
                      ? Math.round(activeSession.traces[activeSession.traces.length - 1]?.performance.renderTime || 0)
                      : 0}ms
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${Math.min((activeSession?.traces.length > 0 
                          ? activeSession.traces[activeSession.traces.length - 1]?.performance.renderTime || 0
                          : 0) / 16 * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Target: &lt;16ms (60fps)
                  </p>
                </div>
              </div>

              {/* Performance History Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Performance Over Time
                </h3>
                <div className="h-64 flex items-end space-x-1">
                  {activeSession?.traces.slice(-20).map((trace, index) => (
                    <div key={trace.id} className="flex-1 flex flex-col justify-end space-y-1">
                      {/* CPU Bar */}
                      <div 
                        className="bg-blue-500 w-full rounded-t transition-all duration-300"
                        style={{ height: `${(trace.performance.cpu / 100) * 80}px` }}
                        title={`CPU: ${trace.performance.cpu.toFixed(1)}%`}
                      />
                      {/* Memory Bar */}
                      <div 
                        className="bg-green-500 w-full transition-all duration-300"
                        style={{ height: `${(trace.performance.memory / 100) * 80}px` }}
                        title={`Memory: ${trace.performance.memory.toFixed(1)}MB`}
                      />
                      {/* Render Time Bar */}
                      <div 
                        className="bg-purple-500 w-full rounded-b transition-all duration-300"
                        style={{ height: `${Math.min((trace.performance.renderTime / 16) * 40, 40)}px` }}
                        title={`Render: ${trace.performance.renderTime.toFixed(1)}ms`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded" />
                    <span className="text-gray-600 dark:text-gray-400">CPU Usage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span className="text-gray-600 dark:text-gray-400">Memory Usage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-500 rounded" />
                    <span className="text-gray-600 dark:text-gray-400">Render Time</span>
                  </div>
                </div>
              </div>

              {/* Performance Alerts */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Performance Alerts
                </h3>
                <div className="space-y-3">
                  {activeSession?.traces.filter(trace => 
                    trace.performance.cpu > 80 || 
                    trace.performance.memory > 90 || 
                    trace.performance.renderTime > 16
                  ).slice(-5).map((trace) => (
                    <div key={trace.id} className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          Performance Issue Detected
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {trace.performance.cpu > 80 && `High CPU usage: ${trace.performance.cpu.toFixed(1)}% `}
                          {trace.performance.memory > 90 && `High memory usage: ${trace.performance.memory.toFixed(1)}MB `}
                          {trace.performance.renderTime > 16 && `Slow render: ${trace.performance.renderTime.toFixed(1)}ms `}
                          • {trace.method} {trace.url}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {new Date(trace.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!activeSession?.traces.some(trace => 
                    trace.performance.cpu > 80 || 
                    trace.performance.memory > 90 || 
                    trace.performance.renderTime > 16
                  )) && (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <div className="text-gray-600 dark:text-gray-400">
                        No performance issues detected
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}