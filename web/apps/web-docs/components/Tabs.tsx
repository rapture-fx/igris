'use client';

import { useState, ReactNode } from 'react';

interface TabProps {
  label: string;
  children: ReactNode;
}

export function Tab({ children }: TabProps) {
  return <>{children}</>;
}

interface TabsProps {
  children: ReactNode;
}

export function Tabs({ children }: TabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Extract tab labels and content from children
  const tabs = Array.isArray(children) ? children : [children];
  const tabElements = tabs.filter((child: any) => child?.type === Tab || child?.type?.name === 'Tab');

  return (
    <div className="my-6 border border-gray-200/30 dark:border-[#f6f6f4]/10 rounded-lg overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200/30 dark:border-[#f6f6f4]/10 bg-gray-50 dark:bg-[#25231e]">
        {tabElements.map((tab: any, index: number) => {
          const label = tab?.props?.label || `Tab ${index + 1}`;
          return (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === index
                  ? 'text-primary dark:text-[#3b82f6] border-b-2 border-primary dark:border-[#3b82f6] bg-white dark:bg-[#1b1912]'
                  : 'text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-[#25231e]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-4 bg-white dark:bg-[#1b1912]">
        {tabElements[activeTab]}
      </div>
    </div>
  );
}
