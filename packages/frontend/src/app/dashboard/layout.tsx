'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
// import { Toaster } from 'sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    if (user?.id) {
      const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.id}`)
      if (!hasCompletedOnboarding) {
        setShowTour(true)
      }
    }
  }, [user])

  const handleTourComplete = () => {
    console.log('Tour completed!')
    if (user?.id) {
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true')
      setShowTour(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        {/* You can replace this with a proper skeleton loader */}
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">
          {/* Remove padding/container from layout - let pages handle their own spacing */}
            {children}
        </main>
      </div>
      
      {/* Guided Tour */}
      <GuidedTour
        isVisible={showTour}
        onClose={() => setShowTour(false)}
        onComplete={handleTourComplete}
        userId={user?.id || ''}
      />
      
      {/* <Toaster position="top-right" richColors /> */}
    </div>
  )
} 