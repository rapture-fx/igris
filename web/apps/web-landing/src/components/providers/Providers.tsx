'use client';

import React from 'react';
import { ModalProvider } from '../../contexts/ModalContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      {children}
    </ModalProvider>
  );
}
