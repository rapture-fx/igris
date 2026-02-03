'use client';

import React from 'react';
import { useViewMode } from '../contexts/ViewModeContext';
import { User, Bot } from 'lucide-react';

export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewMode();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#f6f6f4] dark:bg-[#1b1912]">
      <div className="max-w-[1300px] mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setViewMode('human')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all duration-200 text-xs font-inter ${
              viewMode === 'human'
                ? 'bg-black dark:bg-[#f6f6f4] text-white dark:text-black'
                : 'bg-gray-100 dark:bg-[#2a2520] text-gray-700 dark:text-[#a8a898] hover:bg-gray-200 dark:hover:bg-[#3a3530]'
            }`}
          >
            <User className="h-3 w-3" />
            Human
          </button>
          <button
            onClick={() => setViewMode('ai-agent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all duration-200 text-xs font-inter ${
              viewMode === 'ai-agent'
                ? 'bg-black dark:bg-[#f6f6f4] text-white dark:text-black'
                : 'bg-gray-100 dark:bg-[#2a2520] text-gray-700 dark:text-[#a8a898] hover:bg-gray-200 dark:hover:bg-[#3a3530]'
            }`}
          >
            <Bot className="h-3 w-3" />
            AI Agent
          </button>
        </div>
      </div>
    </div>
  );
}
