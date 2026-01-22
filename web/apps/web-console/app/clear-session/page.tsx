'use client';

import { useEffect, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClearSessionPage() {
  const { signOut, session } = useClerk();
  const router = useRouter();
  const [cleared, setCleared] = useState(false);

  const handleClearSession = async () => {
    try {
      await signOut();
      setCleared(true);
      // Also clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      setTimeout(() => {
        router.push('/dashboard?dev=true');
      }, 1500);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-primary dark:bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Clear Clerk Session</CardTitle>
          <CardDescription>
            This will sign you out and clear all authentication cookies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
              <p className="text-foreground">Current session detected</p>
              <p className="text-muted-foreground text-xs mt-1">User ID: {session.user.id}</p>
            </div>
          )}

          {!session && !cleared && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-muted-foreground">
              No active session found
            </div>
          )}

          {cleared && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-sm">
              <p className="text-green-900 dark:text-green-100">Session cleared! Redirecting...</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleClearSession}
              disabled={!session || cleared}
              variant="destructive"
              className="flex-1"
            >
              Clear Session
            </Button>
            <Button
              onClick={() => router.push('/dashboard?dev=true')}
              variant="outline"
              className="flex-1"
            >
              Go to Dashboard
            </Button>
          </div>

          <div className="text-xs text-muted-foreground pt-4 border-t border-border-light dark:border-border">
            <p className="font-medium mb-2">Quick Access:</p>
            <ul className="space-y-1">
              <li>• Dashboard: <a href="/dashboard?dev=true" className="text-blue-600 hover:underline">/dashboard?dev=true</a></li>
              <li>• Auth Page: <a href="/auth?mode=signin" className="text-blue-600 hover:underline">/auth?mode=signin</a></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
