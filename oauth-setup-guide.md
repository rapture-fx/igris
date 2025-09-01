
# OAuth Provider Setup Guide for Schlep Engine

## Google OAuth Setup

1. Go to Google Cloud Console (https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Configure consent screen with your app details
6. Add your production domain to authorized origins
7. Add callback URLs: https://yourdomain.com/api/v1/auth/oauth/callback
8. Copy Client ID and Client Secret to your .env.production

Required Scopes: openid, email, profile

## GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in application details:
   - Application name: Schlep Engine
   - Homepage URL: https://yourdomain.com
   - Authorization callback URL: https://yourdomain.com/api/v1/auth/oauth/callback
4. Click "Register application"
5. Copy Client ID and generate Client Secret
6. Add to your .env.production

Required Scopes: user:email

## Security Checklist

- [ ] Use HTTPS for all OAuth redirect URIs
- [ ] Validate state parameter in OAuth callback
- [ ] Use minimal necessary scopes
- [ ] Implement proper CSRF protection
- [ ] Store OAuth tokens securely
- [ ] Implement token refresh mechanism
- [ ] Log OAuth authentication events
- [ ] Monitor for suspicious OAuth activity

## Testing OAuth Integration

1. Test authorization flow in staging environment
2. Verify user profile information is retrieved correctly
3. Test account linking for existing users
4. Verify OAuth token storage and refresh
5. Test logout and token revocation
6. Validate error handling for OAuth failures

