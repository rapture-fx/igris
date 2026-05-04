import React from 'react';
import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { docsSearch } from '@/lib/docs-search';
import './globals.css';

export const metadata: Metadata = {
  title: 'Igris Inertial Documentation',
  description: 'Documentation for Igris Inertial, the execution layer for governed and verifiable AI tasks.',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' }
    ],
    shortcut: '/favicon.png',
    apple: { url: '/favicon.png', sizes: '32x32' },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <RootProvider
          theme={{
            enabled: true,
            attribute: 'class',
            defaultTheme: 'dark',
            enableSystem: false,
            disableTransitionOnChange: true,
          }}
          search={docsSearch}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
