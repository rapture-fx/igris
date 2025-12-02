'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { login } from '@/lib/auth';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login({ email, password });
      toast({
        title: 'Success',
        description: 'Logged in successfully',
        variant: 'success',
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-beige-primary relative">
      {/* Logo */}
      <div className="absolute top-6 left-8 z-10">
        <img
          src="/schlep-logo-34.png"
          alt="Schlep Logo"
          className="h-6 w-auto"
        />
      </div>

      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md" style={{ backgroundColor: '#f6f6f4' }}>
          {/* Login Form */}
          <div className="mb-8">
            <h2 className="text-2xl font-inter mb-3" style={{ color: '#000000' }}>
              Welcome Back
            </h2>
            <p className="text-base text-gray-600 font-inter">
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm mb-2 font-inter" style={{ color: '#000000' }}>
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border font-inter focus:outline-none text-sm"
                style={{ borderColor: 'rgba(156, 163, 175, 0.3)', backgroundColor: '#f6f6f4' }}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm mb-2 font-inter" style={{ color: '#000000' }}>
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg border font-inter focus:outline-none text-sm"
                style={{ borderColor: 'rgba(156, 163, 175, 0.3)', backgroundColor: '#f6f6f4' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center w-full px-6 py-3 text-white rounded-lg transition-all duration-200 font-semibold text-base hover:opacity-90 font-inter disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#000000', minHeight: '40px' }}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 mb-6 flex items-center">
            <div className="flex-1 border-t" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}></div>
            <span className="px-4 text-xs text-gray-600 font-inter">or continue with</span>
            <div className="flex-1 border-t" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}></div>
          </div>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 font-inter text-sm"
              style={{ backgroundColor: '#f6f6f4' }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"/>
                <path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"/>
                <path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"/>
                <path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 font-inter text-sm"
              style={{ backgroundColor: '#f6f6f4' }}
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600 font-inter">Don't have an account? </span>
            <Link
              href="/auth/register"
              className="text-gray-900 hover:underline font-medium font-inter"
            >
              Sign up
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-gray-600 font-inter">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Right Side - Branding/Content */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center py-6 pr-8">
        <div className="w-full h-full rounded-2xl border border-gray-300 flex items-center justify-center overflow-hidden shadow-lg" style={{ backgroundColor: '#f6f6f4' }}>
          <img
            src="/schlep-logo-47.svg"
            alt="Schlep Engine Diagram"
            className="w-full h-full object-cover rotate-90 scale-150"
            style={{ opacity: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
}
