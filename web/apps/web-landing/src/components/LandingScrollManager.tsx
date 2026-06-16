'use client';

import { useEffect } from 'react';
import { scrollToLandingSection } from '../lib/landing-sections';

export default function LandingScrollManager() {
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;
      window.setTimeout(() => scrollToLandingSection(hash), 120);
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return null;
}