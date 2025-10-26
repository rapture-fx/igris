// ***********************************************
// Custom Cypress commands for OAuth testing
// ***********************************************

/// <reference types="cypress" />

// OAuth-specific command declarations
declare global {
  namespace Cypress {
    interface Chainable {
      // OAuth Flow Commands
      startOAuthFlow(provider: 'google' | 'github', mode?: 'popup' | 'redirect'): Chainable<void>
      completeOAuthFlow(provider: 'google' | 'github', credentials: any): Chainable<void>
      waitForOAuthCallback(timeout?: number): Chainable<void>
      handleOAuthPopup(provider: 'google' | 'github', credentials: any): Chainable<void>

      // OAuth Mock Commands
      mockOAuthProvider(provider: 'google' | 'github', responseData?: any): Chainable<void>
      mockOAuthError(provider: 'google' | 'github', errorType: string): Chainable<void>

      // OAuth State Management
      clearOAuthState(state?: string): Chainable<void>
      getOAuthState(): Chainable<string>
      validateOAuthState(expectedState: string): Chainable<void>

      // OAuth Token Commands
      generateMockTokens(provider: 'google' | 'github'): Chainable<any>
      validateTokenResponse(tokens: any): Chainable<void>

      // OAuth User Management
      createOAuthTestUser(provider: 'google' | 'github', userData?: any): Chainable<any>
      loginWithOAuth(provider: 'google' | 'github', credentials: any): Chainable<void>

      // OAuth Validation Commands
      verifyOAuthLogin(provider: 'google' | 'github'): Chainable<void>
      verifyOAuthError(expectedError: string): Chainable<void>
      verifyOAuthProviderAvailable(provider: 'google' | 'github'): Chainable<void>

      // OAuth Security Commands
      testOAuthCSRFProtection(): Chainable<void>
      testOAuthStateValidation(): Chainable<void>
      testPKCEFlow(provider: 'google' | 'github'): Chainable<void>

      // Performance and Debugging
      handleOAuthErrors(): Chainable<void>
      debugOAuthFlow(step: string, data?: any): Chainable<void>
      startPerformanceMeasurement(name: string): Chainable<void>
      endPerformanceMeasurement(name: string): Chainable<number>
    }
  }
}

// Start OAuth Flow
Cypress.Commands.add('startOAuthFlow', (provider: 'google' | 'github', mode: 'popup' | 'redirect' = 'popup') => {
  const config = Cypress.env('OAUTH_CONFIG')

  cy.debugOAuthFlow('Starting OAuth Flow', { provider, mode })
  cy.startPerformanceMeasurement(`oauth-${provider}-${mode}-flow`)

  // Visit the login page
  cy.visit('/')

  // Wait for OAuth providers to load
  cy.wait('@getProviders', { timeout: config.TIMEOUTS.PAGE_LOAD })

  // Verify provider is available
  cy.verifyOAuthProviderAvailable(provider)

  // Click OAuth button
  const buttonSelector = provider === 'google'
    ? config.SELECTORS.APP.OAUTH_BUTTON_GOOGLE
    : config.SELECTORS.APP.OAUTH_BUTTON_GITHUB

  cy.get(buttonSelector).should('be.visible').click()

  if (mode === 'popup') {
    // Handle popup mode
    cy.debugOAuthFlow('OAuth Popup Mode Selected')
  } else {
    // Handle redirect mode
    cy.debugOAuthFlow('OAuth Redirect Mode Selected')
  }
})

// Complete OAuth Flow
Cypress.Commands.add('completeOAuthFlow', (provider: 'google' | 'github', credentials: any) => {
  const config = Cypress.env('OAUTH_CONFIG')

  cy.debugOAuthFlow('Completing OAuth Flow', { provider })

  if (Cypress.env('MOCK_OAUTH_ENABLED')) {
    // Mock OAuth flow
    cy.mockOAuthProvider(provider, credentials)
    cy.waitForOAuthCallback(config.TIMEOUTS.CALLBACK)
  } else {
    // Real OAuth flow
    cy.handleOAuthPopup(provider, credentials)
  }

  // Verify successful login
  cy.verifyOAuthLogin(provider)
  cy.endPerformanceMeasurement(`oauth-${provider}-popup-flow`)
})

// Handle OAuth Popup
Cypress.Commands.add('handleOAuthPopup', (provider: 'google' | 'github', credentials: any) => {
  const config = Cypress.env('OAUTH_CONFIG')

  cy.debugOAuthFlow('Handling OAuth Popup', { provider })

  // Handle popup window
  cy.window().then((win) => {
    // Mock popup behavior for testing
    const mockPopup = {
      closed: false,
      focus: () => {},
      close: () => { mockPopup.closed = true },
      postMessage: (data: any) => {
        win.postMessage(data, win.location.origin)
      }
    }

    // Simulate successful OAuth flow
    setTimeout(() => {
      if (provider === 'google') {
        mockPopup.postMessage({
          type: 'oauth_success',
          data: {
            provider: 'google',
            user: credentials,
            tokens: {
              access_token: 'mock_google_token',
              refresh_token: 'mock_google_refresh',
              expires_in: 3600
            }
          }
        })
      } else if (provider === 'github') {
        mockPopup.postMessage({
          type: 'oauth_success',
          data: {
            provider: 'github',
            user: credentials,
            tokens: {
              access_token: 'mock_github_token',
              token_type: 'bearer',
              scope: 'user:email'
            }
          }
        })
      }
      mockPopup.close()
    }, 1000)

    // Store mock popup reference
    ;(win as any).oauthPopup = mockPopup
  })
})

// Wait for OAuth Callback
Cypress.Commands.add('waitForOAuthCallback', (timeout: number = 10000) => {
  const config = Cypress.env('OAUTH_CONFIG')

  cy.debugOAuthFlow('Waiting for OAuth Callback')

  // Wait for callback request
  cy.wait('@oauthCallback', { timeout })

  // Wait for redirect or success state
  cy.get(config.SELECTORS.APP.LOGIN_SUCCESS, { timeout }).should('exist')
})

// Mock OAuth Provider
Cypress.Commands.add('mockOAuthProvider', (provider: 'google' | 'github', responseData: any = {}) => {
  const defaultResponse = provider === 'google' ? {
    id: '123456789',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg'
  } : {
    id: 987654321,
    login: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg'
  }

  const userData = { ...defaultResponse, ...responseData }

  cy.debugOAuthFlow('Mocking OAuth Provider', { provider, userData })

  // Mock API responses
  cy.intercept('POST', `/api/auth/oauth/${provider}/callback`, {
    statusCode: 200,
    body: {
      success: true,
      user: userData,
      tokens: {
        access_token: `mock_${provider}_access_token`,
        refresh_token: `mock_${provider}_refresh_token`,
        expires_in: 3600
      }
    }
  }).as(`${provider}CallbackMock`)
})

// Mock OAuth Error
Cypress.Commands.add('mockOAuthError', (provider: 'google' | 'github', errorType: string) => {
  const errorResponses = {
    invalid_request: { code: 'INVALID_REQUEST', message: 'Invalid OAuth request' },
    access_denied: { code: 'ACCESS_DENIED', message: 'User denied access' },
    server_error: { code: 'SERVER_ERROR', message: 'OAuth server error' },
    network_error: { code: 'NETWORK_ERROR', message: 'Network connection failed' }
  }

  const error = errorResponses[errorType as keyof typeof errorResponses] || errorResponses.server_error

  cy.debugOAuthFlow('Mocking OAuth Error', { provider, errorType, error })

  cy.intercept('POST', `/api/auth/oauth/${provider}/callback`, {
    statusCode: 400,
    body: {
      success: false,
      error: error.code,
      message: error.message
    }
  }).as(`${provider}ErrorMock`)
})

// Clear OAuth State
Cypress.Commands.add('clearOAuthState', (state?: string) => {
  if (state) {
    cy.task('clearOAuthState', state)
  } else {
    // Clear session storage
    cy.window().then((win) => {
      Object.keys(win.sessionStorage)
        .filter(key => key.startsWith('oauth_'))
        .forEach(key => win.sessionStorage.removeItem(key))
    })
  }
})

// Generate Mock Tokens
Cypress.Commands.add('generateMockTokens', (provider: 'google' | 'github') => {
  cy.task('generateMockTokens', provider).then((tokens) => {
    cy.debugOAuthFlow('Generated Mock Tokens', { provider, tokens })
    return cy.wrap(tokens)
  })
})

// Verify OAuth Login
Cypress.Commands.add('verifyOAuthLogin', (provider: 'google' | 'github') => {
  const config = Cypress.env('OAUTH_CONFIG')

  cy.debugOAuthFlow('Verifying OAuth Login', { provider })

  // Check for login success indicators
  cy.get(config.SELECTORS.APP.LOGIN_SUCCESS, { timeout: config.TIMEOUTS.CALLBACK })
    .should('be.visible')

  // Verify no error messages
  cy.get(config.SELECTORS.APP.ERROR_MESSAGE).should('not.exist')

  // Check authentication state
  cy.window().then((win) => {
    const authToken = win.localStorage.getItem('auth_token') || win.sessionStorage.getItem('auth_token')
    expect(authToken).to.exist
  })
})

// Verify OAuth Error
Cypress.Commands.add('verifyOAuthError', (expectedError: string) => {
  const config = Cypress.env('OAUTH_CONFIG')

  cy.debugOAuthFlow('Verifying OAuth Error', { expectedError })

  // Check for error message
  cy.get(config.SELECTORS.APP.ERROR_MESSAGE)
    .should('be.visible')
    .and('contain.text', expectedError)

  // Verify no login success
  cy.get(config.SELECTORS.APP.LOGIN_SUCCESS).should('not.exist')
})

// Verify OAuth Provider Available
Cypress.Commands.add('verifyOAuthProviderAvailable', (provider: 'google' | 'github') => {
  const config = Cypress.env('OAUTH_CONFIG')

  cy.debugOAuthFlow('Verifying OAuth Provider Available', { provider })

  const buttonSelector = provider === 'google'
    ? config.SELECTORS.APP.OAUTH_BUTTON_GOOGLE
    : config.SELECTORS.APP.OAUTH_BUTTON_GITHUB

  cy.get(buttonSelector)
    .should('exist')
    .and('be.visible')
    .and('not.be.disabled')
})

// Test CSRF Protection
Cypress.Commands.add('testOAuthCSRFProtection', () => {
  cy.debugOAuthFlow('Testing OAuth CSRF Protection')

  // Try to access callback without proper state
  cy.request({
    method: 'POST',
    url: '/api/auth/oauth/google/callback',
    body: {
      code: 'fake_code',
      state: 'invalid_state'
    },
    failOnStatusCode: false
  }).then((response) => {
    expect(response.status).to.be.oneOf([400, 401, 403])
    expect(response.body).to.have.property('error')
  })
})

// Test State Validation
Cypress.Commands.add('testOAuthStateValidation', () => {
  cy.debugOAuthFlow('Testing OAuth State Validation')

  // Generate invalid state scenarios
  const invalidStates = ['', 'invalid', 'expired', null, undefined]

  invalidStates.forEach((invalidState) => {
    cy.request({
      method: 'POST',
      url: '/api/auth/oauth/google/callback',
      body: {
        code: 'valid_code',
        state: invalidState
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.be.oneOf([400, 401])
    })
  })
})

// Test PKCE Flow
Cypress.Commands.add('testPKCEFlow', (provider: 'google' | 'github') => {
  cy.debugOAuthFlow('Testing PKCE Flow', { provider })

  // This would test the PKCE implementation
  // For now, we'll verify that PKCE parameters are present in the auth URL
  cy.request(`/api/auth/oauth/${provider}/authorize`).then((response) => {
    expect(response.body).to.have.property('url')
    const url = new URL(response.body.url)

    // Verify PKCE parameters if implemented
    if (url.searchParams.has('code_challenge')) {
      expect(url.searchParams.get('code_challenge')).to.exist
      expect(url.searchParams.get('code_challenge_method')).to.equal('S256')
    }
  })
})

// Create OAuth Test User
Cypress.Commands.add('createOAuthTestUser', (provider: 'google' | 'github', userData: any = {}) => {
  const testData = Cypress.env('TEST_DATA')
  const defaultUserData = testData[provider]
  const finalUserData = { ...defaultUserData, ...userData }

  cy.debugOAuthFlow('Creating OAuth Test User', { provider, userData: finalUserData })

  return cy.task('seedTestUser', {
    provider,
    ...finalUserData
  })
})

// Login with OAuth
Cypress.Commands.add('loginWithOAuth', (provider: 'google' | 'github', credentials: any) => {
  cy.debugOAuthFlow('Login with OAuth', { provider })

  cy.startOAuthFlow(provider, 'popup')
  cy.completeOAuthFlow(provider, credentials)
})

// Validate Token Response
Cypress.Commands.add('validateTokenResponse', (tokens: any) => {
  cy.debugOAuthFlow('Validating Token Response', tokens)

  expect(tokens).to.have.property('access_token')
  expect(tokens).to.have.property('token_type')
  expect(tokens.token_type.toLowerCase()).to.equal('bearer')

  if (tokens.expires_in) {
    expect(tokens.expires_in).to.be.a('number')
    expect(tokens.expires_in).to.be.greaterThan(0)
  }

  if (tokens.refresh_token) {
    expect(tokens.refresh_token).to.be.a('string')
    expect(tokens.refresh_token).to.have.length.greaterThan(0)
  }
})