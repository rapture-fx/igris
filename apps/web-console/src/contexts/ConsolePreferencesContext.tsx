'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface ConsolePreferences {
  // Vertical access control
  primary_vertical: 'ai'
  enabled_verticals: string[]
  hidden_verticals: string[]
  
  // Interface complexity
  interface_mode: 'simple' | 'advanced'
  show_cross_vertical_suggestions: boolean
  
  // UI preferences
  collapsed_categories: string[]
  favorite_endpoints: string[]
  recent_endpoints: string[]
  
  // Display settings
  show_beta_endpoints: boolean
  show_deprecated_endpoints: boolean
  group_by_use_case: boolean
}

interface ConsolePreferencesContextType {
  preferences: ConsolePreferences
  updatePreferences: (updates: Partial<ConsolePreferences>) => void
  isVerticalEnabled: (vertical: string) => boolean
  isCategoryVisible: (categoryId: string) => boolean
  addToFavorites: (endpointId: string) => void
  removeFromFavorites: (endpointId: string) => void
  addToRecent: (endpointId: string) => void
  toggleCategoryCollapse: (categoryId: string) => void
  isHydrated: boolean
}

const defaultPreferences: ConsolePreferences = {
  primary_vertical: 'ai',
  enabled_verticals: ['ai', 'data-processing', 'document-extraction'],
  hidden_verticals: ['fintech'], // Hidden by default
  
  interface_mode: 'simple',
  show_cross_vertical_suggestions: true,
  
  collapsed_categories: ['security-compliance', 'dataset-marketplace'],
  favorite_endpoints: [],
  recent_endpoints: [],
  
  show_beta_endpoints: false,
  show_deprecated_endpoints: false,
  group_by_use_case: true
}

const ConsolePreferencesContext = createContext<ConsolePreferencesContextType | undefined>(undefined)

export function ConsolePreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<ConsolePreferences>(defaultPreferences)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    setIsHydrated(true)
    try {
      const stored = localStorage.getItem('schlep-console-preferences')
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferences(prev => ({ ...prev, ...parsed }))
      }
    } catch (error) {
      console.warn('Failed to load console preferences:', error)
    }
  }, [])

  // Save preferences to localStorage when they change (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem('schlep-console-preferences', JSON.stringify(preferences))
      } catch (error) {
        console.warn('Failed to save console preferences:', error)
      }
    }
  }, [preferences, isHydrated])

  const updatePreferences = (updates: Partial<ConsolePreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }))
  }

  const isVerticalEnabled = (vertical: string): boolean => {
    return preferences.enabled_verticals.includes(vertical) && 
           !preferences.hidden_verticals.includes(vertical)
  }

  const isCategoryVisible = (categoryId: string): boolean => {
    // Always show AI core categories
    if (categoryId.startsWith('ai-') || categoryId === 'authentication') {
      return true
    }

    // Check if the category's vertical is enabled
    const verticalMapping: Record<string, string> = {
      'manufacturing-ai': 'manufacturing',
      'ecommerce-ai': 'ecommerce',
      'fintech-ai': 'fintech',
      'data-processing': 'data-processing',
      'document-extraction': 'document-extraction',
      'analytics-monitoring': 'analytics',
      'security-compliance': 'security'
    }

    const vertical = verticalMapping[categoryId]
    return vertical ? isVerticalEnabled(vertical) : true
  }

  const addToFavorites = (endpointId: string) => {
    setPreferences(prev => ({
      ...prev,
      favorite_endpoints: [...new Set([...prev.favorite_endpoints, endpointId])]
    }))
  }

  const removeFromFavorites = (endpointId: string) => {
    setPreferences(prev => ({
      ...prev,
      favorite_endpoints: prev.favorite_endpoints.filter(id => id !== endpointId)
    }))
  }

  const addToRecent = (endpointId: string) => {
    setPreferences(prev => ({
      ...prev,
      recent_endpoints: [
        endpointId,
        ...prev.recent_endpoints.filter(id => id !== endpointId)
      ].slice(0, 10) // Keep only 10 most recent
    }))
  }

  const toggleCategoryCollapse = (categoryId: string) => {
    setPreferences(prev => ({
      ...prev,
      collapsed_categories: prev.collapsed_categories.includes(categoryId)
        ? prev.collapsed_categories.filter(id => id !== categoryId)
        : [...prev.collapsed_categories, categoryId]
    }))
  }

  return (
    <ConsolePreferencesContext.Provider value={{
      preferences,
      updatePreferences,
      isVerticalEnabled,
      isCategoryVisible,
      addToFavorites,
      removeFromFavorites,
      addToRecent,
      toggleCategoryCollapse,
      isHydrated
    }}>
      {children}
    </ConsolePreferencesContext.Provider>
  )
}

export function useConsolePreferences() {
  const context = useContext(ConsolePreferencesContext)
  if (!context) {
    throw new Error('useConsolePreferences must be used within ConsolePreferencesProvider')
  }
  return context
}