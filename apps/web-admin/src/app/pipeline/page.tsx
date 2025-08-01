'use client'

import { useState, useEffect } from 'react'
import { 
  PlayCircle, 
  PauseCircle, 
  Square, 
  Settings, 
  Download, 
  Upload, 
  Database, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  ArrowRight,
  FileText,
  BarChart3,
  Layers,
  Code2,
  Eye,
  Edit3
} from 'lucide-react'

interface PipelineStep {
  id: string
  name: string
  type: 'input' | 'transform' | 'validate' | 'output' | 'ml'
  status: 'completed' | 'running' | 'pending' | 'error'
  duration: string
  config: Record<string, any>
  inputRows: number
  outputRows: number
  description: string
}

interface Pipeline {
  id: string
  name: string
  status: 'running' | 'completed' | 'paused' | 'failed'
  steps: PipelineStep[]
  startTime: string
  totalDuration: string
  datasetSize: string
}

export default function PipelineVisualization() {
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null)

  useEffect(() => {
    // Mock pipeline data
    const mockPipeline: Pipeline = {
      id: '1',
      name: 'Customer Data Processing Pipeline',
      status: 'running',
      startTime: '2024-01-15T10:30:00Z',
      totalDuration: '4m 23s',
      datasetSize: '2.3 GB',
      steps: [
        {
          id: 'input',
          name: 'Data Ingestion',
          type: 'input',
          status: 'completed',
          duration: '0m 45s',
          inputRows: 0,
          outputRows: 150000,
          description: 'Load CSV data from cloud storage',
          config: {
            source: 's3://data-bucket/customers.csv',
            format: 'CSV',
            encoding: 'UTF-8'
          }
        },
        {
          id: 'validate',
          name: 'Schema Validation',
          type: 'validate',
          status: 'completed',
          duration: '0m 12s',
          inputRows: 150000,
          outputRows: 147850,
          description: 'Validate data against predefined schema',
          config: {
            schema: 'customer_v2.json',
            strict_mode: false,
            drop_invalid: true
          }
        },
        {
          id: 'clean',
          name: 'Data Cleaning',
          type: 'transform',
          status: 'running',
          duration: '1m 34s',
          inputRows: 147850,
          outputRows: 0,
          description: 'Remove duplicates, handle missing values',
          config: {
            remove_duplicates: true,
            missing_value_strategy: 'median_fill',
            outlier_detection: 'iqr'
          }
        },
        {
          id: 'transform',
          name: 'Feature Engineering',
          type: 'transform',
          status: 'pending',
          duration: '',
          inputRows: 0,
          outputRows: 0,
          description: 'Create derived features and encodings',
          config: {
            categorical_encoding: 'one_hot',
            numerical_scaling: 'standard',
            create_features: ['age_group', 'purchase_frequency']
          }
        },
        {
          id: 'ml',
          name: 'Auto-Labeling',
          type: 'ml',
          status: 'pending',
          duration: '',
          inputRows: 0,
          outputRows: 0,
          description: 'Apply ML model for automated classification',
          config: {
            model: 'customer_segmentation_v3',
            confidence_threshold: 0.85,
            fallback_strategy: 'manual_review'
          }
        },
        {
          id: 'output',
          name: 'Data Export',
          type: 'output',
          status: 'pending',
          duration: '',
          inputRows: 0,
          outputRows: 0,
          description: 'Export processed data to destination',
          config: {
            destination: 'postgresql://prod-db/customers',
            format: 'parquet',
            partition_by: 'date'
          }
        }
      ]
    }

    setPipelines([mockPipeline])
    setSelectedPipeline(mockPipeline)
  }, [])

  const getStepIcon = (type: string, status: string) => {
    const iconClass = "w-6 h-6"
    
    if (status === 'running') {
      switch (type) {
        case 'input': return <Upload className={`${iconClass} text-blue-500 animate-pulse`} />
        case 'transform': return <Zap className={`${iconClass} text-yellow-500 animate-pulse`} />
        case 'validate': return <CheckCircle className={`${iconClass} text-green-500 animate-pulse`} />
        case 'ml': return <BarChart3 className={`${iconClass} text-purple-500 animate-pulse`} />
        case 'output': return <Download className={`${iconClass} text-blue-500 animate-pulse`} />
        default: return <Settings className={`${iconClass} text-gray-500 animate-pulse`} />
      }
    }

    switch (type) {
      case 'input': return <Upload className={`${iconClass} ${getStatusColor(status)}`} />
      case 'transform': return <Zap className={`${iconClass} ${getStatusColor(status)}`} />
      case 'validate': return <CheckCircle className={`${iconClass} ${getStatusColor(status)}`} />
      case 'ml': return <BarChart3 className={`${iconClass} ${getStatusColor(status)}`} />
      case 'output': return <Download className={`${iconClass} ${getStatusColor(status)}`} />
      default: return <Settings className={`${iconClass} text-gray-500`} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500'
      case 'running': return 'text-blue-500'
      case 'error': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getStepBackgroundColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-900/20 border-green-700'
      case 'running': return 'bg-blue-900/20 border-blue-700'
      case 'error': return 'bg-red-900/20 border-red-700'
      default: return 'bg-gray-900/20 border-gray-700'
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Pipeline Visualization</h1>
              <p className="text-gray-400 mt-1">Monitor and debug your data transformation workflows</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <PlayCircle className="w-4 h-4 mr-2" />
                Run Pipeline
              </button>
              <button className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                <Square className="w-4 h-4 mr-2" />
                Stop All
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {selectedPipeline && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pipeline Flow Visualization */}
            <div className="lg:col-span-2">
              <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white">{selectedPipeline.name}</h2>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-400">Dataset: {selectedPipeline.datasetSize}</span>
                    <span className="text-sm text-gray-400">Duration: {selectedPipeline.totalDuration}</span>
                  </div>
                </div>

                {/* Pipeline Steps Flow */}
                <div className="space-y-4">
                  {selectedPipeline.steps.map((step, index) => (
                    <div key={step.id}>
                      <div 
                        className={`relative p-4 rounded-lg border cursor-pointer transition-all hover:bg-gray-900/50 ${getStepBackgroundColor(step.status)} ${
                          selectedStep?.id === step.id ? 'ring-2 ring-[#468BE6]' : ''
                        }`}
                        onClick={() => setSelectedStep(step)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {getStepIcon(step.type, step.status)}
                            <div>
                              <h3 className="text-white font-medium">{step.name}</h3>
                              <p className="text-gray-400 text-sm">{step.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            {step.inputRows > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-gray-400">Input</p>
                                <p className="text-sm text-white">{step.inputRows.toLocaleString()}</p>
                              </div>
                            )}
                            {step.outputRows > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-gray-400">Output</p>
                                <p className="text-sm text-white">{step.outputRows.toLocaleString()}</p>
                              </div>
                            )}
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Duration</p>
                              <p className="text-sm text-white">{step.duration || '—'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Progress bar for running steps */}
                        {step.status === 'running' && (
                          <div className="mt-3">
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <div className="bg-[#468BE6] h-2 rounded-full animate-pulse" style={{ width: '65%' }}></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Connector Arrow */}
                      {index < selectedPipeline.steps.length - 1 && (
                        <div className="flex justify-center py-2">
                          <ArrowRight className="w-5 h-5 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step Details Panel */}
            <div className="lg:col-span-1">
              <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {selectedStep ? 'Step Configuration' : 'Select a Step'}
                </h3>
                
                {selectedStep ? (
                  <div className="space-y-6">
                    {/* Step Overview */}
                    <div>
                      <div className="flex items-center space-x-3 mb-3">
                        {getStepIcon(selectedStep.type, selectedStep.status)}
                        <div>
                          <h4 className="text-white font-medium">{selectedStep.name}</h4>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">{selectedStep.type}</p>
                        </div>
                      </div>
                      <p className="text-gray-300 text-sm">{selectedStep.description}</p>
                    </div>

                    {/* Data Flow */}
                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                      <h5 className="text-white font-medium mb-3">Data Flow</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Input Rows</p>
                          <p className="text-lg font-semibold text-white">
                            {selectedStep.inputRows > 0 ? selectedStep.inputRows.toLocaleString() : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Output Rows</p>
                          <p className="text-lg font-semibold text-white">
                            {selectedStep.outputRows > 0 ? selectedStep.outputRows.toLocaleString() : '—'}
                          </p>
                        </div>
                      </div>
                      {selectedStep.inputRows > 0 && selectedStep.outputRows > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-400 mb-1">Data Retention</p>
                          <p className="text-sm text-green-400">
                            {((selectedStep.outputRows / selectedStep.inputRows) * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Configuration */}
                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-white font-medium">Configuration</h5>
                        <button className="text-[#468BE6] hover:text-[#3a7bd5] transition-colors">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(selectedStep.config).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-xs text-gray-400 capitalize">
                              {key.replace(/_/g, ' ')}:
                            </span>
                            <span className="text-xs text-white font-mono max-w-32 truncate">
                              {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors text-sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View Data
                      </button>
                      <button className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors text-sm">
                        <FileText className="w-4 h-4 mr-2" />
                        Logs
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Click on a pipeline step to view its configuration and data flow details.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}