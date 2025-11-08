'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalContextType {
  isEarlyAccessModalOpen: boolean;
  openEarlyAccessModal: () => void;
  closeEarlyAccessModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isEarlyAccessModalOpen, setIsEarlyAccessModalOpen] = useState(false);

  const openEarlyAccessModal = () => setIsEarlyAccessModalOpen(true);
  const closeEarlyAccessModal = () => setIsEarlyAccessModalOpen(false);

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
