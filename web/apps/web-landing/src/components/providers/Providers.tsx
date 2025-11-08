'use client';

import { ModalProvider } from '../../contexts/ModalContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      {children}
    </ModalProvider>
  );
}
