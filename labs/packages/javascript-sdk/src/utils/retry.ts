/**
 * Retry utility for Igris-engine JavaScript SDK
 */

import { RetryConfig } from '../types/common';
import { isRetryableError, RateLimitError, getRetryAfter } from './errors';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  retries: 3,
  retryDelay: 1000, // 1 second
  retryCondition: isRetryableError,
  exponentialBackoff: true,
  maxDelay: 30000 // 30 seconds
};

/**
 * Retry handler class
 */
export class RetryHandler {
  private config: Required<RetryConfig>;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.config.retries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if we've exhausted our attempts
        if (attempt === this.config.retries) {
          break;
        }

        // Check if error is retryable
        if (!this.config.retryCondition(lastError)) {
          break;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, lastError);
        
        // Wait before retry
        await this.sleep(delay);
        
        attempt++;
      }
    }

    // Throw the last error if all retries failed
    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateDelay(attempt: number, error?: Error): number {
    let delay = this.config.retryDelay;

    // Handle rate limiting with retry-after
    if (error instanceof RateLimitError && error.retryAfter) {
      return error.retryAfter * 1000; // Convert to milliseconds
    }

    // Apply exponential backoff
    if (this.config.exponentialBackoff) {
      delay = delay * Math.pow(2, attempt);
    }

    // Add jitter to prevent thundering herd
    delay = delay + Math.random() * 1000;

    // Cap at maximum delay
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<RetryConfig> {
    return { ...this.config };
  }
}

/**
 * Retry decorator for methods
 */
export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  config?: Partial<RetryConfig>
) {
  return function (
    target: unknown,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): void {
    const originalMethod = descriptor.value;
    if (!originalMethod) return;

    const retryHandler = new RetryHandler(config);

    descriptor.value = async function (this: unknown, ...args: Parameters<T>) {
      return retryHandler.executeWithRetry(() => originalMethod.apply(this, args));
    } as T;
  };
}

/**
 * Create a retryable function
 */
export function createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  config?: Partial<RetryConfig>
): T {
  const retryHandler = new RetryHandler(config);
  
  return (async (...args: Parameters<T>) => {
    return retryHandler.executeWithRetry(() => fn(...args));
  }) as T;
}

/**
 * Simple retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  const retryHandler = new RetryHandler({
    retries: maxRetries,
    retryDelay: baseDelay,
    exponentialBackoff: true
  });
  
  return retryHandler.executeWithRetry(fn);
}

export default {
  RetryHandler,
  DEFAULT_RETRY_CONFIG,
  withRetry,
  createRetryable,
  retryWithBackoff
};