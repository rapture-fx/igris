'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import ThemeToggle from '../../src/components/ui/ThemeToggle'

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle sign-in logic here
    console.log('Sign in:', formData)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Theme Toggle - Fixed position */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>
      
      <div className="flex min-h-screen">
        {/* Left Column - Form */}
        <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20 xl:px-24 bg-white dark:bg-slate-950 transition-colors duration-300">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            {/* Logo */}
            <div className="flex items-center mb-8">
              <img 
                src="/Schlep Engine laest logo design.svg" 
                alt="Schlep Engine - AI-Powered Data Preparation" 
                className="h-10 w-auto"
              />
              <span className="ml-3 text-xl font-bold text-[#1A5799] dark:text-[#468BE6]" style={{fontFamily: '"DM Sans", sans-serif'}}>
                Schlep-engine
              </span>
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-50 mb-2 transition-colors duration-300">
                Welcome back
              </h2>
              <p className="text-gray-600 dark:text-slate-300 transition-colors duration-300">
                Sign in to your account to continue
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 transition-colors duration-300">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1A5799] dark:focus:ring-[#468BE6] focus:border-transparent transition-colors duration-300"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 transition-colors duration-300">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1A5799] dark:focus:ring-[#468BE6] focus:border-transparent transition-colors duration-300"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400 dark:text-slate-500 transition-colors duration-300" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400 dark:text-slate-500 transition-colors duration-300" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-[#1A5799] dark:text-[#468BE6] focus:ring-[#1A5799] dark:focus:ring-[#468BE6] border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded transition-colors duration-300"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-slate-300 transition-colors duration-300">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link
                    href="/forgot-password"
                    className="text-[#1A5799] dark:text-[#468BE6] hover:text-[#154A85] dark:hover:text-[#3a7bd5] transition-colors duration-300"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#1A5799] dark:bg-[#468BE6] hover:bg-[#154A85] dark:hover:bg-[#3a7bd5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A5799] dark:focus:ring-[#468BE6] focus:ring-offset-gray-50 dark:focus:ring-offset-slate-950 transition-colors duration-300"
                >
                  Sign in
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-slate-300 transition-colors duration-300">
                  Don't have an account?{' '}
                  <Link
                    href="/signup"
                    className="text-[#1A5799] dark:text-[#468BE6] hover:text-[#154A85] dark:hover:text-[#3a7bd5] font-medium transition-colors duration-300"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column - Image */}
        <div className="hidden lg:block relative flex-1">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A5799] to-[#468BE6] dark:from-slate-800 dark:to-slate-700 transition-colors duration-300">
            <div className="h-full flex items-center justify-center p-12">
              <div className="text-center text-white">
                {/* Placeholder content - replace with actual image */}
                <div className="w-96 h-96 bg-white/10 rounded-2xl flex items-center justify-center mb-8">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium">Secure Access</p>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4">
                  Transform your data processing workflow
                </h3>
                <p className="text-lg text-white/80 max-w-md">
                  Join thousands of data teams who trust Schlep-engine for their AI-powered data preparation needs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}