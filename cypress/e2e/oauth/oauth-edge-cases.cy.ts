describe('OAuth Edge Cases and Security Tests', () => {
  beforeEach(() => {
    cy.cleanupTestData()
    cy.clearAllLocalStorage()
    cy.clearAllCookies()
  })

  describe('Cross-Provider OAuth Scenarios', () => {
    it('should handle switching between OAuth providers', () => {
      cy.visit('/login')

      // Start with Google OAuth
      cy.mockOAuthSuccess('google')
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')
      cy.shouldBeOnDashboard()

      // Logout
      cy.logout()

      // Login with GitHub OAuth using same email
      cy.mockOAuthSuccess('github', {
        email: 'test@schlep-engine.com', // Same email as Google
        login: 'testuser'
      })

      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubOAuthSuccess')

      // Should prompt for account linking
      cy.get('[data-testid="link-oauth-accounts"]').should('be.visible')
      cy.get('[data-testid="confirm-link"]').click()

      cy.shouldBeOnDashboard()

      // Verify both providers are linked
      cy.visit('/dashboard/account')
      cy.get('[data-testid="linked-google"]').should('be.visible')
      cy.get('[data-testid="linked-github"]').should('be.visible')
    })

    it('should handle OAuth with different emails for same user', () => {
      // Create user with Google OAuth
      cy.createTestUser({
        email: 'google@test.com',
        oauth_provider: 'google',
        oauth_id: 'google_123'
      })

      cy.visit('/login')

      // Try to login with GitHub using different email
      cy.mockOAuthSuccess('github', {
        email: 'github@test.com', // Different email
        login: 'testuser'
      })

      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubOAuthSuccess')

      // Should create separate account
      cy.shouldBeOnDashboard()
      cy.get('[data-testid="user-email"]').should('contain.text', 'github@test.com')
    })

    it('should prevent OAuth account takeover', () => {
      // Create existing user with password
      cy.createTestUser({
        email: 'existing@test.com',
        password: 'hashed_password',
        oauth_provider: null
      })

      cy.visit('/login')

      // Attempt OAuth with same email
      cy.mockOAuthSuccess('google', {
        email: 'existing@test.com'
      })

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')

      // Should require password verification before linking
      cy.get('[data-testid="verify-account-password"]').should('be.visible')
      cy.get('[data-testid="password-verification"]').type('wrong_password')
      cy.get('[data-testid="verify-button"]').click()

      // Should show error for wrong password
      cy.get('[data-testid="password-error"]').should('be.visible')

      // Try with correct password
      cy.get('[data-testid="password-verification"]').clear().type('existing_password')
      cy.get('[data-testid="verify-button"]').click()

      // Should successfully link accounts
      cy.shouldBeOnDashboard()
    })
  })

  describe('OAuth Token Security', () => {
    it('should invalidate OAuth tokens on logout', () => {
      cy.visit('/login')

      cy.mockOAuthSuccess('google')
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')
      cy.shouldBeOnDashboard()

      // Mock token validation endpoint
      cy.intercept('POST', '**/api/v1/auth/validate-token', {
        statusCode: 200,
        body: { valid: true }
      }).as('tokenValid')

      // Verify token is valid
      cy.request({
        method: 'POST',
        url: '/api/v1/auth/validate-token',
        headers: {
          'Authorization': 'Bearer mock_jwt_access_token'
        }
      }).then((response) => {
        expect(response.status).to.equal(200)
      })

      // Logout
      cy.intercept('POST', '**/api/v1/auth/logout', {
        statusCode: 200,
        body: { success: true }
      }).as('logout')

      cy.logout()
      cy.wait('@logout')

      // Mock token validation to return invalid
      cy.intercept('POST', '**/api/v1/auth/validate-token', {
        statusCode: 401,
        body: { valid: false, error: 'Token revoked' }
      }).as('tokenInvalid')

      // Verify token is now invalid
      cy.request({
        method: 'POST',
        url: '/api/v1/auth/validate-token',
        headers: {
          'Authorization': 'Bearer mock_jwt_access_token'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(401)
      })
    })

    it('should handle OAuth token tampering', () => {
      cy.visit('/login')

      cy.mockOAuthSuccess('google')
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')

      // Tamper with stored token
      cy.window().then((win) => {
        const tamperedToken = 'tampered.jwt.token'
        win.localStorage.setItem('access_token', tamperedToken)
      })

      // Try to access protected resource
      cy.intercept('GET', '**/api/v1/auth/me', {
        statusCode: 401,
        body: { error: 'Invalid token signature' }
      }).as('invalidToken')

      cy.visit('/dashboard/profile')
      cy.wait('@invalidToken')

      // Should redirect to login
      cy.shouldBeOnLoginPage()
      cy.get('[data-testid="session-expired"]').should('be.visible')
    })

    it('should enforce OAuth token expiration', () => {
      cy.visit('/login')

      // Mock OAuth success with short-lived token
      cy.intercept('POST', '**/api/v1/auth/oauth/google/callback', {
        statusCode: 200,
        body: {
          success: true,
          access_token: 'short_lived_token',
          refresh_token: 'refresh_token',
          expires_in: 1 // 1 second expiry
        }
      }).as('shortLivedToken')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@shortLivedToken')
      cy.shouldBeOnDashboard()

      // Wait for token to expire
      cy.wait(2000)

      // Mock expired token response
      cy.intercept('GET', '**/api/v1/auth/me', {
        statusCode: 401,
        body: { error: 'Token expired' }
      }).as('expiredToken')

      // Mock token refresh
      cy.intercept('POST', '**/api/v1/auth/refresh', {
        statusCode: 200,
        body: {
          access_token: 'new_access_token',
          expires_in: 3600
        }
      }).as('tokenRefresh')

      // Try to access API
      cy.visit('/dashboard/settings')
      cy.wait('@expiredToken')
      cy.wait('@tokenRefresh')

      // Should successfully load with new token
      cy.get('[data-testid="settings-content"]').should('be.visible')
    })
  })

  describe('OAuth Race Conditions', () => {
    it('should handle concurrent OAuth login attempts', () => {
      cy.visit('/login')

      cy.mockOAuthSuccess('google')

      // Simulate rapid clicks
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.get('[data-testid="google-oauth-button"]').click()

      // Should only process one OAuth flow
      cy.wait('@googleOAuthSuccess')
      cy.shouldBeOnDashboard()

      // Verify only one session exists
      cy.getAllLocalStorage().then((localStorage) => {
        const tokens = Object.keys(localStorage['http://localhost:3000'] || {})
          .filter(key => key.includes('token'))
        expect(tokens.length).to.be.lessThan(3)
      })
    })

    it('should handle OAuth callback race conditions', () => {
      cy.visit('/login')

      // Simulate multiple OAuth callbacks
      cy.intercept('POST', '**/api/v1/auth/oauth/google/callback', (req) => {
        // Add delay to simulate race condition
        req.reply({
          delay: Math.random() * 1000,
          statusCode: 200,
          body: {
            success: true,
            access_token: 'race_condition_token',
            user: { id: 'user_123', email: 'test@test.com' }
          }
        })
      }).as('racyOAuthCallback')

      cy.get('[data-testid="google-oauth-button"]').click()

      // Simulate multiple callbacks
      cy.visit('/auth/callback/google?code=code1&state=state1')
      cy.visit('/auth/callback/google?code=code2&state=state2')

      cy.wait('@racyOAuthCallback')

      // Should handle gracefully without duplicate sessions
      cy.shouldBeOnDashboard()
    })
  })

  describe('OAuth Provider Edge Cases', () => {
    it('should handle OAuth provider maintenance mode', () => {
      cy.visit('/login')

      // Mock OAuth provider in maintenance
      cy.intercept('GET', '**/auth/google**', {
        statusCode: 503,
        body: '<!DOCTYPE html><html><body>Service Temporarily Unavailable</body></html>'
      }).as('providerMaintenance')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@providerMaintenance')

      cy.shouldShowOAuthError('Google authentication is temporarily unavailable')
      cy.get('[data-testid="maintenance-notice"]').should('be.visible')
      cy.get('[data-testid="use-alternative-login"]').should('be.visible')
    })

    it('should handle OAuth with unverified email from provider', () => {
      cy.visit('/login')

      // Mock OAuth with unverified email
      cy.mockOAuthSuccess('google', {
        email: 'unverified@test.com',
        email_verified: false
      })

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')

      // Should prompt for email verification
      cy.get('[data-testid="email-verification-required"]').should('be.visible')
      cy.get('[data-testid="resend-verification"]').should('be.visible')

      // Should not allow full access until verified
      cy.visit('/dashboard/settings')
      cy.get('[data-testid="verify-email-banner"]').should('be.visible')
    })

    it('should handle OAuth with missing required fields', () => {
      cy.visit('/login')

      // Mock OAuth response missing required fields
      cy.intercept('POST', '**/api/v1/auth/oauth/google/callback', {
        statusCode: 400,
        body: {
          success: false,
          error: 'missing_required_field',
          error_description: 'Email address is required but not provided by OAuth provider'
        }
      }).as('missingFields')

      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@missingFields')

      cy.shouldShowOAuthError('Required information not available')
      cy.get('[data-testid="complete-profile-manually"]').should('be.visible')
    })
  })

  describe('OAuth Security Compliance', () => {
    it('should comply with PKCE security extension', () => {
      cy.visit('/login')

      // Verify PKCE parameters are generated
      cy.window().then((win) => {
        // Mock code verifier generation
        const codeVerifier = 'test_code_verifier_123'
        const codeChallenge = 'test_code_challenge_456'

        win.sessionStorage.setItem('oauth_code_verifier', codeVerifier)

        // Mock OAuth request with PKCE
        cy.intercept('GET', '**/auth/google**', (req) => {
          expect(req.url).to.include('code_challenge=' + codeChallenge)
          expect(req.url).to.include('code_challenge_method=S256')

          req.reply({
            statusCode: 302,
            headers: {
              'Location': 'http://localhost:3000/auth/callback/google?code=pkce_code&state=state'
            }
          })
        }).as('pkceOAuthRequest')

        cy.get('[data-testid="google-oauth-button"]').click()
        cy.wait('@pkceOAuthRequest')
      })
    })

    it('should enforce secure redirect URI validation', () => {
      cy.visit('/login')

      // Attempt OAuth with invalid redirect URI
      cy.visit('/auth/callback/google?code=valid_code&state=valid_state&redirect_uri=http://malicious.com')

      // Should reject insecure redirect
      cy.shouldShowOAuthError('Invalid redirect URI')
      cy.shouldBeOnLoginPage()
    })

    it('should log OAuth security events', () => {
      cy.visit('/login')

      // Mock security event logging
      cy.intercept('POST', '**/api/v1/audit/security-event', {
        statusCode: 201,
        body: { logged: true }
      }).as('securityEventLogged')

      cy.mockOAuthSuccess('google')
      cy.get('[data-testid="google-oauth-button"]').click()
      cy.wait('@googleOAuthSuccess')

      // Verify security events are logged
      cy.wait('@securityEventLogged')

      cy.shouldBeOnDashboard()
    })
  })

  afterEach(() => {
    cy.cleanupTestData()
  })
})