import { API_BASE_URL } from '@/utils/constants';
import { API_CONFIG, FEATURE_FLAGS } from './config';
import { getMockForPath } from './mock/data';

export class ApiError extends Error {
  constructor(public status: number, public message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  allowMockFallback?: boolean;
}

// CSRF token management
let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE_URL}/v1/csrf-token`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.token;
      return csrfToken;
    }
  } catch {
    // CSRF endpoint may not exist yet — fall back to cookie-based
  }
  return null;
}

export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { skipAuth = false, allowMockFallback = true, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (fetchOptions.headers) {
    Object.assign(headers, fetchOptions.headers);
  }

  // Attach CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method?.toUpperCase() ?? '')) {
    const token = await fetchCsrfToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: fetchOptions.signal ?? controller.signal,
    });

    // Handle 401 - Unauthorized (redirect disabled for local dev)
    if (response.status === 401 && !skipAuth) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Handle other HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.message || errorData.error || `HTTP ${response.status}`,
        errorData
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      // In development, fall back to mock data for non-auth errors
      if (allowMockFallback && FEATURE_FLAGS.enableMockData && error.status !== 401) {
        const mock = getMockForPath(path);
        if (mock !== undefined) return mock as T;
      }
      throw error;
    }
    // Network error - fall back to mock data in development
    if (allowMockFallback && FEATURE_FLAGS.enableMockData) {
      const mock = getMockForPath(path);
      if (mock !== undefined) return mock as T;
    }
    throw new ApiError(500, error instanceof DOMException && error.name === 'AbortError'
      ? 'Request timed out'
      : 'Network error or server is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T = any>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T = any>(path: string, data?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = any>(path: string, data?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = any>(path: string, data?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = any>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
