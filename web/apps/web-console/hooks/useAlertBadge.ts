'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { API_BASE_URL } from '@/utils/constants';

/**
 * Tracks the count of open (unacknowledged) policy violation alerts.
 * - On mount: fetches current open count via REST.
 * - Ongoing: subscribes to GET /v1/alerts/stream (SSE) and increments on new alerts.
 * - Resets to 0 when the user navigates to /history/alerts.
 */
export function useAlertBadge(): number {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const esRef = useRef<EventSource | null>(null);

  // Reset badge when the user lands on the alerts page
  useEffect(() => {
    if (pathname === '/history/alerts') {
      setCount(0);
    }
  }, [pathname]);

  // Fetch initial open alert count
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/v1/history/alerts?range=last_24h&limit=200`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (cancelled) return;
        if (!Array.isArray(data)) return;
        const open = data.filter(
          (a: any) => a.status === 'open'
        ).length;
        setCount(open);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Subscribe to SSE stream for real-time increments
  useEffect(() => {
    // Only subscribe outside the alerts page (badge already reset there)
    const url = `${API_BASE_URL}/v1/alerts/stream`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.addEventListener('alert', () => {
      // Only increment if not currently on the alerts page
      if (window.location.pathname !== '/history/alerts') {
        setCount((n) => n + 1);
      }
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return count;
}
