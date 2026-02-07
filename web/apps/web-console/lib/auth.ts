import Cookies from 'js-cookie';
import { api } from './apiClient';
import { API_ENDPOINTS, COOKIE_KEYS, ROUTES } from '@/utils/constants';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  tenant_name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  tenant: {
    id: string;
    name: string;
    email: string;
    plan: string;
    created_at: string;
  };
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(API_ENDPOINTS.LOGIN, credentials, {
    skipAuth: true,
  });

  // Store tokens
  if (response.access_token) {
    Cookies.set(COOKIE_KEYS.JWT, response.access_token, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  if (response.refresh_token) {
    Cookies.set(COOKIE_KEYS.REFRESH_TOKEN, response.refresh_token, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  return response;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(API_ENDPOINTS.REGISTER, data, {
    skipAuth: true,
  });

  // Store tokens
  if (response.access_token) {
    Cookies.set(COOKIE_KEYS.JWT, response.access_token, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  if (response.refresh_token) {
    Cookies.set(COOKIE_KEYS.REFRESH_TOKEN, response.refresh_token, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  return response;
}

export async function logout(): Promise<void> {
  try {
    await api.post(API_ENDPOINTS.LOGOUT);
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    Cookies.remove(COOKIE_KEYS.JWT);
    Cookies.remove(COOKIE_KEYS.REFRESH_TOKEN);
    if (typeof window !== 'undefined') {
      window.location.href = ROUTES.LOGIN;
    }
  }
}

export function isAuthenticated(): boolean {
  return !!Cookies.get(COOKIE_KEYS.JWT);
}

export function getToken(): string | undefined {
  return Cookies.get(COOKIE_KEYS.JWT);
}
