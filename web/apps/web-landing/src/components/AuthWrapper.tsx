'use client'

import React, { Suspense } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

interface AuthWrapperProps {
  children: React.ReactNode
}

function LoadingFallback() {
  return (
    <div className="min-h-screen igris-grain bg-white dark:bg-[#110f0f] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 dark:border-white/[0.12] border-t-gray-600 dark:border-t-[#c8c8b8] mx-auto mb-4" />
        <p
          className="text-[13px] text-gray-500 dark:text-[#a8a898]"
          style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
        >
          Loading...
        </p>
      </div>
    </div>
  )
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}