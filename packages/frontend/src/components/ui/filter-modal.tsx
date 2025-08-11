'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { AuditLogFilters } from '@/hooks/useAPIData'

export const FilterModal = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange
}: {
  isOpen: boolean
  onClose: () => void
  filters: AuditLogFilters
  onFiltersChange: (filters: AuditLogFilters) => void
}) => {
  const [localFilters, setLocalFilters] = useState(filters)

  const actionTypes = [
    { value: '', label: 'All Actions' },
    { value: 'user.login', label: 'User Login' },
    { value: 'user.logout', label: 'User Logout' },
    { value: 'api_key', label: 'API Key Actions' },
    { value: 'dataset', label: 'Dataset Actions' },
    { value: 'transformation', label: 'Transformation Actions' },
    { value: 'labeling', label: 'Labeling Actions' },
    { value: 'security', label: 'Security Actions' },
    { value: 'billing', label: 'Billing Actions' }
  ]

  const handleApply = () => {
    onFiltersChange(localFilters)
    onClose()
  }

  const handleReset = () => {
    const resetFilters: AuditLogFilters = {
      search: '',
      action_type: '',
      user_id: '',
      start_date: '',
      end_date: '',
      limit: 50,
      offset: 0
    }
    setLocalFilters(resetFilters)
    onFiltersChange(resetFilters)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Filter Audit Logs</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
            <select
              value={localFilters.action_type}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, action_type: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              {actionTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={localFilters.start_date}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, start_date: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={localFilters.end_date}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, end_date: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Results per page</label>
            <select
              value={localFilters.limit}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={25}>25 logs</option>
              <option value={50}>50 logs</option>
              <option value={100}>100 logs</option>
              <option value={200}>200 logs</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between space-x-3 pt-6">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Reset
          </button>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 