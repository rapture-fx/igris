'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border-light bg-beige-primary">
        <div className="h-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between">
            {/* Left side - Logo and Menu */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <Link href="/dashboard" className="flex items-center">
                <img
                  src="/schlep-logo-34.png"
                  alt="Schlep Logo"
                  className="h-8 w-auto"
                />
              </Link>
            </div>

          </div>
        </div>
      </nav>
  );
}
