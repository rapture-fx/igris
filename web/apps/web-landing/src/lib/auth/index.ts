
import { authAPI, LoginCredentials, RegisterData } from './authAPI';

export interface ApiError extends Error {
  status?: number;
}

export const loginWithCredentials = async (credentials: LoginCredentials) => {
  try {
    const response = await authAPI.login(credentials);
    return response;
  } catch (error) {
    const apiError: ApiError = new Error('Login failed');
    apiError.status = error.response?.status;
    throw apiError;
  }
};

export const registerUser = async (userData: RegisterData) => {
  try {
    const response = await authAPI.register(userData);
    return response;
  } catch (error) {
    const apiError: ApiError = new Error('Registration failed');
    apiError.status = error.response?.status;
    throw apiError;
  }
};

export const checkEmailExists = async (email: string): Promise<{ exists: boolean }> => {
  try {
    // This is a workaround. The backend does not have a dedicated endpoint to check for email existence.
    // We are trying to login with a dummy password and if it fails with 401, we assume the user exists.
    await authAPI.login({ email, password: 'dummy_password' });
    return { exists: true };
  } catch (error) {
    if (error.response?.status === 401) {
      return { exists: true };
    }
    return { exists: false };
  }
};

export const initiateOAuthLogin = (provider: 'google' | 'github') => {
  // Redirect to the backend OAuth endpoint
  window.location.href = `/api/v1/auth/${provider}/login`;
};

export { tokenStorage } from './tokenStorage';
