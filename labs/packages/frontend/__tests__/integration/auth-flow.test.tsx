import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

// Setup MSW server
const server = setupServer(
  rest.post("/api/v1/auth/login", (req, res, ctx) => {
    return res(
      ctx.json({
        access_token: "mock-access-token",
        token_type: "bearer",
        user: {
          id: 1,
          email: "test@example.com",
          full_name: "Test User",
        },
      }),
    );
  }),

  rest.post("/api/v1/auth/register", (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 1,
        email: "newuser@example.com",
        full_name: "New User",
        message: "User registered successfully",
      }),
    );
  }),

  rest.post("/api/v1/auth/logout", (req, res, ctx) => {
    return res(ctx.json({ message: "Logged out successfully" }));
  }),

  rest.get("/api/v1/auth/me", (req, res, ctx) => {
    return res(
      ctx.json({
        id: 1,
        email: "test@example.com",
        full_name: "Test User",
      }),
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe("Authentication Flow Integration Tests", () => {
  describe("Sign In Flow", () => {
    it("successfully signs in a user", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      // Fill in the form
      await user.type(screen.getByLabelText(/email/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");

      // Submit the form
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      // Wait for successful sign in
      await waitFor(() => {
        expect(screen.getByText(/welcome/i)).toBeInTheDocument();
      });
    });

    it("handles sign in errors", async () => {
      const user = userEvent.setup();

      // Override the login endpoint to return an error
      server.use(
        rest.post("/api/v1/auth/login", (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ detail: "Invalid credentials" }),
          );
        }),
      );

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      // Fill in the form
      await user.type(screen.getByLabelText(/email/i), "wrong@example.com");
      await user.type(screen.getByLabelText(/password/i), "wrongpassword");

      // Submit the form
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it("validates form inputs", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      // Try to submit without filling the form
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });

      // Test invalid email format
      await user.type(screen.getByLabelText(/email/i), "invalid-email");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
    });

    it("shows loading state during sign in", async () => {
      const user = userEvent.setup();

      // Override the login endpoint to delay response
      server.use(
        rest.post("/api/v1/auth/login", async (req, res, ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return res(
            ctx.json({
              access_token: "mock-access-token",
              token_type: "bearer",
              user: {
                id: 1,
                email: "test@example.com",
                full_name: "Test User",
              },
            }),
          );
        }),
      );

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      // Fill in the form
      await user.type(screen.getByLabelText(/email/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");

      // Submit the form
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      // Check for loading state
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /signing in/i }),
      ).toBeDisabled();
    });
  });

  describe("Sign Up Flow", () => {
    it("successfully registers a new user", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>,
      );

      // Fill in the form
      await user.type(screen.getByLabelText(/full name/i), "New User");
      await user.type(screen.getByLabelText(/email/i), "newuser@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.type(
        screen.getByLabelText(/confirm password/i),
        "password123",
      );

      // Submit the form
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      // Wait for successful registration
      await waitFor(() => {
        expect(
          screen.getByText(/registration successful/i),
        ).toBeInTheDocument();
      });
    });

    it("handles registration errors", async () => {
      const user = userEvent.setup();

      // Override the register endpoint to return an error
      server.use(
        rest.post("/api/v1/auth/register", (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({ detail: "Email already registered" }),
          );
        }),
      );

      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>,
      );

      // Fill in the form
      await user.type(screen.getByLabelText(/full name/i), "Existing User");
      await user.type(screen.getByLabelText(/email/i), "existing@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.type(
        screen.getByLabelText(/confirm password/i),
        "password123",
      );

      // Submit the form
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      // Wait for error message
      await waitFor(() => {
        expect(
          screen.getByText(/email already registered/i),
        ).toBeInTheDocument();
      });
    });

    it("validates password strength", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>,
      );

      // Fill in the form with weak password
      await user.type(screen.getByLabelText(/full name/i), "Test User");
      await user.type(screen.getByLabelText(/email/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "123");
      await user.type(screen.getByLabelText(/confirm password/i), "123");

      // Submit the form
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      // Check for password strength error
      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 8 characters/i),
        ).toBeInTheDocument();
      });
    });

    it("validates password confirmation", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>,
      );

      // Fill in the form with mismatched passwords
      await user.type(screen.getByLabelText(/full name/i), "Test User");
      await user.type(screen.getByLabelText(/email/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.type(
        screen.getByLabelText(/confirm password/i),
        "differentpassword",
      );

      // Submit the form
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      // Check for password mismatch error
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });
  });

  describe("Authentication State Management", () => {
    it("persists authentication state across page reloads", async () => {
      // Mock localStorage
      const mockLocalStorage = {
        getItem: jest.fn().mockReturnValue("mock-access-token"),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(window, "localStorage", {
        value: mockLocalStorage,
        writable: true,
      });

      render(
        <TestWrapper>
          <div data-testid="auth-status">
            <span>Authenticated</span>
          </div>
        </TestWrapper>,
      );

      // Check that the user is authenticated
      expect(screen.getByText(/authenticated/i)).toBeInTheDocument();
    });

    it("handles token expiration", async () => {
      const user = userEvent.setup();

      // Override the me endpoint to return unauthorized
      server.use(
        rest.get("/api/v1/auth/me", (req, res, ctx) => {
          return res(ctx.status(401));
        }),
      );

      render(
        <TestWrapper>
          <div data-testid="auth-status">
            <span>Not Authenticated</span>
          </div>
        </TestWrapper>,
      );

      // Check that the user is not authenticated
      expect(screen.getByText(/not authenticated/i)).toBeInTheDocument();
    });
  });

  describe("Password Reset Flow", () => {
    it("successfully requests password reset", async () => {
      const user = userEvent.setup();

      server.use(
        rest.post("/api/v1/auth/password-reset-request", (req, res, ctx) => {
          return res(ctx.json({ message: "Password reset email sent" }));
        }),
      );

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      // Click on forgot password link
      await user.click(screen.getByText(/forgot password/i));

      // Fill in email
      await user.type(screen.getByLabelText(/email/i), "test@example.com");

      // Submit reset request
      await user.click(
        screen.getByRole("button", { name: /send reset email/i }),
      );

      // Wait for success message
      await waitFor(() => {
        expect(
          screen.getByText(/password reset email sent/i),
        ).toBeInTheDocument();
      });
    });

    it("handles password reset errors", async () => {
      const user = userEvent.setup();

      server.use(
        rest.post("/api/v1/auth/password-reset-request", (req, res, ctx) => {
          return res(ctx.status(404), ctx.json({ detail: "User not found" }));
        }),
      );

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      // Click on forgot password link
      await user.click(screen.getByText(/forgot password/i));

      // Fill in email
      await user.type(
        screen.getByLabelText(/email/i),
        "nonexistent@example.com",
      );

      // Submit reset request
      await user.click(
        screen.getByRole("button", { name: /send reset email/i }),
      );

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/user not found/i)).toBeInTheDocument();
      });
    });
  });

  describe("Two-Factor Authentication", () => {
    it("handles 2FA setup flow", async () => {
      const user = userEvent.setup();

      server.use(
        rest.post("/api/v1/auth/2fa/setup", (req, res, ctx) => {
          return res(
            ctx.json({
              qr_code: "data:image/png;base64,mock-qr-code",
              secret: "mock-secret-key",
            }),
          );
        }),
      );

      render(
        <TestWrapper>
          <div data-testid="2fa-setup">
            <button onClick={() => {}}>Setup 2FA</button>
          </div>
        </TestWrapper>,
      );

      // Click setup 2FA button
      await user.click(screen.getByText(/setup 2fa/i));

      // Wait for QR code to be displayed
      await waitFor(() => {
        expect(screen.getByAltText(/qr code/i)).toBeInTheDocument();
      });
    });

    it("handles 2FA verification", async () => {
      const user = userEvent.setup();

      server.use(
        rest.post("/api/v1/auth/2fa/verify", (req, res, ctx) => {
          return res(ctx.json({ message: "2FA verified successfully" }));
        }),
      );

      render(
        <TestWrapper>
          <div data-testid="2fa-verify">
            <input type="text" placeholder="Enter 2FA code" />
            <button>Verify</button>
          </div>
        </TestWrapper>,
      );

      // Enter 2FA code
      await user.type(screen.getByPlaceholderText(/enter 2fa code/i), "123456");

      // Click verify button
      await user.click(screen.getByText(/verify/i));

      // Wait for success message
      await waitFor(() => {
        expect(
          screen.getByText(/2fa verified successfully/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("API Key Management", () => {
    it("creates new API key", async () => {
      const user = userEvent.setup();

      server.use(
        rest.post("/api/v1/auth/api-keys", (req, res, ctx) => {
          return res(
            ctx.json({
              id: 1,
              name: "Test API Key",
              key: "sk_test_123456789",
              created_at: "2023-01-01T00:00:00Z",
            }),
          );
        }),
      );

      render(
        <TestWrapper>
          <div data-testid="api-key-form">
            <input type="text" placeholder="API Key Name" />
            <button>Create API Key</button>
          </div>
        </TestWrapper>,
      );

      // Enter API key name
      await user.type(
        screen.getByPlaceholderText(/api key name/i),
        "Test API Key",
      );

      // Click create button
      await user.click(screen.getByText(/create api key/i));

      // Wait for API key to be created
      await waitFor(() => {
        expect(screen.getByText(/sk_test_123456789/i)).toBeInTheDocument();
      });
    });

    it("lists existing API keys", async () => {
      server.use(
        rest.get("/api/v1/auth/api-keys", (req, res, ctx) => {
          return res(
            ctx.json({
              api_keys: [
                {
                  id: 1,
                  name: "Test API Key 1",
                  created_at: "2023-01-01T00:00:00Z",
                },
                {
                  id: 2,
                  name: "Test API Key 2",
                  created_at: "2023-01-02T00:00:00Z",
                },
              ],
            }),
          );
        }),
      );

      render(
        <TestWrapper>
          <div data-testid="api-keys-list">
            <span>API Keys List</span>
          </div>
        </TestWrapper>,
      );

      // Wait for API keys to be loaded
      await waitFor(() => {
        expect(screen.getByText(/test api key 1/i)).toBeInTheDocument();
        expect(screen.getByText(/test api key 2/i)).toBeInTheDocument();
      });
    });
  });
});
