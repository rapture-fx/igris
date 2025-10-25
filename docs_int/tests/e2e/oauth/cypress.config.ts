import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    supportFile: 'support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    fixturesFolder: 'fixtures',
    screenshotsFolder: 'screenshots',
    videosFolder: 'videos',
    downloadsFolder: 'downloads',

    // OAuth-specific configuration
    setupNodeEvents(on, config) {
      // Handle OAuth environment variables
      config.env.GOOGLE_TEST_EMAIL = process.env.GOOGLE_TEST_EMAIL
      config.env.GOOGLE_TEST_PASSWORD = process.env.GOOGLE_TEST_PASSWORD
      config.env.GITHUB_TEST_USERNAME = process.env.GITHUB_TEST_USERNAME
      config.env.GITHUB_TEST_PASSWORD = process.env.GITHUB_TEST_PASSWORD
      config.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000'
      config.env.FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000'

      // OAuth mock server configuration
      config.env.MOCK_OAUTH_ENABLED = process.env.MOCK_OAUTH_ENABLED === 'true'
      config.env.MOCK_OAUTH_PORT = process.env.MOCK_OAUTH_PORT || '3001'

      // Tasks for OAuth testing
      on('task', {
        // Clear OAuth state from Redis
        clearOAuthState: async (state: string) => {
          const redis = require('redis')
          const client = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
          })

          try {
            await client.connect()
            await client.del(`oauth:state:${state}`)
            await client.quit()
            return null
          } catch (error) {
            console.error('Failed to clear OAuth state:', error)
            return null
          }
        },

        // Generate mock OAuth tokens
        generateMockTokens: (provider: string) => {
          const crypto = require('crypto')
          return {
            access_token: `mock_access_token_${provider}_${crypto.randomBytes(16).toString('hex')}`,
            refresh_token: `mock_refresh_token_${provider}_${crypto.randomBytes(16).toString('hex')}`,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: provider === 'google' ? 'openid email profile' : 'user:email'
          }
        },

        // Seed test database with OAuth user
        seedTestUser: async (userData: any) => {
          // This would connect to test database and create a user
          // Implementation depends on your database setup
          console.log('Seeding test user:', userData)
          return userData
        },

        // Clean up test data
        cleanupTestData: async () => {
          // Clean up any test data created during OAuth tests
          console.log('Cleaning up OAuth test data')
          return null
        }
      })

      return config
    },

    // Test isolation and retries
    testIsolation: true,
    retries: {
      runMode: 2,
      openMode: 0
    },

    // Timeouts for OAuth flows
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,

    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,

    // Video and screenshot settings
    video: true,
    screenshotOnRunFailure: true,

    // Browser settings for OAuth
    chromeWebSecurity: false, // Needed for OAuth popups
    modifyObstructiveCode: false,

    // Experimental features
    experimentalStudio: true,
    experimentalMemoryManagement: true
  },

  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack'
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'support/component.ts'
  },

  // Global configuration
  watchForFileChanges: true,
  numTestsKeptInMemory: 10,

  // Environment variables
  env: {
    // OAuth provider configurations
    OAUTH_PROVIDERS: {
      google: {
        name: 'google',
        displayName: 'Google',
        authorizeUrl: 'https://accounts.google.com/o/oauth2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: 'openid email profile'
      },
      github: {
        name: 'github',
        displayName: 'GitHub',
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: 'user:email'
      }
    },

    // Test configuration
    TEST_TIMEOUT: 30000,
    OAUTH_CALLBACK_TIMEOUT: 15000,
    POPUP_TIMEOUT: 10000,

    // Coverage settings
    codeCoverage: {
      exclude: ['cypress/**/*']
    }
  }
})