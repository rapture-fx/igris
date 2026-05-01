import type { Metadata } from 'next';
import { Providers } from '@/lib/providers';
import { Toaster } from '@/components/ui/toaster';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Igris Inertial Developer Console',
  description: 'Manage your AI inference infrastructure with Overture and Runtime',
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
