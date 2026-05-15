import config from '../config'

export class TokenStorage {
  private static readonly AUTH_TOKEN_KEY = config.auth.tokenKey
  private static readonly REFRESH_TOKEN_KEY = config.auth.refreshKey

  static setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.AUTH_TOKEN_KEY, token)
    }
  }

  static getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.AUTH_TOKEN_KEY)
    }
    return null
  }

  static setRefreshToken(refreshToken: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken)
    }
  }

  static getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY)
    }
    return null
  }

  static removeTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.AUTH_TOKEN_KEY)
      localStorage.removeItem(this.REFRESH_TOKEN_KEY)
    }
  }

  static hasToken(): boolean {
    return this.getToken() !== null
  }

  static isTokenExpired(token?: string): boolean {
    const authToken = token || this.getToken()
    if (!authToken) return true

    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]))
      const currentTime = Date.now() / 1000
      return payload.exp < currentTime
    } catch {
      return true
    }
  }
}

export const tokenStorage = TokenStorage

export default TokenStorage