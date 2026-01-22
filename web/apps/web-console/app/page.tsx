'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    console.log('Home page: Redirecting to /dashboard?dev=true');
    // Always redirect with dev=true to bypass auth during development
    router.push('/dashboard?dev=true');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  );
}
