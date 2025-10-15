describe('Google OAuth Authentication', () => {
  beforeEach(() => {
    // Clean up before each test
    cy.cleanupTestData()
    cy.clearAllLocalStorage()
    cy.clearAllCookies()
  })

  describe('Successful OAuth Flow', () => {
    it('should successfully authenticate with Google OAuth', () => {
      cy.visit('/login')

      // Set up successful OAuth mock
      cy.mockOAuthSuccess('google')

      // Start performance measurement
      cy.window().then((win) => {
        win.performance.mark('oauth-start')
      })

      // Click Google OAuth button
      cy.get('[data-testid="google-oauth-button"]').should('be.visible')
      cy.get('[data-testid="google-oauth-button"]').click()

      // Verify OAuth redirect
      cy.url().should('match', /google\.com|localhost.*google/)

      // Complete OAuth flow (mocked)
      cy.wait('@googleOAuthSuccess')

      // End performance measurement
      cy.window().then((win) => {
        win.performance.mark('oauth-end')
        win.performance.measure('oauth-duration', 'oauth-start', 'oauth-end')

        const measures = win.performance.getEntriesByType('measure')
        const oauthMeasure = measures.find(m => m.name === 'oauth-duration')

        if (oauthMeasure) {
          cy.log(`Google OAuth took ${oauthMeasure.duration.toFixed(2)}ms`)
          expect(oauthMeasure.duration).to.be.lessThan(Cypress.env('MAX_OAUTH_CALLBACK_TIME'))
        }
      })

      // Verify successful login
      cy.shouldBeOnDashboard()

      // Verify user data is loaded
      cy.wait('@userProfile')
      cy.get('[data-testid="user-avatar"]').should('be.visible')
      cy.get('[data-testid="user-name"]').should('contain.text', 'Test User')

      // Verify OAuth provider is displayed
      cy.get('[data-testid="auth-provider"]').should('contain.text', 'Google')
    })

    it('should handle Google OAuth with existing account linking', () => {
      // Create existing user with email
      cy.createTestUser({
        email: 'test@schlep-engine.com',
        name: 'Existing User',
        oauth_provider: null
      })

      cy.visit('/login')

      // Mock successful OAuth with existing email
      cy.mockOAuthSuccess('google', {
        email: 'test@schlep-engine.com',
        name: 'Test User via Google'
      })

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')

      // Should show account linking prompt
      cy.get('[data-testid="account-linking-dialog"]').should('be.visible')
      cy.get('[data-testid="link-accounts-button"]').click()

      // Verify successful account linking
      cy.shouldBeOnDashboard()
      cy.get('[data-testid="auth-provider"]').should('contain.text', 'Google')
    })

    it('should preserve redirect URL after OAuth login', () => {
      const protectedUrl = '/dashboard/settings'

      // Try to access protected page
      cy.visit(protectedUrl)

      // Should redirect to login with return URL
      cy.shouldBeOnLoginPage()
      cy.url().should('include', `redirect=${encodeURIComponent(protectedUrl)}`)

      // Login with Google OAuth
      cy.mockOAuthSuccess('google')
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')

      // Should redirect to original protected page
      cy.url().should('include', protectedUrl)
    })
  })

  describe('OAuth Error Scenarios', () => {
    it('should handle Google OAuth access denied', () => {
      cy.visit('/login')

      // Mock access denied error
      cy.mockOAuthError('google', 'access_denied')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleAccessDenied')

      // Should show appropriate error message
      cy.shouldShowOAuthError('Access was denied')
      cy.get('[data-testid="try-again-button"]').should('be.visible')

      // User should still be on login page
      cy.shouldBeOnLoginPage()
    })

    it('should handle invalid OAuth grant error', () => {
      cy.visit('/login')

      // Mock invalid grant error
      cy.mockOAuthError('google', 'invalid_grant')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthError')

      // Should show technical error message
      cy.shouldShowOAuthError('Authentication failed')
      cy.get('[data-testid="contact-support-link"]').should('be.visible')
    })

    it('should handle OAuth state mismatch (CSRF protection)', () => {
      cy.visit('/login')

      // Mock state mismatch by intercepting with wrong state
      cy.intercept('POST', '**/api/v1/auth/oauth/google/callback', {
        statusCode: 400,
        body: {
          success: false,
          error: 'invalid_state',
          error_description: 'OAuth state parameter mismatch'
        }
      }).as('googleStateMismatch')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleStateMismatch')

      // Should show security error
      cy.shouldShowOAuthError('Security validation failed')
      cy.get('[data-testid="refresh-page-button"]').should('be.visible')
    })

    it('should handle Google service unavailable', () => {
      cy.visit('/login')

      // Mock Google OAuth service unavailable
      cy.intercept('GET', '**/auth/google**', {
        statusCode: 503,
        body: 'Service Unavailable'
      }).as('googleServiceUnavailable')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleServiceUnavailable')

      // Should show service unavailable message
      cy.shouldShowOAuthError('Google authentication is temporarily unavailable')
      cy.get('[data-testid="use-email-login"]').should('be.visible')
    })
  })

  describe('OAuth Token Management', () => {
    beforeEach(() => {
      // Login with Google OAuth for token tests
      cy.visit('/login')
      cy.mockOAuthSuccess('google')
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')
      cy.shouldBeOnDashboard()
    })

    it('should handle OAuth token refresh', () => {
      // Mock token refresh endpoint
      cy.intercept('POST', '**/api/v1/auth/refresh', {
        statusCode: 200,
        body: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600
        }
      }).as('tokenRefresh')

      // Simulate token expiry by making API call that returns 401
      cy.intercept('GET', '**/api/v1/auth/me', {
        statusCode: 401,
        body: { error: 'Token expired' }
      }).as('tokenExpired')

      // Trigger API call that requires authentication
      cy.visit('/dashboard/profile')
      cy.wait('@tokenExpired')

      // Should automatically refresh token
      cy.wait('@tokenRefresh')

      // Should successfully load profile page
      cy.get('[data-testid="profile-content"]').should('be.visible')
    })

    it('should handle OAuth token revocation', () => {
      // Mock token revocation
      cy.intercept('POST', '**/api/v1/auth/revoke', {
        statusCode: 200,
        body: { success: true }
      }).as('tokenRevoked')

      // Revoke OAuth access
      cy.get('[data-testid="user-menu"]').click()
      cy.get('[data-testid="account-settings"]').click()
      cy.get('[data-testid="revoke-google-access"]').click()
      cy.get('[data-testid="confirm-revoke"]').click()

      cy.wait('@tokenRevoked')

      // Should redirect to login
      cy.shouldBeOnLoginPage()
      cy.get('[data-testid="oauth-revoked-message"]').should('be.visible')
    })
  })

  describe('OAuth Security Tests', () => {
    it('should prevent OAuth CSRF attacks', () => {
      cy.visit('/login')

      // Attempt OAuth callback without proper state parameter
      cy.visit('/auth/callback/google?code=malicious_code')

      // Should reject the request
      cy.shouldShowOAuthError('Invalid request')
      cy.shouldBeOnLoginPage()
    })

    it('should validate OAuth redirect URI', () => {
      cy.visit('/login')

      // Mock OAuth with invalid redirect URI
      cy.intercept('POST', '**/api/v1/auth/oauth/google/callback', {
        statusCode: 400,
        body: {
          success: false,
          error: 'invalid_redirect_uri',
          error_description: 'Redirect URI mismatch'
        }
      }).as('invalidRedirectUri')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@invalidRedirectUri')

      // Should show security error
      cy.shouldShowOAuthError('Invalid redirect')
    })

    it('should enforce OAuth scope validation', () => {
      cy.visit('/login')

      // Mock OAuth success with insufficient scopes
      cy.intercept('POST', '**/api/v1/auth/oauth/google/callback', {
        statusCode: 400,
        body: {
          success: false,
          error: 'insufficient_scope',
          error_description: 'Required scopes not granted'
        }
      }).as('insufficientScope')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@insufficientScope')

      // Should show scope error
      cy.shouldShowOAuthError('Additional permissions required')
      cy.get('[data-testid="retry-with-full-scope"]').should('be.visible')
    })
  })

  describe('OAuth Performance Tests', () => {
    it('should complete OAuth flow within performance thresholds', () => {
      cy.visit('/login')

      // Mock successful OAuth with timing
      cy.mockOAuthSuccess('google')

      // Measure complete OAuth flow
      const startTime = Date.now()

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')
      cy.shouldBeOnDashboard()

      cy.then(() => {
        const duration = Date.now() - startTime
        cy.log(`Complete OAuth flow took ${duration}ms`)

        // Assert performance threshold
        expect(duration).to.be.lessThan(Cypress.env('MAX_OAUTH_CALLBACK_TIME'))
      })
    })

    it('should handle concurrent OAuth attempts gracefully', () => {
      cy.visit('/login')

      // Set up multiple OAuth mocks
      cy.mockOAuthSuccess('google')

      // Simulate rapid button clicks
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.get('[data-testid="google-oauth-button"]').click()

      // Should only process one OAuth flow
      cy.wait('@googleOAuthSuccess')
      cy.shouldBeOnDashboard()

      // Verify no duplicate sessions
      cy.window().then((win) => {
        const tokens = Object.keys(win.localStorage).filter(key => key.includes('token'))
        expect(tokens).to.have.length.lessThan(3)
      })
    })
  })

  afterEach(() => {
    // Clean up after each test
    cy.cleanupTestData()
  })
})