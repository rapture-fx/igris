'use client';

import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export function Logo({ 
  className = '', 
  width = 40, 
  height = 40, 
  alt = 'Pollarbase Logo' 
}: LogoProps) {
  return (
    <Image
      src="/new-logo.svg"
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}

export default Logo; 