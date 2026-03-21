'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ModelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Models Error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <div className="max-w-lg w-full rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-sm font-semibold text-red-800 mb-2">Page error</h2>
        <p className="text-xs text-red-700 font-mono bg-red-100 rounded p-3 mb-4 break-all">
          {error.message || 'Unknown error'}
        </p>
        {error.digest && (
          <p className="text-[10px] text-red-500 mb-4">Digest: {error.digest}</p>
        )}
        <Button size="sm" variant="outline" onClick={reset} className="h-7 text-xs">
          Try again
        </Button>
      </div>
    </div>
  );
}
