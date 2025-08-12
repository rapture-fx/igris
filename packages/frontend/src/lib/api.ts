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

export const apiService = {
  get: <T>(endpoint: string) => api.get<T>(endpoint).then(res => res.data),
  post: <T>(endpoint: string, data?: any) => api.post<T>(endpoint, data).then(res => res.data),
  put: <T>(endpoint: string, data?: any) => api.put<T>(endpoint, data).then(res => res.data),
  delete: <T>(endpoint: string) => api.delete<T>(endpoint).then(res => res.data),
  getDetailedHealth: () => api.get('/health/detailed').then(res => res.data),
}

export default api