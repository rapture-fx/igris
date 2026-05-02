'use client';

import React from 'react';
import { useViewMode } from '../contexts/ViewModeContext';
import { User, Bot } from 'lucide-react';

export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewMode();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-2 bg-white/80 dark:bg-[#110f0f]/80 backdrop-blur-sm px-3 py-2 rounded-md shadow-lg border border-gray-200 dark:border-[#f6f6f4]/10">
          <button
            onClick={() => setViewMode('human')}
            className={`px-3 py-1.5 transition-all duration-200 text-xs font-inter ${
              viewMode === 'human'
                ? 'text-black dark:text-[#f6f6f4] font-semibold'
                : 'text-gray-500 dark:text-[#6a6a60] hover:text-gray-700 dark:hover:text-[#a8a898]'
            }`}
          >
            HUMAN
          </button>
          <button
            onClick={() => setViewMode('ai-agent')}
            className={`px-3 py-1.5 transition-all duration-200 text-xs font-inter ${
              viewMode === 'ai-agent'
                ? 'text-black dark:text-[#f6f6f4] font-semibold'
                : 'text-gray-500 dark:text-[#6a6a60] hover:text-gray-700 dark:hover:text-[#a8a898]'
            }`}
          >
            AI
          </button>
      </div>
    </div>
  );
}
