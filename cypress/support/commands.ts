// General Cypress commands for authentication testing

// Login with email/password
Cypress.Commands.add('loginWithCredentials', (email: string, password: string) => {
  cy.visit('/login')

  // Fill login form
  cy.get('[data-testid="email-input"]').type(email)
  cy.get('[data-testid="password-input"]').type(password)

  // Measure login performance
  cy.measureAuthPerformance()

  // Submit form
  cy.get('[data-testid="login-submit"]').click()

  // Wait for login API call
  cy.wait('@login')

  // Verify successful login
  cy.shouldBeOnDashboard()
})

// Logout
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()

  // Verify logout
  cy.shouldBeOnLoginPage()
})

// Page assertions
Cypress.Commands.add('shouldBeOnLoginPage', () => {
  cy.url().should('include', '/login')
  cy.get('[data-testid="login-form"]').should('be.visible')
})

Cypress.Commands.add('shouldBeOnDashboard', () => {
  cy.url().should('include', '/dashboard')
  cy.get('[data-testid="dashboard-content"]').should('be.visible')
})

Cypress.Commands.add('shouldShowOAuthError', (message: string) => {
  cy.get('[data-testid="oauth-error"]').should('be.visible')
  cy.get('[data-testid="oauth-error"]').should('contain.text', message)
})

// Test data management
Cypress.Commands.add('createTestUser', (userData: any) => {
  return cy.task('createTestUser', userData)
})

Cypress.Commands.add('cleanupTestData', () => {
  return cy.task('clearTestDatabase')
})