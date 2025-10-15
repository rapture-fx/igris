/**
 * Token storage utilities for Schlep-engine JavaScript SDK
 * Provides secure token storage for browser and Node.js environments
 */

import { TokenStorage } from '../types/common';
import { TokenResponse } from '../types/auth';
import { promises as fs } from 'fs';
import path from 'path';

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
      await fs.writeFile(keyPath, apiKey, { mode: 0o600 }); // Secure permissions
    } catch (error) {
      throw new Error(`Failed to store API key: ${error}`);
    }
  }

  async getApiKey(identifier = 'default'): Promise<string | null> {
    const keyPath = this.getApiKeyPath(identifier);
    try {
      return await fs.readFile(keyPath, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  async removeApiKey(identifier = 'default'): Promise<void> {
    const keyPath = this.getApiKeyPath(identifier);
    try {
      await fs.unlink(keyPath);
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  async clearAll(): Promise<void> {
    await this.removeToken();
    
    // Remove all API key files
    try {
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
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async writeTokenFile(tokenData: TokenResponse): Promise<void> {
    try {
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
    const os = require('os');
    
    return path.join(os.homedir(), '.schlep-engine', 'tokens.json');
  }

  private getApiKeyPath(identifier: string): string {
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
  return new FileTokenStorage(customPath);
}

export default {
  FileTokenStorage,
  createTokenStorage
};