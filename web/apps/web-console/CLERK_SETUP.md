# Clerk Authentication Setup

This application now uses Clerk for authentication. Follow these steps to set up Clerk:

## 1. Create a Clerk Account

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Create a new application
3. Choose your authentication methods:
   - Email/Password (recommended)
   - Google OAuth (recommended)
   - GitHub OAuth (recommended)

## 2. Get Your API Keys

From your Clerk dashboard:

1. Navigate to **API Keys** in the sidebar
2. Copy your **Publishable Key** (starts with `pk_test_...` or `pk_live_...`)
3. Copy your **Secret Key** (starts with `sk_test_...` or `sk_live_...`)

## 3. Configure Environment Variables

Create a `.env.local` file in the `web/apps/web-console` directory with the following variables:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# API Configuration (keep existing)
NEXT_PUBLIC_API_URL=http://localhost:8081

# Optional: Disable Clerk telemetry
CLERK_TELEMETRY_DISABLED=1
```

## 4. Configure OAuth Providers (Optional)

If you want to enable Google/GitHub login:

### Google OAuth:
1. In Clerk dashboard, go to **User & Authentication** → **Social Connections**
2. Enable Google
3. Follow Clerk's guide to set up Google OAuth credentials

### GitHub OAuth:
1. In Clerk dashboard, go to **User & Authentication** → **Social Connections**
2. Enable GitHub
3. Follow Clerk's guide to set up GitHub OAuth app

## 5. User Metadata Configuration

The onboarding flow stores user preferences in Clerk's `unsafeMetadata`:

- `intent`: User's selected platform (cloud, edge, or hybrid)
- `onboardingCompleted`: Boolean flag for onboarding status
- `setupData`: Optional setup information (API keys status, etc.)

## 6. Test the Flow

1. Start the development server: `pnpm dev:console`
2. Navigate to `/auth`
3. Create a new account or sign in
4. Complete the onboarding wizard
5. You'll be redirected to the dashboard

## Authentication Flow

```
New User → /auth → Sign Up → /onboarding → Select Intent → Quick Setup → /dashboard
Existing User → /auth → Sign In → /dashboard (if onboarding completed)
```

## Customization

The Clerk components are styled to match the existing design system:
- Colors: Beige primary (#f6f6f4), Black (#000000)
- Font: Inter
- Text sizes: xs (12px), sm (14px)
- Border radius: rounded-lg (0.5rem)

Customize appearance in:
- `app/layout.tsx` - Global ClerkProvider appearance
- `app/auth/page.tsx` - Auth page specific styling
