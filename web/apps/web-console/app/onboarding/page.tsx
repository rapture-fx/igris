'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { theme, mounted } = useTheme();

  useEffect(() => {
    const completeOnboarding = async () => {
      if (!isLoaded || !user) return;

      try {
        // Check if already completed
        const metadata = user.unsafeMetadata as { onboardingCompleted?: boolean; intent?: string };

        if (metadata?.onboardingCompleted) {
          // Already completed, redirect to dashboard
          router.replace('/dashboard');
          return;
        }

        // Mark onboarding as completed
        await user.update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            onboardingCompleted: true,
            intent: metadata?.intent || 'hybrid', // Default to hybrid if not set
          },
        });

        console.log('Onboarding marked as completed');

        // Redirect to dashboard
        router.replace('/dashboard');
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
      }
    };

    completeOnboarding();
  }, [isLoaded, user, router]);

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#1b1912] text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 border-4 border-[#000000] dark:border-[#f6f6f4] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#000000] dark:text-[#f6f6f4] font-medium">Setting up your account...</p>
        </div>
      </div>
    </div>
  );
}
