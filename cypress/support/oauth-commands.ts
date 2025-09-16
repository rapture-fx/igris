// OAuth-specific Cypress commands for comprehensive testing

// Mock OAuth providers setup
Cypress.Commands.add('setupMockOAuthProviders', () => {
  // Mock Google OAuth endpoints
  cy.intercept('GET', '**/auth/google**', {
    statusCode: 302,
    headers: {
      'Location': 'http://localhost:3000/auth/callback/google?code=mock_code&state=mock_state'
    }
  }).as('googleOAuthRedirect')

  cy.intercept('POST', '**/oauth2/token', {
    statusCode: 200,
    body: {
      access_token: 'mock_google_access_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_google_refresh_token',
      scope: 'openid email profile'
    }
  }).as('googleTokenExchange')

  cy.intercept('GET', '**/oauth2/v2/userinfo', {
    statusCode: 200,
    body: {
      id: 'mock_google_user_id',
      email: 'test@schlep-engine.com',
      verified_email: true,
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      picture: 'https://example.com/avatar.jpg'
    }
  }).as('googleUserInfo')

  // Mock GitHub OAuth endpoints
  cy.intercept('GET', '**/login/oauth/authorize**', {
    statusCode: 302,
    headers: {
      'Location': 'http://localhost:3000/auth/callback/github?code=mock_github_code&state=mock_state'
    }
  }).as('githubOAuthRedirect')

  cy.intercept('POST', '**/login/oauth/access_token', {
    statusCode: 200,
    body: {
      access_token: 'mock_github_access_token',
      scope: 'user:email',
      token_type: 'bearer'
    }
  }).as('githubTokenExchange')

  cy.intercept('GET', '**/user', {
    statusCode: 200,
    body: {
      id: 12345,
      login: 'testuser',
      name: 'Test User',
      email: 'test@schlep-engine.com',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif'
    }
  }).as('githubUserInfo')
})

// Mock successful OAuth flow
Cypress.Commands.add('mockOAuthSuccess', (provider: 'google' | 'github', userData?: any) => {
  const defaultUserData = {
    google: {
      id: 'mock_google_user',
      email: 'test@schlep-engine.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg'
    },
    github: {
      id: 12345,
      login: 'testuser',
      email: 'test@schlep-engine.com',
      name: 'Test User',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif'
    }
  }

  const user = userData || defaultUserData[provider]

  // Mock successful OAuth callback
  cy.intercept('POST', `**/api/v1/auth/oauth/${provider}/callback`, {
    statusCode: 200,
    body: {
      success: true,
      user: {
        id: 'test-user-id',
        email: user.email,
        name: user.name,
        avatar: user.picture || user.avatar_url,
        oauth_provider: provider,
        role: 'user',
        is_verified: true
      },
      access_token: 'mock_jwt_access_token',
      refresh_token: 'mock_jwt_refresh_token',
      expires_in: 3600
    }
  }).as(`${provider}OAuthSuccess`)
})

// Mock OAuth error scenarios
Cypress.Commands.add('mockOAuthError', (provider: 'google' | 'github', error: string) => {
  cy.intercept('POST', `**/api/v1/auth/oauth/${provider}/callback`, {
    statusCode: 400,
    body: {
      success: false,
      error: error,
      error_description: `OAuth ${provider} authentication failed: ${error}`
    }
  }).as(`${provider}OAuthError`)

  // Mock OAuth provider errors
  if (error === 'access_denied') {
    cy.intercept('GET', `**/auth/${provider}**`, {
      statusCode: 302,
      headers: {
        'Location': `http://localhost:3000/auth/callback/${provider}?error=access_denied&error_description=User+denied+access`
      }
    }).as(`${provider}AccessDenied`)
  }

  if (error === 'invalid_grant') {
    cy.intercept('POST', '**/oauth2/token', {
      statusCode: 400,
      body: {
        error: 'invalid_grant',
        error_description: 'Invalid authorization code'
      }
    }).as(`${provider}InvalidGrant`)
  }
})

// Google OAuth login flow
Cypress.Commands.add('loginWithGoogle', () => {
  cy.visit('/login')

  // Set up successful OAuth mock
  cy.mockOAuthSuccess('google')

  // Click Google login button
  cy.get('[data-testid="google-oauth-button"]').click()

  // Handle OAuth popup/redirect
  cy.origin('accounts.google.com', () => {
    // This would handle the Google OAuth flow
    // In real testing, this would interact with Google's OAuth interface
    cy.url().should('include', 'accounts.google.com')
  })

  // Verify successful login
  cy.wait('@googleOAuthSuccess')
  cy.shouldBeOnDashboard()
})

// GitHub OAuth login flow
Cypress.Commands.add('loginWithGitHub', () => {
  cy.visit('/login')

  // Set up successful OAuth mock
  cy.mockOAuthSuccess('github')

  // Click GitHub login button
  cy.get('[data-testid="github-oauth-button"]').click()

  // Handle OAuth popup/redirect
  cy.origin('github.com', () => {
    // This would handle the GitHub OAuth flow
    cy.url().should('include', 'github.com')
  })

  // Verify successful login
  cy.wait('@githubOAuthSuccess')
  cy.shouldBeOnDashboard()
})

// Performance measurement for auth flows
Cypress.Commands.add('measureAuthPerformance', () => {
  let startTime: number

  cy.window().then((win) => {
    startTime = win.performance.now()
  })

  cy.window().then((win) => {
    const endTime = win.performance.now()
    const duration = endTime - startTime

    // Log performance metrics
    cy.log(`Authentication took ${duration.toFixed(2)}ms`)

    // Assert performance thresholds
    const maxTime = Cypress.env('MAX_LOGIN_TIME') || 5000
    expect(duration).to.be.lessThan(maxTime)

    return cy.wrap(duration)
  })
})