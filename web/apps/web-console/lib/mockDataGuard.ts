/**
 * Mock Data Guard
 *
 * This module provides production-safe fallback handling for API calls.
 * Mock data is ONLY returned in development when explicitly enabled.
 */

import { FEATURE_FLAGS, ENV } from './config';

/**
 * Production-safe error class for API failures
 */
export class ApiDataError extends Error {
  constructor(
    message: string,
    public originalError?: unknown,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApiDataError';
  }
}

/**
 * Safely handle API errors with environment-aware fallback behavior.
 *
 * In production: Always throws the error (no mock data)
 * In development with mock data enabled: Returns mock data
 * In development with mock data disabled: Throws the error
 *
 * @param error - The caught error from the API call
 * @param mockData - Mock data to return in development mode
 * @param context - Context string for debugging (e.g., "useUsage")
 * @returns Mock data in development, never in production
 * @throws ApiDataError in production or when mock data is disabled
 */
export function handleApiError<T>(
  error: unknown,
  mockData: T,
  context: string
): T {
  // CRITICAL: In production, NEVER return mock data
  if (ENV.isProduction || !FEATURE_FLAGS.enableMockData) {
    // Log the error for debugging (in production, this goes to monitoring)
    console.error(`[${context}] API call failed in ${ENV.current} mode:`, error);

    // Throw an error that will be caught by error boundaries
    throw new ApiDataError(
      `Failed to fetch data for ${context}. Please try again later.`,
      error,
      error instanceof Error && 'status' in error ? (error as any).status : undefined
    );
  }

  // Development mode with mock data enabled: Return mock data
  if (ENV.isDevelopment) {
    console.warn(`[${context}] API call failed, returning mock data (development mode):`, error);
    return mockData;
  }

  // Staging mode: Throw error (no mock data in staging either)
  console.error(`[${context}] API call failed in staging mode:`, error);
  throw new ApiDataError(
    `Failed to fetch data for ${context}. Backend may be unavailable.`,
    error
  );
}

/**
 * Check if mock data is currently enabled.
 * Useful for components that need to show a warning badge.
 */
export function isMockDataEnabled(): boolean {
  return FEATURE_FLAGS.enableMockData;
}

/**
 * Get a user-friendly error message from an API error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiDataError) {
    return error.message;
  }

  if (error instanceof Error) {
    // In production, don't expose internal error details
    if (ENV.isProduction) {
      return 'An unexpected error occurred. Please try again later.';
    }
    return error.message;
  }

  if (ENV.isProduction) {
    return 'An unexpected error occurred. Please try again later.';
  }

  return String(error);
}

/**
 * Runtime assertion that mock data is not being used in production.
 * Call this in critical paths to add an extra safety check.
 */
export function assertNotMockDataInProduction(data: any, context: string): void {
  if (ENV.isProduction && FEATURE_FLAGS.enableMockData) {
    // This should never happen due to config.ts validation, but just in case...
    console.error(`❌ CRITICAL: Mock data detected in production for ${context}!`);
    throw new Error('Production safety violation: Mock data in production');
  }
}
