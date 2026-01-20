import React from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import { ThemeProvider } from '../src/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'Igris Runtime Docs',
  description: 'Documentation for Igris Runtime - Offline-first AI inference engine with automatic cloud fallback',
  icons: {
    icon: '/img/schlep-logo-34.png',
    shortcut: '/img/schlep-logo-34.png',
    apple: '/img/schlep-logo-34.png'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="m-0 p-0" suppressHydrationWarning>
      <body className="font-inter antialiased m-0 p-0" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
          storageKey="igris-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
