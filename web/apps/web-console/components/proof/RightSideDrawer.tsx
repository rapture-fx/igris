'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/helpers';

export interface RightSideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}

export function RightSideDrawer({ open, onClose, title, subtitle, children }: RightSideDrawerProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed top-2 bottom-2 right-2 z-50',
          'flex flex-col w-full sm:w-[720px] max-w-[calc(100vw-1rem)]',
          'bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden',
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 flex items-center gap-2 flex-wrap">
              {title}
            </div>
            {subtitle && (
              <div className="text-[10px] text-gray-400 mt-0.5 truncate">{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/** Drawer section header — thin monospace label above content */
export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
        {title}
      </div>
      {children}
    </div>
  );
}
