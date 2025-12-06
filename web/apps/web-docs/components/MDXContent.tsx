import { ReactNode } from 'react';

interface MDXContentProps {
  children: ReactNode;
}

export function MDXContent({ children }: MDXContentProps) {
  return (
    <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2 prose-p:text-gray-700 prose-p:leading-7 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-ul:my-4 prose-li:my-1 prose-table:border-collapse prose-table:w-full prose-thead:bg-gray-50 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:uppercase prose-th:tracking-wider prose-th:text-gray-700 prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-gray-200">
      {children}
    </div>
  );
}
