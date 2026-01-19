'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface ModalContextType {
  isEarlyAccessModalOpen: boolean;
  openEarlyAccessModal: () => void;
  closeEarlyAccessModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isEarlyAccessModalOpen, setIsEarlyAccessModalOpen] = useState(false);

  const openEarlyAccessModal = useCallback(() => setIsEarlyAccessModalOpen(true), []);
  const closeEarlyAccessModal = useCallback(() => setIsEarlyAccessModalOpen(false), []);

  // Ensure body can scroll on mount and cleanup
  useEffect(() => {
    // Force remove modal-open class on mount
    document.body.classList.remove('modal-open');
    // Ensure overflow is reset
    document.body.style.overflow = '';

    // Cleanup function
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <ModalContext.Provider
      value={{
        isEarlyAccessModalOpen,
        openEarlyAccessModal,
        closeEarlyAccessModal,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
