import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the auth page before each test
    await page.goto('/auth/signin');
  });

  test.describe('Sign In Flow', () => {
    test('successful sign in', async ({ page }) => {
      // Mock the API response
      await page.route('/api/v1/auth/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock-access-token',
            token_type: 'bearer',
            user: {
              id: 1,
              email: 'test@example.com',
              full_name: 'Test User',
            },
          }),
        });
      });

      // Fill in the sign in form
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      // Submit the form
      await page.click('[data-testid="signin-button"]');

      // Wait for redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
      
      // Verify user is authenticated
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-email"]')).toContainText('test@example.com');
    });

    test('failed sign in with invalid credentials', async ({ page }) => {
      // Mock the API response for failed login
      await page.route('/api/v1/auth/login', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'Invalid credentials',
          }),
        });
      });

      // Fill in the sign in form with wrong credentials
      await page.fill('[data-testid="email-input"]', 'wrong@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');

      // Submit the form
      await page.click('[data-testid="signin-button"]');

      // Verify error message is displayed
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
      
      // Verify we're still on the sign in page
      await expect(page).toHaveURL('/auth/signin');
    });

    test('form validation', async ({ page }) => {
      // Try to submit empty form
      await page.click('[data-testid="signin-button"]');

      // Verify validation errors
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();

      // Test invalid email format
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.click('[data-testid="signin-button"]');

      await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email format');
    });

    test('password visibility toggle', async ({ page }) => {
      // Fill in password
      await page.fill('[data-testid="password-input"]', 'password123');

      // Verify password is hidden by default
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'password');

      // Click password visibility toggle
      await page.click('[data-testid="password-toggle"]');

      // Verify password is now visible
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'text');

      // Click again to hide
      await page.click('[data-testid="password-toggle"]');

      // Verify password is hidden again
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Sign Up Flow', () => {
    test('successful sign up', async ({ page }) => {
      // Navigate to sign up page
      await page.goto('/auth/signup');

      // Mock the API response
      await page.route('/api/v1/auth/register', async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            email: 'newuser@example.com',
            full_name: 'New User',
            message: 'User registered successfully',
          }),
        });
      });

      // Fill in the sign up form
      await page.fill('[data-testid="full-name-input"]', 'New User');
      await page.fill('[data-testid="email-input"]', 'newuser@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.fill('[data-testid="confirm-password-input"]', 'password123');

      // Submit the form
      await page.click('[data-testid="signup-button"]');

      // Wait for success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('User registered successfully');
    });

    test('password strength validation', async ({ page }) => {
      await page.goto('/auth/signup');

      // Fill in form with weak password
      await page.fill('[data-testid="full-name-input"]', 'Test User');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', '123');

      // Verify password strength indicator
      await expect(page.locator('[data-testid="password-strength"]')).toHaveClass(/weak/);

      // Try to submit
      await page.click('[data-testid="signup-button"]');

      // Verify error message
      await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must be at least 8 characters');
    });

    test('password confirmation validation', async ({ page }) => {
      await page.goto('/auth/signup');

      // Fill in form with mismatched passwords
      await page.fill('[data-testid="full-name-input"]', 'Test User');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.fill('[data-testid="confirm-password-input"]', 'differentpassword');

      // Submit the form
      await page.click('[data-testid="signup-button"]');

      // Verify error message
      await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText('Passwords do not match');
    });
  });

  test.describe('Password Reset Flow', () => {
    test('successful password reset request', async ({ page }) => {
      // Mock the API response
      await page.route('/api/v1/auth/password-reset-request', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Password reset email sent',
          }),
        });
      });

      // Click forgot password link
      await page.click('[data-testid="forgot-password-link"]');

      // Fill in email
      await page.fill('[data-testid="email-input"]', 'test@example.com');

      // Submit reset request
      await page.click('[data-testid="reset-password-button"]');

      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Password reset email sent');
    });

    test('password reset with non-existent email', async ({ page }) => {
      // Mock the API response for non-existent user
      await page.route('/api/v1/auth/password-reset-request', async route => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'User not found',
          }),
        });
      });

      // Click forgot password link
      await page.click('[data-testid="forgot-password-link"]');

      // Fill in non-existent email
      await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');

      // Submit reset request
      await page.click('[data-testid="reset-password-button"]');

      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('User not found');
    });
  });

  test.describe('Two-Factor Authentication', () => {
    test('2FA setup flow', async ({ page }) => {
      // First sign in
      await page.route('/api/v1/auth/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock-access-token',
            token_type: 'bearer',
            user: {
              id: 1,
              email: 'test@example.com',
              full_name: 'Test User',
            },
          }),
        });
      });

      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="signin-button"]');

      // Navigate to settings
      await page.goto('/dashboard/settings');

      // Mock 2FA setup API
      await page.route('/api/v1/auth/2fa/setup', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            qr_code: 'data:image/png;base64,mock-qr-code',
            secret: 'mock-secret-key',
          }),
        });
      });

      // Click setup 2FA button
      await page.click('[data-testid="setup-2fa-button"]');

      // Verify QR code is displayed
      await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();
      await expect(page.locator('[data-testid="secret-key"]')).toBeVisible();
    });

    test('2FA verification', async ({ page }) => {
      // Mock 2FA verification API
      await page.route('/api/v1/auth/2fa/verify', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '2FA verified successfully',
          }),
        });
      });

      // Navigate to 2FA verification page
      await page.goto('/auth/2fa/verify');

      // Enter 2FA code
      await page.fill('[data-testid="2fa-code-input"]', '123456');

      // Submit verification
      await page.click('[data-testid="verify-2fa-button"]');

      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('2FA verified successfully');
    });
  });

  test.describe('API Key Management', () => {
    test('create new API key', async ({ page }) => {
      // Mock API key creation
      await page.route('/api/v1/auth/api-keys', async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'Test API Key',
            key: 'sk_test_123456789',
            created_at: '2023-01-01T00:00:00Z',
          }),
        });
      });

      // Navigate to API keys page
      await page.goto('/dashboard/settings/api-keys');

      // Fill in API key name
      await page.fill('[data-testid="api-key-name-input"]', 'Test API Key');

      // Create API key
      await page.click('[data-testid="create-api-key-button"]');

      // Verify API key is displayed
      await expect(page.locator('[data-testid="api-key-value"]')).toContainText('sk_test_123456789');
    });

    test('delete API key', async ({ page }) => {
      // Mock API key deletion
      await page.route('/api/v1/auth/api-keys/1', async route => {
        await route.fulfill({
          status: 204,
        });
      });

      // Navigate to API keys page
      await page.goto('/dashboard/settings/api-keys');

      // Click delete button for first API key
      await page.click('[data-testid="delete-api-key-button"]');

      // Confirm deletion
      await page.click('[data-testid="confirm-delete-button"]');

      // Verify API key is removed
      await expect(page.locator('[data-testid="api-key-item"]')).not.toBeVisible();
    });
  });

  test.describe('Session Management', () => {
    test('automatic logout on token expiration', async ({ page }) => {
      // Mock expired token response
      await page.route('/api/v1/auth/me', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'Token expired',
          }),
        });
      });

      // Navigate to dashboard (should trigger token check)
      await page.goto('/dashboard');

      // Verify redirect to login page
      await expect(page).toHaveURL('/auth/signin');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Session expired');
    });

    test('manual logout', async ({ page }) => {
      // First sign in
      await page.route('/api/v1/auth/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock-access-token',
            token_type: 'bearer',
            user: {
              id: 1,
              email: 'test@example.com',
              full_name: 'Test User',
            },
          }),
        });
      });

      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="signin-button"]');

      // Mock logout API
      await page.route('/api/v1/auth/logout', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Logged out successfully',
          }),
        });
      });

      // Click user menu
      await page.click('[data-testid="user-menu"]');

      // Click logout
      await page.click('[data-testid="logout-button"]');

      // Verify redirect to login page
      await expect(page).toHaveURL('/auth/signin');
    });
  });

  test.describe('Security Features', () => {
    test('CSRF protection', async ({ page }) => {
      // Try to make a request without CSRF token
      const response = await page.request.post('/api/v1/auth/logout', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should be rejected
      expect(response.status()).toBe(403);
    });

    test('rate limiting', async ({ page }) => {
      // Mock rate limit response
      await page.route('/api/v1/auth/login', async route => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'Too many requests',
          }),
        });
      });

      // Try to sign in multiple times
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'password123');
        await page.click('[data-testid="signin-button"]');
      }

      // Verify rate limit error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Too many requests');
    });

    test('XSS protection', async ({ page }) => {
      await page.goto('/auth/signup');

      // Try to inject script in name field
      const xssPayload = '<script>alert("xss")</script>';
      await page.fill('[data-testid="full-name-input"]', xssPayload);

      // Submit form
      await page.click('[data-testid="signup-button"]');

      // Verify script is not executed (no alert should appear)
      const alertPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
      const alert = await alertPromise;
      expect(alert).toBeNull();
    });
  });

  test.describe('Accessibility', () => {
    test('keyboard navigation', async ({ page }) => {
      await page.goto('/auth/signin');

      // Navigate through form fields with Tab
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="email-input"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="password-input"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="signin-button"]')).toBeFocused();

      // Submit form with Enter
      await page.keyboard.press('Enter');
    });

    test('screen reader support', async ({ page }) => {
      await page.goto('/auth/signin');

      // Verify ARIA labels are present
      await expect(page.locator('[data-testid="email-input"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('aria-label');

      // Verify error messages are announced
      await page.click('[data-testid="signin-button"]');
      await expect(page.locator('[data-testid="email-error"]')).toHaveAttribute('role', 'alert');
    });

    test('color contrast', async ({ page }) => {
      await page.goto('/auth/signin');

      // Check that text has sufficient contrast
      const textColor = await page.locator('body').evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.color;
      });

      const backgroundColor = await page.locator('body').evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.backgroundColor;
      });

      // This is a basic check - in a real scenario you'd use a proper contrast checking library
      expect(textColor).not.toBe(backgroundColor);
    });
  });
}); 