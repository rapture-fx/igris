import './globals.css'
import { Providers } from '../src/components/providers/Providers'
import React from 'react'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { GeistPixelSquare } from 'geist/font/pixel'

const fontVariables = `${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable}`

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata = {
  metadataBase: new URL('https://igris.inertial'),
  title: 'Action layer for AI agents.',
  description: 'Your agent calls Igris instead of calling tools directly. Igris checks policy, routes execution, recovers from failures, and proves what happened.',
  openGraph: {
    title: 'Action layer for AI agents.',
    description: 'Your agent calls Igris instead of calling tools directly. Igris checks policy, routes execution, recovers from failures, and proves what happened.',
    url: 'https://igris.inertial',
    siteName: 'Igris Inertial',
    images: [{ url: '/foot2.png', width: 1200, height: 630, alt: 'Igris Inertial logo' }],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Action layer for AI agents.',
    description: 'Your agent calls Igris instead of calling tools directly. Igris checks policy, routes execution, recovers from failures, and proves what happened.',
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
    <html lang="en" suppressHydrationWarning className={fontVariables} style={{ backgroundColor: '#ffffff' }}>
      <head>
        <meta name="theme-color" content="#ffffff" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Geist Light is the single theme for the landing page.
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  document.documentElement.style.backgroundColor = '#ffffff';
                  document.body.style.backgroundColor = '#ffffff';
                  var meta = document.querySelector('meta[name="theme-color"]');
                  if (meta) meta.setAttribute('content', '#ffffff');
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
