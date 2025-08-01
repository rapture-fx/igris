'use client'

import { useState, useEffect } from 'react'
import { 
  Workflow, 
  Plus, 
  PlayCircle, 
  PauseCircle, 
  Square, 
  Settings, 
  Copy, 
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Database,
  Zap,
  Upload,
  Download,
  ArrowRight,
  Edit3,
  Eye
} from 'lucide-react'

interface PipelineStep {
  id: string
  name: string
  type: 'input' | 'transform' | 'validate' | 'output' | 'ml'
  status: 'completed' | 'running' | 'pending' | 'error'
}

interface Pipeline {
  id: string
  name: string
  description: string
  status: 'draft' | 'running' | 'completed' | 'paused' | 'failed'
  steps: PipelineStep[]
  lastRun: string
  totalRuns: number
  successRate: number
  createdAt: string
}

export default function PipelineBuilder() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)

  useEffect(() => {
    // Mock data
    setPipelines([
      {
        id: '1',
        name: 'Customer Data Processing',
        description: 'End-to-end pipeline for customer transaction data cleaning and enrichment',
        status: 'running',
        lastRun: '2 hours ago',
        totalRuns: 47,
        successRate: 94.6,
        createdAt: '2024-01-10',
        steps: [
          { id: '1', name: 'Data Ingestion', type: 'input', status: 'completed' },
          { id: '2', name: 'Schema Validation', type: 'validate', status: 'completed' },
          { id: '3', name: 'Data Cleaning', type: 'transform', status: 'running' },
          { id: '4', name: 'Feature Engineering', type: 'transform', status: 'pending' },
          { id: '5', name: 'Auto-Labeling', type: 'ml', status: 'pending' },
          { id: '6', name: 'Data Export', type: 'output', status: 'pending' }
        ]
      },
      {
        id: '2',
        name: 'Product Catalog Enrichment',
        description: 'Automated product categorization and metadata enhancement pipeline',
        status: 'completed',
        lastRun: '1 day ago',
        totalRuns: 23,
        successRate: 87.2,
        createdAt: '2024-01-08',
        steps: [
          { id: '1', name: 'Product Data Load', type: 'input', status: 'completed' },
          { id: '2', name: 'Image Processing', type: 'ml', status: 'completed' },
          { id: '3', name: 'Category Classification', type: 'ml', status: 'completed' },
          { id: '4', name: 'Metadata Enrichment', type: 'transform', status: 'completed' },
          { id: '5', name: 'Quality Check', type: 'validate', status: 'completed' },
          { id: '6', name: 'Catalog Export', type: 'output', status: 'completed' }
        ]
      },
      {
        id: '3',
        name: 'Log Analysis Pipeline',
        description: 'Real-time log processing and anomaly detection for system monitoring',
        status: 'draft',
        lastRun: 'Never',
        totalRuns: 0,
        successRate: 0,
        createdAt: '2024-01-15',
        steps: [
          { id: '1', name: 'Log Ingestion', type: 'input', status: 'pending' },
          { id: '2', name: 'Log Parsing', type: 'transform', status: 'pending' },
          { id: '3', name: 'Anomaly Detection', type: 'ml', status: 'pending' },
          { id: '4', name: 'Alert Generation', type: 'output', status: 'pending' }
        ]
      }
    ])
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayCircle className="w-4 h-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'paused':
        return <PauseCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-400 bg-blue-900/20 border-blue-700'
      case 'completed':
        return 'text-green-400 bg-green-900/20 border-green-700'
      case 'failed':
        return 'text-red-400 bg-red-900/20 border-red-700'
      case 'paused':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-700'
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-700'
    }
  }

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'input':
        return <Upload className="w-4 h-4 text-blue-400" />
      case 'transform':
        return <Zap className="w-4 h-4 text-yellow-400" />
      case 'validate':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'ml':
        return <Database className="w-4 h-4 text-purple-400" />
      case 'output':
        return <Download className="w-4 h-4 text-blue-400" />
      default:
        return <Settings className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Pipeline Builder</h1>
              <p className="text-gray-400 mt-1">Create and manage your data processing workflows</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="inline-flex items-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors">
                <Plus className="w-4 h-4 mr-2" />
                New Pipeline
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pipeline List */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {pipelines.map((pipeline) => (
                <div 
                  key={pipeline.id} 
                  className={`bg-[#161616] border rounded-xl p-6 cursor-pointer transition-all hover:border-[#468BE6]/50 ${
                    selectedPipeline?.id === pipeline.id ? 'border-[#468BE6] ring-1 ring-[#468BE6]/50' : 'border-gray-800'
                  }`}
                  onClick={() => setSelectedPipeline(pipeline)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{pipeline.name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(pipeline.status)}`}>
                          {pipeline.status}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-4">{pipeline.description}</p>
                      
                      {/* Pipeline Steps Preview */}
                      <div className="flex items-center space-x-2 mb-4">
                        {pipeline.steps.slice(0, 4).map((step, index) => (
                          <div key={step.id} className="flex items-center">
                            <div className={`p-2 rounded-lg border ${
                              step.status === 'completed' ? 'bg-green-900/20 border-green-700' :
                              step.status === 'running' ? 'bg-blue-900/20 border-blue-700' :
                              step.status === 'error' ? 'bg-red-900/20 border-red-700' :
                              'bg-gray-900/20 border-gray-700'
                            }`}>
                              {getStepIcon(step.type)}
                            </div>
                            {index < Math.min(pipeline.steps.length - 1, 3) && (
                              <ArrowRight className="w-3 h-3 text-gray-600 mx-1" />
                            )}
                          </div>
                        ))}
                        {pipeline.steps.length > 4 && (
                          <span className="text-xs text-gray-400">+{pipeline.steps.length - 4} more</span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Last Run:</span>
                          <span className="text-white ml-2">{pipeline.lastRun}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Total Runs:</span>
                          <span className="text-white ml-2">{pipeline.totalRuns}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Success Rate:</span>
                          <span className="text-green-400 ml-2">{pipeline.successRate}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(pipeline.status)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <div className="flex items-center space-x-2">
                      {pipeline.status === 'running' ? (
                        <button className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                          <Square className="w-3 h-3 mr-1" />
                          Stop
                        </button>
                      ) : (
                        <button className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                          <PlayCircle className="w-3 h-3 mr-1" />
                          Run
                        </button>
                      )}
                      <button className="inline-flex items-center px-3 py-1.5 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors text-sm">
                        <Edit3 className="w-3 h-3 mr-1" />
                        Edit
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-1.5 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors">
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                      <button className="p-1.5 bg-[#1a1a1a] border border-red-700 rounded-lg hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline Details Panel */}
          <div className="lg:col-span-1">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-white mb-4">
                {selectedPipeline ? 'Pipeline Details' : 'Select a Pipeline'}
              </h3>
              
              {selectedPipeline ? (
                <div className="space-y-6">
                  {/* Pipeline Info */}
                  <div>
                    <h4 className="text-white font-medium mb-2">{selectedPipeline.name}</h4>
                    <p className="text-gray-400 text-sm mb-4">{selectedPipeline.description}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Created:</span>
                        <span className="text-white">{selectedPipeline.createdAt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(selectedPipeline.status)}`}>
                          {selectedPipeline.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Steps List */}
                  <div>
                    <h5 className="text-white font-medium mb-3">Pipeline Steps</h5>
                    <div className="space-y-2">
                      {selectedPipeline.steps.map((step, index) => (
                        <div key={step.id} className="flex items-center space-x-3 p-3 bg-[#0f0f0f] border border-gray-800 rounded-lg">
                          <span className="text-xs text-gray-500 w-6">{index + 1}</span>
                          {getStepIcon(step.type)}
                          <span className="text-sm text-white flex-1">{step.name}</span>
                          <div className={`w-2 h-2 rounded-full ${
                            step.status === 'completed' ? 'bg-green-500' :
                            step.status === 'running' ? 'bg-blue-500 animate-pulse' :
                            step.status === 'error' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`}></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button className="w-full inline-flex items-center justify-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors">
                      <Eye className="w-4 h-4 mr-2" />
                      View Execution Logs
                    </button>
                    <button className="w-full inline-flex items-center justify-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors">
                      <Settings className="w-4 h-4 mr-2" />
                      Configure Pipeline
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Workflow className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Select a pipeline to view its details and configuration</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}