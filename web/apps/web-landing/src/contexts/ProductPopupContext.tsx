'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface ProductPopupContextType {
  isOvertureOpen: boolean;
  isRuntimeOpen: boolean;
  openOverture: () => void;
  closeOverture: () => void;
  openRuntime: () => void;
  closeRuntime: () => void;
  closeAll: () => void;
}

const ProductPopupContext = createContext<ProductPopupContextType | undefined>(undefined);

export function ProductPopupProvider({ children }: { children: ReactNode }) {
  const [isOvertureOpen, setIsOvertureOpen] = useState(false);
  const [isRuntimeOpen, setIsRuntimeOpen] = useState(false);

  const openOverture = useCallback(() => {
    setIsOvertureOpen(true);
    setIsRuntimeOpen(false);
  }, []);

  const closeOverture = useCallback(() => {
    setIsOvertureOpen(false);
  }, []);

  const openRuntime = useCallback(() => {
    setIsRuntimeOpen(true);
    setIsOvertureOpen(false);
  }, []);

  const closeRuntime = useCallback(() => {
    setIsRuntimeOpen(false);
  }, []);

  const closeAll = useCallback(() => {
    setIsOvertureOpen(false);
    setIsRuntimeOpen(false);
  }, []);

  // Handle body scroll lock when popup is open
  useEffect(() => {
    if (isOvertureOpen || isRuntimeOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOvertureOpen, isRuntimeOpen]);

  return (
    <ProductPopupContext.Provider
      value={{
        isOvertureOpen,
        isRuntimeOpen,
        openOverture,
        closeOverture,
        openRuntime,
        closeRuntime,
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
