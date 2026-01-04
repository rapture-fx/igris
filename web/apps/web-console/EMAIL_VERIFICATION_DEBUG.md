# Email Verification Debugging Guide

## Issue: Email Verification Always Failing

If email verification is consistently failing, follow these debugging steps:

## 1. Check Browser Console Logs

Open your browser's developer console (F12) and look for these log markers:

### When signing up:
```
=== SIGN UP START ===
Email: your@email.com
Sign up result status: complete
✓ Email verification prepared
✓ Verification code sent to: your@email.com
```

### When verifying code:
```
=== EMAIL VERIFICATION START ===
Email: your@email.com
Code (trimmed): 123456
Sign up status: missing_requirements
Verification response: {...}
```

## 2. Verify Clerk Configuration

### Check Publishable Key Format

Your `.env.local` file should have:
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_<account_id>.<key_id>
```

**Common Issues:**
- ❌ Incorrect format: `pk_test_<base64_encoded_string>`
- ✅ Correct format: `pk_test_a1b2c3d4e5f6g7h8i9j0`

### Get Your Correct Key:

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **API Keys**
4. Copy the **Publishable Key** (starts with `pk_test_` or `pk_live_`)
5. Paste it into your `.env.local` file:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
```

**Important:** Do NOT use base64 encoding or modification of the key.

## 3. Verify Clerk Email Settings

### In Clerk Dashboard:

1. Go to **User & Authentication** → **Email & Phone Numbers**
2. Verify email delivery is configured
3. Check if using development or production email server
4. Ensure your email is in allowed domains (if restricted)

### For Development:
- Development emails are sent instantly
- Check browser console for "Email verification prepared" log
- Look for email in your inbox (or spam folder)

### For Production:
- Must configure email provider (SendGrid, Mailgun, etc.)
- Emails are sent via configured provider

## 4. Check Email Verification Strategy

Verify you're using the correct verification strategy in Clerk Dashboard:

1. Go to **User & Authentication** → **Email & Phone Numbers**
2. Under **Email verification**, ensure **Code** (email_code) is enabled
3. Verify settings:
   - Code length: 6 digits (default)
   - Code expiration: 10 minutes (default)
   - Maximum attempts: 3 (default)

## 5. Common Error Messages & Solutions

### Error: "Incorrect verification code"
**Cause:** Typo in code or code expired

**Solution:**
- Double-check the code in your email
- Ensure no spaces before/after the code
- Request a new code if expired (after 10 minutes)

### Error: "Verification code has expired"
**Cause:** Code older than 10 minutes

**Solution:**
- Click "Back to options" and sign up again
- Use the new verification code immediately

### Error: "Sign up expired"
**Cause:** User took too long to verify

**Solution:**
- Click "Back to options"
- Start the sign-up process again

### Error: "Email address not found"
**Cause:** Sign-up was interrupted

**Solution:**
- Start fresh from the beginning
- Complete all steps without interruption

## 6. Test Clerk Configuration

### Create a simple test page:

Create `test-clerk.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <script
    async
    src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
    onload="window.Clerk.load()"
  ></script>
</head>
<body>
  <div id="sign-up"></div>
  <script>
    const clerk = window.Clerk;
    async function testSignUp() {
      try {
        const signUp = await clerk.client.signUp.create({
          emailAddress: 'test@example.com',
          password: 'Test123456!',
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        console.log('✓ Sign up successful!');
        console.log('✓ Verification code sent!');
      } catch (err) {
        console.error('✗ Error:', err);
      }
    }
    clerk.load().then(testSignUp);
  </script>
</body>
</html>
```

Open this file in your browser and check the console.

## 7. Verify Environment Variables

### Check if variables are loaded:

Add this to `app/auth/page.tsx` (temporarily):
```typescript
useEffect(() => {
  console.log('=== ENVIRONMENT CHECK ===');
  console.log('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:', !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  console.log('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY length:', process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.length);
  console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
}, []);
```

Expected output:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: true
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY length: 50-100
NEXT_PUBLIC_API_URL: http://localhost:8081
```

## 8. Clerk Dashboard - Check Test Users

1. Go to **Users** in Clerk Dashboard
2. Look for your test email
3. Check user status:
   - **Pending verification**: User exists but email not verified
   - **Active**: Email verified successfully

If you see many "Pending verification" users, your verification flow has issues.

## 9. Common Coding Mistakes

### Issue 1: Not trimming whitespace
```typescript
// ❌ Wrong
const result = await signUp.attemptEmailAddressVerification({
  code: code, // Might have spaces
});

// ✅ Correct
const trimmedCode = code.trim();
const result = await signUp.attemptEmailAddressVerification({
  code: trimmedCode,
});
```

### Issue 2: Wrong status check
```typescript
// ❌ Wrong
if (result.status === 'success') { ... }

// ✅ Correct
if (result.status === 'complete') { ... }
```

### Issue 3: Not handling all states
```typescript
// ❌ Incomplete
if (result.status === 'complete') {
  // Success
} else {
  setError('Verification failed');
}

// ✅ Complete
if (result.status === 'complete') {
  // Success
} else if (result.status === 'abandoned') {
  // User took too long
} else if (result.status === 'missing_requirements') {
  // Missing fields
} else {
  setError('Unknown error');
}
```

## 10. Next Steps After Fix

Once verification works, test these flows:
- [ ] New user with email → verify → redirected to onboarding
- [ ] Existing user with email → login → redirected to dashboard
- [ ] New user with Google → redirected to onboarding
- [ ] Existing user with Google → redirected to dashboard

## Quick Diagnostic Checklist

- [ ] Clerk publishable key is correct format (not base64)
- [ ] Clerk secret key is correct format
- [ ] Email verification is enabled in Clerk Dashboard
- [ ] Browser console shows "✓ Email verification prepared"
- [ ] Email arrives in inbox (not spam)
- [ ] Code entered has no spaces/extra characters
- [ ] Code is 6 digits
- [ ] Code entered within 10 minutes

## If Still Failing

1. **Create a new Clerk application** - Current app might have misconfiguration
2. **Contact Clerk support** - There might be account-level issues
3. **Try different email** - Specific email might be blocked
4. **Check network requests** - In DevTools Network tab, verify Clerk API calls succeed

## Clerk Support Resources

- Documentation: https://clerk.com/docs
- Support: https://clerk.com/support
- Community: https://clerk.com/community
