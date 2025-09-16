// Cypress E2E Support File
// This file is processed and loaded automatically before test files

import './commands'
import './oauth-commands'

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  // that might occur in the application under test
  console.warn('Uncaught exception:', err.message)

  // Don't fail on known OAuth redirect errors
  if (err.message.includes('oauth') || err.message.includes('redirect')) {
    return false
  }

  // Don't fail on network errors during OAuth flows
  if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
    return false
  }

  return true
})

// Custom before hooks for OAuth testing
beforeEach(() => {
  // Clear local storage and cookies before each test
  cy.clearAllLocalStorage()
  cy.clearAllCookies()

  // Set up API interceptors for monitoring
  cy.intercept('POST', '**/api/v1/auth/login', { fixture: 'auth/login-response.json' }).as('login')
  cy.intercept('POST', '**/api/v1/auth/oauth/**', { fixture: 'auth/oauth-response.json' }).as('oauthCallback')
  cy.intercept('GET', '**/api/v1/auth/me', { fixture: 'auth/user-profile.json' }).as('userProfile')

  // Mock OAuth providers if enabled
  if (Cypress.env('ENABLE_MOCK_OAUTH')) {
    cy.setupMockOAuthProviders()
  }
})

// Global test utilities
declare global {
  namespace Cypress {
    interface Chainable {
      // Authentication helpers
      loginWithCredentials(email: string, password: string): Chainable<void>
      loginWithGoogle(): Chainable<void>
      loginWithGitHub(): Chainable<void>
      logout(): Chainable<void>

      // OAuth-specific commands
      setupMockOAuthProviders(): Chainable<void>
      mockOAuthSuccess(provider: 'google' | 'github', userData?: any): Chainable<void>
      mockOAuthError(provider: 'google' | 'github', error: string): Chainable<void>

      // Test data management
      createTestUser(userData: any): Chainable<any>
      cleanupTestData(): Chainable<void>

      // Assertions
      shouldBeOnLoginPage(): Chainable<void>
      shouldBeOnDashboard(): Chainable<void>
      shouldShowOAuthError(message: string): Chainable<void>

      // Performance testing
      measureAuthPerformance(): Chainable<number>
    }
  }
}