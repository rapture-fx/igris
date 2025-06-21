'use client'

import { useState } from 'react'
import { DataSourcesHeader } from '@/components/data-sources/data-sources-header'
import { UploadProgress } from '@/components/data-sources/upload-progress'
import { CleaningWorkflow } from '@/components/data-sources/cleaning-workflow'
import { apiService, UploadResponse, JobStatus } from '@/lib/api'
// import { toast } from 'sonner'

export default function DataSourcesPage() {
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showCleaning, setShowCleaning] = useState(false)

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(0)
    setUploadResponse(null)
    setJobStatus(null)
    setShowCleaning(false)

    try {
      // Upload file with AI analysis
      const response = await apiService.uploadFile(file, {
        runAiAnalysis: true,
        autoClean: false,
        onProgress: setUploadProgress
      })

      setUploadResponse(response)
      console.log(`File "${file.name}" uploaded successfully!`)

      // Start polling job status
      if (response.job_id) {
        await pollJobStatus(response.job_id)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      console.error('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    try {
      const finalStatus = await apiService.pollJobStatus(
        jobId,
        (status) => {
          setJobStatus(status)
          if (status.status === 'completed') {
            console.log('Data analysis completed!')
            setShowCleaning(true)
          }
        }
      )
      setJobStatus(finalStatus)
    } catch (error) {
      console.error('Job polling failed:', error)
      console.error('Failed to get job status')
    }
  }

  const handleStartCleaning = () => {
    setShowCleaning(true)
  }

  return (
    <div className="space-y-6">
      <DataSourcesHeader onFileUpload={handleFileUpload} />
      
      {/* Upload Progress */}
      {(isUploading || uploadResponse) && (
        <UploadProgress
          isUploading={isUploading}
          progress={uploadProgress}
          uploadResponse={uploadResponse}
          jobStatus={jobStatus}
          onStartCleaning={handleStartCleaning}
        />
      )}

      {/* Cleaning Workflow */}
      {showCleaning && jobStatus?.job_id && (
        <CleaningWorkflow 
          jobId={jobStatus.job_id}
          jobStatus={jobStatus}
        />
      )}
    </div>
  )
} 