/**
 * Enhanced Main authentication hook - Now using @schlep-engine/ui auth system
 */
import { AuthProvider as EnhancedAuthProvider, useAuth as useEnhancedAuth } from '@/contexts/AuthContext'
import type { User } from '@schlep-engine/types/auth'

// Re-export for backward compatibility
export { EnhancedAuthProvider as AuthProvider }
export type { User }

// Enhanced useAuth hook with backward compatibility for web-admin
export function useAuth() {
  return useEnhancedAuth()
} 