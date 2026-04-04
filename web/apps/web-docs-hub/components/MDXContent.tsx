import { ReactNode } from 'react';

interface MDXContentProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export function MDXContent({ children, fullWidth = false }: MDXContentProps) {
  return (
    <div
      className="prose"
      style={fullWidth ? { maxWidth: 'none', width: '100%' } : undefined}
    >
      {children}
    </div>
  );
}
