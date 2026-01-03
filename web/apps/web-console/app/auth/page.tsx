'use client';

import { useState, useEffect } from 'react';
import { useSignUp, useSignIn } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'signin' ? 'signin' : 'signup';

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
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) {
      console.error('Sign up not loaded');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Attempting email verification with code:', code);
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      console.log('Verification response:', completeSignUp);

      if (completeSignUp.status === 'complete') {
        console.log('Verification complete, setting active session');

        // Set the active session
        await setActiveSignUp({ session: completeSignUp.createdSessionId });

        console.log('Session set successfully');

        // Use window.location for a full page redirect to ensure session is picked up
        window.location.href = '/onboarding';
      } else {
        console.log('Verification incomplete, status:', completeSignUp.status);
        setError('Email verification incomplete. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.errors?.[0]?.message || err.message || 'Verification failed');
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

    // Note: authenticateWithRedirect() will redirect the page
    // It won't return normally, so we don't need try/catch
    // If it throws, it's a real error (like provider not enabled)
    signIn.authenticateWithRedirect({
      strategy: provider,
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/onboarding',
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

  return (
    <div className="min-h-screen flex bg-beige-primary relative">
      {/* Logo */}
      <div className="absolute top-6 left-8 z-10">
        <img
          src="/schlep-logo-34.png"
          alt="Igris Logo"
          className="h-6 w-auto"
        />
      </div>

      {/* Center the Auth Options */}
      <div className="w-full flex items-center justify-center px-8 py-6">
        <div className="w-full max-w-sm px-8">
          

          {/* Vertical Auth Buttons */}
          {!showEmailForm && !pendingVerification && (
            <div className="space-y-3">
              {error && (
                <div className="text-xs text-red-600 font-inter bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={() => handleOAuthSignIn('oauth_google')}
                disabled={loadingProvider !== null}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-border-light rounded-lg text-sm font-medium text-gray-900 font-inter outline-none focus:outline-none focus:ring-0 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#f6f6f4' }}
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
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-border-light rounded-lg text-sm font-medium text-gray-900 font-inter outline-none focus:outline-none focus:ring-0 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#f6f6f4' }}
              >
                <Mail className="w-5 h-5 flex-shrink-0" />
                <span>Continue with Email</span>
              </button>

              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={() => router.push(mode === 'signup' ? '/auth?mode=signin' : '/auth?mode=signup')}
                  className="text-xs text-gray-600 font-inter"
                >
                  {mode === 'signup' ? (
                    <>Already have an account? <span className="text-gray-900 hover:underline">Sign in</span></>
                  ) : (
                    <>Don't have an account? <span className="text-gray-900 hover:underline">Sign up</span></>
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
                className="text-xs text-gray-600 font-inter hover:text-gray-900 mb-4"
              >
                ← Back to options
              </button>

              {mode === 'signup' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="firstName" className="block text-xs font-medium text-gray-900 font-inter mb-1.5">
                      First name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required={mode === 'signup'}
                      className="w-full px-3 py-2 border border-border-light rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm"
                      style={{ backgroundColor: '#f6f6f4' }}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-xs font-medium text-gray-900 font-inter mb-1.5">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required={mode === 'signup'}
                      className="w-full px-3 py-2 border border-border-light rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm"
                      style={{ backgroundColor: '#f6f6f4' }}
                      placeholder="Doe"
                    />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-900 font-inter mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border-light rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm"
                  style={{ backgroundColor: '#f6f6f4' }}
                  placeholder="you@example.com"
                />
              </div>
              {mode === 'signup' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="password" className="block text-xs font-medium text-gray-900 font-inter mb-1.5">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-border-light rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm"
                      style={{ backgroundColor: '#f6f6f4' }}
                      placeholder="•••••••••"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-900 font-inter mb-1.5">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={mode === 'signup'}
                      className="w-full px-3 py-2 border border-border-light rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm"
                      style={{ backgroundColor: '#f6f6f4' }}
                      placeholder="•••••••••"
                    />
                  </div>
                </div>
              )}
              {mode === 'signin' && (
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-gray-900 font-inter mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border-light rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm"
                    style={{ backgroundColor: '#f6f6f4' }}
                    placeholder="•••••••••"
                  />
                </div>
              )}

              {error && (
                <div className="text-xs text-red-600 font-inter bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-medium font-inter hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
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
                <label htmlFor="code" className="block text-xs font-medium text-gray-900 font-inter mb-1.5">
                  Verification code
                </label>
                <p className="text-xs text-gray-600 font-inter mb-2">
                  We sent a 6-digit code to <span className="font-medium text-gray-900">{email}</span>
                </p>
                <p className="text-xs text-gray-500 font-inter mb-3">
                  Code expires in 10 minutes. Check your spam folder if you don't see it.
                </p>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={6}
                  className="w-full px-3 py-2 border border-border-light rounded-lg text-sm font-inter focus:outline-none focus:ring-0 shadow-sm"
                  style={{ backgroundColor: '#f6f6f4' }}
                  placeholder="000000"
                />
              </div>

              {error && (
                <div className="text-xs text-red-600 font-inter bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-medium font-inter hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                Verify email
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-gray-600 font-inter" style={{ fontSize: '9px' }}>
            By signing in, you accept our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}
