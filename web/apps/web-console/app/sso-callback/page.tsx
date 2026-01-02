'use client';

import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SSOCallback() {
  const { handleRedirectCallback } = useClerk();
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await handleRedirectCallback();
        // The redirectUrlComplete from the OAuth flow will handle the final redirect
      } catch (error) {
        console.error('OAuth callback error:', error);
        router.push('/auth?error=oauth_failed');
      }
    };

    handleCallback();
  }, [handleRedirectCallback, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-primary">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-900 mx-auto mb-4" />
        <p className="text-sm text-gray-600 font-inter">Completing sign in...</p>
      </div>
    </div>
  );
}
