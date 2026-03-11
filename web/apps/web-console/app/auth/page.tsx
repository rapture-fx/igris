'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSignUp, useSignIn } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'signin' ? 'signin' : 'signup';
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();

  // Debug logging
  useEffect(() => {
    console.log('=== AUTH PAGE LOADED ===');
    console.log('Mode:', mode);
    console.log('signUpLoaded:', signUpLoaded);
    console.log('signInLoaded:', signInLoaded);
    console.log('Clerk Key Configured:', !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

    // Log available OAuth providers when signIn is loaded
    if (signInLoaded && signIn) {
      console.log('Clerk signIn object ready');
      console.log('Available methods:', Object.keys(signIn).filter(k => k.includes('authenticate')));
    }
  }, [mode, signUpLoaded, signInLoaded, signIn]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded) return;

    setLoading(true);
    setError('');

    // Validation for sign up
    if (mode === 'signup' && (!firstName || !lastName || !email || !password)) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (mode === 'signin' && (!email || !password)) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      console.log('=== SIGN UP START ===');
      console.log('Email:', email);
      console.log('Mode:', mode);

      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      console.log('Sign up result status:', result.status);
      console.log('Sign up created session ID:', result.createdSessionId);

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      console.log('✓ Email verification prepared');
      console.log('✓ Verification code sent to:', email);

      setPendingVerification(true);
    } catch (err: any) {
      console.error('=== SIGN UP ERROR ===');
      console.error('Error:', err);

      const clerkErrors = err.errors || [];
      if (clerkErrors.length > 0) {
        const firstError = clerkErrors[0];
        console.error('Clerk error:', {
          code: firstError.code,
          message: firstError.message,
          longMessage: firstError.longMessage
        });

        if (firstError.code === 'form_password_pwned') {
          setError('This password has been exposed in data breaches. Please choose a different password.');
        } else if (firstError.code === 'form_identifier_exists') {
          setError('An account with this email already exists. Please sign in instead.');
        } else if (firstError.code === 'form_password_length_too_short') {
          setError('Password is too short. It must be at least 8 characters.');
        } else {
          setError(firstError.longMessage || firstError.message || 'An error occurred during sign up');
        }
      } else {
        setError(err.message || 'An error occurred during sign up');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded) return;

    setLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId });
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'oauth_google' | 'oauth_github' | 'oauth_huggingface') => {
    console.log('=== OAUTH FLOW START ===');
    console.log('Provider:', provider);
    console.log('Mode:', mode);
    console.log('Clerk loaded:', { signInLoaded, signUpLoaded });

    if (!signInLoaded || !signIn) {
      console.error('❌ Clerk not ready');
      setError('Please wait a moment and try again.');
      return;
    }

    // Clear any previous errors
    setError('');
    setLoadingProvider(provider);

    console.log('✓ Starting OAuth redirect...');

    // Set up the redirect URL based on mode
    const redirectUrlComplete = mode === 'signup' ? '/onboarding' : '/dashboard';

    // Note: authenticateWithRedirect() will redirect the page
    // It won't return normally, so we don't need try/catch
    // If it throws, it's a real error (like provider not enabled)
    signIn.authenticateWithRedirect({
      strategy: provider,
      redirectUrl: '/sso-callback',
      redirectUrlComplete,
    }).catch((err: any) => {
      console.error('=== OAUTH ERROR ===');
      console.error('Error:', err);

      // Check if this is a "provider not enabled" error
      if (err.errors?.[0]?.code === 'form_identifier_not_found' ||
          err.errors?.[0]?.message?.includes('not enabled') ||
          err.errors?.[0]?.message?.includes('not found')) {
        setError(`${provider.replace('oauth_', '')} is not enabled in Clerk Dashboard. Please enable it first.`);
      } else if (err.errors?.[0]) {
        setError(err.errors[0].longMessage || err.errors[0].message);
      } else {
        setError(err.message || 'OAuth authentication failed');
      }

      setLoadingProvider(null);
      console.error('=== OAUTH ERROR END ===');
    });
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;

    setLoading(true);
    setError('');

    try {
      console.log('=== EMAIL VERIFICATION START ===');
      console.log('Code length:', code.length);
      console.log('Code:', code);

      // Verify the email code
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      console.log('Verification result status:', result.status);

      if (result.status === 'complete') {
        // Set the session as active
        await setActiveSignUp({ session: result.createdSessionId });

        console.log('✓ Email verified successfully');
        console.log('✓ Session activated, redirecting to onboarding');

        router.push('/onboarding');
      } else {
        console.error('Verification incomplete:', result.status);
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      console.error('=== EMAIL VERIFICATION ERROR ===');
      console.error('Error:', err);

      const clerkErrors = err.errors || [];
      if (clerkErrors.length > 0) {
        const firstError = clerkErrors[0];
        console.error('Clerk error:', {
          code: firstError.code,
          message: firstError.message,
        });

        if (firstError.code === 'form_code_incorrect') {
          setError('Incorrect verification code. Please check and try again.');
        } else if (firstError.code === 'verification_expired') {
          setError('Verification code has expired. Please request a new one.');
        } else if (firstError.code === 'form_param_format_invalid') {
          setError('Invalid code format. Please enter the 6-digit code.');
        } else {
          setError(firstError.message || 'Verification failed');
        }
      } else {
        setError(err.message || 'Verification failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative bg-background text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Center the Auth Options */}
      <div className="w-full flex items-center justify-center px-8 py-6 relative z-10">
        <div className="w-full max-w-sm px-8">
          
          {/* Logo - Centered above sign in/up */}
          <div className="flex justify-center mb-20">
            <img
              src="/dmfoot.png"
              alt="Igris Logo"
              style={{ width: '40px', height: 'auto' }}
            />
          </div>
          

          {/* Vertical Auth Buttons */}
          {!showEmailForm && !pendingVerification && (
            <div className="space-y-3">
              {error && (
                <div className="text-xs text-red-600 dark:text-red-400 font-inter bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3 mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={() => handleOAuthSignIn('oauth_google')}
                disabled={loadingProvider !== null}
                className="w-80 flex items-center justify-center gap-3 px-4 py-3.5 border border-gray-300 dark:border-[#f6f6f4]/5 rounded-lg text-sm font-medium text-[#000000] dark:text-[#f6f6f4] font-inter outline-none focus:outline-none focus:ring-0 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-background dark:bg-[#1b1912]"
              >
                {loadingProvider === 'oauth_google' ? (
                  <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <button
                onClick={() => setShowEmailForm(true)}
                disabled={loading}
                className="w-80 flex items-center justify-center gap-3 px-4 py-3.5 border border-border rounded-lg text-sm font-medium text-foreground font-inter outline-none focus:outline-none focus:ring-0 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-background"
              >
                <Mail className="w-5 h-5 flex-shrink-0" />
                <span>Continue with Email</span>
              </button>

              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={() => router.push(mode === 'signup' ? '/auth?mode=signin' : '/auth?mode=signup')}
                  className="text-xs text-muted-foreground font-inter"
                >
                  {mode === 'signup' ? (
                    <>Already have an account? <span className="text-foreground hover:underline">Sign in</span></>
                  ) : (
                    <>Don't have an account? <span className="text-foreground hover:underline">Sign up</span></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Email/Password Form */}
          {showEmailForm && !pendingVerification && (
            <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn} className="space-y-4">
              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="text-xs text-muted-foreground font-inter hover:text-foreground mb-4"
              >
                ← Back to options
              </button>

              {mode === 'signup' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="firstName" className="block text-xs font-medium text-foreground font-inter mb-1.5">
                      First name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required={mode === 'signup'}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm bg-background"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-xs font-medium text-foreground font-inter mb-1.5">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required={mode === 'signup'}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm bg-background"
                      placeholder="Doe"
                    />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-foreground font-inter mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm bg-background"
                  placeholder="you@example.com"
                />
              </div>
              {mode === 'signup' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="password" className="block text-xs font-medium text-foreground font-inter mb-1.5">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm bg-background"
                      placeholder="•••••••••"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-medium text-foreground font-inter mb-1.5">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={mode === 'signup'}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm bg-background"
                      placeholder="•••••••••"
                    />
                  </div>
                </div>
              )}
              {mode === 'signin' && (
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-foreground font-inter mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm bg-background"
                    placeholder="•••••••••"
                  />
                </div>
              )}

              {error && (
                <div className="text-xs text-destructive font-inter bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white py-3 rounded-lg text-sm font-medium font-inter hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                Continue
              </button>
            </form>
          )}

          {/* Verification Form */}
          {pendingVerification && (
            <form onSubmit={handleVerification} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-xs font-medium text-foreground font-inter mb-1.5">
                  Verification code
                </label>
                <p className="text-xs text-muted-foreground font-inter mb-2">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
                </p>
                <p className="text-xs text-muted-foreground font-inter mb-3">
                  Code expires in 10 minutes. Check your spam folder if you don't see it.
                </p>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(e) => {
                    // Only allow numbers, max 6 digits
                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setCode(value);
                  }}
                  required
                  maxLength={6}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm bg-background"
                  placeholder="123456"
                />
              </div>

              {error && (
                <div className="text-xs text-destructive font-inter bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg text-sm font-medium font-inter hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                Verify email
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-muted-foreground font-inter" style={{ fontSize: '9px' }}>
            By signing in, you accept our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}
