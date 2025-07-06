/**
 * Custom API Data Hooks
 * =====================
 * 
 * Eliminates redundant state management patterns across 12+ components
 * Provides consistent loading, error, and data states with automatic retries
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiService, handleAPIError, APIError } from '@/lib/api-service'
import { toast } from 'sonner'

// ==================== TYPES ====================

export interface UseAPIDataOptions {
  enabled?: boolean
  refetchInterval?: number
  retryOnFailure?: boolean
  retryAttempts?: number
  retryDelay?: number
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  transform?: (data: any) => any
}

export interface UseAPIDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  lastFetched: Date | null
}

export interface UsePaginatedDataOptions extends UseAPIDataOptions {
  pageSize?: number
  initialPage?: number
}

export interface UsePaginatedDataResult<T> extends UseAPIDataResult<T[]> {
  page: number
  totalPages: number
  totalItems: number
  hasNextPage: boolean
  hasPrevPage: boolean
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
}

export interface AuditLogFilters {
  search: string
  action_type: string
  user_id: string
  start_date: string
  end_date: string
  limit: number
  offset: number
}

// ==================== CORE HOOK ====================

export function useAPIData<T>(
  fetchFunction: () => Promise<T>,
  options: UseAPIDataOptions = {}
): UseAPIDataResult<T> {
  const {
    enabled = true,
    refetchInterval,
    retryOnFailure = true,
    retryAttempts = 3,
    retryDelay = 1000,
    onSuccess,
    onError,
    transform
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async (attemptNumber = 0): Promise<void> => {
    if (!enabled || !mountedRef.current) return

    try {
      setLoading(true)
      setError(null)

      const result = await fetchFunction()
      
      if (!mountedRef.current) return

      const transformedData = transform ? transform(result) : result
      setData(transformedData)
      setLastFetched(new Date())
      onSuccess?.(transformedData)

    } catch (err) {
      if (!mountedRef.current) return

      const errorMessage = err instanceof APIError ? err.message : 'An error occurred'
      setError(errorMessage)
      
      handleAPIError(err, 'useAPIData')
      onError?.(err as Error)

      // Retry logic
      if (retryOnFailure && attemptNumber < retryAttempts) {
        const delay = retryDelay * Math.pow(2, attemptNumber) // Exponential backoff
        retryTimeoutRef.current = setTimeout(() => {
          fetchData(attemptNumber + 1)
        }, delay)
        return
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [enabled, fetchFunction, retryOnFailure, retryAttempts, retryDelay, onSuccess, onError, transform])

  const refetch = useCallback(async () => {
    await fetchData(0)
  }, [fetchData])

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData()
    }
  }, [enabled, fetchData])

  // Set up refetch interval
  useEffect(() => {
    if (refetchInterval && enabled) {
      intervalRef.current = setInterval(() => {
        fetchData()
      }, refetchInterval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [refetchInterval, enabled, fetchData])

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    data,
    loading,
    error,
    refetch,
    lastFetched
  }
}

// ==================== DASHBOARD HOOKS ====================

export function useDashboardStats(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getDashboardStats(),
    {
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

export function useRecentActivity(limit: number = 20, options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getRecentActivity(limit),
    {
      refetchInterval: 15000, // 15 seconds
      ...options
    }
  )
}

export function useActiveJobs(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getActiveJobs(),
    {
      refetchInterval: 5000, // 5 seconds
      ...options
    }
  )
}

export function useDataQualityMetrics(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getDataQualityMetrics(),
    {
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

// ==================== INVESTIGATION HOOKS ====================

export function useInvestigations(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getInvestigations(),
    {
      refetchInterval: 10000, // 10 seconds
      ...options
    }
  )
}

export function useInvestigation(id: string, options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getInvestigation(id),
    {
      enabled: !!id,
      ...options
    }
  )
}

export function useInvestigationInsights(id: string, options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getInvestigationInsights(id),
    {
      enabled: !!id,
      ...options
    }
  )
}

// ==================== SYSTEM HOOKS ====================

export function useSystemStatus(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getSystemStatus(),
    {
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

export function useHealthCheck(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getHealthCheck(),
    {
      refetchInterval: 60000, // 1 minute
      ...options
    }
  )
}

// ==================== PAGINATED DATA HOOK ====================

export function usePaginatedData<T>(
  fetchFunction: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>,
  options: UsePaginatedDataOptions = {}
): UsePaginatedDataResult<T> {
  const {
    pageSize = 20,
    initialPage = 1,
    ...apiOptions
  } = options

  const [page, setPage] = useState(initialPage)
  const [totalItems, setTotalItems] = useState(0)

  const { data, loading, error, refetch, lastFetched } = useAPIData<T[]>(
    async () => {
      const result = await fetchFunction(page, pageSize);
      setTotalItems(result.total);
      return result.data;
    },
    apiOptions
  )

  const totalPages = Math.ceil(totalItems / pageSize)
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }, [totalPages])

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage(prev => prev + 1)
    }
  }, [hasNextPage])

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setPage(prev => prev - 1)
    }
  }, [hasPrevPage])

  return {
    data,
    loading,
    error,
    refetch,
    lastFetched,
    page,
    totalPages,
    totalItems,
    hasNextPage,
    hasPrevPage,
    goToPage,
    nextPage,
    prevPage
  }
}

// ==================== COMBINED DASHBOARD HOOK ====================

export function useDashboardData() {
  const stats = useDashboardStats()
  const dataQuality = useDataQualityMetrics()
  const recentActivity = useRecentActivity(5)
  const activeJobs = useActiveJobs()

  const isLoading = stats.loading || dataQuality.loading || recentActivity.loading || activeJobs.loading
  const hasError = !!(stats.error || dataQuality.error || recentActivity.error || activeJobs.error)

  const refetchAll = useCallback(async () => {
    await Promise.all([
      stats.refetch(),
      dataQuality.refetch(),
      recentActivity.refetch(),
      activeJobs.refetch()
    ])
  }, [stats.refetch, dataQuality.refetch, recentActivity.refetch, activeJobs.refetch])

  return {
    stats: stats.data,
    dataQuality: dataQuality.data,
    recentActivity: recentActivity.data || [],
    activeJobs: activeJobs.data || [],
    loading: isLoading,
    error: hasError,
    refetchAll,
    lastFetched: {
      stats: stats.lastFetched,
      dataQuality: dataQuality.lastFetched,
      recentActivity: recentActivity.lastFetched,
      activeJobs: activeJobs.lastFetched
    }
  }
}

// ==================== UPLOAD HOOK ====================

export function useFileUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(async (
    file: File,
    name?: string,
    description?: string,
    onProgress?: (progress: number) => void
  ) => {
    try {
      setUploading(true)
      setProgress(0)
      setError(null)

      // Simulate progress updates (in real implementation, use XMLHttpRequest for progress tracking)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + 10, 90)
          onProgress?.(newProgress)
          return newProgress
        })
      }, 200)

      const result = await apiService.uploadFile(file, name, description)

      clearInterval(progressInterval)
      setProgress(100)
      onProgress?.(100)

      return result

    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Upload failed'
      setError(errorMessage)
      handleAPIError(err, 'useFileUpload')
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setUploading(false)
    setProgress(0)
    setError(null)
  }, [])

  return {
    uploadFile,
    uploading,
    progress,
    error,
    reset
  }
}

// ==================== POLLING HOOK ====================

export function usePolling<T>(
  fetchFunction: () => Promise<T>,
  interval: number,
  condition?: (data: T | null) => boolean
) {
  const [data, setData] = useState<T | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const startPolling = useCallback(() => {
    setIsPolling(true)
  }, [])

  const stopPolling = useCallback(() => {
    setIsPolling(false)
  }, [])

  const { refetch } = useAPIData(
    fetchFunction,
    {
      enabled: isPolling,
      refetchInterval: interval,
      onSuccess: (result) => {
        setData(result)
        // Stop polling if condition is met
        if (condition && condition(result)) {
          stopPolling()
        }
      }
    }
  )

  return {
    data,
    isPolling,
    startPolling,
    stopPolling,
    refetch
  }
}

// ==================== NEW DATA PROCESSING HOOKS ====================

export function useDataProcessing() {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(async (
    file: File, 
    options: { target_framework?: string, processing_mode?: string } = {}
  ) => {
    setProcessing(true)
    setError(null)
    
    try {
      const result = await apiService.processDataFile(file, options)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed'
      setError(errorMessage)
      throw err
    } finally {
      setProcessing(false)
    }
  }, [])

  return {
    processFile,
    processing,
    error
  }
}

export function useSupportedFrameworks(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getSupportedFrameworks(),
    {
      refetchInterval: 300000, // 5 minutes - frameworks don't change often
      ...options
    }
  )
}

export function useMLAnalysis() {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = useCallback(async (
    data: any[],
    analysisType: 'anomaly_detection' | 'sentiment_analysis' | 'classification',
    config?: Record<string, any>
  ) => {
    setAnalyzing(true)
    setError(null)
    
    try {
      const result = await apiService.runMLAnalysis({
        data,
        analysis_type: analysisType,
        config
      })
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      setError(errorMessage)
      throw err
    } finally {
      setAnalyzing(false)
    }
  }, [])

  return {
    runAnalysis,
    analyzing,
    error
  }
}

export function useMLServiceStatus(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getMLServiceStatus(),
    {
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

export function useAvailableMLModels(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getAvailableMLModels(),
    {
      refetchInterval: 60000, // 1 minute
      ...options
    }
  )
}

export function useDataPrepHealth(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getDataPrepHealth(),
    {
      refetchInterval: 15000, // 15 seconds
      ...options
    }
  )
}

// ==================== TRANSFORMATION HOOKS ====================

export function useAvailableTransformations(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getAvailableTransformations(),
    {
      refetchInterval: 300000, // 5 minutes - transformations don't change often
      ...options
    }
  )
}

export function useTransformationPipelines(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getTransformationPipelines(),
    {
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

export function useTransformationPipeline() {
  const [creating, setCreating] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createPipeline = useCallback(async (pipelineData: {
    name: string
    description?: string
    dataset_id: string
    steps: Array<{
      type: string
      column: string
      params: Record<string, any>
    }>
    target_framework?: string
  }) => {
    setCreating(true)
    setError(null)
    
    try {
      const result = await apiService.createTransformationPipeline(pipelineData)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Pipeline creation failed'
      setError(errorMessage)
      throw err
    } finally {
      setCreating(false)
    }
  }, [])

  const executePipeline = useCallback(async (pipelineId: string) => {
    setExecuting(true)
    setError(null)
    
    try {
      const result = await apiService.executeTransformationPipeline(pipelineId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Pipeline execution failed'
      setError(errorMessage)
      throw err
    } finally {
      setExecuting(false)
    }
  }, [])

  return {
    createPipeline,
    executePipeline,
    creating,
    executing,
    error
  }
}

export function useTransformationPipelineStatus(pipelineId: string | null, options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => pipelineId ? apiService.getTransformationPipelineStatus(pipelineId) : Promise.resolve(null),
    {
      enabled: !!pipelineId,
      refetchInterval: 2000, // 2 seconds for real-time status
      ...options
    }
  )
}

export function useFrameworkTransformationSuggestions(
  datasetId: string | null, 
  framework: string,
  options: UseAPIDataOptions = {}
) {
  return useAPIData(
    () => datasetId ? apiService.getFrameworkTransformationSuggestions(datasetId, framework) : Promise.resolve(null),
    {
      enabled: !!datasetId,
      refetchInterval: 60000, // 1 minute
      ...options
    }
  )
}

export function useTransformationPreview() {
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewTransformation = useCallback(async (transformationData: {
    dataset_id: string
    step: {
      type: string
      column: string
      params: Record<string, any>
    }
  }) => {
    setPreviewing(true)
    setError(null)
    
    try {
      const result = await apiService.previewTransformation(transformationData)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Preview failed'
      setError(errorMessage)
      throw err
    } finally {
      setPreviewing(false)
    }
  }, [])

  return {
    previewTransformation,
    previewing,
    error
  }
}

// ==================== AUTO-LABELING HOOKS ====================

export function useAutoLabelingCapabilities(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getAutoLabelingCapabilities(),
    {
      refetchInterval: 300000, // 5 minutes - capabilities don't change often
      ...options
    }
  )
}

export function useLabelingProjects(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getLabelingProjects(),
    {
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

export function useLabelingQueue(projectId: string | null, limit: number = 10, options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => projectId ? apiService.getLabelingQueue(projectId, limit) : Promise.resolve(null),
    {
      enabled: !!projectId,
      refetchInterval: 5000, // 5 seconds for real-time queue updates
      ...options
    }
  )
}

export function useLabelingProject() {
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createProject = useCallback(async (projectData: {
    name: string
    description?: string
    type: 'image_classification' | 'text_categorization' | 'object_detection'
    dataset_id: string
    labels: string[]
    auto_label_enabled: boolean
    confidence_threshold?: number
  }) => {
    setCreating(true)
    setError(null)
    
    try {
      const result = await apiService.createLabelingProject(projectData)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Project creation failed'
      setError(errorMessage)
      throw err
    } finally {
      setCreating(false)
    }
  }, [])

  const submitLabel = useCallback(async (
    projectId: string, 
    itemId: string, 
    labelData: {
      label: string
      confidence?: number
      review_notes?: string
      accept_auto_label?: boolean
    }
  ) => {
    setSubmitting(true)
    setError(null)
    
    try {
      const result = await apiService.submitLabel(projectId, itemId, labelData)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Label submission failed'
      setError(errorMessage)
      throw err
    } finally {
      setSubmitting(false)
    }
  }, [])

  return {
    createProject,
    submitLabel,
    creating,
    submitting,
    error
  }
}

export function useAutoLabeling() {
  const [requesting, setRequesting] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestAutoLabeling = useCallback(async (projectId: string, itemIds: string[]) => {
    setRequesting(true)
    setError(null)
    
    try {
      const result = await apiService.requestAutoLabeling(projectId, itemIds)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Auto-labeling request failed'
      setError(errorMessage)
      throw err
    } finally {
      setRequesting(false)
    }
  }, [])

  const bulkAutoLabel = useCallback(async (
    datasetId: string, 
    labelingConfig: {
      model_type: 'image_classification' | 'text_classification' | 'object_detection'
      confidence_threshold: number
      labels: string[]
      review_low_confidence: boolean
    }
  ) => {
    setBulkProcessing(true)
    setError(null)
    
    try {
      const result = await apiService.bulkAutoLabel(datasetId, labelingConfig)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bulk auto-labeling failed'
      setError(errorMessage)
      throw err
    } finally {
      setBulkProcessing(false)
    }
  }, [])

  return {
    requestAutoLabeling,
    bulkAutoLabel,
    requesting,
    bulkProcessing,
    error
  }
}

export function useAutoLabelingJobStatus(jobId: string | null, options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => jobId ? apiService.getAutoLabelingJobStatus(jobId) : Promise.resolve(null),
    {
      enabled: !!jobId,
      refetchInterval: 2000, // 2 seconds for real-time status
      ...options
    }
  )
}

export function useLabelingProjectAnalytics(projectId: string | null, options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => projectId ? apiService.getLabelingProjectAnalytics(projectId) : Promise.resolve(null),
    {
      enabled: !!projectId,
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

// ==================== SECURITY HOOKS ====================

export function useSecuritySettings(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getSecuritySettings(),
    {
      refetchInterval: 60000, // 1 minute
      ...options
    }
  )
}

export function useActiveSessions(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getActiveSessions(),
    {
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

export function useAPIKeys(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getAPIKeys(),
    {
      refetchInterval: 60000, // 1 minute
      ...options
    }
  )
}

export function useAuditLogs(filters?: {
  start_date?: string
  end_date?: string
  action_type?: string
  user_id?: string
  limit?: number
  offset?: number
}, options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getAuditLogs(filters),
    {
      refetchInterval: 30000, // 30 seconds
      ...options
    }
  )
}

export function useSecurityMetrics(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getSecurityMetrics(),
    {
      refetchInterval: 60000, // 1 minute
      ...options
    }
  )
}

export function useSecurityRecommendations(options: UseAPIDataOptions = {}) {
  return useAPIData(
    () => apiService.getSecurityRecommendations(),
    {
      refetchInterval: 300000, // 5 minutes
      ...options
    }
  )
}

export function useSecurityManagement() {
  const [updating, setUpdating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateSecuritySettings = useCallback(async (settings: {
    mfa_enabled?: boolean
    session_timeout?: number
    password_policy?: Record<string, any>
  }) => {
    setUpdating(true)
    setError(null)
    
    try {
      const result = await apiService.updateSecuritySettings(settings)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Settings update failed'
      setError(errorMessage)
      throw err
    } finally {
      setUpdating(false)
    }
  }, [])

  const updateMFASettings = useCallback(async (enabled: boolean, method?: string) => {
    setUpdating(true)
    setError(null)
    
    try {
      const result = await apiService.updateMFASettings(enabled, method)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MFA update failed'
      setError(errorMessage)
      throw err
    } finally {
      setUpdating(false)
    }
  }, [])

  const createAPIKey = useCallback(async (keyData: {
    name: string
    permissions: string[]
    expires_at?: string
    description?: string
  }) => {
    setCreating(true)
    setError(null)
    
    try {
      const result = await apiService.createAPIKey(keyData)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'API key creation failed'
      setError(errorMessage)
      throw err
    } finally {
      setCreating(false)
    }
  }, [])

  const revokeAPIKey = useCallback(async (keyId: string) => {
    setRevoking(true)
    setError(null)
    
    try {
      const result = await apiService.revokeAPIKey(keyId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'API key revocation failed'
      setError(errorMessage)
      throw err
    } finally {
      setRevoking(false)
    }
  }, [])

  const revokeSession = useCallback(async (sessionId: string) => {
    setRevoking(true)
    setError(null)
    
    try {
      const result = await apiService.revokeSession(sessionId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Session revocation failed'
      setError(errorMessage)
      throw err
    } finally {
      setRevoking(false)
    }
  }, [])

  const changePassword = useCallback(async (passwordData: {
    current_password: string
    new_password: string
    confirm_password: string
  }) => {
    setUpdating(true)
    setError(null)
    
    try {
      const result = await apiService.changePassword(passwordData)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password change failed'
      setError(errorMessage)
      throw err
    } finally {
      setUpdating(false)
    }
  }, [])

  const testAPIKey = async (keyId: string) => {
    try {
      const result = await apiService.post(`/security/api-keys/${keyId}/test`);
      toast.success(result.message || 'API key is valid and working.');
      return result;
    } catch (error) {
      const apiError = handleAPIError(error);
      toast.error(apiError.message);
      throw apiError;
    }
  };

  return {
    updateSecuritySettings,
    updateMFASettings,
    createAPIKey,
    revokeAPIKey,
    revokeSession,
    changePassword,
    testAPIKey,
    updating,
    creating,
    revoking,
    error
  }
}

export const useBilling = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setData({
        subscription: {
          plan_name: 'Professional',
          cost_mtd: 78.50,
          renews_on: '2024-08-01',
          usage: 75230,
        },
        paymentMethod: {
          card_type: 'Visa',
          last4: '4242',
          expiry_date: '12/25'
        },
        billingHistory: [
          { id: 'inv_12345', date: '2024-07-01', amount: 99.00, invoice_url: '#' },
          { id: 'inv_12344', date: '2024-06-01', amount: 99.00, invoice_url: '#' },
          { id: 'inv_12343', date: '2024-05-01', amount: 99.00, invoice_url: '#' },
        ]
      })
      setLoading(false)
    }
    fetchData()
  }, [])

  return { data, loading }
}

export const useTeamManagement = () => {
  const [data, setData] = useState<any>(null)
  // ... existing code ...
} 