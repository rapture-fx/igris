import { api } from './api'

export interface APIResponse<T = any> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export class APIService {
  static async get<T>(endpoint: string): Promise<APIResponse<T>> {
    const response = await api.get(endpoint)
    return response.data
  }

  static async post<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    const response = await api.post(endpoint, data)
    return response.data
  }

  static async put<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    const response = await api.put(endpoint, data)
    return response.data
  }

  static async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    const response = await api.delete(endpoint)
    return response.data
  }

  static async upload<T>(endpoint: string, formData: FormData): Promise<APIResponse<T>> {
    const response = await api.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  }
}

export class APIError extends Error {
  constructor(message: string, public status?: number, public data?: any) {
    super(message)
    this.name = 'APIError'
  }
}

export const handleAPIError = (error: any): never => {
  if (error.response) {
    throw new APIError(
      error.response.data?.message || 'API Error',
      error.response.status,
      error.response.data
    )
  }
  throw new APIError(error.message || 'Network Error')
}

export const apiService = APIService

export default APIService