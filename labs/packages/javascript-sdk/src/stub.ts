// Stub implementation to allow web-landing build to proceed
// TODO: Replace with proper implementation once SDK TypeScript issues are resolved

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export class AuthManager {
  constructor(config: any) {}
  
  async login(email: string, password: string): Promise<any> {
    return null;
  }
  
  async logout(): Promise<void> {}
  
  async refresh(): Promise<void> {}
  
  isAuthenticated(): boolean {
    return false;
  }
  
  getCurrentUser(): any {
    return null;
  }
}

export const createTokenStorage = (): any => ({
  getTokens: () => null,
  setTokens: () => {},
  clearTokens: () => {}
});

export class IgrisClient {
  constructor(config: any) {}
  
  async upload(file: File): Promise<any> {
    return null;
  }
  
  async processData(data: any): Promise<any> {
    return null;
  }
}

// Additional exports that might be needed
export * from './types/common';
export * from './types/auth';
