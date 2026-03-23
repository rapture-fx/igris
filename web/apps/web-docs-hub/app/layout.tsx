import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../src/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'Igris Inertial Documentation',
  description: 'Documentation for Igris products - Overture and Runtime',
  icons: {
    icon: [
      { url: '/inertia.png', type: 'image/png', sizes: '32x32' }
    ],
    shortcut: '/inertia.png',
    apple: { url: '/inertia.png', sizes: '32x32' },
  },
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
          defaultTheme="light"
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
