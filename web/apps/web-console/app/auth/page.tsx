'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { signIn, signUp, authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AuthPage() {
  // AUTH DISABLED FOR LOCAL DEVELOPMENT
  if (typeof window !== 'undefined') {
    window.location.replace('/home');
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
    </div>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  );

  const [emailOpen, setEmailOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState('');

  const switchMode = (next: 'signin' | 'signup' | 'forgot') => {
    setMode(next);
    setError('');
    setPassword('');
    setName('');
    setShowPassword(false);
    setEmailOpen(false);
    setForgotSent(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Enter your email address'); return; }
    setForgotLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const result = await authClient.requestPasswordReset({ email, redirectTo });
      if (result?.error) {
        setError(result.error.message || 'Failed to send reset email. Please try again.');
        setForgotLoading(false);
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
      setForgotLoading(false);
      return;
    }
    setForgotSent(true);
    setForgotLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const result = await signUp.email({ email, password, name });
        if (result.error) { setError(result.error.message || 'Sign up failed'); return; }
        router.replace('/onboarding');
      } else {
        const result = await signIn.email({ email, password });
        if (result.error) { setError(result.error.message || 'Invalid email or password'); return; }
        router.replace('/home');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError('');
    setLoadingProvider(provider);
    try {
      await signIn.social({ provider, callbackURL: '/home' });
    } catch (err: any) {
      setError(err.message || `${provider} sign in failed`);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-12">
          <img src="/inertia.png" alt="Igris" className="h-10 w-auto rounded-lg" />
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden bg-white dark:bg-[#111110]">

          {/* Folder tabs */}
          {mode !== 'forgot' && (
            <div className="flex">
              {(['signin', 'signup'] as const).map((tab) => {
                const active = mode === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => switchMode(tab)}
                    className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                      active
                        ? 'text-gray-900 dark:text-white bg-white dark:bg-[#111110]'
                        : 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-[#191918] hover:text-gray-600 dark:hover:text-gray-400'
                    }`}
                  >
                    {tab === 'signin' ? 'Sign in' : 'Sign up'}
                  </button>
                );
              })}
            </div>
          )}

          {/* Forgot password view */}
          {mode === 'forgot' && (
            <div className="p-6">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-5 flex items-center gap-1"
              >
                ← Back to sign in
              </button>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Reset your password</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
                Enter your email and we'll send a reset link.
              </p>
              {forgotSent ? (
                <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-xs text-green-700 dark:text-green-400">
                  Check your inbox — a reset link has been sent to <strong>{email}</strong>.
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs text-gray-500 dark:text-gray-400">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoFocus
                      className="h-9"
                    />
                  </div>
                  {error && (
                    <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                  <Button type="submit" disabled={forgotLoading} className="h-8 text-xs px-5">
                    {forgotLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Send reset link
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Body */}
          {mode !== 'forgot' && <div className="p-6 space-y-3">

            {/* Google */}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth('google')}
              disabled={!!loadingProvider}
              className="w-full h-12 text-sm gap-3 justify-start px-4"
            >
              {loadingProvider === 'google' ? (
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              ) : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span className="flex-1 text-center">Continue with Google</span>
            </Button>

            {/* GitHub */}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth('github')}
              disabled={!!loadingProvider}
              className="w-full h-12 text-sm gap-3 justify-start px-4"
            >
              {loadingProvider === 'github' ? (
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              ) : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              )}
              <span className="flex-1 text-center">Continue with GitHub</span>
            </Button>

            {/* Email trigger */}
            <button
              type="button"
              onClick={() => setEmailOpen((v) => !v)}
              className={`w-full h-12 rounded-lg border text-sm font-medium flex items-center gap-3 px-4 transition-colors ${
                emailOpen
                  ? 'border-black dark:border-white text-gray-900 dark:text-white bg-black/[0.02] dark:bg-white/[0.04]'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Mail className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-center">Continue with Email</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-white dark:text-[#111110]" />
            </button>

            {/* Forgot password — visible in signin mode even when email accordion is closed */}
            {mode === 'signin' && !emailOpen && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline-offset-2 hover:underline"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            {/* Email form slide */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${emailOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'}`}
              style={{ padding: '0 2px 2px' }}
            >
              <form onSubmit={handleSubmit} className="pt-3 space-y-3">
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs text-gray-500 dark:text-gray-400">Full name</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Ada Lovelace"
                      autoComplete="name"
                      className="h-9"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-gray-500 dark:text-gray-400">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs text-gray-500 dark:text-gray-400">Password</Label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-[9px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline-offset-2 hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="h-9 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <EyeOff className="h-3.5 w-3.5" />
                        : <Eye className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="h-8 text-xs px-5">
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  {mode === 'signup' ? 'Create account' : 'Sign in'}
                </Button>
              </form>
            </div>

          </div>}

          <div className="px-5 pb-4 pt-1">
            <p className="text-center text-[9px] text-gray-400">
              By continuing, you agree to our{' '}
              <a href="#" className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300">Terms</a>
              {' '}and{' '}
              <a href="#" className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300">Privacy Policy</a>.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
