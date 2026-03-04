import Cookies from 'js-cookie';
import { API_BASE_URL, COOKIE_KEYS, ROUTES } from '@/utils/constants';
import { FEATURE_FLAGS } from './config';
import { getMockForPath } from './mock/data';

export class ApiError extends Error {
  constructor(public status: number, public message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function refreshToken(): Promise<string | null> {
  try {
    const refreshToken = Cookies.get(COOKIE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      credentials: 'include',
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.access_token) {
      Cookies.set(COOKIE_KEYS.JWT, data.access_token, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      return data.access_token;
    }

    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  let token = Cookies.get(COOKIE_KEYS.JWT);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (fetchOptions.headers) {
    Object.assign(headers, fetchOptions.headers);
  }

  if (!skipAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    // Handle 401 - Unauthorized
    if (response.status === 401 && !skipAuth) {
      // Try to refresh token
      const newToken = await refreshToken();
      if (newToken) {
        // Retry with new token
        const retryHeaders: Record<string, string> = {
          ...headers,
          'Authorization': `Bearer ${newToken}`,
        };
        const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
          ...fetchOptions,
          headers: retryHeaders,
          credentials: 'include',
        });

        if (retryResponse.ok) {
          return await retryResponse.json();
        }
      }

      // If refresh failed or retry failed, redirect to login
      if (typeof window !== 'undefined') {
        Cookies.remove(COOKIE_KEYS.JWT);
        Cookies.remove(COOKIE_KEYS.REFRESH_TOKEN);
        window.location.href = ROUTES.LOGIN;
      }
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
      if (FEATURE_FLAGS.enableMockData && error.status !== 401) {
        const mock = getMockForPath(path);
        if (mock !== undefined) return mock as T;
      }
      throw error;
    }
    // Network error - fall back to mock data in development
    if (FEATURE_FLAGS.enableMockData) {
      const mock = getMockForPath(path);
      if (mock !== undefined) return mock as T;
    }
    throw new ApiError(500, 'Network error or server is unavailable');
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
