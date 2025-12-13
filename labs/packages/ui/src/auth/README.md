# Igris Overture Authentication System

A comprehensive, secure authentication system with OAuth support, multi-factor authentication, and enterprise-grade security features.

## 🚀 Features

- **Secure Authentication**: JWT tokens with 512-bit cryptographic keys
- **OAuth Integration**: Support for Google, GitHub, and Discord
- **Multi-Factor Authentication**: TOTP, SMS, and email-based MFA
- **Session Management**: Automatic token refresh and session timeout
- **Password Security**: Real-time strength validation and secure storage
- **Rate Limiting**: Built-in protection against brute force attacks
- **Audit Logging**: Comprehensive security event tracking
- **Mobile Responsive**: Tailwind CSS with mobile-first design
- **TypeScript**: Full type safety with comprehensive type definitions

## 📦 Installation

```bash
# Install the UI package in your app
pnpm add @igris-inertial/ui @igris-inertial/types
```

## 🎯 Quick Start

### 1. Setup Authentication Provider

```tsx
// app/layout.tsx
import { AuthProvider } from '@igris-inertial/ui/auth'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider
          config={{
            autoRefresh: true,
            refreshThreshold: 5, // Minutes before expiry to refresh
            sessionTimeout: 30, // Minutes of inactivity before logout
            persistSession: true
          }}
        >
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

### 2. Create Login Page

```tsx
// app/login/page.tsx
'use client'

import { LoginForm, useAuth } from '@igris-inertial/ui/auth'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  const handleLogin = async (credentials) => {
    try {
      await login(credentials)
      router.push('/dashboard')
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  const handleOAuth = async (provider) => {
    // OAuth flow will be handled automatically
    console.log(`OAuth login with ${provider}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoginForm
        onSubmit={handleLogin}
        onOAuthLogin={handleOAuth}
        onForgotPassword={() => router.push('/forgot-password')}
        showRememberMe={true}
        showOAuth={true}
        oauthProviders={[
          {
            name: 'google',
            displayName: 'Google',
            icon: 'mail',
            enabled: true,
            scopes: ['email', 'profile']
          }
        ]}
      />
    </div>
  )
}
```

### 3. Protect Routes

```tsx
// app/dashboard/page.tsx
import { ProtectedRoute } from '@igris-inertial/ui/auth'

export default function Dashboard() {
  return (
    <ProtectedRoute
      requiredRole={['admin', 'user']}
      redirectTo="/login"
    >
      <div>
        <h1>Dashboard</h1>
        {/* Your dashboard content */}
      </div>
    </ProtectedRoute>
  )
}
```

### 4. Use Authentication State

```tsx
// components/UserProfile.tsx
import { useAuth } from '@igris-inertial/ui/auth'

export function UserProfile() {
  const { user, logout, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <div>Please log in</div>
  }

  return (
    <div>
      <h2>Welcome, {user?.name}!</h2>
      <p>Email: {user?.email}</p>
      <p>Role: {user?.role}</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

## 🔐 Security Features

### Password Strength Validation

```tsx
import { useAuth } from '@igris-inertial/ui/auth'

function PasswordField() {
  const { checkPasswordStrength } = useAuth()
  const [password, setPassword] = useState('')
  const [strength, setStrength] = useState(null)

  const handlePasswordChange = (value) => {
    setPassword(value)
    setStrength(checkPasswordStrength(value))
  }

  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={(e) => handlePasswordChange(e.target.value)}
      />
      {strength && (
        <div>
          Score: {strength.score}/5
          {strength.suggestions.map(suggestion => (
            <p key={suggestion}>{suggestion}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Multi-Factor Authentication

```tsx
import { useAuth } from '@igris-inertial/ui/auth'

function MFASetup() {
  const { setupMFA, verifyMFA, getMFAStatus } = useAuth()
  const [qrCode, setQrCode] = useState('')
  const [verificationCode, setVerificationCode] = useState('')

  const handleSetupMFA = async () => {
    try {
      const response = await setupMFA({ method: 'totp' })
      setQrCode(response.qrCodeUrl)
    } catch (error) {
      console.error('MFA setup failed:', error)
    }
  }

  const handleVerifyMFA = async () => {
    try {
      await verifyMFA({
        code: verificationCode,
        method: 'totp'
      })
      alert('MFA enabled successfully!')
    } catch (error) {
      console.error('MFA verification failed:', error)
    }
  }

  return (
    <div>
      <button onClick={handleSetupMFA}>Setup MFA</button>
      {qrCode && (
        <div>
          <img src={qrCode} alt="QR Code" />
          <input
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Enter 6-digit code"
          />
          <button onClick={handleVerifyMFA}>Verify</button>
        </div>
      )}
    </div>
  )
}
```

### Session Management

```tsx
import { useAuth } from '@igris-inertial/ui/auth'

function SessionManager() {
  const { getSessions, revokeSession, revokeAllSessions } = useAuth()
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const userSessions = await getSessions()
        setSessions(userSessions)
      } catch (error) {
        console.error('Failed to load sessions:', error)
      }
    }
    loadSessions()
  }, [])

  const handleRevokeSession = async (sessionId) => {
    try {
      await revokeSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (error) {
      console.error('Failed to revoke session:', error)
    }
  }

  return (
    <div>
      <h3>Active Sessions</h3>
      {sessions.map(session => (
        <div key={session.id}>
          <p>{session.deviceInfo.browser} on {session.deviceInfo.os}</p>
          <p>{session.ipAddress} - {session.location}</p>
          <p>Last active: {new Date(session.lastActiveAt).toLocaleString()}</p>
          <button onClick={() => handleRevokeSession(session.id)}>
            Revoke
          </button>
        </div>
      ))}
      <button onClick={revokeAllSessions}>Revoke All Sessions</button>
    </div>
  )
}
```

## 🛡️ Authentication Guards

### Conditional Rendering

```tsx
import {
  AuthGuard,
  RequireAuth,
  RequireRole,
  RequirePermission,
  RequireVerified
} from '@igris-inertial/ui/auth'

function MyComponent() {
  return (
    <div>
      <RequireAuth fallback={<div>Please log in</div>}>
        <p>You are logged in!</p>
      </RequireAuth>

      <RequireRole role="admin" fallback={<div>Admin only</div>}>
        <AdminPanel />
      </RequireRole>

      <RequirePermission
        permission="write"
        fallback={<div>Read-only mode</div>}
      >
        <EditButton />
      </RequirePermission>

      <RequireVerified fallback={<VerifyEmailNotice />}>
        <SensitiveContent />
      </RequireVerified>

      <AuthGuard
        require="authenticated"
        roles={['admin', 'manager']}
        permissions={['read', 'write']}
        fallback={<UnauthorizedMessage />}
        onUnauthorized={() => console.log('Access denied')}
      >
        <ProtectedContent />
      </AuthGuard>
    </div>
  )
}
```

### useAuthGuard Hook

```tsx
import { useAuthGuard } from '@igris-inertial/ui/auth'

function MyComponent() {
  const {
    isAuthenticated,
    user,
    isAdmin,
    hasRole,
    hasPermission,
    can,
    cannot
  } = useAuthGuard()

  if (!isAuthenticated) {
    return <LoginPrompt />
  }

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      
      {isAdmin && <AdminControls />}
      
      {hasRole('manager') && <ManagerDashboard />}
      
      {hasPermission('write') && <EditControls />}
      
      {can('delete') && <DeleteButton />}
      
      {cannot('admin') && <LimitedFeatures />}
    </div>
  )
}
```

## 🔧 Advanced Configuration

### Custom API Configuration

```tsx
import { AuthProvider } from '@igris-inertial/ui/auth'

// Custom API configuration
const authConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  apiVersion: 'v1',
  timeout: 10000,
  retryAttempts: 3
}

function App({ children }) {
  return (
    <AuthProvider
      config={{
        autoRefresh: true,
        refreshThreshold: 5,
        sessionTimeout: 30,
        persistSession: true
      }}
      apiConfig={authConfig}
    >
      {children}
    </AuthProvider>
  )
}
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.yourapp.com
NEXT_PUBLIC_OAUTH_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_OAUTH_GITHUB_CLIENT_ID=your_github_client_id
```

## 🔌 OAuth Integration

### Setting up OAuth Providers

```tsx
import { useOAuth } from '@igris-inertial/ui/auth'

function OAuthLogin() {
  const { providers, startPopupFlow, startRedirectFlow } = useOAuth({
    onSuccess: (response) => {
      console.log('OAuth success:', response)
      // Handle successful authentication
    },
    onError: (error) => {
      console.error('OAuth error:', error)
      // Handle authentication error
    }
  })

  return (
    <div>
      {providers.map(provider => (
        <button
          key={provider.name}
          onClick={() => startPopupFlow(provider.name)}
        >
          Login with {provider.displayName}
        </button>
      ))}
    </div>
  )
}
```

### OAuth Callback Handling

```tsx
// app/auth/callback/[provider]/page.tsx
import { withOAuthCallback } from '@igris-inertial/ui/auth'

function CallbackPage() {
  return <div>Processing OAuth callback...</div>
}

export default withOAuthCallback(CallbackPage, 'google')
```

## 📱 Mobile Responsive Design

The authentication components are built with Tailwind CSS and are fully responsive:

```tsx
// The LoginForm automatically adapts to mobile screens
<LoginForm
  onSubmit={handleLogin}
  // Mobile-optimized by default
  // Includes touch-friendly buttons
  // Responsive form layout
  // Mobile-friendly OAuth buttons
/>
```

## 🎨 Customization

### Custom Styling

```tsx
// Override default styles with Tailwind classes
<LoginForm
  onSubmit={handleLogin}
  className="custom-login-form"
  buttonClassName="bg-purple-600 hover:bg-purple-700"
  inputClassName="border-purple-300 focus:border-purple-500"
/>
```

### Custom Components

```tsx
import { useAuth } from '@igris-inertial/ui/auth'

function CustomLoginForm() {
  const { login, error, isLoading } = useAuth()

  return (
    <form onSubmit={handleSubmit}>
      {/* Your custom form fields */}
      <CustomInput />
      <CustomButton loading={isLoading} />
      {error && <CustomErrorDisplay error={error} />}
    </form>
  )
}
```

## 🔍 Error Handling

```tsx
import { AuthError } from '@igris-inertial/ui/auth'

function handleAuthError(error: AuthError) {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      showError('Invalid email or password')
      break
    case 'ACCOUNT_LOCKED':
      showError('Account temporarily locked')
      break
    case 'EMAIL_NOT_VERIFIED':
      redirectToVerification()
      break
    case 'RATE_LIMITED':
      showError(`Too many attempts. Try again in ${error.rateLimitInfo?.retryAfter}s`)
      break
    default:
      showError(error.message)
  }
}
```

## 📊 Analytics and Monitoring

```tsx
import { useAuth } from '@igris-inertial/ui/auth'

function AuthAnalytics() {
  const { getSecurityEvents, getLoginAttempts } = useAuth()
  const [events, setEvents] = useState([])

  useEffect(() => {
    const loadSecurityEvents = async () => {
      try {
        const securityEvents = await getSecurityEvents(50)
        setEvents(securityEvents)
      } catch (error) {
        console.error('Failed to load security events:', error)
      }
    }
    loadSecurityEvents()
  }, [])

  return (
    <div>
      <h3>Security Events</h3>
      {events.map(event => (
        <div key={event.id}>
          <p>{event.type}: {event.description}</p>
          <p>Time: {new Date(event.timestamp).toLocaleString()}</p>
          <p>Severity: {event.severity}</p>
        </div>
      ))}
    </div>
  )
}
```

## 🧪 Testing

### Unit Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthProvider, LoginForm } from '@igris-inertial/ui/auth'

describe('LoginForm', () => {
  it('validates email format', async () => {
    const mockSubmit = jest.fn()
    
    render(
      <AuthProvider>
        <LoginForm onSubmit={mockSubmit} />
      </AuthProvider>
    )

    const emailInput = screen.getByLabelText(/email/i)
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.blur(emailInput)

    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
  })
})
```

### Integration Tests

```tsx
import { renderWithAuth } from '../test-utils'
import { ProtectedRoute } from '@igris-inertial/ui/auth'

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users', () => {
    const { mockPush } = renderWithAuth(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { authenticated: false }
    )

    expect(mockPush).toHaveBeenCalledWith('/login')
  })
})
```

## 🚀 Deployment

### Environment Setup

```bash
# Production environment variables
NEXT_PUBLIC_API_URL=https://api.yourapp.com
NEXT_PUBLIC_OAUTH_GOOGLE_CLIENT_ID=production_google_client_id
NEXT_PUBLIC_OAUTH_GITHUB_CLIENT_ID=production_github_client_id

# Security settings
AUTH_SECRET=your-very-secure-secret-key
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=strict
```

### Build Configuration

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET,
  },
  // Enable SWC for faster builds
  swcMinify: true,
}

module.exports = nextConfig
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- 📧 Email: support@igris-inertial.com  
- 💬 Discord: [Join our community](https://discord.gg/igris-inertial)
- 📖 Docs: [Full Documentation](https://docs.igris-inertial.com/auth)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/igris-inertial/issues)

---

Built with ❤️ by the Igris Overture Team