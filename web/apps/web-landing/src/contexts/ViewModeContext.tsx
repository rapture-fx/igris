'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type ViewMode = 'human' | 'ai-agent';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAIAgentMode: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('human');

  const value = {
    viewMode,
    setViewMode,
    isAIAgentMode: viewMode === 'ai-agent',
  };

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}
