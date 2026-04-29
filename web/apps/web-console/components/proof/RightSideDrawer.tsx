'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
} from '@/components/ui/sheet';

export interface RightSideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}

export function RightSideDrawer({ open, onClose, title, subtitle, children }: RightSideDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:w-[720px]">
        <SheetHeader>
          <div className="min-w-0">
            <SheetTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
              {title}
            </SheetTitle>
            {subtitle && (
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <SheetClose onClick={onClose} />
        </SheetHeader>
        <SheetBody className="space-y-6 px-6 py-5">
          {children}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{title}</div>
      {children}
    </div>
  );
}
