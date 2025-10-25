describe('GitHub OAuth Authentication', () => {
  beforeEach(() => {
    cy.cleanupTestData()
    cy.clearAllLocalStorage()
    cy.clearAllCookies()
  })

  describe('Successful OAuth Flow', () => {
    it('should successfully authenticate with GitHub OAuth', () => {
      cy.visit('/login')

      cy.mockOAuthSuccess('github')

      // Performance timing
      cy.window().then((win) => {
        win.performance.mark('github-oauth-start')
      })

      cy.get('[data-testid="github-oauth-button"]').should('be.visible')
      cy.get('[data-testid="github-oauth-button"]').click()

      // Verify GitHub OAuth redirect
      cy.url().should('match', /github\.com|localhost.*github/)

      cy.wait('@githubOAuthSuccess')

      // End performance measurement
      cy.window().then((win) => {
        win.performance.mark('github-oauth-end')
        win.performance.measure('github-oauth-duration', 'github-oauth-start', 'github-oauth-end')

        const measures = win.performance.getEntriesByType('measure')
        const githubMeasure = measures.find(m => m.name === 'github-oauth-duration')

        if (githubMeasure) {
          cy.log(`GitHub OAuth took ${githubMeasure.duration.toFixed(2)}ms`)
          expect(githubMeasure.duration).to.be.lessThan(Cypress.env('MAX_OAUTH_CALLBACK_TIME'))
        }
      })

      cy.shouldBeOnDashboard()

      // Verify GitHub-specific user data
      cy.wait('@userProfile')
      cy.get('[data-testid="user-avatar"]').should('be.visible')
      cy.get('[data-testid="user-name"]').should('contain.text', 'Test User')
      cy.get('[data-testid="auth-provider"]').should('contain.text', 'GitHub')
      cy.get('[data-testid="github-username"]').should('contain.text', 'testuser')
    })

    it('should handle GitHub OAuth with organization membership', () => {
      cy.visit('/login')

      // Mock GitHub OAuth with organization data
      cy.mockOAuthSuccess('github', {
        login: 'testuser',
        email: 'test@schlep-engine.com',
        name: 'Test User',
        organizations: ['schlep-engine-org']
      })

      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubOAuthSuccess')

      cy.shouldBeOnDashboard()

      // Verify organization information is displayed
      cy.get('[data-testid="user-organizations"]').should('contain.text', 'schlep-engine-org')
    })

    it('should handle GitHub OAuth without public email', () => {
      cy.visit('/login')

      // Mock GitHub user with private email
      cy.intercept('GET', '**/user', {
        statusCode: 200,
        body: {
          id: 12345,
          login: 'testuser',
          name: 'Test User',
          email: null, // No public email
          avatar_url: 'https://github.com/images/error/octocat_happy.gif'
        }
      }).as('githubUserNoEmail')

      // Mock GitHub emails API to get primary email
      cy.intercept('GET', '**/user/emails', {
        statusCode: 200,
        body: [
          {
            email: 'test@schlep-engine.com',
            primary: true,
            verified: true,
            visibility: 'private'
          }
        ]
      }).as('githubEmails')

      cy.mockOAuthSuccess('github')

      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubUserNoEmail')
      cy.wait('@githubEmails')
      cy.wait('@githubOAuthSuccess')

      cy.shouldBeOnDashboard()
      cy.get('[data-testid="user-email"]').should('contain.text', 'test@schlep-engine.com')
    })
  })

  describe('GitHub OAuth Error Scenarios', () => {
    it('should handle GitHub OAuth access denied', () => {
      cy.visit('/login')

      cy.mockOAuthError('github', 'access_denied')

      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubAccessDenied')

      cy.shouldShowOAuthError('Access was denied')
      cy.get('[data-testid="try-again-button"]').should('be.visible')
      cy.shouldBeOnLoginPage()
    })

    it('should handle GitHub OAuth application suspended', () => {
      cy.visit('/login')

      // Mock GitHub OAuth application suspended error
      cy.intercept('POST', '**/login/oauth/access_token', {
        statusCode: 403,
        body: {
          error: 'application_suspended',
          error_description: 'The OAuth application has been suspended'
        }
      }).as('githubAppSuspended')

      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubAppSuspended')

      cy.shouldShowOAuthError('GitHub authentication is temporarily unavailable')
      cy.get('[data-testid="use-email-login"]').should('be.visible')
    })

    it('should handle GitHub rate limiting', () => {
      cy.visit('/login')

      // Mock GitHub API rate limiting
      cy.intercept('GET', '**/user', {
        statusCode: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() / 1000 + 3600).toString()
        },
        body: {
          message: 'API rate limit exceeded'
        }
      }).as('githubRateLimit')

      cy.mockOAuthSuccess('github')
      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubRateLimit')

      cy.shouldShowOAuthError('GitHub is experiencing high traffic')
      cy.get('[data-testid="try-again-later"]').should('be.visible')
    })

    it('should handle GitHub OAuth scope restrictions', () => {
      cy.visit('/login')

      // Mock insufficient OAuth scopes
      cy.intercept('GET', '**/user/emails', {
        statusCode: 403,
        body: {
          message: 'Missing required scope: user:email'
        }
      }).as('githubInsufficientScope')

      cy.mockOAuthSuccess('github')
      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubInsufficientScope')

      cy.shouldShowOAuthError('Additional permissions required')
      cy.get('[data-testid="grant-email-permission"]').should('be.visible')
    })
  })

  describe('GitHub OAuth Security Tests', () => {
    it('should validate GitHub OAuth state parameter', () => {
      cy.visit('/login')

      // Attempt callback with invalid state
      cy.visit('/auth/callback/github?code=valid_code&state=invalid_state')

      cy.shouldShowOAuthError('Invalid request')
      cy.shouldBeOnLoginPage()
    })

    it('should handle GitHub OAuth CSRF protection', () => {
      cy.visit('/login')

      // Mock CSRF token mismatch
      cy.intercept('POST', '**/api/v1/auth/oauth/github/callback', {
        statusCode: 403,
        body: {
          success: false,
          error: 'csrf_token_mismatch',
          error_description: 'CSRF token validation failed'
        }
      }).as('githubCSRFError')

      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubCSRFError')

      cy.shouldShowOAuthError('Security validation failed')
      cy.get('[data-testid="refresh-page-button"]').should('be.visible')
    })

    it('should validate GitHub webhook signatures', () => {
      // This would test webhook signature validation for GitHub Apps
      cy.request({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'X-GitHub-Event': 'ping',
          'X-Hub-Signature-256': 'invalid-signature'
        },
        body: { zen: 'Non-blocking is better than blocking.' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(401)
        expect(response.body).to.have.property('error', 'Invalid signature')
      })
    })
  })

  describe('GitHub OAuth Integration Tests', () => {
    it('should sync GitHub repositories after OAuth', () => {
      cy.visit('/login')

      // Mock GitHub repositories API
      cy.intercept('GET', '**/user/repos', {
        statusCode: 200,
        body: [
          {
            id: 1,
            name: 'test-repo',
            full_name: 'testuser/test-repo',
            private: false,
            html_url: 'https://github.com/testuser/test-repo'
          }
        ]
      }).as('githubRepos')

      cy.mockOAuthSuccess('github')
      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubOAuthSuccess')

      // Navigate to integrations page
      cy.visit('/dashboard/integrations')
      cy.get('[data-testid="sync-github-repos"]').click()

      cy.wait('@githubRepos')

      // Verify repositories are displayed
      cy.get('[data-testid="github-repository"]').should('contain.text', 'test-repo')
    })

    it('should handle GitHub OAuth token refresh for API calls', () => {
      cy.visit('/login')

      cy.mockOAuthSuccess('github')
      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubOAuthSuccess')

      // Mock expired GitHub token
      cy.intercept('GET', '**/user/repos', {
        statusCode: 401,
        body: {
          message: 'Bad credentials'
        }
      }).as('githubTokenExpired')

      // Mock token refresh
      cy.intercept('POST', '**/api/v1/auth/oauth/github/refresh', {
        statusCode: 200,
        body: {
          access_token: 'new_github_token',
          scope: 'user:email repo'
        }
      }).as('githubTokenRefresh')

      // Retry API call with new token
      cy.intercept('GET', '**/user/repos', {
        statusCode: 200,
        body: []
      }).as('githubReposRetry')

      cy.visit('/dashboard/integrations')
      cy.get('[data-testid="sync-github-repos"]').click()

      cy.wait('@githubTokenExpired')
      cy.wait('@githubTokenRefresh')
      cy.wait('@githubReposRetry')

      cy.get('[data-testid="sync-success"]').should('be.visible')
    })
  })

  describe('GitHub OAuth Performance Tests', () => {
    it('should handle GitHub OAuth with large organization membership', () => {
      cy.visit('/login')

      // Mock user with many organizations
      const organizations = Array.from({ length: 50 }, (_, i) => `org-${i}`)

      cy.mockOAuthSuccess('github', {
        login: 'testuser',
        email: 'test@schlep-engine.com',
        name: 'Test User',
        organizations
      })

      const startTime = Date.now()

      cy.get('[data-testid="github-oauth-button"]').click()
      cy.wait('@githubOAuthSuccess')
      cy.shouldBeOnDashboard()

      cy.then(() => {
        const duration = Date.now() - startTime
        cy.log(`GitHub OAuth with 50 orgs took ${duration}ms`)

        // Should still be within performance threshold
        expect(duration).to.be.lessThan(Cypress.env('MAX_OAUTH_CALLBACK_TIME') * 2)
      })
    })

    it('should timeout GitHub OAuth gracefully', () => {
      cy.visit('/login')

      // Mock slow GitHub OAuth response
      cy.intercept('POST', '**/api/v1/auth/oauth/github/callback', {
        delay: 10000, // 10 second delay
        statusCode: 200,
        body: { success: true }
      }).as('slowGithubOAuth')

      cy.get('[data-testid="github-oauth-button"]').click()

      // Should show loading state
      cy.get('[data-testid="oauth-loading"]').should('be.visible')

      // Should timeout and show error after 5 seconds
      cy.get('[data-testid="oauth-timeout-error"]', { timeout: 6000 }).should('be.visible')
      cy.get('[data-testid="try-again-button"]').should('be.visible')
    })
  })

  afterEach(() => {
    cy.cleanupTestData()
  })
})