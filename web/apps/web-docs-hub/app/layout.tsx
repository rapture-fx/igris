import React from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Igris Inertial Documentation',
  description: 'Documentation for Igris products - Overture and Runtime',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="m-0 p-0" suppressHydrationWarning>
      <body className="font-inter antialiased m-0 p-0" suppressHydrationWarning>{children}</body>
    </html>
  );
}
