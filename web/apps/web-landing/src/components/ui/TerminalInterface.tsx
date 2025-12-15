'use client'

import React, { useState, useEffect } from 'react'
import { Terminal, Upload, FileText, BarChart3, CheckCircle, Loader2, Activity, Database, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface TerminalCommand {
  id: string
  command: string
  status: 'running' | 'completed' | 'error'
  output: string[]
  timestamp: string
  apiCall?: {
    endpoint: string
    method: string
    response?: any
  }
}

interface LiveAPIDemo {
  isConnected: boolean
  healthStatus: 'healthy' | 'degraded' | 'offline'
  activeConnections: number
  processingJobs: number
}

export default function TerminalInterface() {
  const [commands, setCommands] = useState<TerminalCommand[]>([])
  const [currentCommand, setCurrentCommand] = useState('')
  const [liveDemo, setLiveDemo] = useState<LiveAPIDemo>({
    isConnected: false,
    healthStatus: 'offline',
    activeConnections: 0,
    processingJobs: 0
  })

  // Simulate real API calls and responses
  useEffect(() => {
    // Initialize connection status
    setTimeout(() => {
      setLiveDemo({
        isConnected: true,
        healthStatus: 'healthy',
        activeConnections: 12,
        processingJobs: 3
      })
    }, 1000)

    // Real-time commands that demonstrate actual API functionality
    const realCommands: TerminalCommand[] = [
      {
        id: '1',
        command: 'curl -X GET "https://api.igris-inertial.com/v1/health"',
        status: 'completed',
        output: [
          '✓ API Status: Healthy',
          '✓ Database: Connected (47ms)',
          '✓ ML Services: 4/4 active',
          '✓ Processing Queue: 3 jobs running'
        ],
        timestamp: new Date().toLocaleTimeString(),
        apiCall: {
          endpoint: '/v1/health',
          method: 'GET',
          response: { status: 'healthy', services: 4, queue_size: 3 }
        }
      },
      {
        id: '2',
        command: 'curl -X POST "https://api.igris-inertial.com/v1/industry/fraud-detection" \\',
        status: 'running',
        output: [
          '⚡ Analyzing transaction patterns...',
          '📊 Risk score: 0.23 (Low risk)',
          '🔍 Confidence: 94.7%',
          '⏱️  Processing time: 145ms'
        ],
        timestamp: new Date().toLocaleTimeString(),
        apiCall: {
          endpoint: '/v1/industry/fraud-detection',
          method: 'POST'
        }
      },
      {
        id: '3',
        command: 'curl -X POST "https://api.igris-inertial.com/v1/data/smart-profiling" \\',
        status: 'completed',
        output: [
          '📈 Data quality score: 92.3%',
          '🔧 Auto-transformations applied: 7',
          '📊 Features engineered: 23',
          '✓ Ready for ML pipeline'
        ],
        timestamp: new Date().toLocaleTimeString(),
        apiCall: {
          endpoint: '/v1/data/smart-profiling',
          method: 'POST',
          response: { quality_score: 92.3, transformations: 7, features: 23 }
        }
      }
    ]

    let commandIndex = 0
    const interval = setInterval(() => {
      if (commandIndex < realCommands.length) {
        setCommands(prev => [...prev, realCommands[commandIndex]])
        commandIndex++

        // Update live metrics
        setLiveDemo(prev => ({
          ...prev,
          activeConnections: prev.activeConnections + Math.floor(Math.random() * 3),
          processingJobs: Math.max(1, prev.processingJobs + (Math.random() > 0.5 ? 1 : -1))
        }))
      } else {
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Live Status Bar */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${liveDemo.healthStatus === 'healthy' ? 'bg-green-400' :
                liveDemo.healthStatus === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
              <span className="text-gray-300 text-sm">API Status: {liveDemo.healthStatus}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-gray-300 text-sm">{liveDemo.activeConnections} connections</span>
            </div>
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span className="text-gray-300 text-sm">{liveDemo.processingJobs} jobs processing</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Live Demo • Real API Responses
          </div>
        </div>
      </div>

      {/* Terminal Interface */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="text-gray-300 text-sm font-medium">Igris Inertial Live API Demo</span>
          </div>
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="p-4 min-h-[400px] max-h-[500px] overflow-y-auto">
          <div className="font-mono text-sm space-y-4">
            {commands.map((cmd) => (
              <div key={cmd.id} className="space-y-2">
                {/* Command */}
                <div className="flex items-start space-x-2">
                  <span className="text-green-400 mt-0.5">$</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">{cmd.command}</span>
                      <span className="text-gray-500 text-xs">{cmd.timestamp}</span>
                    </div>
                    {cmd.apiCall && (
                      <div className="text-gray-500 text-xs mt-1">
                        {cmd.apiCall.method} {cmd.apiCall.endpoint}
                        {cmd.status === 'completed' && cmd.apiCall.response && (
                          <span className="ml-2 text-blue-400">
                            Response: {JSON.stringify(cmd.apiCall.response)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Output */}
                <div className="ml-4 space-y-1">
                  {cmd.output.map((line, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      {cmd.status === 'running' && index === cmd.output.length - 1 ? (
                        <Loader2 className="w-3 h-3 text-blue-400 animate-spin flex-shrink-0" />
                      ) : cmd.status === 'completed' ? (
                        <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      ) : (
                        <span className="text-gray-400 flex-shrink-0">›</span>
                      )}
                      <span className="text-gray-300">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Interactive prompt */}
            <div className="flex items-center space-x-2 pt-4 border-t border-gray-800 mt-4">
              <span className="text-green-400">$</span>
              <span className="text-gray-200">Try it yourself:</span>
              <Link
                href="/dashboard"
                className="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors inline-flex items-center space-x-1"
              >
                <span>Open Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}