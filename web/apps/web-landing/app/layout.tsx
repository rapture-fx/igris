import './globals.css'
import { Providers } from '../src/components/providers/Providers'
import React from 'react'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { GeistPixelSquare } from 'geist/font/pixel'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata = {
  metadataBase: new URL('https://igris.inertial'),
  title: 'Run AI that survives failure',
  description: 'Deploy AI anywhere with a 16MB binary. BYOM (bring your own model). Works offline with fleet dashboard included free. Secure sandboxed execution for edge devices.',
  openGraph: {
    title: 'Run AI that survives failure',
    description: 'Secure AI execution for edge devices. 16MB binary, works offline, fleet dashboard included.',
    url: 'https://igris.inertial',
    siteName: 'Igris Inertial',
    images: [{ url: '/foot2.png', width: 1200, height: 630, alt: 'Igris Inertial logo' }],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Run AI that survives failure',
    description: 'Secure AI execution for edge devices. 16MB binary, works offline, fleet dashboard included.',
    images: ['/foot2.png']
  },
  icons: {
    icon: [
      { url: '/inertia.png', type: 'image/png', sizes: '32x32' }
    ],
    shortcut: '/inertia.png',
    apple: { url: '/inertia.png', sizes: '32x32' },
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable}`} style={{ backgroundColor: '#ffffff' }}>
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#110f0f" media="(prefers-color-scheme: dark)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('igris-theme') || 'light';
                  document.documentElement.classList.add(theme);
                  document.documentElement.style.backgroundColor = theme === 'dark' ? '#110f0f' : '#ffffff';
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning style={{ backgroundColor: '#ffffff' }}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
