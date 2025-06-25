import { useQuery } from '@tanstack/react-query'
import { apiService } from '@/lib/api'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiService.getDashboardStats(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  })
}

export function useDataQuality() {
  return useQuery({
    queryKey: ['dashboard', 'data-quality'],
    queryFn: () => apiService.getDataQuality(),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  })
}

export function useQualityTrends(period: string = '6months') {
  return useQuery({
    queryKey: ['dashboard', 'quality-trends', period],
    queryFn: () => apiService.getQualityTrends(period),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
  })
}

export function useRecentActivity(limit: number = 20, offset: number = 0) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit, offset],
    queryFn: () => apiService.getRecentActivity(limit, offset),
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 10000,
  })
}

export function useActiveJobs() {
  return useQuery({
    queryKey: ['dashboard', 'active-jobs'],
    queryFn: () => apiService.getActiveJobs(),
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    staleTime: 2000,
  })
}

// Combined dashboard data hook for convenience
export function useDashboardData() {
  const stats = useDashboardStats()
  const dataQuality = useDataQuality()
  const qualityTrends = useQualityTrends()
  const recentActivity = useRecentActivity()
  const activeJobs = useActiveJobs()

  return {
    stats,
    dataQuality,
    qualityTrends,
    recentActivity,
    activeJobs,
    isLoading: stats.isLoading || dataQuality.isLoading || qualityTrends.isLoading,
    isError: stats.isError || dataQuality.isError || qualityTrends.isError,
    refetchAll: () => {
      stats.refetch()
      dataQuality.refetch()
      qualityTrends.refetch()
      recentActivity.refetch()
      activeJobs.refetch()
    }
  }
} 