'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface ProductPopupContextType {
  isOvertureOpen: boolean;
  isRuntimeOpen: boolean;
  isUseCasesOpen: boolean;
  openOverture: () => void;
  closeOverture: () => void;
  openRuntime: () => void;
  closeRuntime: () => void;
  openUseCases: () => void;
  closeUseCases: () => void;
  closeAll: () => void;
}

const ProductPopupContext = createContext<ProductPopupContextType | undefined>(undefined);

export function ProductPopupProvider({ children }: { children: ReactNode }) {
  const [isOvertureOpen, setIsOvertureOpen] = useState(false);
  const [isRuntimeOpen, setIsRuntimeOpen] = useState(false);
  const [isUseCasesOpen, setIsUseCasesOpen] = useState(false);

  const openOverture = useCallback(() => {
    setIsOvertureOpen(true);
    setIsRuntimeOpen(false);
    setIsUseCasesOpen(false);
  }, []);

  const closeOverture = useCallback(() => {
    setIsOvertureOpen(false);
  }, []);

  const openRuntime = useCallback(() => {
    setIsRuntimeOpen(true);
    setIsOvertureOpen(false);
    setIsUseCasesOpen(false);
  }, []);

  const closeRuntime = useCallback(() => {
    setIsRuntimeOpen(false);
  }, []);

  const openUseCases = useCallback(() => {
    setIsUseCasesOpen(true);
    setIsOvertureOpen(false);
    setIsRuntimeOpen(false);
  }, []);

  const closeUseCases = useCallback(() => {
    setIsUseCasesOpen(false);
  }, []);

  const closeAll = useCallback(() => {
    setIsOvertureOpen(false);
    setIsRuntimeOpen(false);
    setIsUseCasesOpen(false);
  }, []);

  // Handle body scroll lock when popup is open
  useEffect(() => {
    if (isOvertureOpen || isRuntimeOpen || isUseCasesOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOvertureOpen, isRuntimeOpen, isUseCasesOpen]);

  return (
    <ProductPopupContext.Provider
      value={{
        isOvertureOpen,
        isRuntimeOpen,
        isUseCasesOpen,
        openOverture,
        closeOverture,
        openRuntime,
        closeRuntime,
        openUseCases,
        closeUseCases,
        closeAll,
      }}
    >
      {children}
    </ProductPopupContext.Provider>
  );
}

export function useProductPopup() {
  const context = useContext(ProductPopupContext);
  if (context === undefined) {
    throw new Error('useProductPopup must be used within a ProductPopupProvider');
  }
  return context;
}
