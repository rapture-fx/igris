/**
 * Enhanced Sign In Form Component with Elegant UX
 */
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// Validation schema
const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().default(false),
});

type SignInFormData = z.infer<typeof signInSchema>;

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { signIn, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      remember_me: false,
    },
  });

  const watchedEmail = watch('email');
  const watchedPassword = watch('password');

  const onSubmit = async (data: SignInFormData) => {
    try {
      setIsSubmitted(true);
      await signIn(data);
    } catch (error) {
      setIsSubmitted(false);
    }
  };

  const isFormLoading = isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Email Field */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
          Email Address
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <Mail className={`h-5 w-5 transition-colors duration-200 ${
              watchedEmail ? 'text-blue-500' : 'text-gray-400'
            }`} />
          </div>
          <input
            {...register('email')}
            type="email"
            id="email"
            className={`block w-full pl-12 pr-4 py-4 border-2 rounded-xl shadow-sm placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-0 bg-gray-50/50 backdrop-blur-sm ${
              errors.email 
                ? 'border-red-300 focus:border-red-500' 
                : watchedEmail
                ? 'border-blue-300 focus:border-blue-500 bg-blue-50/30'
                : 'border-gray-200 focus:border-blue-400 hover:border-gray-300'
            }`}
            placeholder="Enter your email"
            disabled={isFormLoading}
          />
          {watchedEmail && !errors.email && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          )}
        </div>
        {errors.email && (
          <p className="text-sm text-red-600 flex items-center mt-1 animate-in slide-in-from-left-1 duration-200">
            <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
          Password
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <Lock className={`h-5 w-5 transition-colors duration-200 ${
              watchedPassword ? 'text-blue-500' : 'text-gray-400'
            }`} />
          </div>
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            id="password"
            className={`block w-full pl-12 pr-12 py-4 border-2 rounded-xl shadow-sm placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-0 bg-gray-50/50 backdrop-blur-sm ${
              errors.password 
                ? 'border-red-300 focus:border-red-500' 
                : watchedPassword
                ? 'border-blue-300 focus:border-blue-500 bg-blue-50/30'
                : 'border-gray-200 focus:border-blue-400 hover:border-gray-300'
            }`}
            placeholder="Enter your password"
            disabled={isFormLoading}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-4 flex items-center z-10 hover:scale-110 transition-transform"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isFormLoading}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-600 flex items-center mt-1 animate-in slide-in-from-left-1 duration-200">
            <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between">
        <label className="flex items-center group cursor-pointer">
          <input
            {...register('remember_me')}
            type="checkbox"
            className="sr-only"
            disabled={isFormLoading}
          />
          <div className="relative">
            <div className="w-5 h-5 border-2 border-gray-300 rounded group-hover:border-blue-400 transition-colors"></div>
            <div className="absolute inset-0 w-5 h-5 bg-blue-500 rounded opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <CheckCircle className="absolute inset-0 w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
            Remember me
          </span>
        </label>
        <Link
          href="/auth/forgot-password"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-all"
        >
          Forgot password?
        </Link>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isFormLoading}
        className="group relative w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] transform"
      >
        {isFormLoading ? (
          <>
            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <span>Sign In</span>
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </>
        )}
        
        {/* Button Glow Effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 opacity-0 group-hover:opacity-20 transition-opacity blur-xl"></div>
      </button>

      {/* Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">New to Pollarbase?</span>
        </div>
      </div>

      {/* Sign Up Link */}
      <div className="text-center">
        <Link 
          href="/auth/signup" 
          className="inline-flex items-center px-6 py-3 border-2 border-gray-200 rounded-xl text-base font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 hover:scale-[1.02] transform"
        >
          Create an account
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </form>
  );
} 