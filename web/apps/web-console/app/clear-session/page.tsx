'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';

export default function ClearSessionPage() {
  const router = useRouter();

  useEffect(() => {
    signOut().then(() => {
      router.replace('/auth?mode=signin');
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400">Clearing session...</p>
    </div>
  );
}
