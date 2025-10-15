'use client'

import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider } from '@/hooks/useAuth'
import { WebSocketProvider, NotificationToastContainer } from '@schlep-engine/ui'
import { getEnvironmentWebSocketConfig } from '@/lib/websocket'
import { Toaster } from 'sonner'

// WebSocket wrapper that uses auth context
function WebSocketWrapper({ children }: { children: React.ReactNode }) {
  const [authToken, setAuthToken] = useState<string>()
  
  // Get auth token from localStorage/session (simplified for this example)
  React.useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      setAuthToken(token)
    }
  }, [])

  const wsConfig = getEnvironmentWebSocketConfig(authToken)

  return (
    <WebSocketProvider options={wsConfig}>
      {children}
      <NotificationToastContainer position="top-right" maxToasts={3} />
    </WebSocketProvider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketWrapper>
          {children}
          <Toaster position="top-right" richColors />
          <ReactQueryDevtools initialIsOpen={false} />
        </WebSocketWrapper>
      </AuthProvider>
    </QueryClientProvider>
  )
} 