'use client'

import { useState, useEffect } from 'react'
import {
  Zap,
  ChevronRight,
  Plus,
  ArrowRight,
  GripVertical,
  Trash2,
  Copy,
  Check,
  Replace,
  Split,
  Binary,
  CalendarClock,
  KeyRound,
  Eye,
  Play,
  Save,
  Wand2,
  X,
  Pencil,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Lightbulb,
  Settings,
  Brain,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { 
  useInvestigations,
  useAvailableTransformations,
  useTransformationPipelines,
  useTransformationPipeline,
  useTransformationPipelineStatus,
  useFrameworkTransformationSuggestions,
  useTransformationPreview,
  useSupportedFrameworks
} from '@/hooks/useAPIData'

interface Dataset {
  id: string
  name: string
  rowCount: number
  status: string
}

interface TransformationStep {
  id: string
  type: string
  column: string
  description: string
  params: Record<string, any>
}

interface Pipeline {
  id: string
  name: string
  description?: string
  dataset_id: string
  status: string
  steps: TransformationStep[]
  created_at: string
  target_framework?: string
}

const FrameworkSelector = ({ 
  value, 
  onChange,
  frameworks 
}: { 
  value: string, 
  onChange: (framework: string) => void,
  frameworks: Record<string, any> | null
}) => {
  if (!frameworks) return null

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center space-x-2 mb-3">
        <Target className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-medium text-gray-700">Target Framework</h3>
      </div>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
      >
        {Object.entries(frameworks).map(([key, framework]) => (
          <option key={key} value={key}>
            {framework.name} - {framework.description}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-2">
        Framework-specific optimizations will be applied to your pipeline
      </p>
    </div>
  )
}

const FrameworkSuggestions = ({ 
  datasetId, 
  framework,
  onAddSuggestion 
}: { 
  datasetId: string | null,
  framework: string,
  onAddSuggestion: (suggestion: any) => void
}) => {
  const { data: suggestions, loading } = useFrameworkTransformationSuggestions(datasetId, framework)

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm text-gray-600">Loading AI suggestions...</span>
        </div>
      </div>
    )
  }

  if (!suggestions?.suggestions || suggestions.suggestions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-2 text-gray-500">
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm">No AI suggestions available</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center space-x-2 mb-3">
        <Brain className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-medium text-gray-700">AI Suggestions</h3>
      </div>
      <div className="space-y-2">
        {suggestions.suggestions.slice(0, 3).map((suggestion, index) => (
          <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">{suggestion.description}</p>
                <p className="text-xs text-purple-700 mt-1">
                  Column: {suggestion.column} • Priority: {suggestion.priority}/10
                </p>
              </div>
              <button
                onClick={() => onAddSuggestion(suggestion)}
                className="ml-2 p-1 text-purple-600 hover:bg-purple-100 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const AddTransformationModal = ({ 
  isOpen, 
  onClose, 
  onAddStep,
  availableTransformations 
}: {
  isOpen: boolean, 
  onClose: () => void, 
  onAddStep: (type: string) => void,
  availableTransformations: any[] | null
}) => {
  if (!isOpen) return null;

  const getTransformationIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'replace': Replace,
      'split': Split,
      'format-date': CalendarClock,
      'convert-type': Binary,
      'remove-duplicates': Copy,
      'normalize': Wand2,
      'aggregate': Target,
      'filter': Eye
    }
    const IconComponent = iconMap[type] || Zap
    return <IconComponent className="w-6 h-6 text-blue-600" />
  }

  const transforms = availableTransformations || [
    { type: 'replace', title: 'Replace Text', description: 'Find and replace text in a column.' },
    { type: 'split', title: 'Split Column', description: 'Split a column into multiple columns.' },
    { type: 'format-date', title: 'Format Date', description: 'Change the format of a date column.' },
    { type: 'convert-type', title: 'Convert Data Type', description: 'Change the data type of a column.' },
    { type: 'remove-duplicates', title: 'Remove Duplicates', description: 'Remove duplicate rows.' },
  ]

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl transform transition-all">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Transformation Step</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600"/>
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-6">Select a transformation to add to your pipeline. Framework-specific optimizations will be applied automatically.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {transforms.map(transform => (
              <div 
                key={transform.type} 
                onClick={() => onAddStep(transform.type)}
                className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3 mb-2">
                  {getTransformationIcon(transform.type)}
                  <h3 className="font-semibold text-gray-800">{transform.title}</h3>
                </div>
                <p className="text-sm text-gray-500">{transform.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const TransformationStepCard = ({ 
  step, 
  onUpdate, 
  onDelete, 
  onPreview,
  isEditing, 
  onSetEditing,
  datasetId 
}: {
  step: TransformationStep, 
  onUpdate: (step: TransformationStep) => void, 
  onDelete: (id: string) => void,
  onPreview: (step: TransformationStep) => void,
  isEditing: boolean, 
  onSetEditing: (id: string | null) => void,
  datasetId: string | null
}) => {
  const [formData, setFormData] = useState(step);
  const { previewTransformation, previewing } = useTransformationPreview()
  const [previewResults, setPreviewResults] = useState<any>(null)

  const handleSave = () => {
    onUpdate(formData);
    onSetEditing(null);
  };

  const handlePreview = async () => {
    if (!datasetId) return
    
    try {
      const result = await previewTransformation({
        dataset_id: datasetId,
        step: {
          type: formData.type,
          column: formData.column,
          params: formData.params
        }
      })
      setPreviewResults(result)
    } catch (error) {
      console.error('Preview failed:', error)
    }
  }

  const getTransformationIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'replace': Replace,
      'split': Split,
      'format-date': CalendarClock,
      'convert-type': Binary,
      'remove-duplicates': Copy,
      'normalize': Wand2,
      'aggregate': Target,
      'filter': Eye
    }
    const IconComponent = iconMap[type] || Zap
    return <IconComponent className="w-5 h-5 text-gray-500" />
  }
    
  if (isEditing) {
    return (
      <div className="p-4 rounded-lg bg-white border-2 border-blue-600 shadow-lg">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0 bg-blue-100 p-2 rounded-md">
            {getTransformationIcon(step.type)}
          </div>
          <div className="flex-grow">
            <input 
              type="text" 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="font-semibold text-gray-800 w-full p-1 rounded-md border border-gray-300" 
            />
          </div>
        </div>

        {/* Dynamic Form Fields */}
        <div className="space-y-3 pl-10">
          <div className="grid grid-cols-3 gap-2 items-center">
            <label className="text-sm font-medium text-gray-700">Column</label>
            <input 
              type="text" 
              value={formData.column} 
              onChange={e => setFormData({...formData, column: e.target.value})} 
              className="col-span-2 p-1 rounded-md border border-gray-300 text-sm" 
            />
          </div>
          
          {/* Type-specific parameters */}
          {step.type === 'replace' && (
            <>
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-sm font-medium text-gray-700">Find</label>
                <input 
                  type="text" 
                  placeholder="Text or /regex/" 
                  value={formData.params.find || ''} 
                  onChange={e => setFormData({...formData, params: {...formData.params, find: e.target.value}})}
                  className="col-span-2 p-1 rounded-md border border-gray-300 text-sm" 
                />
                  </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-sm font-medium text-gray-700">Replace with</label>
                <input 
                  type="text" 
                  value={formData.params.replace || ''} 
                  onChange={e => setFormData({...formData, params: {...formData.params, replace: e.target.value}})}
                  className="col-span-2 p-1 rounded-md border border-gray-300 text-sm" 
                />
              </div>
            </>
          )}
          
          {step.type === 'split' && (
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="text-sm font-medium text-gray-700">Delimiter</label>
              <input 
                type="text" 
                value={formData.params.delimiter || ''} 
                onChange={e => setFormData({...formData, params: {...formData.params, delimiter: e.target.value}})} 
                className="col-span-2 p-1 rounded-md border border-gray-300 text-sm" 
              />
            </div>
          )}
          
          {step.type === 'convert-type' && (
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="text-sm font-medium text-gray-700">Target Type</label>
              <select 
                value={formData.params.target_type || ''} 
                onChange={e => setFormData({...formData, params: {...formData.params, target_type: e.target.value}})}
                className="col-span-2 p-1 rounded-md border border-gray-300 text-sm"
              >
                <option value="">Select type</option>
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>
          )}
        </div>

        {/* Preview Results */}
        {previewResults && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-medium text-green-800 mb-2">Preview Results</h4>
            <p className="text-sm text-green-700">
              {previewResults.affected_rows} rows would be affected
            </p>
            {previewResults.warnings && previewResults.warnings.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-orange-700">Warnings:</p>
                <ul className="text-xs text-orange-600 ml-4">
                  {previewResults.warnings.map((warning: string, idx: number) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center mt-4">
          <button
            onClick={handlePreview}
            disabled={previewing || !datasetId}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50"
          >
            {previewing ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
            Preview
          </button>
          
          <div className="flex space-x-2">
            <button 
              onClick={() => onSetEditing(null)} 
              className="px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              className="px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 border border-gray-200/80 group">
      <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
      <div className="flex-shrink-0 bg-white p-2 rounded-md shadow-sm border border-gray-200">
        {getTransformationIcon(step.type)}
      </div>
      <div className="flex-grow">
        <p className="font-semibold text-gray-800">{step.description}</p>
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-600">Column:</span> {step.column}
        </p>
      </div>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
        <button 
          onClick={() => onSetEditing(step.id)} 
          className="p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onDelete(step.id)} 
          className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

const PipelineExecutionStatus = ({ 
  pipelineId 
}: { 
  pipelineId: string | null 
}) => {
  const { data: status, loading } = useTransformationPipelineStatus(pipelineId)

  if (!pipelineId || loading) return null

  if (!status) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200'
      case 'failed': return 'text-red-600 bg-red-50 border-red-200'
      case 'running': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor(status.status)}`}>
              <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {status.status === 'running' && <RefreshCw className="w-4 h-4 animate-spin" />}
          {status.status === 'completed' && <CheckCircle className="w-4 h-4" />}
          {status.status === 'failed' && <AlertTriangle className="w-4 h-4" />}
          <span className="font-medium">Pipeline {status.status}</span>
        </div>
        <span className="text-sm">{status.progress}%</span>
      </div>
      {status.errors && status.errors.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium">Errors:</p>
          <ul className="text-sm mt-1">
            {status.errors.map((error, idx) => (
              <li key={idx}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function TransformationsPage() {
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [pipeline, setPipeline] = useState<TransformationStep[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [targetFramework, setTargetFramework] = useState('pandas')
  const [executingPipelineId, setExecutingPipelineId] = useState<string | null>(null)

  // API hooks
  const { data: investigations } = useInvestigations()
  const { data: availableTransformations } = useAvailableTransformations()
  const { data: existingPipelines, refetch: refetchPipelines } = useTransformationPipelines()
  const { data: frameworks } = useSupportedFrameworks()
  const { createPipeline, executePipeline, creating, executing } = useTransformationPipeline()

  // Convert investigations to datasets
  const datasets: Dataset[] = investigations?.filter(inv => inv.status === 'completed').map(inv => ({
    id: inv.id,
    name: inv.name,
    rowCount: inv.total_records || 0,
    status: inv.status
  })) || []

  useEffect(() => {
    if (datasets.length > 0 && !selectedDataset) {
      setSelectedDataset(datasets[0])
    }
  }, [datasets, selectedDataset])

  const addStepToPipeline = (type: string) => {
    const transformInfo = availableTransformations?.transformations.find(t => t.type === type);
    const newStep: TransformationStep = {
      id: `step_${Date.now()}`,
      type: type,
      column: 'column_name',
      description: transformInfo?.title || "New Step",
      params: {}
    }
    setPipeline([...pipeline, newStep]);
    setEditingStepId(newStep.id);
    setIsModalOpen(false);
  }

  const addSuggestionToPipeline = (suggestion: any) => {
    const newStep: TransformationStep = {
      id: `step_${Date.now()}`,
      type: suggestion.type,
      column: suggestion.column,
      description: suggestion.description,
      params: suggestion.params
    }
    setPipeline([...pipeline, newStep]);
  }

  const updateStepInPipeline = (updatedStep: TransformationStep) => {
    setPipeline(pipeline.map(step => step.id === updatedStep.id ? updatedStep : step));
  }

  const deleteStepFromPipeline = (stepId: string) => {
    setPipeline(pipeline.filter(step => step.id !== stepId));
  }

  const handleSavePipeline = async () => {
    if (!selectedDataset || pipeline.length === 0) return

    try {
      const result = await createPipeline({
        name: `${selectedDataset.name} Pipeline`,
        description: `Transformation pipeline for ${selectedDataset.name}`,
        dataset_id: selectedDataset.id,
        target_framework: targetFramework,
        steps: pipeline.map(step => ({
          type: step.type,
          column: step.column,
          params: step.params
        }))
      })
      
      console.log('Pipeline created:', result)
      refetchPipelines()
    } catch (error) {
      console.error('Failed to create pipeline:', error)
    }
  }

  const handleExecutePipeline = async (pipelineId: string) => {
    try {
      setExecutingPipelineId(pipelineId)
      const result = await executePipeline(pipelineId)
      console.log('Pipeline execution started:', result)
    } catch (error) {
      console.error('Failed to execute pipeline:', error)
      setExecutingPipelineId(null)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Data Transformations"
        description="Build AI-powered transformation pipelines with framework-specific optimizations."
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSavePipeline}
            disabled={creating || pipeline.length === 0 || !selectedDataset}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {creating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Pipeline
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-sm hover:shadow-lg transition-all transform hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Step
                </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Framework Selection */}
          <FrameworkSelector value={targetFramework} onChange={setTargetFramework} frameworks={frameworks} />
          
          {/* AI Suggestions */}
          <FrameworkSuggestions 
            datasetId={selectedDataset?.id || null}
            framework={targetFramework}
            onAddSuggestion={addSuggestionToPipeline}
          />
          
          {/* Dataset Selection */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Select Dataset</h2>
            <div className="space-y-2">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  onClick={() => setSelectedDataset(dataset)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4',
                    selectedDataset?.id === dataset.id 
                      ? 'bg-blue-50 border-blue-600' 
                      : 'border-transparent hover:bg-gray-100'
                  )}
                >
                  <h3 className="font-semibold text-gray-800 text-sm">{dataset.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{dataset.rowCount.toLocaleString()} rows</p>
                </div>
              ))}
              {datasets.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No datasets available</p>
                  <p className="text-xs">Process data first</p>
                </div>
              )}
              </div>
            </div>

          {/* Existing Pipelines */}
          {existingPipelines && existingPipelines.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Saved Pipelines</h2>
              <div className="space-y-2">
                {existingPipelines.map((existingPipeline) => (
                  <div key={existingPipeline.id} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                  <div>
                        <h3 className="font-semibold text-gray-800 text-sm">{existingPipeline.name}</h3>
                        <p className="text-xs text-gray-500">{existingPipeline.steps.length} steps</p>
                      </div>
                      <button
                        onClick={() => handleExecutePipeline(existingPipeline.id)}
                        disabled={executing}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Pipeline Execution Status */}
          <PipelineExecutionStatus pipelineId={executingPipelineId} />

          {/* Pipeline Builder */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Transformation Pipeline</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDataset ? `Building pipeline for ${selectedDataset.name}` : 'Select a dataset to start'}
                </p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Settings className="w-4 h-4" />
                <span>Framework: {targetFramework}</span>
              </div>
            </div>

            {pipeline.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No transformation steps yet</h3>
                <p className="text-gray-600 mb-4">Add transformation steps to build your pipeline</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Step
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pipeline.map((step, index) => (
                  <div key={step.id} className="relative">
                    <TransformationStepCard
                      step={step}
                      onUpdate={updateStepInPipeline}
                      onDelete={deleteStepFromPipeline}
                      onPreview={(step) => console.log('Preview:', step)}
                      isEditing={editingStepId === step.id}
                      onSetEditing={setEditingStepId}
                      datasetId={selectedDataset?.id || null}
                    />
                    {index < pipeline.length - 1 && (
                      <div className="flex justify-center my-2">
                        <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
                    )}
                </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Transformation Modal */}
      <AddTransformationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddStep={addStepToPipeline}
        availableTransformations={availableTransformations?.transformations || null}
      />
    </div>
  )
}
