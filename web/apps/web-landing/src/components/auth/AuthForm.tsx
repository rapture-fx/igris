'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Loader2, Mail, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { signIn, signUp, authClient } from '../../lib/auth-client';
import { getConsoleUrl } from '../../lib/console-url';

const SANS =
  'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace';

type AuthMode = 'signin' | 'signup' | 'forgot';

function AuthLogo() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && theme === 'dark';
  return (
    <Link href="/" className="inline-flex" aria-label="Igris Inertial home">
      <img
        src={isDark ? '/inertiadm.png' : '/inertia.png'}
        alt="Igris Inertial"
        className="h-8 w-auto rounded-lg"
      />
    </Link>
  );
}

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('signin');

  useEffect(() => {
    const next = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
    setMode((current) => (current === 'forgot' ? current : next));
  }, [searchParams]);
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

  const consoleUrl = getConsoleUrl();

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setPassword('');
    setName('');
    setShowPassword(false);
    setEmailOpen(false);
    setForgotSent(false);
    const params = new URLSearchParams(window.location.search);
    if (next === 'signup') params.set('mode', 'signup');
    else if (next === 'signin') params.set('mode', 'signin');
    else params.delete('mode');
    const qs = params.toString();
    router.replace(qs ? `/auth?${qs}` : '/auth', { scroll: false });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Enter your email address');
      return;
    }
    setForgotLoading(true);
    setError('');
    try {
      const redirectTo = `${consoleUrl}/reset-password`;
      const result = await authClient.requestPasswordReset({ email, redirectTo });
      if (result?.error) {
        setError(result.error.message || 'Failed to send reset email. Please try again.');
        return;
      }
      setForgotSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email. Please try again.';
      setError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const result = await signUp.email({ email, password, name });
        if (result.error) {
          setError(result.error.message || 'Sign up failed');
          return;
        }
        window.location.href = `${consoleUrl}/onboarding`;
      } else {
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message || 'Invalid email or password');
          return;
        }
        window.location.href = `${consoleUrl}/dashboard`;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError('');
    setLoadingProvider(provider);
    try {
      await signIn.social({ provider, callbackURL: `${consoleUrl}/dashboard` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `${provider} sign in failed`;
      setError(message);
      setLoadingProvider(null);
    }
  };

  const inputClass =
    'w-full h-10 rounded-lg border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-[#161515] px-3 text-[13px] text-gray-900 dark:text-[#f6f6f4] placeholder:text-gray-400 dark:placeholder:text-[#6a6a5c] outline-none transition-colors focus:border-gray-400 dark:focus:border-white/[0.22]';
  const oauthClass =
    'w-full h-11 rounded-xl border border-gray-200 dark:border-white/[0.12] bg-[var(--landing-surface)] text-[13px] text-gray-700 dark:text-[#f6f6f4] flex items-center gap-3 px-4 transition-colors hover:border-gray-300 dark:hover:border-white/[0.2] disabled:opacity-50';

  return (
    <div className="min-h-screen igris-grain bg-white dark:bg-[#110f0f] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-[400px]">
        <div className="flex justify-center mb-10">
          <AuthLogo />
        </div>

        {mode !== 'forgot' && (
          <div className="text-center mb-8">
            <h1
              className="text-gray-700 dark:text-[#c8c8b8]"
              style={{
                fontFamily: PIXEL,
                fontWeight: 400,
                fontSize: 'clamp(1.1rem, 2.4vw, 1.5rem)',
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
              }}
            >
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p
              className="mt-3 text-gray-600 dark:text-[#a8a898]"
              style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.55 }}
            >
              {mode === 'signup'
                ? 'Start running governed actions with recovery and proof built in.'
                : 'Sign in to manage actions, receipts, and fleet visibility.'}
            </p>
          </div>
        )}

        {/* Layered bezel card */}
        <div className="relative rounded-[18px] p-[6px] bg-black/[0.03] dark:bg-white/[0.02] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
          <div className="relative rounded-[14px] p-[4px] bg-black/[0.04] dark:bg-white/[0.025] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]">
            <div className="rounded-[12px] overflow-hidden bg-white dark:bg-[#161515] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06)]">
              {mode !== 'forgot' && (
                <div className="flex border-b border-gray-200 dark:border-white/[0.08]">
                  {(['signin', 'signup'] as const).map((tab) => {
                    const active = mode === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => switchMode(tab)}
                        className={`flex-1 py-3.5 text-[11px] font-medium transition-colors ${
                          active
                            ? 'text-gray-900 dark:text-[#f6f6f4] bg-white dark:bg-[#161515]'
                            : 'text-gray-400 dark:text-[#6a6a5c] bg-gray-50/80 dark:bg-[#121110] hover:text-gray-600 dark:hover:text-[#a8a898]'
                        }`}
                        style={{ fontFamily: SANS }}
                      >
                        {tab === 'signin' ? 'Sign in' : 'Sign up'}
                      </button>
                    );
                  })}
                </div>
              )}

              {mode === 'forgot' && (
                <div className="p-6">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-[11px] text-gray-500 dark:text-[#a8a898] hover:text-gray-800 dark:hover:text-[#f6f6f4] mb-5 flex items-center gap-1 transition-colors"
                    style={{ fontFamily: SANS }}
                  >
                    ← Back to sign in
                  </button>
                  <h2
                    className="text-gray-700 dark:text-[#c8c8b8] mb-1"
                    style={{ fontFamily: PIXEL, fontSize: '1rem', fontWeight: 400 }}
                  >
                    Reset your password
                  </h2>
                  <p
                    className="text-[13px] text-gray-500 dark:text-[#a8a898] mb-5"
                    style={{ fontFamily: SANS }}
                  >
                    Enter your email and we will send a reset link.
                  </p>
                  {forgotSent ? (
                    <div
                      className="rounded-lg border border-green-200/80 dark:border-green-800/60 bg-green-50/80 dark:bg-green-950/25 px-4 py-3 text-[12px] text-green-700 dark:text-green-400"
                      style={{ fontFamily: SANS }}
                    >
                      Check your inbox. A reset link has been sent to <strong>{email}</strong>.
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-3">
                      <div className="space-y-1.5">
                        <label htmlFor="forgot-email" className="text-[11px] text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: SANS }}>
                          Email
                        </label>
                        <input
                          id="forgot-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="you@example.com"
                          autoFocus
                          className={inputClass}
                          style={{ fontFamily: SANS }}
                        />
                      </div>
                      {error && <ErrorBanner message={error} />}
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="inline-flex items-center justify-center h-9 px-5 rounded-xl text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                        style={{ fontFamily: SANS }}
                      >
                        {forgotLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                        Send reset link
                      </button>
                    </form>
                  )}
                </div>
              )}

              {mode !== 'forgot' && (
                <div className="p-6 space-y-3">
                  <button type="button" onClick={() => handleOAuth('google')} disabled={!!loadingProvider} className={oauthClass} style={{ fontFamily: SANS }}>
                    {loadingProvider === 'google' ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : (
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                    )}
                    <span className="flex-1 text-center">Continue with Google</span>
                  </button>

                  <button type="button" onClick={() => handleOAuth('github')} disabled={!!loadingProvider} className={oauthClass} style={{ fontFamily: SANS }}>
                    {loadingProvider === 'github' ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : (
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                    )}
                    <span className="flex-1 text-center">Continue with GitHub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmailOpen((v) => !v)}
                    className={`w-full h-11 rounded-xl border text-[13px] font-medium flex items-center gap-3 px-4 transition-colors ${
                      emailOpen
                        ? 'border-gray-400 dark:border-white/[0.22] text-gray-900 dark:text-[#f6f6f4] bg-black/[0.02] dark:bg-white/[0.04]'
                        : 'border-gray-200 dark:border-white/[0.12] text-gray-600 dark:text-[#a8a898] hover:border-gray-300 dark:hover:border-white/[0.18]'
                    }`}
                    style={{ fontFamily: SANS }}
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-center">Continue with Email</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${emailOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {mode === 'signin' && !emailOpen && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-[11px] text-gray-500 dark:text-[#a8a898] hover:text-gray-800 dark:hover:text-[#f6f6f4] underline-offset-2 hover:underline transition-colors"
                        style={{ fontFamily: SANS }}
                      >
                        Forgot your password?
                      </button>
                    </div>
                  )}

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${emailOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <form onSubmit={handleSubmit} className="pt-3 space-y-3">
                      {mode === 'signup' && (
                        <div className="space-y-1.5">
                          <label htmlFor="name" className="text-[11px] text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: SANS }}>
                            Full name
                          </label>
                          <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="Ada Lovelace"
                            autoComplete="name"
                            className={inputClass}
                            style={{ fontFamily: SANS }}
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label htmlFor="email" className="text-[11px] text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: SANS }}>
                          Email
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="you@example.com"
                          autoComplete="email"
                          className={inputClass}
                          style={{ fontFamily: SANS }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor="password" className="text-[11px] text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: SANS }}>
                            Password
                          </label>
                          {mode === 'signin' && (
                            <button
                              type="button"
                              onClick={() => switchMode('forgot')}
                              className="text-[10px] text-gray-500 dark:text-[#a8a898] hover:text-gray-800 dark:hover:text-[#f6f6f4] underline-offset-2 hover:underline"
                              style={{ fontFamily: SANS }}
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Min. 8 characters"
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                            className={`${inputClass} pr-10`}
                            style={{ fontFamily: SANS }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-[#c8c8b8] transition-colors"
                            tabIndex={-1}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {error && <ErrorBanner message={error} />}

                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center justify-center h-9 px-5 rounded-xl text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                        style={{ fontFamily: SANS }}
                      >
                        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                        {mode === 'signup' ? 'Create account' : 'Sign in'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              <div className="px-5 pb-5 pt-1">
                <p className="text-center text-[10px] text-gray-400 dark:text-[#6a6a5c]" style={{ fontFamily: SANS }}>
                  By continuing, you agree to our{' '}
                  <Link href="/terms" className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-[#a8a898]">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-[#a8a898]">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-lg px-3 py-2"
      style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
    >
      {message}
    </p>
  );
}