// User related types
export interface User {
  id: string
  email: string
  username: string
  firstName?: string
  lastName?: string
  avatar?: string
  role: 'admin' | 'user' | 'viewer'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  username: string
  firstName?: string
  lastName?: string
}