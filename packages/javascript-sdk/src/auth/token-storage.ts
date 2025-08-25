/**
 * Token storage utilities for Schlep-engine JavaScript SDK
 * Provides secure token storage for browser and Node.js environments
 */

import { TokenStorage } from '../types/common';
import { TokenResponse } from '../types/auth';

/**
 * Browser-based token storage using localStorage
 */
export class BrowserTokenStorage implements TokenStorage {
  private readonly keyPrefix = 'schlep_engine_';
  private readonly tokenKey = `${this.keyPrefix}tokens`;
  private readonly apiKeyPrefix = `${this.keyPrefix}api_key_`;

  async getToken(): Promise<string | null> {
    try {
      const stored = localStorage.getItem(this.tokenKey);
      if (!stored) return null;

      const tokenData: TokenResponse = JSON.parse(stored);
      
      // Check if token is expired
      if (this.isTokenExpired(tokenData)) {
        await this.removeToken();
        return null;
      }

      return tokenData.access_token;
    } catch (error) {
      console.warn('Failed to retrieve token from localStorage:', error);
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    try {
      // If it's just a token string, wrap it in a basic TokenResponse structure
      const tokenData: TokenResponse = {
        access_token: token,
        refresh_token: '',
        token_type: 'bearer',
        expires_in: 3600,
        issued_at: new Date().toISOString()
      };

      localStorage.setItem(this.tokenKey, JSON.stringify(tokenData));
    } catch (error) {
      console.warn('Failed to store token in localStorage:', error);
      throw error;
    }
  }

  async removeToken(): Promise<void> {
    try {
      localStorage.removeItem(this.tokenKey);
    } catch (error) {
      console.warn('Failed to remove token from localStorage:', error);
    }
  }

  isTokenValid(token: string): boolean {
    if (!token) return false;

    try {
      // Basic JWT structure validation
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      // Decode payload to check expiration
      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      return payload.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Store complete token response
   */
  async storeTokenResponse(tokenResponse: TokenResponse): Promise<void> {
    try {
      localStorage.setItem(this.tokenKey, JSON.stringify(tokenResponse));
    } catch (error) {
      console.warn('Failed to store token response:', error);
      throw error;
    }
  }

  /**
   * Get stored token response
   */
  async getTokenResponse(): Promise<TokenResponse | null> {
    try {
      const stored = localStorage.getItem(this.tokenKey);
      if (!stored) return null;

      const tokenData: TokenResponse = JSON.parse(stored);
      
      // Check if token is expired
      if (this.isTokenExpired(tokenData)) {
        await this.removeToken();
        return null;
      }

      return tokenData;
    } catch (error) {
      console.warn('Failed to retrieve token response:', error);
      return null;
    }
  }

  /**
   * Store API key
   */
  async storeApiKey(apiKey: string, identifier = 'default'): Promise<void> {
    try {
      localStorage.setItem(`${this.apiKeyPrefix}${identifier}`, apiKey);
    } catch (error) {
      console.warn('Failed to store API key:', error);
      throw error;
    }
  }

  /**
   * Get stored API key
   */
  async getApiKey(identifier = 'default'): Promise<string | null> {
    try {
      return localStorage.getItem(`${this.apiKeyPrefix}${identifier}`);
    } catch (error) {
      console.warn('Failed to retrieve API key:', error);
      return null;
    }
  }

  /**
   * Remove stored API key
   */
  async removeApiKey(identifier = 'default'): Promise<void> {
    try {
      localStorage.removeItem(`${this.apiKeyPrefix}${identifier}`);
    } catch (error) {
      console.warn('Failed to remove API key:', error);
    }
  }

  /**
   * Clear all stored authentication data
   */
  async clearAll(): Promise<void> {
    try {
      // Remove all keys that start with our prefix
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.keyPrefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear authentication data:', error);
    }
  }

  private isTokenExpired(tokenData: TokenResponse): boolean {
    if (!tokenData.issued_at || !tokenData.expires_in) {
      return false; // Can't determine, assume valid
    }

    try {
      const issuedAt = new Date(tokenData.issued_at);
      const expiresAt = new Date(issuedAt.getTime() + tokenData.expires_in * 1000);
      return Date.now() > expiresAt.getTime();
    } catch (error) {
      return false; // Can't determine, assume valid
    }
  }
}

/**
 * Memory-only token storage for Node.js or when persistence is not desired
 */
export class MemoryTokenStorage implements TokenStorage {
  private tokenData: TokenResponse | null = null;
  private apiKeys: Map<string, string> = new Map();

  async getToken(): Promise<string | null> {
    if (!this.tokenData) return null;

    // Check if token is expired
    if (this.isTokenExpired(this.tokenData)) {
      this.tokenData = null;
      return null;
    }

    return this.tokenData.access_token;
  }

  async setToken(token: string): Promise<void> {
    this.tokenData = {
      access_token: token,
      refresh_token: '',
      token_type: 'bearer',
      expires_in: 3600,
      issued_at: new Date().toISOString()
    };
  }

  async removeToken(): Promise<void> {
    this.tokenData = null;
  }

  isTokenValid(token: string): boolean {
    if (!token) return false;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      return payload.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  async storeTokenResponse(tokenResponse: TokenResponse): Promise<void> {
    this.tokenData = { ...tokenResponse };
  }

  async getTokenResponse(): Promise<TokenResponse | null> {
    if (!this.tokenData) return null;

    // Check if token is expired
    if (this.isTokenExpired(this.tokenData)) {
      this.tokenData = null;
      return null;
    }

    return { ...this.tokenData };
  }

  async storeApiKey(apiKey: string, identifier = 'default'): Promise<void> {
    this.apiKeys.set(identifier, apiKey);
  }

  async getApiKey(identifier = 'default'): Promise<string | null> {
    return this.apiKeys.get(identifier) || null;
  }

  async removeApiKey(identifier = 'default'): Promise<void> {
    this.apiKeys.delete(identifier);
  }

  async clearAll(): Promise<void> {
    this.tokenData = null;
    this.apiKeys.clear();
  }

  private isTokenExpired(tokenData: TokenResponse): boolean {
    if (!tokenData.issued_at || !tokenData.expires_in) {
      return false;
    }

    try {
      const issuedAt = new Date(tokenData.issued_at);
      const expiresAt = new Date(issuedAt.getTime() + tokenData.expires_in * 1000);
      return Date.now() > expiresAt.getTime();
    } catch (error) {
      return false;
    }
  }
}

/**
 * Node.js file-based token storage
 */
export class FileTokenStorage implements TokenStorage {
  private readonly filePath: string;
  private readonly apiKeyPrefix: string;

  constructor(filePath?: string) {
    // Use a default path if none provided
    this.filePath = filePath || this.getDefaultPath();
    this.apiKeyPrefix = 'api_key_';
  }

  async getToken(): Promise<string | null> {
    try {
      const tokenData = await this.readTokenFile();
      if (!tokenData) return null;

      // Check if token is expired
      if (this.isTokenExpired(tokenData)) {
        await this.removeToken();
        return null;
      }

      return tokenData.access_token;
    } catch (error) {
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    const tokenData: TokenResponse = {
      access_token: token,
      refresh_token: '',
      token_type: 'bearer',
      expires_in: 3600,
      issued_at: new Date().toISOString()
    };

    await this.writeTokenFile(tokenData);
  }

  async removeToken(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(this.filePath);
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  isTokenValid(token: string): boolean {
    if (!token) return false;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const currentTime = Math.floor(Date.now() / 1000);
      
      return payload.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  async storeTokenResponse(tokenResponse: TokenResponse): Promise<void> {
    await this.writeTokenFile(tokenResponse);
  }

  async getTokenResponse(): Promise<TokenResponse | null> {
    try {
      const tokenData = await this.readTokenFile();
      if (!tokenData) return null;

      // Check if token is expired
      if (this.isTokenExpired(tokenData)) {
        await this.removeToken();
        return null;
      }

      return tokenData;
    } catch (error) {
      return null;
    }
  }

  async storeApiKey(apiKey: string, identifier = 'default'): Promise<void> {
    const keyPath = this.getApiKeyPath(identifier);
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(keyPath, apiKey, { mode: 0o600 }); // Secure permissions
    } catch (error) {
      throw new Error(`Failed to store API key: ${error}`);
    }
  }

  async getApiKey(identifier = 'default'): Promise<string | null> {
    const keyPath = this.getApiKeyPath(identifier);
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(keyPath, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  async removeApiKey(identifier = 'default'): Promise<void> {
    const keyPath = this.getApiKeyPath(identifier);
    try {
      const fs = await import('fs/promises');
      await fs.unlink(keyPath);
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  async clearAll(): Promise<void> {
    await this.removeToken();
    
    // Remove all API key files
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const dir = path.dirname(this.filePath);
      const files = await fs.readdir(dir);
      
      const apiKeyFiles = files.filter(file => 
        file.startsWith(this.apiKeyPrefix) && file.endsWith('.key')
      );

      await Promise.all(
        apiKeyFiles.map(file => 
          fs.unlink(path.join(dir, file)).catch(() => {})
        )
      );
    } catch (error) {
      // Directory might not exist or be readable
    }
  }

  private async readTokenFile(): Promise<TokenResponse | null> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async writeTokenFile(tokenData: TokenResponse): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write with secure permissions
      await fs.writeFile(this.filePath, JSON.stringify(tokenData, null, 2), { 
        mode: 0o600 
      });
    } catch (error) {
      throw new Error(`Failed to write token file: ${error}`);
    }
  }

  private getDefaultPath(): string {
    const path = require('path');
    const os = require('os');
    
    return path.join(os.homedir(), '.schlep-engine', 'tokens.json');
  }

  private getApiKeyPath(identifier: string): string {
    const path = require('path');
    const dir = path.dirname(this.filePath);
    
    return path.join(dir, `${this.apiKeyPrefix}${identifier}.key`);
  }

  private isTokenExpired(tokenData: TokenResponse): boolean {
    if (!tokenData.issued_at || !tokenData.expires_in) {
      return false;
    }

    try {
      const issuedAt = new Date(tokenData.issued_at);
      const expiresAt = new Date(issuedAt.getTime() + tokenData.expires_in * 1000);
      return Date.now() > expiresAt.getTime();
    } catch (error) {
      return false;
    }
  }
}

/**
 * Factory function to create appropriate token storage based on environment
 */
export function createTokenStorage(customPath?: string): TokenStorage {
  // Detect environment
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions?.node;

  if (isBrowser) {
    return new BrowserTokenStorage();
  } else if (isNode) {
    return new FileTokenStorage(customPath);
  } else {
    // Fallback to memory storage for other environments
    return new MemoryTokenStorage();
  }
}

export default {
  BrowserTokenStorage,
  MemoryTokenStorage,
  FileTokenStorage,
  createTokenStorage
};