'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
}

export function Logo({ className, size = 'md', variant = 'default' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  const colorClasses = {
    default: 'text-blue-600',
    white: 'text-white'
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center',
        sizeClasses[size]
      )}>
        <span className="text-white font-bold text-sm">S</span>
      </div>
      <span className={cn(
        'font-bold tracking-tight',
        textSizeClasses[size],
        colorClasses[variant]
      )}>
        Schlep
      </span>
    </div>
  );
} 