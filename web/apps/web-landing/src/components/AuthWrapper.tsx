'use client'

import React, { Suspense } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

interface AuthWrapperProps {
  children: React.ReactNode
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#468BE6] mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold text-white mb-2">
          Loading...
        </h2>
        <p className="text-gray-300">
          Please wait while we prepare your authentication page.
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