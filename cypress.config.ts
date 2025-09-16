import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    video: true,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    experimentalStudio: true,
    env: {
      // API endpoints
      API_BASE_URL: 'http://localhost:8000',

      // OAuth test credentials (use test providers)
      GOOGLE_TEST_EMAIL: 'test@schlep-engine.com',
      GOOGLE_TEST_PASSWORD: 'test_password_123',
      GITHUB_TEST_USERNAME: 'schlep-engine-test',
      GITHUB_TEST_PASSWORD: 'test_password_123',

      // Test database
      TEST_DB_NAME: 'schlep_engine_test',

      // Feature flags for testing
      ENABLE_OAUTH_TESTING: true,
      ENABLE_MOCK_OAUTH: true,

      // Security testing
      ENABLE_SECURITY_TESTS: true,

      // Performance thresholds
      MAX_LOGIN_TIME: 5000,
      MAX_OAUTH_CALLBACK_TIME: 3000
    },
    setupNodeEvents(on, config) {
      // implement node event listeners here

      // Custom tasks for OAuth testing
      on('task', {
        // Mock OAuth server control
        startMockOAuthServer() {
          // Implementation for starting mock OAuth server
          return null
        },

        stopMockOAuthServer() {
          // Implementation for stopping mock OAuth server
          return null
        },

        // Database utilities for test setup/teardown
        clearTestDatabase() {
          // Implementation for clearing test database
          return null
        },

        createTestUser(userData) {
          // Implementation for creating test users
          console.log('Creating test user:', userData)
          return { id: 'test-user-id', ...userData }
        },

        // OAuth token validation
        validateOAuthToken(token) {
          // Implementation for validating OAuth tokens
          return { valid: true, expires: Date.now() + 3600000 }
        }
      })

      // Environment-specific configuration
      if (config.env.NODE_ENV === 'ci') {
        config.baseUrl = 'http://localhost:3000'
        config.env.API_BASE_URL = 'http://localhost:8000'
      }

      return config
    },
  },

  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
  }
})