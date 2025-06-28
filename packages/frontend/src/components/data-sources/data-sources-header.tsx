'use client'

import { useState } from 'react'
import { Upload, FileText, TrendingUp, RefreshCw, HelpCircle, Search, Database } from 'lucide-react'

interface DataSourcesHeaderProps {
  onFileUpload?: (file: File) => Promise<void>
  onUploadClick: () => void
}

export function DataSourcesHeader({ onFileUpload, onUploadClick }: DataSourcesHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Sources</h1>
          <p className="mt-2 text-gray-600">
            Manage your datasets and data connections
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onUploadClick}
            className="inline-flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Dataset</span>
          </button>
          <button className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <HelpCircle className="w-4 h-4" />
            <span>Help</span>
          </button>
          <button className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <Database className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Sources</p>
              <p className="text-2xl font-semibold text-gray-900">5</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-semibold text-gray-900">125K</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-50">
              <Upload className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Recent Uploads</p>
              <p className="text-2xl font-semibold text-gray-900">3</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search investigations, datasets, or files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mercury-accent focus:border-transparent"
        />
      </div>
    </div>
  )
} 