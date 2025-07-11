'use client'

import { useState } from 'react'
import {
  Tags,
  Plus,
  Search,
  List,
  LayoutGrid,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import {
  useAutoLabelingCapabilities,
  useLabelingProjects,
  useLabelingQueue,
  useLabelingProject,
  useInvestigations,
  useLabelingProjectMutations,
  useAutoLabeling
} from '@/hooks/useAPIData'
import { LabelingProject, QueueItem } from '@/components/labeling/types'
import { AutoLabelingStatus } from '@/components/labeling/auto-labeling-status'
import { CreateProjectModal } from '@/components/labeling/create-project-modal'
import { LabelingInterface } from '@/components/labeling/labeling-interface'


export default function LabelingPage() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const { data: capabilities } = useAutoLabelingCapabilities()
  const { data: projects, loading: isLoadingProjects } = useLabelingProjects()
  const { data: investigations } = useInvestigations()
  const { data: project, loading: isLoadingProject } = useLabelingProject(selectedProjectId)
  const { data: queue, loading: isLoadingQueue } = useLabelingQueue(selectedProjectId)
  const { createProject, submitLabel } = useLabelingProjectMutations()
  const { requestAutoLabeling } = useAutoLabeling()

  // LOG 1: Check what the API actually returns
  console.log('🔍 API Response Debug:')
  console.log('projects data:', projects)
  console.log('projects type:', typeof projects)
  console.log('projects is array:', Array.isArray(projects))
  if (projects && projects.length > 0) {
    console.log('first project structure:', projects[0])
    console.log('first project keys:', Object.keys(projects[0]))
    console.log('has labels property:', 'labels' in projects[0])
  }


  const handleLabelSubmit = async (itemId: string, label: string) => {
    if (!selectedProjectId) return
    try {
      await submitLabel(selectedProjectId, itemId, { label })
      // Optionally refetch queue
    } catch (error) {
      console.error('Failed to submit label:', error)
    }
  }

  const handleAutoLabelRequest = async (itemIds: string[]) => {
    if (!selectedProjectId) return
    try {
      await requestAutoLabeling(selectedProjectId, itemIds)
      // Optionally refetch queue
    } catch (error) {
      console.error('Failed to start auto-labeling job:', error)
    }
  }

  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case 'image_classification': return <LayoutGrid className="w-5 h-5 text-blue-600" />
      case 'text_categorization': return <List className="w-5 h-5 text-green-600" />
      case 'object_detection': return <Tags className="w-5 h-5 text-purple-600" />
      default: return <Tags className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div className="flex space-x-8 p-4 sm:p-6 md:p-8 h-full bg-gray-50/50">
      {/* Left Sidebar */}
      <div className="w-1/3 max-w-md flex-shrink-0 space-y-6">
        <PageHeader
            title="Labeling Projects"
            description="Manage, monitor, and create new labeling projects."
            actions={
              <button 
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
              >
                  <Plus className="w-5 h-5 mr-2" />
                  New Project
              </button>
            }
        />
        
        <AutoLabelingStatus capabilities={capabilities} />

        <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search projects..."
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {isLoadingProjects ? (
            <div className="p-4 text-center text-gray-500">Loading projects...</div>
          ) : (
            projects?.map((p: any) => {
              // LOG 2: Check the type casting issue
              console.log('🔍 Type Casting Debug:')
              console.log('Raw project object:', p)
              console.log('Attempting to cast to LabelingProject...')
              
              // Try to identify missing properties
              const requiredProps = ['id', 'name', 'type', 'items_labeled', 'total_items', 'progress', 'quality_score', 'team_size', 'auto_label_enabled', 'created_at', 'updated_at', 'labels']
              const missingProps = requiredProps.filter(prop => !(prop in p))
              console.log('Missing properties:', missingProps)
              
              return (
                <button 
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={cn(
                    "w-full text-left p-4 hover:bg-gray-50",
                    selectedProjectId === p.id && "bg-blue-50"
                  )}
                >
                  <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                          {getProjectTypeIcon(p.type)}
                          <div>
                              <p className="font-semibold text-gray-800">{p.name}</p>
                              <p className="text-sm text-gray-500">{p.total_items} items</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="font-semibold text-gray-800">{p.progress}%</p>
                          <p className="text-sm text-gray-500">complete</p>
                      </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${p.progress}%` }}></div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {isLoadingProject || isLoadingQueue ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-2xl">
                <div className="flex items-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-gray-600">Loading project...</span>
                </div>
            </div>
        ) : (
            <LabelingInterface 
                project={project}
                queueData={queue}
                onLabelSubmit={handleLabelSubmit}
                onAutoLabelRequest={handleAutoLabelRequest}
            />
        )}
      </div>

      <CreateProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        datasets={investigations || []}
        capabilities={capabilities}
      />
    </div>
  )
}
