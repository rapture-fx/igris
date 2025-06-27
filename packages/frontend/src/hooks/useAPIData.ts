/**
 * Custom API Data Hooks
 * =====================
 * 
 * Eliminates redundant state management patterns across 12+ components
 * Provides consistent loading, error, and data states with automatic retries
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiService, handleAPIError, APIError } from '@/lib/api-service'

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

  const { data, loading, error, refetch, lastFetched } = useAPIData(
    () => fetchFunction(page, pageSize),
    {
      ...apiOptions,
      transform: (result) => {
        setTotalItems(result.total)
        return result.data
      }
    }
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
    data: data || [],
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