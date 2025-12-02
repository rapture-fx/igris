'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from './Breadcrumbs';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 md:left-72 right-0 z-40 h-12 bg-beige-primary md:pl-2 md:pr-2">
        <div className="h-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between">
            {/* Left side - Menu button (mobile only) and Breadcrumbs */}
            <div className="flex items-center gap-4 md:gap-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Breadcrumbs />
            </div>

          </div>
        </div>
      </nav>
  );
}
