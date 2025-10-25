// ***********************************************************
// This support file is processed and loaded automatically before
// your test files for OAuth E2E testing.
// ***********************************************************

import './commands'
import '@cypress/code-coverage/support'

// Global configuration for OAuth testing
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore OAuth popup errors that don't affect the test
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  if (err.message.includes('Non-Error promise rejection captured')) {
    return false
  }
  if (err.message.includes('Script error')) {
    return false
  }
  // Don't fail tests on OAuth provider network errors during testing
  if (err.message.includes('NetworkError') || err.message.includes('CORS')) {
    return false
  }
  return true
})

// OAuth test configuration
const OAUTH_CONFIG = {
  TIMEOUTS: {
    PAGE_LOAD: 30000,
    POPUP: 15000,
    CALLBACK: 10000,
    TOKEN_EXCHANGE: 5000
  },
  SELECTORS: {
    GOOGLE: {
      LOGIN_FORM: '[data-testid="oauth-google-form"], #identifierNext, [data-identifier]',
      EMAIL_INPUT: 'input[type="email"], input[name="identifier"], #identifierId',
      PASSWORD_INPUT: 'input[type="password"], input[name="password"], #password',
      SUBMIT_BUTTON: 'button[type="submit"], #identifierNext, #passwordNext',
      CONSENT_BUTTON: '[data-testid="consent"], #submit_approve_access'
    },
    GITHUB: {
      LOGIN_FORM: '[data-testid="oauth-github-form"], .auth-form-body',
      USERNAME_INPUT: 'input[name="login"], #login_field',
      PASSWORD_INPUT: 'input[name="password"], #password',
      SUBMIT_BUTTON: 'input[type="submit"], .btn-primary',
      AUTHORIZE_BUTTON: '[data-testid="authorize"], #js-oauth-authorize-btn'
    },
    APP: {
      OAUTH_BUTTON_GOOGLE: '[data-testid="oauth-google-button"]',
      OAUTH_BUTTON_GITHUB: '[data-testid="oauth-github-button"]',
      LOGIN_SUCCESS: '[data-testid="login-success"], .dashboard, [data-authenticated="true"]',
      ERROR_MESSAGE: '[data-testid="auth-error"], .error-message, .alert-danger',
      LOADING_STATE: '[data-testid="loading"], .spinner, .loading'
    }
  },
  URLS: {
    GOOGLE_AUTH: 'accounts.google.com',
    GITHUB_AUTH: 'github.com',
    CALLBACK_PATTERN: /\/auth\/oauth\/.*\/callback/
  }
}

// Make config available globally
Cypress.env('OAUTH_CONFIG', OAUTH_CONFIG)

// Before each test hook for OAuth tests
beforeEach(() => {
  // Clear cookies and local storage
  cy.clearCookies()
  cy.clearLocalStorage()

  // Clear session storage
  cy.window().then((win) => {
    win.sessionStorage.clear()
  })

  // Set up API interceptors for OAuth endpoints
  cy.intercept('GET', '/api/auth/oauth/*/authorize', { fixture: 'oauth/auth-url.json' }).as('getAuthUrl')
  cy.intercept('POST', '/api/auth/oauth/*/callback', { fixture: 'oauth/callback-success.json' }).as('oauthCallback')
  cy.intercept('GET', '/api/auth/providers', { fixture: 'oauth/providers.json' }).as('getProviders')
})

// After each test hook for cleanup
afterEach(() => {
  // Close any remaining popups
  cy.window().then((win) => {
    // Close OAuth popups if they exist
    if ((win as any).oauthPopup && !(win as any).oauthPopup.closed) {
      (win as any).oauthPopup.close()
    }
  })

  // Cleanup test data if needed
  if (!Cypress.env('MOCK_OAUTH_ENABLED')) {
    cy.task('cleanupTestData')
  }
})

// Custom error handling for OAuth flows
Cypress.Commands.add('handleOAuthErrors', () => {
  cy.on('window:alert', (text) => {
    console.warn('OAuth Alert:', text)
    return true
  })

  cy.on('window:confirm', (text) => {
    console.warn('OAuth Confirm:', text)
    return true
  })
})

// OAuth flow debugging helpers
Cypress.Commands.add('debugOAuthFlow', (step: string, data?: any) => {
  if (Cypress.env('DEBUG_OAUTH')) {
    cy.log(`OAuth Debug - ${step}`, data || '')

    // Take screenshot for debugging
    if (Cypress.env('OAUTH_SCREENSHOTS')) {
      cy.screenshot(`oauth-debug-${step.toLowerCase().replace(/\s+/g, '-')}`)
    }
  }
})

// OAuth test data management
const generateTestData = () => {
  const timestamp = Date.now()
  return {
    google: {
      email: Cypress.env('GOOGLE_TEST_EMAIL') || `test.oauth.google+${timestamp}@gmail.com`,
      password: Cypress.env('GOOGLE_TEST_PASSWORD') || 'TestPassword123!',
      displayName: 'OAuth Test User (Google)',
      firstName: 'OAuth',
      lastName: 'TestGoogle'
    },
    github: {
      username: Cypress.env('GITHUB_TEST_USERNAME') || `oauth-test-${timestamp}`,
      password: Cypress.env('GITHUB_TEST_PASSWORD') || 'TestPassword123!',
      email: `test.oauth.github+${timestamp}@example.com`,
      displayName: 'OAuth Test User (GitHub)'
    }
  }
}

Cypress.env('TEST_DATA', generateTestData())

// OAuth mock server helpers
if (Cypress.env('MOCK_OAUTH_ENABLED')) {
  beforeEach(() => {
    // Set up mock OAuth server routes
    cy.intercept('GET', '**/accounts.google.com/**', { fixture: 'oauth/google-mock.html' })
    cy.intercept('POST', '**/oauth2.googleapis.com/token', { fixture: 'oauth/google-token.json' })
    cy.intercept('GET', '**/www.googleapis.com/oauth2/v2/userinfo', { fixture: 'oauth/google-userinfo.json' })

    cy.intercept('GET', '**/github.com/login/oauth/authorize**', { fixture: 'oauth/github-mock.html' })
    cy.intercept('POST', '**/github.com/login/oauth/access_token', { fixture: 'oauth/github-token.json' })
    cy.intercept('GET', '**/api.github.com/user', { fixture: 'oauth/github-userinfo.json' })
  })
}

// Performance monitoring for OAuth flows
let performanceMarks: Record<string, number> = {}

Cypress.Commands.add('startPerformanceMeasurement', (name: string) => {
  performanceMarks[name] = performance.now()
})

Cypress.Commands.add('endPerformanceMeasurement', (name: string) => {
  if (performanceMarks[name]) {
    const duration = performance.now() - performanceMarks[name]
    cy.log(`Performance: ${name} took ${duration.toFixed(2)}ms`)

    // Assert performance thresholds
    const maxDuration = Cypress.env('OAUTH_CONFIG').TIMEOUTS.TOKEN_EXCHANGE
    if (duration > maxDuration) {
      cy.log(`⚠️  Performance Warning: ${name} exceeded ${maxDuration}ms threshold`)
    }

    delete performanceMarks[name]
    return cy.wrap(duration)
  }
  return cy.wrap(0)
})

// Global test statistics
let testStats = {
  passed: 0,
  failed: 0,
  oauthFlows: 0,
  popupTests: 0,
  redirectTests: 0
}

// Track test statistics
Cypress.on('test:after:run', (attributes) => {
  if (attributes.state === 'passed') {
    testStats.passed++
  } else if (attributes.state === 'failed') {
    testStats.failed++
  }

  // Track OAuth-specific metrics
  if (attributes.title.toLowerCase().includes('oauth')) {
    testStats.oauthFlows++
  }
  if (attributes.title.toLowerCase().includes('popup')) {
    testStats.popupTests++
  }
  if (attributes.title.toLowerCase().includes('redirect')) {
    testStats.redirectTests++
  }
})

// Export test statistics at the end of test run
after(() => {
  cy.log('OAuth Test Statistics:', testStats)
  cy.writeFile('cypress/results/oauth-test-stats.json', testStats)
})