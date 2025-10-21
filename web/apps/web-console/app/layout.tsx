import type { Metadata } from 'next';
import { Providers } from '@/lib/providers';
import { Toaster } from '@/components/ui/toaster';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Schlep-engine Developer Console',
  description: 'Manage your AI inference infrastructure with Schlep-engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-inter antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
