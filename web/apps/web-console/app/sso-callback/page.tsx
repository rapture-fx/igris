'use client';

import { useEffect } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function SSOCallback() {
  const { handleRedirectCallback } = useClerk();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    console.log('=== SSO CALLBACK PAGE LOADED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Current URL:', window.location.href);

    const handleOAuthCallback = async () => {
      try {
        console.log('Processing OAuth callback...');
        await handleRedirectCallback();
        console.log('OAuth callback processed successfully');

        // Wait a moment for session to be set
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!isLoaded || !user) {
          console.error('User not loaded after callback');
          window.location.href = '/auth?error=user_not_loaded';
          return;
        }

        // Check if user has completed onboarding
        const userMetadata = user.unsafeMetadata as { onboardingCompleted?: boolean } | undefined;
        const onboardingCompleted = userMetadata?.onboardingCompleted || false;

        console.log('Onboarding completed:', onboardingCompleted);

        if (onboardingCompleted) {
          console.log('Redirecting to /dashboard');
          window.location.href = '/dashboard';
        } else {
          console.log('Redirecting to /onboarding');
          window.location.href = '/onboarding';
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        // If there's an error, redirect to auth page
        window.location.href = '/auth?error=oauth_callback_failed';
      }
    };

    handleOAuthCallback();
  }, [handleRedirectCallback, isLoaded, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-primary">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-900 mx-auto mb-4" />
        <p className="text-sm text-gray-600 font-inter">Completing sign in...</p>
      </div>
    </div>
  );
}
