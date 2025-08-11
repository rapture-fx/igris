'use client'

import { useState } from 'react'
import { PageHeader, PageHeaderActions } from '@/components/ui/page-header'
import { PipelinesToolbar } from '@/components/pipelines/PipelinesToolbar'
import { PipelinesList } from '@/components/pipelines/PipelinesList'
import { 
  Plus, 
  Workflow, 
  Play, 
  Pause, 
  Settings, 
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'

export default function PipelinesPage() {
  const [isCreating, setIsCreating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Pipelines"
        description="Build, manage, and monitor your data processing workflows with automated pipelines."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Pipelines' }
        ]}
        stats={[
          {
            label: 'Active Pipelines',
            value: 12,
            icon: Play,
            color: 'green'
          },
          {
            label: 'Scheduled',
            value: 8,
            icon: Clock,
            color: 'blue'
          },
          {
            label: 'Success Rate',
            value: '94%',
            icon: CheckCircle,
            color: 'green'
          },
          {
            label: 'Issues',
            value: 2,
            icon: AlertTriangle,
            color: 'red'
          }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PageHeaderActions.Refresh 
              onClick={handleRefresh}
              isLoading={isRefreshing}
              tooltip="Refresh pipelines"
            />
            <PageHeaderActions.Secondary
              icon={Settings}
              onClick={() => {}}
            >
              Settings
            </PageHeaderActions.Secondary>
            <PageHeaderActions.Primary
              icon={Plus}
              onClick={() => setIsCreating(true)}
            >
              Create Pipeline
            </PageHeaderActions.Primary>
          </div>
        }
      />

      <div className="space-y-6">
        <PipelinesToolbar />
        <PipelinesList />
      </div>

      {/* Create Pipeline Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Workflow className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Create New Pipeline</h2>
                    <p className="text-gray-600">Build an automated data processing workflow</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Workflow className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Pipeline Builder</h3>
                  <p className="text-gray-600 mb-6">Coming soon - Visual pipeline builder interface</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      Create Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 