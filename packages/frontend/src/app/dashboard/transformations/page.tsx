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
import { FrameworkSelector } from '@/components/transformations/framework-selector'
import { FrameworkSuggestions } from '@/components/transformations/framework-suggestions'
import AddTransformationModal from '@/components/transformations/add-transformation-modal'
import { TransformationStepCard } from '@/components/transformations/transformation-step-card'
import { PipelineExecutionStatus } from '@/components/transformations/pipeline-execution-status'

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

const PipelineToolbar = ({ onSave, onExecute, onAddStep, selectedPipeline }: { onSave: () => void, onExecute: () => void, onAddStep: () => void, selectedPipeline: Pipeline | null }) => (
  <div className="flex justify-between items-center mb-4">
    <div>
      <h2 className="text-xl font-bold text-gray-800">{selectedPipeline?.name || 'New Pipeline'}</h2>
      <p className="text-sm text-gray-500">{selectedPipeline?.description || 'Build a new transformation pipeline'}</p>
    </div>
    <div className="flex items-center space-x-2">
      <button
        onClick={onAddStep}
        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Step
      </button>
      <button
        onClick={onSave}
        className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
      >
        <Save className="w-4 h-4 mr-2" />
        Save
      </button>
      <button
        onClick={onExecute}
        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
      >
        <Play className="w-4 h-4 mr-2" />
        Execute
      </button>
    </div>
  </div>
);

const TransformationPipelineList = ({ steps, onUpdateStep, onDeleteStep, editingStepId, setEditingStepId, datasetId }: { steps: TransformationStep[], onUpdateStep: (step: TransformationStep) => void, onDeleteStep: (id: string) => void, editingStepId: string | null, setEditingStepId: (id: string | null) => void, datasetId: string | null }) => (
  <div className="space-y-3">
    {steps.length > 0 ? (
      steps.map((step, index) => (
        <TransformationStepCard
          key={step.id}
          step={step}
          onUpdate={onUpdateStep}
          onDelete={onDeleteStep}
          isEditing={editingStepId === step.id}
          onSetEditing={setEditingStepId}
          datasetId={datasetId}
        />
      ))
    ) : (
      <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
        <Zap className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Empty Pipeline</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by adding a transformation step.</p>
      </div>
    )}
  </div>
);

export default function TransformationsPage() {
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [pipeline, setPipeline] = useState<TransformationStep[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [targetFramework, setTargetFramework] = useState('pandas')
  const [executedPipelineId, setExecutedPipelineId] = useState<string | null>(null)

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
      setExecutedPipelineId(pipelineId)
      const result = await executePipeline(pipelineId)
      console.log('Pipeline execution started:', result)
    } catch (error) {
      console.error('Failed to execute pipeline:', error)
      setExecutedPipelineId(null)
    }
  }

  const handleFrameworkChange = (framework: string) => {
    setTargetFramework(framework)
  }

  const handleExecuteCurrentPipeline = () => {
    if (executedPipelineId) {
      handleExecutePipeline(executedPipelineId)
    }
  }

  return (
    <div className="h-full bg-gray-50">
      <PageHeader
        title="Transformations"
        description="Build AI-powered transformation pipelines with framework-specific optimizations."
        actions={
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
        }
      />

      <div className="p-4 lg:p-8">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-3">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Pipelines</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-2 space-y-1">
              {existingPipelines?.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleExecutePipeline(p.id)}
                  className={`w-full text-left flex justify-between items-center p-3 rounded-md transition-colors ${executedPipelineId === p.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-100'}`}
                >
                  <span>{p.name}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ))}
              <button
                onClick={() => setExecutedPipelineId(null)}
                className="w-full text-left flex justify-between items-center p-3 rounded-md transition-colors hover:bg-gray-100"
              >
                <span>+ New Pipeline</span>
              </button>
            </div>
            {executedPipelineId && (
              <div className="mt-6">
                <FrameworkSelector
                  value={targetFramework}
                  onChange={handleFrameworkChange}
                  frameworks={frameworks}
                />
              </div>
            )}
          </div>

          <main className="col-span-12 lg:col-span-9">
            <PipelineToolbar 
              onSave={handleSavePipeline}
              onExecute={handleExecuteCurrentPipeline}
              onAddStep={() => setIsModalOpen(true)}
              selectedPipeline={executedPipelineId ? null : existingPipelines?.find(p => p.id === executedPipelineId) || null}
            />
            
            {executedPipelineId && <PipelineExecutionStatus pipelineId={executedPipelineId} />}
            
            <div className="mt-6">
              <TransformationPipelineList 
                steps={executedPipelineId ? pipeline : existingPipelines?.find(p => p.id === executedPipelineId)?.steps || []}
                onUpdateStep={updateStepInPipeline}
                onDeleteStep={deleteStepFromPipeline}
                editingStepId={editingStepId}
                setEditingStepId={setEditingStepId}
                datasetId={executedPipelineId ? selectedDataset?.id || null : existingPipelines?.find(p => p.id === executedPipelineId)?.dataset_id || null}
              />
            </div>
          </main>
        </div>
      </div>

      <AddTransformationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddStep={addStepToPipeline}
        availableTransformations={availableTransformations?.transformations || null}
      />
    </div>
  )
}
