'use client';

import { useEffect } from 'react';

/**
 * Diagnostic component to identify what's blocking scroll
 */
export function ScrollDiagnostic() {
  useEffect(() => {
    const logScrollBlocker = () => {
      // Check all fixed and absolute positioned elements
      const allElements = document.querySelectorAll('*');
      const blockingElements: Element[] = [];

      allElements.forEach((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Check if element is fixed/absolute and covers viewport
        if (
          (style.position === 'fixed' || style.position === 'absolute') &&
          rect.width > window.innerWidth * 0.9 &&
          rect.height > window.innerHeight * 0.9 &&
          style.pointerEvents !== 'none'
        ) {
          blockingElements.push(el);
        }
      });

      if (blockingElements.length > 0) {
        console.warn('🚫 Elements blocking scroll events:', blockingElements);
        blockingElements.forEach((el) => {
          console.log('Element:', el);
          console.log('Classes:', el.className);
          console.log('Computed style:', {
            position: window.getComputedStyle(el).position,
            pointerEvents: window.getComputedStyle(el).pointerEvents,
            zIndex: window.getComputedStyle(el).zIndex,
          });
        });
      } else {
        console.log('✅ No obvious blocking elements found');
      }

      // Check body styles
      console.log('📄 Body styles:', {
        overflow: document.body.style.overflow,
        overflowY: document.body.style.overflowY,
        classList: Array.from(document.body.classList),
      });
    };

    // Run diagnostic after a delay
    const timeoutId = setTimeout(logScrollBlocker, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  return null;
}
