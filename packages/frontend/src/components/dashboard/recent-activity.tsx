'use client'

import { Database, Brain, Workflow, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { cn, getStatusColor } from '@/lib/utils'

const activities = [
  {
    id: '1',
    type: 'data_source',
    title: 'New data source connected',
    description: 'PostgreSQL database "production_db" successfully connected',
    timestamp: '2024-01-15T10:30:00Z',
    status: 'success',
    icon: Database
  },
  {
    id: '2',
    type: 'workflow',
    title: 'Workflow execution completed',
    description: 'Daily Sales Data Pipeline processed 15,432 records',
    timestamp: '2024-01-15T10:15:00Z',
    status: 'success',
    icon: Workflow
  },
  {
    id: '3',
    type: 'intelligence',
    title: 'Anomaly detected',
    description: 'Unusual pattern found in customer_orders table',
    timestamp: '2024-01-15T09:45:00Z',
    status: 'warning',
    icon: AlertTriangle
  },
  {
    id: '4',
    type: 'workflow',
    title: 'Workflow execution failed',
    description: 'Inventory Sync Process failed due to connection timeout',
    timestamp: '2024-01-15T09:30:00Z',
    status: 'error',
    icon: XCircle
  },
  {
    id: '5',
    type: 'intelligence',
    title: 'Data profiling completed',
    description: 'Quality assessment finished for users table (Score: 92%)',
    timestamp: '2024-01-15T09:00:00Z',
    status: 'success',
    icon: Brain
  },
  {
    id: '6',
    type: 'data_source',
    title: 'Data sync completed',
    description: 'Synchronized 2,847 records from Salesforce CRM',
    timestamp: '2024-01-15T08:30:00Z',
    status: 'success',
    icon: CheckCircle
  }
]

const getActivityIcon = (activity: typeof activities[0]) => {
  const IconComponent = activity.icon
  const colorClass = activity.status === 'success' ? 'text-green-600' :
                    activity.status === 'warning' ? 'text-yellow-600' :
                    activity.status === 'error' ? 'text-red-600' :
                    'text-blue-600'
  
  return <IconComponent className={cn('w-5 h-5', colorClass)} />
}

const formatTimeAgo = (timestamp: string) => {
  const now = new Date()
  const time = new Date(timestamp)
  const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d ago`
}

export function RecentActivity() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>

      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {activities.map((activity, activityIdx) => (
            <li key={activity.id}>
              <div className="relative pb-8">
                {activityIdx !== activities.length - 1 ? (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    {getActivityIcon(activity)}
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activity.description}
                      </p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <time dateTime={activity.timestamp}>
                        {formatTimeAgo(activity.timestamp)}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Activity summary */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-green-600">4</div>
            <div className="text-xs text-gray-500">Successful</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-yellow-600">1</div>
            <div className="text-xs text-gray-500">Warnings</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-red-600">1</div>
            <div className="text-xs text-gray-500">Errors</div>
          </div>
        </div>
      </div>
    </div>
  )
} 