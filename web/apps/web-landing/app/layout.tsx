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
  title: 'Igris Inertial — Control and Execution Platform for Production LLM Systems',
  description: 'Igris Inertial is a platform combining Overture (control plane) and Runtime (execution plane) for intelligent routing, cost governance, and resilient LLM operations.',
  openGraph: {
    title: 'Igris Inertial',
    description: 'Control and execution platform for production LLM systems.',
    url: 'https://igris.inertial',
    siteName: 'Igris Inertial',
    images: [{ url: '/logo.svg', width: 1200, height: 630, alt: 'Igris Inertial diagram' }],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Igris Inertial',
    description: 'Control and execution platform for production LLM systems.',
    images: ['/logo.svg']
  },
  icons: { 
    icon: '/schlep-logo-34.png',
    shortcut: '/schlep-logo-34.png',
    apple: '/schlep-logo-34.png'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" style={{ backgroundColor: '#f6f6f4' }}>
      <body style={{ backgroundColor: '#f6f6f4' }} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
