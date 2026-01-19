'use client';

import { useEffect } from 'react';

/**
 * Component to ensure body scroll is enabled on mount
 * Fixes issue where modal-open class gets stuck on body
 * Also fixes scroll issues related to theme hydration
 */
export function ScrollFix() {
  useEffect(() => {
    // Force enable scrolling on mount
    const enableScroll = () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.overflowY = 'auto';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overflowY = 'auto';

      // Remove any potential pointer-events blocks
      document.body.style.pointerEvents = '';
      document.body.style.touchAction = '';

      // Force enable CSS properties that might block scroll
      document.body.style.overscrollBehavior = 'auto';
    };

    // Run immediately
    enableScroll();

    // Run after a short delay to catch any late initializations (theme hydration)
    const timeoutId = setTimeout(enableScroll, 150);

    // Also run after theme is loaded (in case it takes longer)
    const laterTimeoutId = setTimeout(enableScroll, 500);

    // Run one more time just to be sure
    const finalTimeoutId = setTimeout(enableScroll, 1000);

    // Also listen for when the page becomes visible (in case of tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        enableScroll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(laterTimeoutId);
      clearTimeout(finalTimeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
