'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SignUp() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new unified auth page
    router.replace('/auth')
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p>Redirecting to authentication...</p>
      </div>
    </div>
  )
}