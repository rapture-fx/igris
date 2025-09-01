import axios, { AxiosResponse, AxiosError } from 'axios'
import Cookies from 'js-cookie'

// Environment-based API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const API_VERSION = 'v1'
const API_TIMEOUT = 30000 // Increased timeout for ML operations

// Enhanced API client with retry logic
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for session management
})

// Request interceptor with enhanced auth handling
api.interceptors.request.use(
  (config) => {
    // Try multiple auth sources
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_token') || Cookies.get('auth_token')
      : null
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Add request ID for tracking
    config.headers['X-Request-ID'] = crypto.randomUUID()
    
    // Add client info
    config.headers['X-Client-Version'] = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'
    config.headers['X-Client-Type'] = 'web'
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Enhanced response interceptor with retry logic
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log successful requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        requestId: response.config.headers['X-Request-ID']
      })
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (typeof window !== 'undefined') {
        // Clear auth tokens
        localStorage.removeItem('auth_token')
        Cookies.remove('auth_token')
        
        // Emit auth error event for global handling
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
        
        // Redirect to login if not already on auth page
        if (!window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth/signin'
        }
      }
    }
    
    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 1
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
      return api.request(originalRequest!)
    }
    
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`API Error: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, {
        status: error.response?.status,
        message: error.message,
        requestId: originalRequest?.headers['X-Request-ID']
      })
    }
    
    return Promise.reject(error)
  }
)

// Enhanced Authentication API with OAuth support
export const authAPI = {
  // Traditional auth
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  register: (userData: { email: string; password: string; name: string; [key: string]: any }) =>
    api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  
  // Profile management
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData: any) => api.put('/auth/profile', profileData),
  
  // OAuth endpoints
  getOAuthUrl: (provider: 'google' | 'github' | 'discord') =>
    api.get(`/auth/oauth/${provider}/url`),
  handleOAuthCallback: (provider: string, code: string, state?: string) =>
    api.post(`/auth/oauth/${provider}/callback`, { code, state }),
  
  // Session management
  refreshToken: () => api.post('/auth/refresh'),
  validateToken: (token: string) => api.post('/auth/validate', { token }),
  
  // Security
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  requestPasswordReset: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),
  
  // Two-factor authentication
  enable2FA: () => api.post('/auth/2fa/enable'),
  verify2FA: (code: string) => api.post('/auth/2fa/verify', { code }),
  disable2FA: (code: string) => api.post('/auth/2fa/disable', { code }),
}

// Enhanced Dashboard API
export const dashboardAPI = {
  // Overview metrics
  getStats: () => api.get('/dashboard/stats'),
  getOverview: () => api.get('/monitoring/dashboard/overview'),
  getHealthMetrics: () => api.get('/monitoring/dashboard/health'),
  getPerformanceMetrics: () => api.get('/monitoring/dashboard/performance'),
  
  // Activity tracking
  getRecentActivity: () => api.get('/dashboard/activity'),
  getUserActivity: (userId?: string, limit = 50) => 
    api.get(`/dashboard/activity${userId ? `/${userId}` : ''}?limit=${limit}`),
  
  // Data quality monitoring
  getDataQuality: () => api.get('/dashboard/data-quality'),
  getDataQualityHistory: (timeRange = '7d') => 
    api.get(`/dashboard/data-quality/history?range=${timeRange}`),
  
  // System health
  getSystemHealth: () => api.get('/health/detailed'),
  getSystemMetrics: () => api.get('/metrics/summary'),
  getAlerts: () => api.get('/monitoring/dashboard/alerts'),
  getLogs: (level?: string, limit = 100) => 
    api.get(`/monitoring/dashboard/logs?${level ? `level=${level}&` : ''}limit=${limit}`),
}

// Comprehensive Data Processing API
export const dataAPI = {
  // File operations
  uploadFile: (formData: FormData, onProgress?: (progress: number) => void) =>
    api.post('/data/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    }),
  
  // Data sources
  getDataSources: () => api.get('/data/sources'),
  getDataSource: (sourceId: string) => api.get(`/data/sources/${sourceId}`),
  deleteDataSource: (sourceId: string) => api.delete(`/data/sources/${sourceId}`),
  
  // Data processing
  processData: (sourceId: string, config: any) =>
    api.post(`/data/process/${sourceId}`, config),
  validateData: (data: any, schema?: any) =>
    api.post('/data/validate', { data, schema }),
  
  // Job management
  getJobs: (status?: string, limit = 50) => 
    api.get(`/data/jobs?${status ? `status=${status}&` : ''}limit=${limit}`),
  getJob: (jobId: string) => api.get(`/data/jobs/${jobId}`),
  cancelJob: (jobId: string) => api.post(`/data/jobs/${jobId}/cancel`),
  retryJob: (jobId: string) => api.post(`/data/jobs/${jobId}/retry`),
  
  // Data quality
  getDataQualityReport: (sourceId: string) => api.get(`/data/quality/${sourceId}`),
  runDataQualityCheck: (sourceId: string, checks: string[]) =>
    api.post(`/data/quality/${sourceId}/check`, { checks }),
  
  // Export operations
  exportData: (sourceId: string, format: 'csv' | 'json' | 'parquet' = 'csv') =>
    api.get(`/data/export/${sourceId}?format=${format}`, { responseType: 'blob' }),
}

// Machine Learning and AI API
export const mlAPI = {
  // Model operations
  getModels: () => api.get('/ml/models'),
  getModel: (modelId: string) => api.get(`/ml/models/${modelId}`),
  trainModel: (config: any) => api.post('/ml/train', config),
  predictBatch: (modelId: string, data: any[]) => api.post(`/ml/predict/${modelId}`, { data }),
  
  // Advanced AI features
  generateInsights: (data: any) => api.post('/ai/insights', data),
  semanticSearch: (query: string, context?: any) => api.post('/ai/semantic-search', { query, context }),
  
  // RL Optimization
  getRLStatus: () => api.get('/rl/status'),
  startRLOptimization: (config: any) => api.post('/rl/optimize', config),
  getRLMetrics: () => api.get('/rl/metrics'),
}

// Real-time and WebSocket API
export const realtimeAPI = {
  // Streaming endpoints
  getStreamingStatus: () => api.get('/streaming/status'),
  getStreamMetrics: () => api.get('/streaming/metrics'),
  
  // WebSocket connection info
  getWebSocketToken: () => api.get('/streaming/ws-token'),
}

// User Management API
export const usersAPI = {
  getUsers: (page = 1, limit = 20, search?: string) => 
    api.get(`/users?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`),
  getUser: (userId: string) => api.get(`/users/${userId}`),
  updateUser: (userId: string, userData: any) => api.put(`/users/${userId}`, userData),
  deleteUser: (userId: string) => api.delete(`/users/${userId}`),
  getUserActivity: (userId: string) => api.get(`/users/${userId}/activity`),
}

// Admin and Security API
export const adminAPI = {
  // System administration
  getSystemInfo: () => api.get('/admin/system-info'),
  getAuditLogs: (page = 1, limit = 50) => api.get(`/admin/audit?page=${page}&limit=${limit}`),
  
  // Security
  getSecurityEvents: () => api.get('/security/events'),
  runSecurityScan: () => api.post('/security/scan'),
  
  // DPA Compliance
  getDPAStatus: () => api.get('/dpa-compliance/status'),
  generateComplianceReport: () => api.get('/dpa-compliance/report'),
}

// Billing and Enterprise API
export const billingAPI = {
  getSubscription: () => api.get('/billing/subscription'),
  getUsage: (period = 'current') => api.get(`/billing/usage?period=${period}`),
  getInvoices: () => api.get('/billing/invoices'),
  updatePaymentMethod: (paymentData: any) => api.post('/billing/payment-method', paymentData),
}

// Generic API service helper
export const apiService = {
  get: <T>(endpoint: string, config?: any) => api.get<T>(endpoint, config).then(res => res.data),
  post: <T>(endpoint: string, data?: any, config?: any) => api.post<T>(endpoint, data, config).then(res => res.data),
  put: <T>(endpoint: string, data?: any, config?: any) => api.put<T>(endpoint, data, config).then(res => res.data),
  delete: <T>(endpoint: string, config?: any) => api.delete<T>(endpoint, config).then(res => res.data),
  patch: <T>(endpoint: string, data?: any, config?: any) => api.patch<T>(endpoint, data, config).then(res => res.data),
  
  // Health checks
  getHealth: () => api.get('/health').then(res => res.data),
  getDetailedHealth: () => api.get('/health/detailed').then(res => res.data),
  
  // Generic CRUD operations
  create: <T>(resource: string, data: any) => api.post<T>(`/${resource}`, data).then(res => res.data),
  read: <T>(resource: string, id?: string) => api.get<T>(`/${resource}${id ? `/${id}` : ''}`).then(res => res.data),
  update: <T>(resource: string, id: string, data: any) => api.put<T>(`/${resource}/${id}`, data).then(res => res.data),
  remove: <T>(resource: string, id: string) => api.delete<T>(`/${resource}/${id}`).then(res => res.data),
}

export default api