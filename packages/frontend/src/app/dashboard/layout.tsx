'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { useState, useEffect } from 'react'
// import { Toaster } from 'sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showTour, setShowTour] = useState(false)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    // Check if user is new and hasn't completed onboarding
    const token = localStorage.getItem('token')
    if (token) {
      // Get user info from token or make API call
      const userId = 'current-user' // This would come from auth context
      setUserId(userId)
      
      const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${userId}`)
      if (!hasCompletedOnboarding) {
        setShowTour(true)
      }
    }
  }, [])

  const handleTourComplete = () => {
    console.log('Tour completed!')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Guided Tour */}
      <GuidedTour
        isVisible={showTour}
        onClose={() => setShowTour(false)}
        onComplete={handleTourComplete}
        userId={userId}
      />
      
      {/* <Toaster position="top-right" richColors /> */}
    </div>
  )
} 