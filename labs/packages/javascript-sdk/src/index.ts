// Minimal JavaScript stub implementation for web-landing build compatibility

interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

class AuthManager {
  constructor(config: any) {}
  
  async login(email: string, password: string) {
    return null;
  }
  
  async logout() {}
  
  async refresh() {}
  
  async handleOAuthCallback(params: { code: string; provider: string }) {
    return null;
  }
  
  isAuthenticated() {
    return false;
  }
  
  getCurrentUser() {
    return null;
  }
}

const createTokenStorage = () => ({
  getTokens: () => null,
  setTokens: () => {},
  clearTokens: () => {}
});

class SchlepEngineClient {
  constructor(config: any) {}
  
  async upload(file: File) {
    return null;
  }
  
  async processData(data: any) {
    return null;
  }
}

export { AuthManager, createTokenStorage, SchlepEngineClient };
export type { ApiError };
export default SchlepEngineClient;
