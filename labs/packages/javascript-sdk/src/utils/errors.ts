/**
 * Error classes for Schlep-engine JavaScript SDK
 */

import { ErrorResponse, SDKError } from '../types/common';

/**
 * Base SDK error class
 */
export class SchlepEngineError extends Error implements SDKError {
  public readonly code?: string;
  public readonly statusCode?: number;
  public readonly response?: ErrorResponse;
  public readonly isRetryable?: boolean;

  constructor(
    message: string,
    code?: string,
    statusCode?: number,
    response?: ErrorResponse,
    isRetryable = false
  ) {
    super(message);
    this.name = 'SchlepEngineError';
    this.code = code;
    this.statusCode = statusCode;
    this.response = response;
    this.isRetryable = isRetryable;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SchlepEngineError);
    }
  }
}

/**
 * API error for HTTP-related issues
 */
export class APIError extends SchlepEngineError {
  constructor(
    message: string,
    statusCode: number,
    response?: ErrorResponse,
    isRetryable = false
  ) {
    super(message, 'API_ERROR', statusCode, response, isRetryable);
    this.name = 'APIError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends SchlepEngineError {
  constructor(message = 'Authentication failed', response?: ErrorResponse) {
    super(message, 'AUTH_ERROR', 401, response, false);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends SchlepEngineError {
  constructor(message = 'Access denied', response?: ErrorResponse) {
    super(message, 'AUTHORIZATION_ERROR', 403, response, false);
    this.name = 'AuthorizationError';
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends SchlepEngineError {
  public readonly retryAfter?: number;

  constructor(
    message = 'Rate limit exceeded',
    retryAfter?: number,
    response?: ErrorResponse
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, response, true);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Network error for connection issues
 */
export class NetworkError extends SchlepEngineError {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, undefined, true);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends SchlepEngineError {
  constructor(message = 'Request timeout') {
    super(message, 'TIMEOUT_ERROR', 408, undefined, true);
    this.name = 'TimeoutError';
  }
}

/**
 * Server error (5xx status codes)
 */
export class ServerError extends SchlepEngineError {
  constructor(message: string, statusCode: number, response?: ErrorResponse) {
    super(message, 'SERVER_ERROR', statusCode, response, true);
    this.name = 'ServerError';
  }
}

/**
 * Client error (4xx status codes, excluding auth and rate limit)
 */
export class ClientError extends SchlepEngineError {
  constructor(message: string, statusCode: number, response?: ErrorResponse) {
    super(message, 'CLIENT_ERROR', statusCode, response, false);
    this.name = 'ClientError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends SchlepEngineError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends SchlepEngineError {
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(message: string, details?: Array<{ field: string; message: string }>) {
    super(message, 'VALIDATION_ERROR', 400, undefined, false);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Parse API error from response
 */
export function parseAPIError(
  response: ErrorResponse,
  statusCode: number
): SchlepEngineError {
  const message = response.message || response.error || 'Unknown API error';

  // Handle specific error types based on status code
  switch (statusCode) {
    case 400:
      return new ClientError(message, statusCode, response);
    case 401:
      return new AuthenticationError(message, response);
    case 403:
      return new AuthorizationError(message, response);
    case 429:
      return new RateLimitError(message, undefined, response);
    case 408:
    case 504:
      return new TimeoutError(message);
    default:
      if (statusCode >= 500) {
        return new ServerError(message, statusCode, response);
      } else if (statusCode >= 400) {
        return new ClientError(message, statusCode, response);
      } else {
        return new APIError(message, statusCode, response);
      }
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof SchlepEngineError) {
    return error.isRetryable || false;
  }

  // Network errors are generally retryable
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Extract retry-after value from response headers or error
 */
export function getRetryAfter(error: RateLimitError | Headers): number | undefined {
  if (error instanceof RateLimitError) {
    return error.retryAfter;
  }

  if (error instanceof Headers) {
    const retryAfter = error.get('retry-after');
    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
  }

  return undefined;
}

export default {
  SchlepEngineError,
  APIError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServerError,
  ClientError,
  ConfigurationError,
  ValidationError,
  parseAPIError,
  isRetryableError,
  getRetryAfter
};