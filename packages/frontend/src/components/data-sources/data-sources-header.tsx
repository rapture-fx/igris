'use client'

import { useState } from 'react'
import { Upload, FileText, TrendingUp, RefreshCw, HelpCircle, Search } from 'lucide-react'

export function DataSourcesHeader() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Sources</h1>
          <p className="text-gray-600 mt-1">
            Upload, process, and analyze your datasets with AI-powered intelligence
          </p>
        </div>
        <div className="flex items-center space-x-3">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">Ready to Upload</p>
            <p className="text-xs text-blue-700">Drag & drop files or browse</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
          <div className="p-2 bg-green-100 rounded-lg">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-900">AI Processing</p>
            <p className="text-xs text-green-700">Automatic quality analysis</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
          <div className="p-2 bg-purple-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-purple-900">Instant Insights</p>
            <p className="text-xs text-purple-700">Quality scores & recommendations</p>
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
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  )
} 