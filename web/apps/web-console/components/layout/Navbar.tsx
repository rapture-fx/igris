'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 md:left-64 right-0 z-40 h-12 bg-background md:pl-12 md:pr-2">
      <div className="h-full px-4 flex items-center md:justify-end">
        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
