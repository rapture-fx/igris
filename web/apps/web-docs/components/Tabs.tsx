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
    <div className="my-6 border border-gray-200/30 rounded-lg overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200/30 bg-gray-50">
        {tabElements.map((tab: any, index: number) => {
          const label = tab?.props?.label || `Tab ${index + 1}`;
          return (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === index
                  ? 'text-primary border-b-2 border-primary bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-4 bg-white">
        {tabElements[activeTab]}
      </div>
    </div>
  );
}
