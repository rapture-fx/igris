import { useEffect, useState } from 'react';
import { useApiKey } from '@/hooks/useApiKey';

const STORAGE_KEY = 'igris_onboarding_complete';

/**
 * Determines whether the onboarding modal should be shown.
 *
 * Shows when:
 * - localStorage does not have the completion flag set, AND
 * - the API key query has resolved and the tenant has no key yet
 *
 * We wait for the API key query to settle before deciding so we don't
 * flash the modal for users who already have a key.
 */
export function useOnboarding() {
  const { data: apiKeyInfo, isLoading: apiKeyLoading } = useApiKey();

  // Track whether localStorage says onboarding is done. We read it
  // lazily inside useEffect to avoid SSR mismatches.
  const [storageComplete, setStorageComplete] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setStorageComplete(localStorage.getItem(STORAGE_KEY) !== null);
    } catch {
      // localStorage blocked (private browsing etc.) — treat as incomplete
      setStorageComplete(false);
    }
  }, []);

  const markComplete = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setStorageComplete(true);
  };

  // Still waiting for either localStorage read or the API key query
  if (storageComplete === null || apiKeyLoading) {
    return { shouldShow: false, isReady: false, markComplete };
  }

  // Show only when: storage flag is absent AND no key exists yet
  const shouldShow = !storageComplete && apiKeyInfo?.has_key === false;

  return { shouldShow, isReady: true, markComplete };
}
