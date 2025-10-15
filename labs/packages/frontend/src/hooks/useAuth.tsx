/**
 * Main authentication hook
 */
import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authAPIClient, User, SignInRequest, SignUpRequest } from '@/lib/auth/authAPI';
import { tokenStorage } from '@/lib/auth/tokenStorage';
import { toast } from 'sonner';
import { shouldBypassAuth, getMockUser, devLog } from '@/lib/dev-config';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (data: SignInRequest) => Promise<void>;
  signUp: (data: SignUpRequest) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user && tokenStorage.isAuthenticated();

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Normal authentication flow
        const storedUser = tokenStorage.getUser();
        const hasToken = tokenStorage.hasAccessToken();

        if (storedUser && hasToken) {
          // Try to get fresh user data
          try {
            const currentUser = await authAPIClient.getCurrentUser();
            setUser(currentUser);
            tokenStorage.setUser(currentUser);
          } catch (error) {
            // If API call fails, use stored user data
            setUser(storedUser);
          }
        } else if (hasToken) {
          // Has token but no user data, fetch user
          try {
            const currentUser = await authAPIClient.getCurrentUser();
            setUser(currentUser);
            tokenStorage.setUser(currentUser);
          } catch (error) {
            // Token is invalid, clear everything
            tokenStorage.clearTokens();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        tokenStorage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (data: SignInRequest) => {
    try {
      setIsLoading(true);

      // Normal sign in flow
      const response = await authAPIClient.signIn(data);
      
      // Store tokens and user data
      tokenStorage.setTokens(
        response.tokens.access_token,
        response.tokens.refresh_token
      );
      tokenStorage.setUser(response.user);
      setUser(response.user);

      toast.success('Sign in successful!');
      router.push('/dashboard');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Sign in failed';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (data: SignUpRequest) => {
    try {
      setIsLoading(true);

      // Normal sign up flow
      const response = await authAPIClient.signUp(data);
      
      toast.success(response.message);
      
      if (response.verification_required) {
        router.push('/auth/verify-email?email=' + encodeURIComponent(data.email));
      } else {
        router.push('/auth/signin');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Registration failed';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Call API to invalidate session
      try {
        await authAPIClient.signOut();
      } catch (error) {
        // Continue with logout even if API call fails
        console.error('Logout API error:', error);
      }

      // Clear local storage
      tokenStorage.clearTokens();
      setUser(null);

      toast.success('Signed out successfully');
      router.push('/auth/signin');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      tokenStorage.clearTokens();
      setUser(null);
      router.push('/auth/signin');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authAPIClient.getCurrentUser();
      setUser(currentUser);
      tokenStorage.setUser(currentUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // If refresh fails, sign out
      await signOut();
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 