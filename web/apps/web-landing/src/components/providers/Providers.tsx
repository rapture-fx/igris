'use client';

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { ModalProvider } from '../../contexts/ModalContext';
import { ScrollFix } from './ScrollFix';
import { ScrollDiagnostic } from './ScrollDiagnostic';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="igris-theme"
    >
      <ModalProvider>
        <ScrollFix />
        <ScrollDiagnostic />
        {children}
      </ModalProvider>
    </ThemeProvider>
  );
}
