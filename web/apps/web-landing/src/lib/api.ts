import axios from 'axios'

// Base API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
        window.location.href = '/auth/signin'
      }
    }
    return Promise.reject(error)
  }
)

// API endpoints
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  register: (userData: { email: string; password: string; name: string }) =>
    api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
}

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentActivity: () => api.get('/dashboard/activity'),
  getDataQuality: () => api.get('/dashboard/data-quality'),
}

export const dataAPI = {
  uploadFile: (formData: FormData) =>
    api.post('/data/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getDataSources: () => api.get('/data/sources'),
  processData: (sourceId: string, config: any) =>
    api.post(`/data/process/${sourceId}`, config),
  getJobs: () => api.get('/data/jobs'),
  getJobStatus: (jobId: string) => api.get(`/data/jobs/${jobId}`),
}

// Industry Solutions API Types
export interface IndustryMetrics {
  financial: {
    fraud_detections_24h: number
    transactions_processed: number
    avg_risk_score: number
    high_risk_alerts: number
    credit_assessments: number
    avg_processing_time: number
  }
  ecommerce: {
    recommendations_served: number
    click_through_rate: number
    conversion_rate: number
    demand_forecasts: number
    personalization_accuracy: number
    catalog_items_analyzed: number
  }
  manufacturing: {
    equipment_monitored: number
    maintenance_alerts: number
    predictive_accuracy: number
    downtime_prevented_hours: number
    quality_checks_passed: number
    iot_sensors_active: number
  }
}

export interface IndustryActivity {
  id: string
  type: 'financial' | 'ecommerce' | 'manufacturing'
  action: string
  description: string
  risk_score?: number
  timestamp: string
  status: 'success' | 'warning' | 'error'
}

export interface MLPipelineStatus {
  pipeline_id: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  progress: number
  stage: string
  metrics?: any
  logs?: string[]
}

export interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  active_connections: number
  requests_per_minute: number
  average_response_time: number
  error_rate: number
}

export interface APIEndpointStats {
  endpoint: string
  method: string
  requests_24h: number
  avg_response_time: number
  success_rate: number
  last_error?: string
}

// Health API
export const healthApi = {
  check: async (): Promise<{ status: string; service: string }> => {
    const response = await api.get<{ status: string; service: string }>('/api/v1/health')
    return response.data
  },
}

// Industry API
export const industryApi = {
  getIndustryMetrics: async (): Promise<IndustryMetrics> => {
    const response = await api.get<IndustryMetrics>('/api/v1/industry/dashboard/metrics')
    return response.data
  },

  getIndustryActivity: async (limit: number = 20): Promise<IndustryActivity[]> => {
    const response = await api.get<IndustryActivity[]>(`/api/v1/industry/dashboard/activity?limit=${limit}`)
    return response.data
  }
}

// ML Pipeline API
export const mlPipelineApi = {
  getActivePipelines: async (): Promise<MLPipelineStatus[]> => {
    const response = await api.get<MLPipelineStatus[]>('/api/v1/ml/pipeline/active')
    return response.data
  },

  getStatus: async (pipeline_id: string): Promise<MLPipelineStatus> => {
    const response = await api.get<MLPipelineStatus>(`/api/v1/ml/pipeline/${pipeline_id}/status`)
    return response.data
  },
}

// Analytics API  
export const analyticsApi = {
  getSystemMetrics: async (): Promise<SystemMetrics> => {
    const response = await api.get<SystemMetrics>('/api/v1/analytics/system-metrics')
    return response.data
  },

  getEndpointStats: async (): Promise<APIEndpointStats[]> => {
    const response = await api.get<APIEndpointStats[]>('/api/v1/analytics/endpoints')
    return response.data
  },
}

// Data Processing API
export const dataProcessingApi = {
  getInvestigations: async (workspace_id?: string) => {
    const params = workspace_id ? { workspace_id } : {}
    const response = await api.get('/api/v1/processing/investigations/', { params })
    return response.data
  },

  uploadFile: async (file: File, options?: { 
    auto_process?: boolean 
    workspace_id?: string 
  }) => {
    const formData = new FormData()
    formData.append('file', file)
    if (options?.auto_process) formData.append('auto_process', 'true')
    if (options?.workspace_id) formData.append('workspace_id', options.workspace_id)

    const response = await api.post('/api/v1/storage/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },
}

export const apiService = {
  get: <T>(endpoint: string) => api.get<T>(endpoint).then(res => res.data),
  post: <T>(endpoint: string, data?: any) => api.post<T>(endpoint, data).then(res => res.data),
  put: <T>(endpoint: string, data?: any) => api.put<T>(endpoint, data).then(res => res.data),
  delete: <T>(endpoint: string) => api.delete<T>(endpoint).then(res => res.data),
  getDetailedHealth: () => api.get('/health/detailed').then(res => res.data),
}

export default api