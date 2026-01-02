import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from '@/lib/providers';
import { Toaster } from '@/components/ui/toaster';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Igris Inertial Developer Console',
  description: 'Manage your AI inference infrastructure with Overture and Runtime',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInUrl="/auth?mode=signin"
      signUpUrl="/auth?mode=signup"
      afterSignInUrl="/onboarding"
      afterSignUpUrl="/onboarding"
      afterSignOutUrl="/auth?mode=signup"
      appearance={{
        variables: {
          colorPrimary: '#000000',
          colorBackground: '#f6f6f4',
          colorText: '#000000',
          fontFamily: 'Inter, sans-serif',
        },
      }}
    >
      <html lang="en" className="m-0 p-0" suppressHydrationWarning>
        <body className="font-inter antialiased m-0 p-0" suppressHydrationWarning>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
