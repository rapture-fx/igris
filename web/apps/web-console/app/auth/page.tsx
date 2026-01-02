'use client';

import { useState, useEffect } from 'react';
import { useSignUp, useSignIn } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'signin' ? 'signin' : 'signup';

  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

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
    if (!signUpLoaded) return;

    setLoading(true);
    setError('');

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActiveSignUp({ session: completeSignUp.createdSessionId });
        router.push('/onboarding');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Verification failed');
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
    if (!signInLoaded) return;

    try {
      await signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: mode === 'signup' ? '/onboarding' : '/dashboard',
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'OAuth sign in failed');
    }
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

      {/* Left Side - Custom Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-base font-semibold text-gray-900 font-inter mb-2">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-sm text-gray-600 font-inter">
              {mode === 'signup'
                ? 'Get started with Igris Inertial'
                : 'Sign in to your account'}
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => handleOAuthSignIn('oauth_google')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 border border-border-light rounded-lg text-sm font-medium text-gray-900 font-inter focus:outline-none shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#f6f6f4' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>

            <button
              onClick={() => handleOAuthSignIn('oauth_github')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 border border-border-light rounded-lg text-sm font-medium text-gray-900 font-inter focus:outline-none shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#f6f6f4' }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
            </button>

            <button
              onClick={() => handleOAuthSignIn('oauth_huggingface')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 border border-border-light rounded-lg text-sm font-medium text-gray-900 font-inter focus:outline-none shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#f6f6f4' }}
            >
              <img src="/Hugging Face Logo.svg" alt="Hugging Face" className="w-5 h-5" />
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-light"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 text-gray-600 font-inter" style={{ backgroundColor: '#f6f6f4' }}>
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          {!pendingVerification ? (
            <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn} className="space-y-4">
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
                className="w-full bg-gray-900 text-white py-2 rounded-md text-sm font-medium font-inter hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'signup' ? 'Sign up' : 'Sign in'}
              </button>

              <div className="text-center">
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
            </form>
          ) : (
            <form onSubmit={handleVerification} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-xs font-medium text-gray-900 font-inter mb-1.5">
                  Verification code
                </label>
                <p className="text-xs text-gray-600 font-inter mb-2">
                  Enter the verification code sent to {email}
                </p>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
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
                className="w-full bg-gray-900 text-white py-2 rounded-md text-sm font-medium font-inter hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify email
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-gray-600 font-inter" style={{ fontSize: '7px' }}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Right Side - Branding/Content */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-3 sm:p-4 lg:p-6">
        <div
          className="w-full h-full rounded-xl border border-gray-300/60 overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: '#f6f6f4', boxShadow: '0 0 4px rgba(0, 0, 0, 0.08)' }}
        >
          <img
            src="/mnt.png"
            alt="Right column fill"
            className="w-3/4 h-3/4 object-contain opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
