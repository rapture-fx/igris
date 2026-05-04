import type { Metadata } from 'next';
import { Providers } from '@/lib/providers';
import { Toaster } from '@/components/ui/toaster';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Igris Inertial Developer Console',
  description: 'Operator console for Igris execution runs, events, signed records, and environment visibility.',
  icons: { icon: '/inertia.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-inter antialiased m-0 p-0 bg-background text-foreground"
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
