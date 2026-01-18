'use client';

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { ModalProvider } from '../../contexts/ModalContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ModalProvider>
        {children}
      </ModalProvider>
    </ThemeProvider>
  );
}
