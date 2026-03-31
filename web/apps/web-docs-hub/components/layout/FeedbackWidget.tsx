'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

export function FeedbackWidget() {
  const [voted, setVoted] = useState<'yes' | 'no' | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-[#f6f6f4]/10">
        <p className="text-sm text-gray-600 dark:text-[#a8a89a]">
          Thanks for your feedback!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-[#f6f6f4]/10">
      <p className="text-sm font-medium text-gray-700 dark:text-[#c8c8b8] mb-3">
        Was this page helpful?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => { setVoted('yes'); setSubmitted(true); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            voted === 'yes'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
              : 'border-gray-200 dark:border-[#f6f6f4]/10 text-gray-600 dark:text-[#a8a89a] hover:bg-gray-50 dark:hover:bg-[#2c2a22] hover:text-gray-900 dark:hover:text-[#f6f6f4]'
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          Yes
        </button>
        <button
          onClick={() => { setVoted('no'); setSubmitted(true); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            voted === 'no'
              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300'
              : 'border-gray-200 dark:border-[#f6f6f4]/10 text-gray-600 dark:text-[#a8a89a] hover:bg-gray-50 dark:hover:bg-[#2c2a22] hover:text-gray-900 dark:hover:text-[#f6f6f4]'
          }`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          No
        </button>
      </div>
    </div>
  );
}
