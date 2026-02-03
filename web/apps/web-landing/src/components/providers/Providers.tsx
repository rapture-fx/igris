'use client';

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { ModalProvider } from '../../contexts/ModalContext';
import { ProductPopupProvider } from '../../contexts/ProductPopupContext';
import { ViewModeProvider } from '../../contexts/ViewModeContext';
import { ScrollFix } from './ScrollFix';

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
        <ProductPopupProvider>
          <ViewModeProvider>
            <ScrollFix />
            {children}
          </ViewModeProvider>
        </ProductPopupProvider>
      </ModalProvider>
    </ThemeProvider>
  );
}
