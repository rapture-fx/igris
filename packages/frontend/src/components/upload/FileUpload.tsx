"use client"

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { useFileUpload } from '@/hooks/useAPIData'
import { config } from '@/lib/config'

interface FileUploadProps {
  onUploadComplete?: (investigationId: string) => void
  onUploadStart?: () => void
  maxFileSize?: number
  allowedTypes?: string[]
}

interface FileWithStatus {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  investigationId?: string
  error?: string
}

export function FileUpload({ 
  onUploadComplete, 
  onUploadStart,
  maxFileSize = config.upload.maxFileSize,
  allowedTypes = config.upload.allowedExtensions
}: FileUploadProps) {
  const router = useRouter()
  const [files, setFiles] = useState<FileWithStatus[]>([])
  const [showNameDialog, setShowNameDialog] = useState<number | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const { uploadFile } = useFileUpload()

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(rejection => {
        const error = rejection.errors[0]
        return `${rejection.file.name}: ${error.message}`
      })
      alert(`Some files were rejected:\n${errors.join('\n')}`)
    }

    // Add accepted files
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
      progress: 0
    }))

    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.apache.parquet': ['.parquet'],
      'text/plain': ['.txt']
    },
    maxSize: maxFileSize,
    multiple: true
  })

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(droppedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
      progress: 0
    })))
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(selectedFiles.map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: 'pending' as const,
        progress: 0
      })))
    }
  }, [])

  const uploadFileWithDetails = async (fileIndex: number, name?: string, description?: string) => {
    const fileObj = files[fileIndex]
    if (!fileObj) return

    setFiles(prev => prev.map((f, i) => 
      i === fileIndex ? { ...f, status: 'uploading', progress: 0 } : f
    ))

    onUploadStart?.()

    try {
      const result = await uploadFile(
        fileObj.file, 
        name, 
        description,
        (progress) => {
          setFiles(prev => prev.map((f, i) => 
            i === fileIndex ? { ...f, progress } : f
          ))
        }
      )

      setFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { 
          ...f, 
          status: 'success', 
          progress: 100,
          investigationId: result.investigation_id 
        } : f
      ))

      onUploadComplete?.(result.investigation_id)

      // Auto-redirect to investigation after 2 seconds
      setTimeout(() => {
        router.push(`/dashboard/data-sources?investigation=${result.investigation_id}`)
      }, 2000)

    } catch (error) {
      setFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { 
          ...f, 
          status: 'error', 
          progress: 0,
          error: error instanceof Error ? error.message : 'Upload failed'
        } : f
      ))
    }
  }

  const handleUpload = (fileIndex: number) => {
    setShowNameDialog(fileIndex)
  }

  const handleUploadWithName = () => {
    if (showNameDialog !== null) {
      uploadFileWithDetails(showNameDialog, uploadName, uploadDescription)
      setShowNameDialog(null)
      setUploadName('')
      setUploadDescription('')
    }
  }

  const removeFile = (fileIndex: number) => {
    setFiles(prev => prev.filter((_, i) => i !== fileIndex))
  }

  const getFileIcon = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'csv': return '📊'
      case 'json': return '📋'
      case 'xlsx':
      case 'xls': return '📈'
      case 'parquet': return '🗂️'
      default: return '📄'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleUploadProgress = async () => {
    if (files.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 10
      })
    }, 200)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setUploadProgress(100)
      
      // Wait a bit to show completion
      setTimeout(() => {
        setUploading(false)
                 setFiles([])
         setUploadProgress(0)
         onUploadComplete?.('mock-investigation-id')
       }, 500)
      
    } catch (error) {
      console.error('Upload failed:', error)
      setUploading(false)
      setUploadProgress(0)
    } finally {
      clearInterval(interval)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Upload your dataset
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Drag and drop your files here, or click to browse
        </p>
        
        <input
          type="file"
          multiple
          accept=".csv,.json,.xlsx,.xls"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
          Select Files
        </button>
        
        <p className="text-xs text-gray-400 mt-2">
          Supported formats: CSV, JSON, Excel (max 100MB)
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Selected Files ({files.length})
          </h4>
          <div className="space-y-2">
          {files.map((fileObj, index) => (
              <div
                key={fileObj.id}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
              >
                <div className="flex items-center">
                  <span className="text-2xl">{getFileIcon(fileObj.file)}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {fileObj.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(fileObj.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                      <button
                        onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-500"
                      >
                  <X className="h-4 w-4" />
                      </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Uploading...</span>
            <span className="text-sm text-gray-500">{uploadProgress}%</span>
          </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

      {/* Upload Button */}
      {files.length > 0 && !uploading && (
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={() => setFiles([])}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear All
          </button>
          <button
            onClick={handleUploadProgress}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </button>
                </div>
              )}

      {uploadProgress === 100 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-sm text-green-700">Upload completed successfully!</span>
        </div>
      )}

      {/* Name Dialog */}
      {showNameDialog !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Upload Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Investigation Name (Optional)
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a name for this investigation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what this data contains"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNameDialog(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadWithName}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUpload 