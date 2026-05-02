'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ClientChartProps {
  children: ReactElement;
  width?: string | number;
  height: string | number;
  fallbackClassName?: string;
}

export function ClientChart({
  children,
  width = '100%',
  height,
  fallbackClassName,
}: ClientChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={fallbackClassName}
        style={{ width: typeof width === 'number' ? `${width}px` : width, height }}
      />
    );
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      {children}
    </ResponsiveContainer>
  );
}
