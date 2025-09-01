/**
 * Application Configuration
 * Centralized configuration management for environment variables and feature flags
 */

// Type definitions for configuration
export interface AppConfig {
  env: 'development' | 'staging' | 'production'
  debug: boolean
  api: ApiConfig
  app: AppInfo
  auth: AuthConfig
  features: FeatureFlags
  analytics: AnalyticsConfig
  storage: StorageConfig
  security: SecurityConfig
  performance: PerformanceConfig
}

export interface ApiConfig {
  baseUrl: string
  version: string
  timeout: number
  retryAttempts: number
  wsHost: string
  enableMocking: boolean
}

export interface AppInfo {
  name: string
  version: string
  url: string
  supportEmail: string
  docsUrl: string
}

export interface AuthConfig {
  providers: {
    google: boolean
    github: boolean
    discord: boolean
  }
  sessionTimeout: number
  rememberMe: boolean
  tokenKey: string
  refreshKey: string
}

export interface FeatureFlags {
  mlFeatures: boolean
  realTime: boolean
  analytics: boolean
  monitoring: boolean
  devTools: boolean
  experimental: {
    newDashboard: boolean
    advancedML: boolean
    collaboration: boolean
  }
}

export interface AnalyticsConfig {
  enabled: boolean
  sentryDsn?: string
  googleAnalyticsId?: string
  posthogKey?: string
  trackErrors: boolean
  trackPerformance: boolean
}

export interface StorageConfig {
  maxFileSize: string
  allowedFileTypes: string[]
  compressionEnabled: boolean
}

export interface SecurityConfig {
  csrfProtection: boolean
  rateLimiting: boolean
  encryptLocalStorage: boolean
}

export interface PerformanceConfig {
  serviceWorker: boolean
  pwa: boolean
  imageLazyLoading: boolean
  codeSplitting: boolean
}

// Environment variable helpers
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key]
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    console.warn(`Environment variable ${key} is not defined`)
    return ''
  }
  return value
}

const getBooleanEnv = (key: string, defaultValue = false): boolean => {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true'
}

const getNumberEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

// Parse file size (e.g., "100MB" -> bytes)
const parseFileSize = (sizeStr: string): number => {
  const units: { [key: string]: number } = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  }

  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i)
  if (!match) return 0

  const [, size, unit] = match
  return parseFloat(size) * (units[unit.toUpperCase()] || 1)
}

// Configuration object
export const config: AppConfig = {
  env: (getEnvVar('NODE_ENV', 'development') as AppConfig['env']),
  debug: getBooleanEnv('NEXT_PUBLIC_DEBUG', false),

  api: {
    baseUrl: getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:8000'),
    version: getEnvVar('NEXT_PUBLIC_API_VERSION', 'v1'),
    timeout: getNumberEnv('NEXT_PUBLIC_API_TIMEOUT', 30000),
    retryAttempts: getNumberEnv('NEXT_PUBLIC_API_RETRY_ATTEMPTS', 3),
    wsHost: getEnvVar('NEXT_PUBLIC_WS_HOST', 'localhost:8000'),
    enableMocking: getBooleanEnv('NEXT_PUBLIC_API_MOCKING', false),
  },

  app: {
    name: getEnvVar('NEXT_PUBLIC_APP_NAME', 'Schlep Engine'),
    version: getEnvVar('NEXT_PUBLIC_APP_VERSION', '0.1.0'),
    url: getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
    supportEmail: getEnvVar('NEXT_PUBLIC_SUPPORT_EMAIL', 'support@schlep-engine.com'),
    docsUrl: getEnvVar('NEXT_PUBLIC_DOCS_URL', 'https://docs.schlep-engine.com'),
  },

  auth: {
    providers: {
      google: getBooleanEnv('NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED', true),
      github: getBooleanEnv('NEXT_PUBLIC_OAUTH_GITHUB_ENABLED', true),
      discord: getBooleanEnv('NEXT_PUBLIC_OAUTH_DISCORD_ENABLED', false),
    },
    sessionTimeout: getNumberEnv('NEXT_PUBLIC_SESSION_TIMEOUT', 24 * 60 * 60 * 1000), // 24 hours
    rememberMe: getBooleanEnv('NEXT_PUBLIC_REMEMBER_ME_ENABLED', true),
    tokenKey: 'auth_token',
    refreshKey: 'refresh_token',
  },

  features: {
    mlFeatures: getBooleanEnv('NEXT_PUBLIC_ENABLE_ML_FEATURES', true),
    realTime: getBooleanEnv('NEXT_PUBLIC_ENABLE_REAL_TIME', true),
    analytics: getBooleanEnv('NEXT_PUBLIC_ENABLE_ANALYTICS', true),
    monitoring: getBooleanEnv('NEXT_PUBLIC_ENABLE_MONITORING', true),
    devTools: getBooleanEnv('NEXT_PUBLIC_SHOW_DEV_TOOLS', false),
    experimental: {
      newDashboard: getBooleanEnv('NEXT_PUBLIC_EXPERIMENTAL_NEW_DASHBOARD', false),
      advancedML: getBooleanEnv('NEXT_PUBLIC_EXPERIMENTAL_ADVANCED_ML', false),
      collaboration: getBooleanEnv('NEXT_PUBLIC_EXPERIMENTAL_COLLABORATION', false),
    },
  },

  analytics: {
    enabled: getBooleanEnv('NEXT_PUBLIC_ENABLE_ANALYTICS', true),
    sentryDsn: getEnvVar('NEXT_PUBLIC_SENTRY_DSN'),
    googleAnalyticsId: getEnvVar('NEXT_PUBLIC_GOOGLE_ANALYTICS_ID'),
    posthogKey: getEnvVar('NEXT_PUBLIC_POSTHOG_KEY'),
    trackErrors: getBooleanEnv('NEXT_PUBLIC_TRACK_ERRORS', true),
    trackPerformance: getBooleanEnv('NEXT_PUBLIC_TRACK_PERFORMANCE', true),
  },

  storage: {
    maxFileSize: getEnvVar('NEXT_PUBLIC_MAX_FILE_SIZE', '100MB'),
    allowedFileTypes: getEnvVar('NEXT_PUBLIC_ALLOWED_FILE_TYPES', 'csv,json,xlsx,parquet,txt')
      .split(',')
      .map(type => type.trim().toLowerCase()),
    compressionEnabled: getBooleanEnv('NEXT_PUBLIC_COMPRESSION_ENABLED', true),
  },

  security: {
    csrfProtection: getBooleanEnv('NEXT_PUBLIC_CSRF_PROTECTION', true),
    rateLimiting: getBooleanEnv('NEXT_PUBLIC_RATE_LIMITING', true),
    encryptLocalStorage: getBooleanEnv('NEXT_PUBLIC_ENCRYPT_LOCAL_STORAGE', false),
  },

  performance: {
    serviceWorker: getBooleanEnv('NEXT_PUBLIC_ENABLE_SW', false),
    pwa: getBooleanEnv('NEXT_PUBLIC_ENABLE_PWA', false),
    imageLazyLoading: getBooleanEnv('NEXT_PUBLIC_IMAGE_LAZY_LOADING', true),
    codeSplitting: getBooleanEnv('NEXT_PUBLIC_CODE_SPLITTING', true),
  },
}

// Utility functions
export const isProduction = () => config.env === 'production'
export const isDevelopment = () => config.env === 'development'
export const isStaging = () => config.env === 'staging'

export const getApiUrl = (endpoint: string = '') => {
  const baseUrl = config.api.baseUrl.replace(/\/$/, '') // Remove trailing slash
  const version = config.api.version
  const cleanEndpoint = endpoint.replace(/^\//, '') // Remove leading slash
  
  return `${baseUrl}/api/${version}/${cleanEndpoint}`
}

export const getWebSocketUrl = () => {
  const protocol = config.api.baseUrl.startsWith('https') ? 'wss:' : 'ws:'
  return `${protocol}//${config.api.wsHost}/ws`
}

export const getMaxFileSizeBytes = () => {
  return parseFileSize(config.storage.maxFileSize)
}

export const isFileTypeAllowed = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension ? config.storage.allowedFileTypes.includes(extension) : false
}

export const getFeatureFlag = (flag: keyof FeatureFlags): boolean => {
  return config.features[flag] as boolean
}

export const getExperimentalFlag = (flag: keyof FeatureFlags['experimental']): boolean => {
  return config.features.experimental[flag]
}

// Export commonly used values
export const API_BASE_URL = config.api.baseUrl
export const APP_VERSION = config.app.version
export const IS_DEVELOPMENT = isDevelopment()
export const IS_PRODUCTION = isProduction()

export default config