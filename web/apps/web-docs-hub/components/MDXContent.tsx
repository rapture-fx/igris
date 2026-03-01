import { ReactNode } from 'react';

interface MDXContentProps {
  children: ReactNode;
}

export function MDXContent({ children }: MDXContentProps) {
  return (
    <div className="prose max-w-none">
      {children}
    </div>
  );
}
