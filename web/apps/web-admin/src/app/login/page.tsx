/**
 * Enhanced Login Page for Web Admin
 * Using the comprehensive authentication system
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginForm, useAuth } from '@schlep-engine/ui/auth'
import type { AuthCredentials, OAuthProvider } from '@schlep-engine/types/auth'
import { toast } from 'sonner'
import { Building, Shield, Users, BarChart } from 'lucide-react'

// Mock OAuth providers for demo (these would come from backend in production)
const oauthProviders: OAuthProvider[] = [
  {
    name: 'google',
    displayName: 'Google',
    icon: 'mail',
    enabled: true,
    scopes: ['email', 'profile']
  },
  {
    name: 'github',
    displayName: 'GitHub',
    icon: 'github',
    enabled: true,
    scopes: ['user:email']
  }
]

const features = [
  {
    icon: <BarChart className="h-6 w-6 text-blue-600" />,
    title: 'Analytics Dashboard',
    description: 'Comprehensive insights into your data processing workflows'
  },
  {
    icon: <Users className="h-6 w-6 text-green-600" />,
    title: 'User Management',
    description: 'Manage team access and permissions across your organization'
  },
  {
    icon: <Shield className="h-6 w-6 text-purple-600" />,
    title: 'Security Controls',
    description: 'Enterprise-grade security with MFA and audit logs'
  },
  {
    icon: <Building className="h-6 w-6 text-orange-600" />,
    title: 'Organization Tools',
    description: 'Multi-tenant support with role-based access control'
  }
]

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Get redirect URL from query params
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isAuthenticated, isLoading, router, redirectTo])

  // Handle form submission
  const handleLogin = async (credentials: AuthCredentials) => {
    setIsSubmitting(true)
    try {
      await login(credentials)
      toast.success('Login successful!')
      router.push(redirectTo)
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
      throw error // Let the form handle the error display
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle OAuth login
  const handleOAuthLogin = async (provider: string) => {
    try {
      toast.info(`Connecting to ${provider}...`)
      // In a real implementation, this would trigger the OAuth flow
      // For now, we'll show a message
      toast.info('OAuth integration coming soon!')
    } catch (error: any) {
      toast.error(`Failed to connect with ${provider}`)
      throw error
    }
  }

  // Handle forgot password
  const handleForgotPassword = () => {
    router.push('/forgot-password')
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Building className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-900">Schlep Engine</h1>
                <p className="text-sm text-gray-500">Admin Dashboard</p>
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Access your admin dashboard to manage data processing workflows
            </p>
          </div>

          <div className="mt-8">
            <LoginForm
              onSubmit={handleLogin}
              onOAuthLogin={handleOAuthLogin}
              onForgotPassword={handleForgotPassword}
              isLoading={isSubmitting}
              showRememberMe={true}
              showOAuth={true}
              oauthProviders={oauthProviders}
              redirectTo={redirectTo}
            />
          </div>

          <div className="mt-8">
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button
                  onClick={() => router.push('/register')}
                  className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors"
                >
                  Contact your administrator
                </button>
              </p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <strong>Secure Access:</strong> All connections are encrypted and monitored. 
                Multi-factor authentication is required for admin accounts.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Features */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
          <div className="absolute inset-0 bg-black opacity-20"></div>
          <div className="relative h-full flex flex-col justify-center px-12 text-white">
            <div className="max-w-md">
              <h2 className="text-3xl font-bold mb-6">
                Powerful Admin Tools
              </h2>
              <p className="text-xl text-blue-100 mb-8">
                Manage your data processing workflows with enterprise-grade tools and insights.
              </p>
              
              <div className="space-y-6">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 p-2 bg-white bg-opacity-20 rounded-lg">
                      {feature.icon}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-white">
                        {feature.title}
                      </h3>
                      <p className="text-blue-100 text-sm">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 p-4 bg-white bg-opacity-10 rounded-lg border border-white border-opacity-20">
                <p className="text-sm text-blue-100">
                  <strong>Enterprise Ready:</strong> SOC 2 compliant with 99.9% uptime SLA. 
                  Your data is secure and always available.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}