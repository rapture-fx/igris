/**
 * Centralized Environment & Feature Flag Configuration
 *
 * CRITICAL: This file controls production safety behaviors.
 * Mock data is ONLY allowed in development environments.
 */

export const ENV = {
  /**
   * Current environment: 'development' | 'staging' | 'production'
   */
  current: (process.env.NEXT_PUBLIC_ENV || 'development') as 'development' | 'staging' | 'production',

  /**
   * Is this a production environment?
   */
  isProduction: process.env.NEXT_PUBLIC_ENV === 'production',

  /**
   * Is this a development environment?
   */
  isDevelopment: process.env.NEXT_PUBLIC_ENV === 'development' || !process.env.NEXT_PUBLIC_ENV,

  /**
   * Is this a staging environment?
   */
  isStaging: process.env.NEXT_PUBLIC_ENV === 'staging',
} as const;

export const FEATURE_FLAGS = {
  /**
   * Enable mock data fallbacks when API calls fail.
   *
   * PRODUCTION SAFETY: This MUST be false in production.
   * Default: true in development, false otherwise
   */
  enableMockData: (() => {
    // Explicit override
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true') return true;
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'false') return false;

    // Default behavior: only in development
    return ENV.isDevelopment;
  })(),

  /**
   * Show detailed error messages to users.
   * In production, we show friendly messages instead of stack traces.
   */
  showDetailedErrors: ENV.isDevelopment,

  /**
   * Enable analytics and monitoring.
   */
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',

  /**
   * Enable monitoring (Sentry, LogRocket, etc.)
   */
  enableMonitoring: process.env.NEXT_PUBLIC_ENABLE_MONITORING === 'true',

  /**
   * Require backend health check before rendering dashboard.
   * Always required in production and staging.
   */
  requireHealthCheck: !ENV.isDevelopment,

  /**
   * Health check polling interval in milliseconds.
   */
  healthCheckInterval: 30000, // 30 seconds
} as const;

export const API_CONFIG = {
  /**
   * Backend API base URL
   */
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',

  /**
   * Health check endpoint
   */
  healthCheckUrl: process.env.NEXT_PUBLIC_API_HEALTH_CHECK_URL || '/v1/health',

  /**
   * Request timeout in milliseconds
   */
  timeout: 8000,

  /**
   * Number of retry attempts for failed requests
   */
  retryAttempts: ENV.isProduction ? 2 : 0,

  /**
   * Retry delay in milliseconds
   */
  retryDelay: 1000,
} as const;

/**
 * Runtime validation to prevent misconfiguration
 */
if (typeof window !== 'undefined') {
  // Validate production safety
  if (ENV.isProduction && FEATURE_FLAGS.enableMockData) {
    console.error('❌ CRITICAL MISCONFIGURATION: Mock data is enabled in production!');
    console.error('Set NEXT_PUBLIC_ENABLE_MOCK_DATA=false in production environment.');

    // In production, we want to be extra safe - throw an error
    throw new Error('Production safety violation: Mock data cannot be enabled in production');
  }

  // Log environment info in development
  if (ENV.isDevelopment) {
    console.log('🔧 Environment:', ENV.current);
    console.log('🎭 Mock data enabled:', FEATURE_FLAGS.enableMockData);
    console.log('🏥 Health check required:', FEATURE_FLAGS.requireHealthCheck);
  }
}

/**
 * Type-safe environment validation
 */
export function validateEnvironment(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Production safety checks
  if (ENV.isProduction) {
    if (FEATURE_FLAGS.enableMockData) {
      errors.push('Mock data is enabled in production');
    }

    if (!API_CONFIG.baseUrl || API_CONFIG.baseUrl.includes('localhost')) {
      errors.push('Production API URL is not configured or points to localhost');
    }

    if (!process.env.BETTER_AUTH_SECRET) {
      errors.push('BETTER_AUTH_SECRET is not configured');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
