'use client';

export const dynamic = 'force-dynamic';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new unified auth page
    router.push('/auth');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-primary">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-sm text-gray-600 font-inter">Redirecting to sign up...</p>
      </div>
    </div>
  );
}
