// Minimal stub implementation for web-landing build
// This provides just the exports needed by the web-landing app

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export class AuthManager {
  constructor(config: any) {}
  async login(email: string, password: string): Promise<any> { return null; }
  async logout(): Promise<void> {}
  async refresh(): Promise<void> {}
  isAuthenticated(): boolean { return false; }
  getCurrentUser(): any { return null; }
}

export const createTokenStorage = (): any => ({
  getTokens: () => null,
  setTokens: () => {},
  clearTokens: () => {}
});

export class IgrisClient {
  constructor(config: any) {}
  async upload(file: File): Promise<any> { return null; }
  async processData(data: any): Promise<any> { return null; }
}

export const SDK_INFO = {
  version: '1.0.0',
  name: '@igris-inertial/javascript-sdk'
};

export default IgrisClient;
