'use client';

import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function SSOCallback() {
  const { handleRedirectCallback } = useClerk();

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
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('Redirecting to /onboarding');
        window.location.href = '/onboarding';
      } catch (error) {
        console.error('OAuth callback error:', error);
        // If there's an error, redirect to auth page
        window.location.href = '/auth?error=oauth_callback_failed';
      }
    };

    handleOAuthCallback();
  }, [handleRedirectCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-primary">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-900 mx-auto mb-4" />
        <p className="text-sm text-gray-600 font-inter">Completing sign in...</p>
      </div>
    </div>
  );
}
