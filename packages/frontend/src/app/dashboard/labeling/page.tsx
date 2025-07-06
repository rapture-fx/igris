'use client'

import { useState, useEffect } from 'react'
import {
  Tags,
  Plus,
  Search,
  Filter,
  Users,
  CheckSquare,
  Clock,
  RefreshCw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Grab,
  Edit,
  Settings,
  ArrowUpRight,
  List,
  LayoutGrid,
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle,
  Eye,
  Target,
  Lightbulb,
  X,
  Sparkles,
  TrendingUp,
  BarChart3,
  Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import {
  useAutoLabelingCapabilities,
  useLabelingProjects,
  useLabelingQueue,
  useLabelingProject,
  useAutoLabeling,
  useAutoLabelingJobStatus,
  useLabelingProjectAnalytics,
  useInvestigations
} from '@/hooks/useAPIData'

interface LabelingProject {
  id: string
  name: string
  type: 'image_classification' | 'text_categorization' | 'object_detection'
  items_labeled: number
  total_items: number
  progress: number
  quality_score: number
  team_size: number
  auto_label_enabled: boolean
  created_at: string
  updated_at: string
}

interface QueueItem {
  id: string
  data: string
  type: 'image' | 'text'
  status: 'pending' | 'labeled' | 'auto_labeled'
  auto_label_suggestion?: {
    label: string
    confidence: number
    model_used: string
  }
  metadata?: Record<string, any>
}

const AutoLabelingStatus = ({ 
  capabilities 
}: { 
  capabilities: any 
}) => {
  if (!capabilities) return null

  const isOnline = capabilities.service_status === 'online'

  return (
    <div className={`p-4 rounded-lg border ${isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <>
              <Brain className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">AI Auto-Labeling Online</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800">AI Auto-Labeling Offline</span>
            </>
          )}
        </div>
        <span className="text-sm text-gray-600">
          {capabilities.models?.length || 0} models available
        </span>
      </div>
      {isOnline && (
        <div className="mt-2 text-sm text-green-700">
          <p>Available models: {capabilities.models?.map((m: any) => m.name).join(', ')}</p>
        </div>
      )}
    </div>
  )
}

const CreateProjectModal = ({ 
  isOpen, 
  onClose,
  datasets,
  capabilities 
}: {
  isOpen: boolean
  onClose: () => void
  datasets: any[]
  capabilities: any
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'image_classification' as const,
    dataset_id: '',
    labels: [''],
    auto_label_enabled: true,
    confidence_threshold: 0.8
  })
  
  const { createProject, creating } = useLabelingProject()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createProject({
        ...formData,
        labels: formData.labels.filter(label => label.trim() !== '')
      })
      onClose()
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const addLabel = () => {
    setFormData(prev => ({ ...prev, labels: [...prev.labels, ''] }))
  }

  const updateLabel = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels.map((label, i) => i === index ? value : label)
    }))
  }

  const removeLabel = (index: number) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels.filter((_, i) => i !== index)
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 m-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Create Labeling Project</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="image_classification">Image Classification</option>
              <option value="text_categorization">Text Categorization</option>
              <option value="object_detection">Object Detection</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dataset</label>
            <select
              value={formData.dataset_id}
              onChange={(e) => setFormData(prev => ({ ...prev, dataset_id: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a dataset</option>
              {datasets.map(dataset => (
                <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Labels</label>
            {formData.labels.map((label, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => updateLabel(index, e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Label ${index + 1}`}
                />
                {formData.labels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLabel(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addLabel}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + Add Label
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto_label_enabled"
              checked={formData.auto_label_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, auto_label_enabled: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="auto_label_enabled" className="text-sm font-medium text-gray-700">
              Enable AI Auto-Labeling
            </label>
          </div>

          {formData.auto_label_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence Threshold ({Math.round(formData.confidence_threshold * 100)}%)
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={formData.confidence_threshold}
                onChange={(e) => setFormData(prev => ({ ...prev, confidence_threshold: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Conservative (50%)</span>
                <span>Aggressive (100%)</span>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const LabelingInterface = ({ 
  project, 
  queueData,
  onLabelSubmit,
  onAutoLabelRequest 
}: {
  project: LabelingProject
  queueData: any
  onLabelSubmit: (itemId: string, label: string) => void
  onAutoLabelRequest: (itemIds: string[]) => void
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedLabel, setSelectedLabel] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')

  const currentItem = queueData?.items[currentIndex]
  
  if (!currentItem) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">All items labeled!</h3>
        <p className="text-gray-600">Great job! All items in the queue have been processed.</p>
      </div>
    )
  }

  const handleSubmit = () => {
    if (selectedLabel) {
      onLabelSubmit(currentItem.id, selectedLabel)
      setSelectedLabel('')
      setReviewNotes('')
      setCurrentIndex(prev => Math.min(prev + 1, queueData.items.length - 1))
    }
  }

  const handleAutoLabel = () => {
    const pendingItems = queueData.items.filter((item: any) => item.status === 'pending')
    onAutoLabelRequest(pendingItems.map((item: any) => item.id))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Content Viewer */}
      <div className="lg:col-span-2 bg-gray-100 rounded-xl flex items-center justify-center p-4 relative min-h-[500px]">
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
          {currentItem.type === 'image' ? 'Image' : 'Text'} - {currentIndex + 1} of {queueData.items.length}
        </div>

        {/* Auto-label suggestion badge */}
        {currentItem.auto_label_suggestion && (
          <div className="absolute top-3 right-3 bg-purple-100 border border-purple-200 px-3 py-1 rounded-full text-sm">
            <div className="flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span className="text-purple-800 font-medium">
                AI: {currentItem.auto_label_suggestion.label}
              </span>
              <span className="text-purple-600 text-xs">
                ({Math.round(currentItem.auto_label_suggestion.confidence * 100)}%)
              </span>
          </div>
          </div>
        )}

        {currentItem.type === 'image' ? (
          <img 
            src={currentItem.data} 
            alt="Labeling item" 
            className="max-w-full max-h-full rounded-lg object-contain"
          />
        ) : (
          <div className="max-w-prose">
            <p className="text-lg leading-relaxed text-gray-800">{currentItem.data}</p>
          </div>
        )}

        {/* Navigation controls */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-md">
          <button 
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-3 text-sm font-medium">
            {currentIndex + 1} / {queueData.items.length}
          </span>
          <button 
            onClick={() => setCurrentIndex(Math.min(queueData.items.length - 1, currentIndex + 1))}
            disabled={currentIndex === queueData.items.length - 1}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          </div>
        </div>

      {/* Labeling Panel */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h3 className="font-semibold text-lg mb-4">Assign Label</h3>
          
          {/* Auto-label suggestion */}
          {currentItem.auto_label_suggestion && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-800">AI Suggestion</span>
                <span className="text-xs text-purple-600">
                  {Math.round(currentItem.auto_label_suggestion.confidence * 100)}% confident
                </span>
              </div>
              <button
                onClick={() => setSelectedLabel(currentItem.auto_label_suggestion.label)}
                className={cn(
                  'w-full p-2 text-left rounded-lg border transition-colors',
                  selectedLabel === currentItem.auto_label_suggestion.label
                    ? 'border-purple-500 bg-purple-100'
                    : 'border-purple-200 hover:border-purple-300 hover:bg-purple-50'
                )}
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="font-medium">{currentItem.auto_label_suggestion.label}</span>
                </div>
              </button>
            </div>
          )}

          {/* Manual label options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Available Labels:</p>
            {['Positive', 'Negative', 'Neutral', 'Spam', 'Important'].map(label => (
              <button
                key={label}
                onClick={() => setSelectedLabel(label)}
                className={cn(
                  'w-full text-left p-3 border rounded-lg transition-colors',
                  selectedLabel === label
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Review notes */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Review Notes (Optional)
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              rows={3}
              placeholder="Add any notes about this labeling decision..."
            />
          </div>

          {/* Action buttons */}
          <div className="flex space-x-2 mt-4">
            <button
              onClick={handleSubmit}
              disabled={!selectedLabel}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Label
            </button>
            <button
              onClick={() => setCurrentIndex(Math.min(queueData.items.length - 1, currentIndex + 1))}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Skip
            </button>
          </div>

          {/* Bulk auto-label */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleAutoLabel}
              className="w-full flex items-center justify-center space-x-2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Brain className="w-4 h-4" />
              <span>Auto-label Remaining</span>
            </button>
                </div>
                </div>
              </div>
            </div>
  )
}

export default function LabelingPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<LabelingProject | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  // API hooks
  const { data: capabilities } = useAutoLabelingCapabilities()
  const { data: projects, refetch: refetchProjects } = useLabelingProjects()
  const { data: investigations } = useInvestigations()
  const { data: queueData } = useLabelingQueue(selectedProject?.id || null)
  const { data: analytics } = useLabelingProjectAnalytics(selectedProject?.id || null)
  const { data: jobStatus } = useAutoLabelingJobStatus(activeJobId)
  const { submitLabel } = useLabelingProject()
  const { requestAutoLabeling } = useAutoLabeling()

  // Convert investigations to datasets for project creation
  const datasets = investigations?.filter(inv => inv.status === 'completed') || []

  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0])
    }
  }, [projects, selectedProject])

  const handleLabelSubmit = async (itemId: string, label: string) => {
    if (!selectedProject) return
    
    try {
      await submitLabel(selectedProject.id, itemId, {
        label,
        review_notes: ''
      })
      // Refresh queue data
    } catch (error) {
      console.error('Failed to submit label:', error)
    }
  }

  const handleAutoLabelRequest = async (itemIds: string[]) => {
    if (!selectedProject) return
    
    try {
      const result = await requestAutoLabeling(selectedProject.id, itemIds)
      setActiveJobId(result.job_id)
    } catch (error) {
      console.error('Failed to request auto-labeling:', error)
    }
  }

  const getProjectTypeIcon = (type: string) => {
    if (type.includes('image') || type.includes('object')) return <LayoutGrid className="w-5 h-5" />
    if (type.includes('text')) return <List className="w-5 h-5" />
    return <Tags className="w-5 h-5" />
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI-Powered Content Labeling"
        description="Create and manage intelligent labeling projects with automated AI assistance."
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg shadow-sm hover:shadow-lg transition-all transform hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </button>
              </div>
      </PageHeader>

      {/* AI Service Status */}
      <AutoLabelingStatus capabilities={capabilities} />

      {/* Active Job Status */}
      {jobStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="font-medium text-blue-800">Auto-labeling in progress</span>
                </div>
            <span className="text-blue-600">{jobStatus.progress}%</span>
                </div>
          <div className="mt-2 text-sm text-blue-700">
            {jobStatus.items_processed} / {jobStatus.items_total} items processed
            {jobStatus.average_confidence && (
              <span className="ml-4">
                Average confidence: {Math.round(jobStatus.average_confidence * 100)}%
              </span>
            )}
                </div>
              </div>
      )}

      {/* Projects Overview */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Your Projects</h2>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48 focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>
            <button className="p-2 rounded-lg hover:bg-gray-100 border border-gray-300">
              <Filter className="w-4 h-4 text-gray-600" />
            </button>
          </div>
              </div>

        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div 
                key={project.id} 
                onClick={() => setSelectedProject(project)}
                className={cn(
                  'bg-gray-50/80 border rounded-xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer',
                  selectedProject?.id === project.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200/80 hover:border-blue-300'
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border shadow-sm">
                      {getProjectTypeIcon(project.type)}
                </div>
                <div>
                      <h3 className="font-semibold text-gray-900">{project.name}</h3>
                      {project.auto_label_enabled && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Brain className="w-3 h-3 text-purple-600" />
                          <span className="text-xs text-purple-600">AI Enabled</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button className="p-1 text-gray-500 hover:text-gray-800">
                    <MoreVertical className="w-4 h-4"/>
                  </button>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium text-gray-800">
                      {project.items_labeled.toLocaleString()} / {project.total_items.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <div className="flex items-center">
                      <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                      Quality: <span className="font-semibold ml-1">{project.quality_score}%</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                      Team: <span className="font-semibold ml-1">{project.team_size}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Tags className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No labeling projects yet</h3>
            <p className="text-gray-600 mb-4">Create your first project to start labeling data with AI assistance</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Project
            </button>
          </div>
        )}
        </div>

      {/* Labeling Interface */}
      {selectedProject && queueData && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Labeling Queue</h2>
              <p className="text-sm text-gray-500 mt-1">
                Project: {selectedProject.name} • {queueData.items.length} items in queue
              </p>
            </div>
            {analytics && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>{analytics.auto_labeled_items} auto-labeled</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BarChart3 className="w-4 h-4" />
                  <span>{Math.round(analytics.average_confidence * 100)}% avg confidence</span>
              </div>
              </div>
            )}
          </div>

          <LabelingInterface
            project={selectedProject}
            queueData={queueData}
            onLabelSubmit={handleLabelSubmit}
            onAutoLabelRequest={handleAutoLabelRequest}
          />
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        datasets={datasets}
        capabilities={capabilities}
      />
    </div>
  )
}
