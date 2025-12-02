'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 md:left-64 right-0 z-40 h-12 border-b border-border-light bg-beige-primary">
        <div className="h-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between">
            {/* Left side - Menu button (mobile only) */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

          </div>
        </div>
      </nav>
  );
}
