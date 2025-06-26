'use client';

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface FileUploadProps {
  onUploadComplete?: (investigationId: string) => void
  onUploadStart?: () => void
  maxFileSize?: number // in MB
  allowedTypes?: string[]
}

interface UploadedFile {
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  investigationId?: string
  error?: string
}

export function FileUpload({ 
  onUploadComplete, 
  onUploadStart,
  maxFileSize = 100,
  allowedTypes = ['csv', 'json', 'xlsx', 'xls', 'parquet', 'txt']
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
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
      'application/octet-stream': ['.parquet'],
      'text/plain': ['.txt']
    },
    maxSize: maxFileSize * 1024 * 1024,
    multiple: true
  })

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const uploadFile = async (fileIndex: number, name?: string, description?: string) => {
    const fileObj = files[fileIndex]
    if (!fileObj) return

    setFiles(prev => prev.map((f, i) => 
      i === fileIndex ? { ...f, status: 'uploading', progress: 0 } : f
    ))

    try {
      const formData = new FormData()
      formData.append('file', fileObj.file)
      if (name) formData.append('name', name)
      if (description) formData.append('description', description)

      const token = localStorage.getItem('token')
      const response = await fetch('/api/proxy/data/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const result = await response.json()

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
      console.error('Upload error:', error)
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

  const uploadAllFiles = async () => {
    if (isUploading) return
    
    setIsUploading(true)
    onUploadStart?.()

    const pendingFiles = files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.status === 'pending')

    for (const { index } of pendingFiles) {
      await uploadFile(index)
    }

    setIsUploading(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'csv':
        return '📊'
      case 'json':
        return '📋'
      case 'xlsx':
      case 'xls':
        return '📈'
      case 'parquet':
        return '🗃️'
      case 'txt':
        return '📄'
      default:
        return '📁'
    }
  }

  const hasSuccessfulUploads = files.some(f => f.status === 'success')
  const hasPendingFiles = files.some(f => f.status === 'pending')
  const hasErrors = files.some(f => f.status === 'error')

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        
        {isDragActive ? (
          <div>
            <p className="text-lg font-medium text-blue-600">Drop files here...</p>
            <p className="text-sm text-blue-500">Ready to process your data!</p>
          </div>
        ) : (
          <div>
            <p className="text-lg font-medium text-gray-900">
              Drag & drop your data files here
            </p>
            <p className="text-sm text-gray-500 mb-4">
              or click to browse files
            </p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Choose Files
            </button>
          </div>
        )}
      </div>

      {/* File Format Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Supported Formats</h4>
            <p className="text-sm text-blue-700">
              CSV, JSON, Excel (.xlsx, .xls), Parquet, Text files up to {maxFileSize}MB
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Files are processed with AI-powered data intelligence for instant insights
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Files ({files.length})
            </h3>
            {hasPendingFiles && (
              <button
                onClick={uploadAllFiles}
                disabled={isUploading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Process All Files
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid gap-3">
            {files.map((fileObj, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 bg-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="text-2xl">{getFileIcon(fileObj.file.name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileObj.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(fileObj.file.size)}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center space-x-2">
                    {fileObj.status === 'pending' && (
                      <button
                        onClick={() => uploadFile(index)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Upload
                      </button>
                    )}
                    
                    {fileObj.status === 'uploading' && (
                      <div className="flex items-center text-blue-600">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-sm">Processing...</span>
                      </div>
                    )}
                    
                    {fileObj.status === 'success' && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        <span className="text-sm">Complete</span>
                      </div>
                    )}
                    
                    {fileObj.status === 'error' && (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        <span className="text-sm">Failed</span>
                      </div>
                    )}

                    {fileObj.status !== 'uploading' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {fileObj.status === 'uploading' && (
                  <div className="mt-3">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${fileObj.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {fileObj.status === 'error' && fileObj.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {fileObj.error}
                  </div>
                )}

                {/* Success Actions */}
                {fileObj.status === 'success' && fileObj.investigationId && (
                  <div className="mt-3 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center text-green-700">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      <span className="text-sm font-medium">Processing complete!</span>
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard/data-sources?investigation=${fileObj.investigationId}`)}
                      className="text-green-700 hover:text-green-800 text-sm font-medium"
                    >
                      View Results →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Summary */}
      {hasSuccessfulUploads && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-green-900">
                Files processed successfully!
              </h4>
              <p className="text-sm text-green-700">
                Your data has been analyzed and insights are ready. Check the results in your dashboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Summary */}
      {hasErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900">
                Some files failed to process
              </h4>
              <p className="text-sm text-red-700">
                Please check the error messages above and try uploading again.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 