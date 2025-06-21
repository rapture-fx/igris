#  Authentication Toggle Guide

##  Currently: Authentication is DISABLED for Development

Authentication has been temporarily disabled to allow faster development and testing. You can access the dashboard and all features without logging in.

---

##  How to Toggle Authentication

### To DISABLE Authentication (Current State):
```typescript
// In packages/frontend/src/lib/dev-config.ts
export const DEV_CONFIG = {
  BYPASS_AUTH: true,  //  Set to true to disable auth
  // ... rest of config
};
```

### To ENABLE Authentication:
```typescript
// In packages/frontend/src/lib/dev-config.ts
export const DEV_CONFIG = {
  BYPASS_AUTH: false,  //  Set to false to enable auth
  // ... rest of config
};
```

---

##  Current Development State

###  What Works Without Auth:
-  **Direct Dashboard Access**: Go to http://localhost:3000/dashboard
-  **All UI Components**: Navigation, dashboard, charts, etc.
-  **Mock User Data**: Displays as "Developer User" with admin role
-  **Full Application Flow**: No login screens blocking development

###  When Auth is Re-enabled:
-  **Login Required**: Users must authenticate to access dashboard
-  **Sign Up Flow**: Registration and email verification
-  **JWT Tokens**: Secure session management
-  **Role-based Access**: Admin/Analyst/Viewer permissions
-  **Token Refresh**: Automatic session renewal

---

##  Quick Development Workflow

### Without Authentication (Current):
1. Start frontend: `pnpm dev`
2. Go to: http://localhost:3000/dashboard
3. Start developing features immediately!

### With Authentication (When Re-enabled):
1. Start frontend: `pnpm dev`
2. Start backend: `cd packages/backend && source venv/bin/activate && uvicorn app.main:app --reload`
3. Go to: http://localhost:3000
4. Sign in with: demo@pollarbase.com / demo123

---

##  Visual Indicators

When authentication is bypassed, you'll see:
-  **"DEV MODE"** badge in the navigation bar
-  **Development toasts** when signing in/up
-  **Console logs** showing auth bypass messages

---

##  Files Modified for Auth Bypass

### Core Files:
- `src/lib/dev-config.ts` - Main toggle configuration
- `src/hooks/useAuth.tsx` - Auth bypass logic
- `src/components/layout/Navigation.tsx` - Dev mode indicator

### What's Preserved:
-  All original authentication code
-  JWT token handling
-  API client configuration
-  Security middleware
-  Database models and schemas

---

##  When to Re-enable Authentication

Re-enable authentication when:
-  **Backend is stable** and starting correctly
-  **Database is fully configured** and accessible
-  **Email system is set up** for verification
-  **Ready for user flow testing**
-  **Preparing for production deployment**

---

##  Important Notes

###  Security Reminder:
- **NEVER deploy with BYPASS_AUTH: true**
- **Always test with auth enabled before production**
- **Verify all protected routes work with real authentication**

###  Switching Back:
1. Change `BYPASS_AUTH: false` in `dev-config.ts`
2. Restart the development server
3. Ensure backend is running on port 8000
4. Test login flow with: demo@pollarbase.com / demo123

---

##  Need Help?

- **Auth Issues**: Check `dev-config.ts` settings
- **Backend Problems**: Verify PostgreSQL is running
- **Token Errors**: Clear localStorage and refresh
- **Dashboard Access**: Ensure `BYPASS_AUTH: true` for development

---

*Toggle created for seamless development workflow*  
*Authentication system fully preserved and ready to re-enable* 