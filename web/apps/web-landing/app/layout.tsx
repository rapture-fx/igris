import './globals.css'
import { Providers } from '../src/components/providers/Providers'
import React from 'react'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata = {
  metadataBase: new URL('https://igris.inertial'),
  title: 'Igris Runtime — Secure AI Execution for Edge Devices',
  description: 'Deploy AI anywhere with a 16MB binary. BYOM (bring your own model). Works offline with fleet dashboard included free. Secure sandboxed execution for edge devices.',
  openGraph: {
    title: 'Igris Runtime',
    description: 'Secure AI execution for edge devices. 16MB binary, works offline, fleet dashboard included.',
    url: 'https://igris.inertial',
    siteName: 'Igris Runtime',
    images: [{ url: '/logo.svg', width: 1200, height: 630, alt: 'Igris Runtime diagram' }],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Igris Runtime',
    description: 'Secure AI execution for edge devices. 16MB binary, works offline, fleet dashboard included.',
    images: ['/logo.svg']
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('igris-theme') || 'dark';
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
