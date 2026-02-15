/**
 * Base API class for Igris-engine JavaScript SDK
 * Provides common functionality for all API endpoint implementations
 */

import { 
  APIResponse, 
  PaginationInfo, 
  RequestConfig, 
  HTTPMethod 
} from '../types/common';

import { IgrisClient } from '../client/igris-inertial';

/**
 * Base class for all API endpoint implementations
 */
export abstract class BaseAPI {
  protected client: IgrisClient;
  protected basePath: string;

  constructor(client: IgrisClient) {
    this.client = client;
    this.basePath = ''; // Override in subclasses
  }

  /**
   * Make API request through the client
   */
  protected async request<T = unknown>(
    method: HTTPMethod,
    path: string,
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    // Build full path
    const fullPath = this.buildPath(path);
    return this.client.request<T>(method, fullPath, config);
  }

  /**
   * Make GET request
   */
  protected async get<T = unknown>(
    path: string, 
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('GET', path, config);
  }

  /**
   * Make POST request
   */
  protected async post<T = unknown>(
    path: string, 
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('POST', path, config);
  }

  /**
   * Make PUT request
   */
  protected async put<T = unknown>(
    path: string, 
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('PUT', path, config);
  }

  /**
   * Make PATCH request
   */
  protected async patch<T = unknown>(
    path: string, 
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('PATCH', path, config);
  }

  /**
   * Make DELETE request
   */
  protected async delete<T = unknown>(
    path: string, 
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', path, config);
  }

  /**
   * Make paginated API request
   */
  protected async paginatedRequest<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    config?: RequestConfig
  ): Promise<APIResponse<T[]>> {
    const requestConfig: RequestConfig = {
      ...config,
      params: { ...params, ...config?.params }
    };

    return this.get<T[]>(path, requestConfig);
  }

  /**
   * Fetch all pages of a paginated endpoint
   */
  protected async getAllPages<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    maxPages = 100
  ): Promise<T[]> {
    const allItems: T[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore && currentPage <= maxPages) {
      const queryParams = {
        ...params,
        page: currentPage,
        page_size: params?.page_size || 50
      };

      const response = await this.paginatedRequest<T>(path, queryParams);

      if (response.success && response.data) {
        allItems.push(...response.data);
      }

      // Check pagination info
      if (response.pagination) {
        hasMore = response.pagination.has_next;
        currentPage = response.pagination.page + 1;
      } else {
        // No pagination info, assume this is the last page
        hasMore = false;
      }
    }

    return allItems;
  }

  /**
   * Build query parameters, filtering out null/undefined values
   */
  protected buildQueryParams(params: Record<string, unknown>): Record<string, unknown> {
    return Object.entries(params).reduce((filtered, [key, value]) => {
      if (value !== null && value !== undefined) {
        filtered[key] = value;
      }
      return filtered;
    }, {} as Record<string, unknown>);
  }

  /**
   * Build full API path
   */
  protected buildPath(path: string): string {
    if (this.basePath && !path.startsWith('/')) {
      return `${this.basePath}/${path}`;
    }
    return path;
  }

  /**
   * Handle file upload with progress tracking
   */
  protected async uploadFile<T = unknown>(
    path: string,
    file: File | Blob,
    additionalParams?: Record<string, unknown>,
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<T>> {
    const config: RequestConfig = {
      params: additionalParams,
      onUploadProgress: onProgress ? (event) => {
        if (event.total) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      } : undefined
    };

    return this.client.uploadFile<T>(this.buildPath(path), file, config);
  }

  /**
   * Wait for job completion with polling
   */
  protected async waitForJob<T = unknown>(
    jobId: string,
    checkPath = `/jobs/${jobId}`,
    pollInterval = 2000,
    maxWaitTime = 300000 // 5 minutes
  ): Promise<APIResponse<T>> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const response = await this.get<T>(checkPath);
      
      if (!response.success) {
        throw new Error(`Job check failed: ${response.message}`);
      }

      const jobData = response.data as any;
      
      // Check job status
      if (jobData?.status === 'completed') {
        return response;
      } else if (jobData?.status === 'failed') {
        throw new Error(`Job failed: ${jobData.error_message || 'Unknown error'}`);
      } else if (jobData?.status === 'cancelled') {
        throw new Error('Job was cancelled');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Job did not complete within ${maxWaitTime / 1000} seconds`);
  }

  /**
   * Create a download URL for a resource
   */
  protected buildDownloadUrl(path: string, params?: Record<string, string>): string {
    let url = `${this.client.baseUrl}${this.buildPath(path)}`;
    
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, unknown>, requiredFields: string[]): void {
    const missing = requiredFields.filter(field => 
      params[field] === null || params[field] === undefined || params[field] === ''
    );

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Extract error message from response
   */
  protected getErrorMessage(response: APIResponse<unknown>): string {
    return response.message || 'Unknown error occurred';
  }

  /**
   * Check if response indicates success
   */
  protected isSuccess<T>(response: APIResponse<T>): response is APIResponse<T> & { success: true; data: T } {
    return response.success === true && response.data !== undefined;
  }

  protected flattenObject(obj: any, prefix = ''): Record<string, string | number | boolean> {
    return Object.keys(obj).reduce((acc, k) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, this.flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {} as Record<string, string | number | boolean>);
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

export default BaseAPI;