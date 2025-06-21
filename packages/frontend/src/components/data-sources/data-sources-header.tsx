'use client'

import { useState } from 'react'
import { Upload, Plus, FileText, Database } from 'lucide-react'

interface DataSourcesHeaderProps {
  onFileUpload?: (file: File) => void
}

export function DataSourcesHeader({ onFileUpload }: DataSourcesHeaderProps) {
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (onFileUpload) {
        onFileUpload(file)
      }
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (onFileUpload) {
        onFileUpload(file)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Sources</h1>
          <p className="text-gray-600">Upload files or connect to external data sources</p>
        </div>
        <div className="flex space-x-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <Database className="w-4 h-4 mr-2" />
            Connect Database
          </button>
        </div>
      </div>

      {/* File Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          Upload your data files
        </h3>
        <p className="mt-2 text-gray-600">
          Drag and drop your CSV, JSON, or Excel files here, or click to browse
        </p>
        
        <div className="mt-6">
          <label className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            <FileText className="w-4 h-4 mr-2" />
            Choose Files
            <input
              type="file"
              className="hidden"
              accept=".csv,.json,.xlsx,.xls"
              onChange={handleFileInput}
            />
          </label>
        </div>
        
        <p className="mt-4 text-sm text-gray-500">
          Supports CSV, JSON, Excel files up to 100MB
        </p>
      </div>
    </div>
  )
} 