
/**
 * Token storage utilities for Schlep-engine JavaScript SDK - Browser Environments
 */

import { TokenStorage } from '../types/common';
import { TokenResponse } from '../types/auth';

/**
 * Browser localStorage-based token storage
 */
export class BrowserTokenStorage implements TokenStorage {
  private readonly storageKey: string;

  constructor(storageKey: string = 'schlep-engine-token') {
    this.storageKey = storageKey;
  }

  async getToken(): Promise<string | null> {
    const tokenData = this.getTokenResponseSync();
    if (!tokenData) return null;

    if (this.isTokenExpired(tokenData)) {
      await this.removeToken();
      return null;
    }

    return tokenData.access_token;
  }

  async setToken(token: string): Promise<void> {
    const tokenData: TokenResponse = {
      access_token: token,
      refresh_token: '',
      token_type: 'bearer',
      expires_in: 3600,
      issued_at: new Date().toISOString()
    };
    this.storeTokenResponseSync(tokenData);
  }

  async removeToken(): Promise<void> {
    localStorage.removeItem(this.storageKey);
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
    this.storeTokenResponseSync(tokenResponse);
  }

  async getTokenResponse(): Promise<TokenResponse | null> {
    return this.getTokenResponseSync();
  }

  private storeTokenResponseSync(tokenResponse: TokenResponse): void {
    localStorage.setItem(this.storageKey, JSON.stringify(tokenResponse));
  }

  private getTokenResponseSync(): TokenResponse | null {
    const item = localStorage.getItem(this.storageKey);
    if (!item) return null;
    try {
      return JSON.parse(item);
    } catch (error) {
      return null;
    }
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
 * In-memory token storage (fallback for non-browser environments)
 */
export class MemoryTokenStorage implements TokenStorage {
  private tokenData: TokenResponse | null = null;

  async getToken(): Promise<string | null> {
    if (!this.tokenData) return null;

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
    this.tokenData = tokenResponse;
  }

  async getTokenResponse(): Promise<TokenResponse | null> {
    return this.tokenData;
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

export function createTokenStorage(): TokenStorage {
    if (typeof localStorage !== 'undefined') {
        return new BrowserTokenStorage();
    }
    return new MemoryTokenStorage();
}
