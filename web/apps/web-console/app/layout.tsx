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
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/auth?mode=signin"
      signUpUrl="/auth?mode=signup"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: '#1b1912',
          colorInputBackground: '#25231e',
          colorInputText: '#f6f6f4',
          colorText: '#f6f6f4',
          colorTextSecondary: '#9CA3AF',
          fontFamily: 'Inter, sans-serif',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className="font-inter antialiased m-0 p-0 bg-[#f3f3f6] dark:bg-[#25231e]" suppressHydrationWarning>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
