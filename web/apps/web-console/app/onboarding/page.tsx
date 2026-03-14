'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    // Tenant is auto-provisioned by the Go backend on first authenticated request.
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#1b1912] text-gray-900 dark:text-[#f6f6f4] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[#000000] dark:border-[#f6f6f4] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-medium">Setting up your account...</p>
      </div>
    </div>
  );
}
